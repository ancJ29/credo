import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  ATTEMPTS,
  addDays,
  byCode,
  cancelRequestSchema,
  customerSchema,
  type DeliveryDoc,
  type DeliveryRequest,
  deliverRequestSchema,
  deliveryPhotoReplySchema,
  deliveryRequestSchema,
  deliveryRoutes,
  type Driver,
  daySchema,
  documentNumberingSchema,
  layersOf,
  newestOrdersFirst,
  ORDER_LIST_DAYS,
  ORDER_PREFIX,
  type Order,
  type OrderDoc,
  orderRoutes,
  orderSchema,
  priceLines,
  productSchema,
  recordKeys,
  REQUEST_PREFIX,
  resolvePermissions,
  ROUTES,
  numberText,
  firstSaveOrderRequestSchema,
  resaveOrderRequestSchema,
  saveOrderRequestSchema,
  sendableOn,
  sendOrderRequestSchema,
  employeeSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { declare, personOf } from '../audit';
import { HttpError, parse } from '../errors';
import { parsed, recordTools, type TenantStorage } from '../records/records';
import { readSetup } from '../records/staff-records';
import type { Deps } from './staff';

const conflict = (current: unknown) => new HttpError(409, 'Conflict', { current });
const notFound = () => new HttpError(404, 'Not found');
const forbidden = () => new HttpError(403, 'Forbidden');

const idSchema = z.uuid();

/** The orders' and the delivery requests' routes. An order and a request are each one record under
 * their day and id; confirm and send write the order first and then the request, and cancel writes
 * the request first, so a stop between leaves a state the next read shows as it is: an order that
 * names a request which is not there, or not waiting, reads as having none. */
export function registerOrderRoutes(app: FastifyInstance, deps: Deps) {
  const { now, forClient, signedIn, mustCan } = deps;

  /** A request, with its tag. */
  async function readRequest(storage: TenantStorage, day: string, id: string) {
    const found = await storage.getRecord(recordKeys.tenant(storage.tenantId).delivery(day, id));
    return found
      ? { request: parsed(deliveryRequestSchema, 'a delivery request', found), tag: found.tag }
      : null;
  }

  /** The order as the page shows it, given the request it names (if that is there): the request
   * only while it waits or is delivered, and a confirmed order whose request is delivered reads
   * fulfilled, whether or not the write that fulfils it was made. */
  const asShown = (order: Order, live: DeliveryRequest | undefined): Order => {
    if (!order.request) return order;
    if (live?.state === 'waiting') return order;
    if (live?.state === 'delivered') {
      return order.state === 'confirmed' ? { ...order, state: 'fulfilled' } : order;
    }
    return { ...order, request: null };
  };

  async function shown(storage: TenantStorage, order: Order): Promise<Order> {
    if (!order.request) return order;
    const live = await readRequest(storage, order.request.day, order.request.id);
    return asShown(order, live?.request);
  }

  async function readOrder(storage: TenantStorage, day: string, id: string) {
    const found = await storage.getRecord(recordKeys.tenant(storage.tenantId).order(day, id));
    return found ? { order: parsed(orderSchema, 'an order', found), tag: found.tag } : null;
  }

  /** The order named by the route, or a 404. */
  async function mustFindOrder(request: FastifyRequest) {
    const { day, id } = request.params as { day: string; id: string };
    if (!daySchema.safeParse(day).success || !idSchema.safeParse(id).success) throw notFound();
    const found = await readOrder(request.storage, day, id);
    if (!found) throw notFound();
    return found;
  }

  async function mustFindRequest(request: FastifyRequest) {
    const { day, id } = request.params as { day: string; id: string };
    if (!daySchema.safeParse(day).success || !idSchema.safeParse(id).success) throw notFound();
    const found = await readRequest(request.storage, day, id);
    if (!found) throw notFound();
    return found;
  }

  const orderDoc = async (storage: TenantStorage, day: string, id: string): Promise<OrderDoc> => {
    const found = (await readOrder(storage, day, id)) as NonNullable<
      Awaited<ReturnType<typeof readOrder>>
    >;
    return { order: await shown(storage, found.order), version: found.tag };
  };

  const requestDoc = async (
    storage: TenantStorage,
    day: string,
    id: string,
  ): Promise<DeliveryDoc> => {
    const found = (await readRequest(storage, day, id)) as NonNullable<
      Awaited<ReturnType<typeof readRequest>>
    >;
    return { request: found.request, version: found.tag };
  };

  /** The next number of a kind, raised in the numbering record over the tag it was read at before
   * any record carries it; a record that moved is read again, a few times at most (503). A number
   * lost to a failed write is never given again. */
  async function nextNumber(storage: TenantStorage, kind: 'orders' | 'requests') {
    const key = recordKeys.tenant(storage.tenantId).documentNumbering;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const found = await storage.getRecord(key);
      const held = found
        ? parsed(documentNumberingSchema, 'the numbering', found)
        : { orders: 0, requests: 0 };
      const given = held[kind] + 1;
      const saved = await storage.putRecord(key, { ...held, [kind]: given }, found?.tag ?? null);
      if (saved === 'saved') return given;
    }
    throw new HttpError(503, 'Service unavailable');
  }

  /** The customer and the lines of a save, priced by the app: each read by its key, the customer and
   * each distinct product the save names and no more. An id the company lacks, or a total too large,
   * is a 400. */
  async function priced(storage: TenantStorage, body: z.infer<typeof saveOrderRequestSchema>) {
    const keys = recordKeys.tenant(storage.tenantId);
    const found = await storage.getRecord(keys.customer(body.customerId));
    const customer = found ? parsed(customerSchema, 'a customer', found) : undefined;
    const products = (
      await Promise.all(
        [...new Set(body.lines.map((line) => line.productId))].map((id) =>
          storage.getRecord(keys.product(id)),
        ),
      )
    )
      .filter((stored) => stored !== null)
      .map((stored) => parsed(productSchema, 'a product', stored));
    const lines = priceLines(body.lines, products);
    if (!customer || lines.kind !== 'priced') {
      throw new HttpError(400, 'Bad request', { details: 'a customer and products of the lists' });
    }
    return { customer, lines: lines.lines, total: lines.total };
  }

  /** The people the office may name as a driver: not left, and allowed to deliver by their layers. */
  async function driversOf(storage: TenantStorage): Promise<Driver[]> {
    const read = await readSetup(storage, storage.tenantId);
    const people = await recordTools(storage).every(
      recordKeys.tenant(storage.tenantId).employeePrefix,
      employeeSchema,
      'employee',
    );
    return people
      .map((one) => one.record)
      .filter(
        (person) =>
          !person.archived &&
          resolvePermissions(
            layersOf(read.setup, {
              departmentId: person.department?.id,
              positionId: person.position?.id,
              own: person.permissions,
            }),
          )['deliveries.canDeliver'],
      )
      .map(({ id, code, name }) => ({ id, code, name }))
      .sort(byCode);
  }

  app.get(ROUTES.orders, forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canView');
    const query = parse(
      z
        .strictObject({ from: daySchema, to: daySchema })
        .refine(
          ({ from, to }) => from <= to && addDays(from, ORDER_LIST_DAYS - 1) >= to,
          'at most 7 days, in order',
        ),
      request.query,
    );
    const orders: Order[] = [];
    for (let day = query.from; day <= query.to; day = addDays(day, 1)) {
      const dayList = await recordTools(request.storage).every(
        recordKeys.tenant(request.tenantId).orderDayPrefix(day),
        orderSchema,
        'order',
      );
      orders.push(...dayList.map((one) => one.record));
    }
    // A request is looked up once for each day orders name, not once for each order.
    const days = [...new Set(orders.flatMap((one) => (one.request ? [one.request.day] : [])))];
    const lives = new Map<string, DeliveryRequest>();
    for (const day of days) {
      const dayList = await recordTools(request.storage).every(
        recordKeys.tenant(request.tenantId).deliveryDayPrefix(day),
        deliveryRequestSchema,
        'delivery request',
      );
      for (const { record } of dayList) lives.set(record.id, record);
    }
    const shownOrders = orders.map((one) => asShown(one, lives.get(one.request?.id ?? '')));
    return { orders: shownOrders.sort(newestOrdersFirst) };
  });

  app.post(
    ROUTES.orders,
    { ...forClient, config: { audit: 'order.create' } },
    async (request, reply) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who));
      mustCan(who, 'orders.canEdit');
      const body = parse(firstSaveOrderRequestSchema, request.body);
      const { customer, lines, total } = await priced(request.storage, body);
      const given = await nextNumber(request.storage, 'orders');
      const order: Order = {
        id: randomUUID(),
        number: numberText(ORDER_PREFIX, given),
        day: body.day,
        state: 'draft',
        customer,
        lines,
        total,
        request: null,
        madeAt: now(),
        extra: body.extra,
      };
      await recordTools(request.storage).writeNew(
        recordKeys.tenant(request.tenantId).order(order.day, order.id),
        order,
      );
      entry.target(order.id);
      entry.saved(null, order);
      return reply.status(201).send(await orderDoc(request.storage, order.day, order.id));
    },
  );

  app.get(orderRoutes.one(':day', ':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canView');
    const { order, tag } = await mustFindOrder(request);
    return { order: await shown(request.storage, order), version: tag };
  });

  app.put(
    orderRoutes.one(':day', ':id'),
    { ...forClient, config: { audit: 'order.save' } },
    async (request) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who), (request.params as { id: string }).id);
      mustCan(who, 'orders.canEdit');
      const body = parse(resaveOrderRequestSchema, request.body);
      const found = await mustFindOrder(request);
      const { day, id } = found.order;
      if (body.day !== day)
        throw new HttpError(400, 'Bad request', { details: 'day: the order’s own' });
      if (found.tag !== body.version || found.order.state !== 'draft') {
        throw conflict(await orderDoc(request.storage, day, id));
      }
      const { customer, lines, total } = await priced(request.storage, body);
      const changed: Order = { ...found.order, customer, lines, total, extra: body.extra };
      const key = recordKeys.tenant(request.tenantId).order(day, id);
      let outcome: 'saved' | 'moved';
      try {
        outcome = await request.storage.putRecord(key, changed, found.tag);
      } catch (error) {
        // The write may have landed with its answer lost: the record stored is exactly the one built
        // here, state and request included, or the failure stands. A rival's confirm differs in both.
        // a re-read that fails too leaves the write's failure standing, as the lists' recovery does
        const stored = await readOrder(request.storage, day, id).catch(() => null);
        if (stored !== null && isDeepStrictEqual(stored.order, changed)) {
          entry.saved(found.order, changed);
          return await orderDoc(request.storage, day, id);
        }
        throw error;
      }
      if (outcome === 'moved') throw conflict(await orderDoc(request.storage, day, id));
      entry.saved(found.order, changed);
      return await orderDoc(request.storage, day, id);
    },
  );

  /** The request a confirm or a send makes, after the order that names it. The driver must be
   * there, not left and allowed to deliver, and the day not before the order's (400). */
  async function issue(request: FastifyRequest, confirming: boolean) {
    const who = await signedIn(request);
    const entry = declare(request, personOf(who), (request.params as { id: string }).id);
    mustCan(who, 'orders.canEdit');
    const body = parse(sendOrderRequestSchema, request.body);
    const found = await mustFindOrder(request);
    const { order } = found;
    const current = await shown(request.storage, order);
    const allowed = confirming
      ? order.state === 'draft'
      : order.state === 'confirmed' && current.request === null;
    if (found.tag !== body.version || !allowed) {
      throw conflict({ order: current, version: found.tag });
    }
    const driver = (await driversOf(request.storage)).find((one) => one.id === body.driverId);
    if (!driver || !sendableOn(order.day, body.day)) {
      throw new HttpError(400, 'Bad request', {
        details: 'a driver who delivers, on or after the order’s day',
      });
    }
    const keys = recordKeys.tenant(request.tenantId);
    // A driver whose day is closed is sent nothing more for it.
    if (await request.storage.getRecord(keys.reconciliation(body.day, driver.id))) {
      throw new HttpError(400, 'Bad request', {
        details: 'a driver whose day is not closed for that day',
      });
    }
    const made: DeliveryRequest = {
      id: randomUUID(),
      number: numberText(REQUEST_PREFIX, await nextNumber(request.storage, 'requests')),
      day: body.day,
      state: 'waiting',
      driver,
      order: { id: order.id, day: order.day, number: order.number },
      customer: order.customer,
      lines: order.lines,
      total: order.total,
      madeAt: now(),
      extra: {},
    };
    const link = { id: made.id, number: made.number, day: made.day, driver };
    const confirmed: Order = { ...order, state: 'confirmed', request: link };
    if (
      (await request.storage.putRecord(keys.order(order.day, order.id), confirmed, found.tag)) ===
      'moved'
    ) {
      throw conflict(await orderDoc(request.storage, order.day, order.id));
    }
    await recordTools(request.storage).writeNew(keys.delivery(made.day, made.id), made);
    entry.saved(order, confirmed);
    return await orderDoc(request.storage, order.day, order.id);
  }

  app.post(
    orderRoutes.confirm(':day', ':id'),
    { ...forClient, config: { audit: 'order.confirm' } },
    (request) => issue(request, true),
  );
  app.post(
    orderRoutes.send(':day', ':id'),
    { ...forClient, config: { audit: 'order.send' } },
    (request) => issue(request, false),
  );

  app.post(
    orderRoutes.cancel(':day', ':id'),
    { ...forClient, config: { audit: 'order.cancel' } },
    async (request) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who), (request.params as { id: string }).id);
      mustCan(who, 'orders.canEdit');
      const body = parse(cancelRequestSchema, request.body);
      const found = await mustFindOrder(request);
      const { order } = found;
      const live = order.request
        ? await readRequest(request.storage, order.request.day, order.request.id)
        : null;
      // A fulfilled order, or a confirmed one whose request is delivered, is not cancelled.
      if (
        found.tag !== body.version ||
        order.state === 'cancelled' ||
        order.state === 'fulfilled' ||
        live?.request.state === 'delivered'
      ) {
        throw conflict(await orderDoc(request.storage, order.day, order.id));
      }
      const keys = recordKeys.tenant(request.tenantId);
      // The request is cancelled first, then the order: a stop between leaves a confirmed order whose
      // request is cancelled, which reads as having none.
      if (live?.request.state === 'waiting') {
        const key = keys.delivery(live.request.day, live.request.id);
        await request.storage.putRecord(key, { ...live.request, state: 'cancelled' }, live.tag);
      }
      const cancelled: Order = { ...order, state: 'cancelled', request: null };
      if (
        (await request.storage.putRecord(keys.order(order.day, order.id), cancelled, found.tag)) ===
        'moved'
      ) {
        throw conflict(await orderDoc(request.storage, order.day, order.id));
      }
      entry.saved(order, cancelled);
      return await orderDoc(request.storage, order.day, order.id);
    },
  );

  app.get(ROUTES.deliveries, forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canView');
    const query = parse(z.strictObject({ day: daySchema }), request.query);
    const dayList = await recordTools(request.storage).every(
      recordKeys.tenant(request.tenantId).deliveryDayPrefix(query.day),
      deliveryRequestSchema,
      'delivery request',
    );
    const deliveries = dayList
      .map((one) => one.record)
      .sort(
        (a, b) => a.driver.code.localeCompare(b.driver.code) || a.number.localeCompare(b.number),
      );
    return { deliveries };
  });

  /** Who may read a request and its photo: those who may see orders, and the request's own driver
   * (allowed to deliver, never the root); anyone else is a 403 before anything is looked for. */
  async function mustReadRequest(request: FastifyRequest) {
    const who = await signedIn(request);
    const office = who.root || who.permissions['orders.canView'];
    if (!office) mustCan(who, 'deliveries.canDeliver');
    const found = await mustFindRequest(request);
    if (!office && found.request.driver.id !== who.employeeId) throw forbidden();
    return found;
  }

  app.get(deliveryRoutes.one(':day', ':id'), forClient, async (request) => {
    const { request: found, tag } = await mustReadRequest(request);
    return { request: found, version: tag };
  });

  app.get(deliveryRoutes.photo(':day', ':id'), forClient, async (request) => {
    const { request: found } = await mustReadRequest(request);
    const stored =
      found.state === 'delivered'
        ? await request.storage.getRecord(
            recordKeys.tenant(request.tenantId).deliveryPhoto(found.day, found.id),
          )
        : null;
    if (!stored) throw notFound();
    return parsed(deliveryPhotoReplySchema, 'a delivery photo', stored);
  });

  /** The signed-in driver: allowed to deliver, and a person (the root holds none, so it is a 403). */
  async function mustBeDriver(request: FastifyRequest) {
    const who = await signedIn(request);
    mustCan(who, 'deliveries.canDeliver');
    if (who.root || !who.employeeId) throw forbidden();
    return { driverId: who.employeeId, who };
  }

  app.get(ROUTES.myDeliveries, forClient, async (request) => {
    const { driverId } = await mustBeDriver(request);
    const query = parse(z.strictObject({ day: daySchema }), request.query);
    const dayList = await recordTools(request.storage).every(
      recordKeys.tenant(request.tenantId).deliveryDayPrefix(query.day),
      deliveryRequestSchema,
      'delivery request',
    );
    const rank = (one: DeliveryRequest) => (one.state === 'waiting' ? 0 : 1);
    const deliveries = dayList
      .map((one) => one.record)
      .filter((one) => one.driver.id === driverId && one.state !== 'cancelled')
      .sort((a, b) => rank(a) - rank(b) || a.number.localeCompare(b.number));
    return { deliveries };
  });

  /** The photo written over any an earlier try left: a record that moved is read again, a few times. */
  async function writePhoto(storage: TenantStorage, day: string, id: string, photo: string) {
    const key = recordKeys.tenant(storage.tenantId).deliveryPhoto(day, id);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await storage.getRecord(key);
      if ((await storage.putRecord(key, { photo }, held?.tag ?? null)) === 'saved') return;
    }
    throw new HttpError(503, 'Service unavailable');
  }

  app.post(
    deliveryRoutes.deliver(':day', ':id'),
    { ...forClient, config: { audit: 'delivery.deliver' } },
    async (request) => {
      const { driverId, who } = await mustBeDriver(request);
      const entry = declare(request, personOf(who), (request.params as { id: string }).id);
      const body = parse(deliverRequestSchema, request.body);
      const found = await mustFindRequest(request);
      const { day, id, order: named } = found.request;
      if (found.request.driver.id !== driverId) throw forbidden();
      if (found.tag !== body.version || found.request.state !== 'waiting') {
        throw conflict(await requestDoc(request.storage, day, id));
      }
      const keys = recordKeys.tenant(request.tenantId);
      // The photo, then the request delivered over its tag, then the order fulfilled over its tag: a
      // stop after the photo leaves a waiting request, a stop after the request a confirmed order
      // whose request is delivered, which reads fulfilled.
      await writePhoto(request.storage, day, id, body.photo);
      const delivered: DeliveryRequest = {
        ...found.request,
        state: 'delivered',
        deliveredAt: now(),
      };
      if (
        (await request.storage.putRecord(keys.delivery(day, id), delivered, found.tag)) === 'moved'
      ) {
        throw conflict(await requestDoc(request.storage, day, id));
      }
      entry.saved(found.request, delivered);
      // The order is fulfilled while it is confirmed and still names this request, read again when it
      // moved; after a few tries it is left, and still reads fulfilled.
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const ordered = await readOrder(request.storage, named.day, named.id);
        if (ordered?.order.state !== 'confirmed' || ordered.order.request?.id !== id) break;
        const key = keys.order(named.day, named.id);
        if (
          (await request.storage.putRecord(
            key,
            { ...ordered.order, state: 'fulfilled' },
            ordered.tag,
          )) === 'saved'
        ) {
          break;
        }
      }
      return await requestDoc(request.storage, day, id);
    },
  );

  app.post(
    deliveryRoutes.cancel(':day', ':id'),
    { ...forClient, config: { audit: 'delivery.cancel' } },
    async (request) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who), (request.params as { id: string }).id);
      mustCan(who, 'orders.canEdit');
      const body = parse(cancelRequestSchema, request.body);
      const found = await mustFindRequest(request);
      const { day, id, order: named } = found.request;
      if (found.tag !== body.version || found.request.state !== 'waiting') {
        throw conflict(await requestDoc(request.storage, day, id));
      }
      const keys = recordKeys.tenant(request.tenantId);
      if (
        (await request.storage.putRecord(
          keys.delivery(day, id),
          { ...found.request, state: 'cancelled' },
          found.tag,
        )) === 'moved'
      ) {
        throw conflict(await requestDoc(request.storage, day, id));
      }
      entry.saved(found.request, { ...found.request, state: 'cancelled' });
      // The order is then freed to send again. An order that moved meanwhile is left as it is: a
      // request that is cancelled reads as none whatever the order names.
      const ordered = await readOrder(request.storage, named.day, named.id);
      if (ordered?.order.request?.id === id) {
        await request.storage.putRecord(
          keys.order(named.day, named.id),
          { ...ordered.order, request: null },
          ordered.tag,
        );
      }
      return await requestDoc(request.storage, day, id);
    },
  );

  app.get(ROUTES.drivers, forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canEdit');
    return { drivers: await driversOf(request.storage) };
  });
}
