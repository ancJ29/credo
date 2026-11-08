import { isDeepStrictEqual } from 'node:util';
import {
  closeDayRequestSchema,
  daySchema,
  deliveryRequestSchema,
  driverDay,
  gapOf,
  orderSchema,
  type Reconciliation,
  reconciliationListReplySchema,
  reconciliationRoutes,
  reconciliationSchema,
  recordKeys,
  ROUTES,
  sameIds,
} from '@credo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse } from './errors';
import { recordTools } from './orders';
import { readEmployee } from './staff-records';
import type { Deps } from './staff';

const conflict = (current: unknown) => new HttpError(409, 'Conflict', { current });
const notFound = () => new HttpError(404, 'Not found');

/** The drivers' days closed. A day is closed once per driver: the delivered requests it covers are
 * summed here from the records, never taken from the page, and the page names the requests it showed
 * so that a day which moved since closes nothing (409). The writes go in an order that leaves every
 * stop valid: each request still waiting is cancelled over its tag and its order freed, as the
 * request's own cancel writes them, then the closed day is written once; a stop between leaves the
 * day open with those requests cancelled, and the next close goes on. */
export function registerReconciliationRoutes(app: FastifyInstance, deps: Deps) {
  const { storage, now, forClient, signedIn, mustCan } = deps;
  const { parsed, every } = recordTools(storage);

  /** The closed day written once under its key. The write may have landed while its answer was
   * lost: the record is there as written, or another close sits under it. */
  async function writeClosed(key: string, record: Reconciliation) {
    try {
      return await storage.putRecord(key, record, null);
    } catch (error) {
      const held = await storage.getRecord(key);
      if (!held) throw error;
      return isDeepStrictEqual(held.data, record) ? ('saved' as const) : ('moved' as const);
    }
  }

  app.get(ROUTES.reconciliations, forClient, async (request) => {
    mustCan(await signedIn(request), 'orders.canView');
    const query = parse(z.strictObject({ day: daySchema }), request.query);
    const listed = await every(
      recordKeys.tenant(request.tenantId).reconciliationDayPrefix(query.day),
      reconciliationSchema,
      'closed day',
    );
    const reconciliations = listed
      .map((one) => one.record)
      .sort((a, b) => a.driver.code.localeCompare(b.driver.code));
    return reconciliationListReplySchema.parse({ reconciliations });
  });

  app.post(reconciliationRoutes.close(':day', ':driverId'), forClient, async (request) => {
    const who = await signedIn(request);
    mustCan(who, 'orders.canEdit');
    const body = parse(closeDayRequestSchema, request.body);
    const { day, driverId } = request.params as { day: string; driverId: string };
    if (!daySchema.safeParse(day).success || !z.uuid().safeParse(driverId).success) {
      throw notFound();
    }
    const keys = recordKeys.tenant(request.tenantId);
    const listed = await every(
      keys.deliveryDayPrefix(day),
      deliveryRequestSchema,
      'delivery request',
    );
    const driver = listed.find((one) => one.record.driver.id === driverId)?.record.driver;
    if (!driver) throw notFound();
    const figures = driverDay(
      listed.map((one) => one.record),
      driverId,
    );
    const key = keys.reconciliation(day, driverId);
    const held = await storage.getRecord(key);
    const asItIs = (record: unknown) => ({
      delivered: figures.delivered.map((one) => one.id),
      waiting: figures.waiting.map((one) => one.id),
      reconciliation: record,
    });
    // A day closed already, or another set of requests than the page showed, closes nothing.
    if (held) throw conflict(asItIs(parsed(reconciliationSchema, 'a closed day', held)));
    if (
      !sameIds(
        body.delivered,
        figures.delivered.map((one) => one.id),
      ) ||
      !sameIds(
        body.waiting,
        figures.waiting.map((one) => one.id),
      )
    ) {
      throw conflict(asItIs(null));
    }
    if (figures.tooLarge) {
      throw new HttpError(400, 'Bad request', {
        details: 'a day that adds up to the most or less',
      });
    }
    // The closer is read before the first write: a person whose record has gone since the sign-in
    // closes nothing (the root alone has no record), so the day is never signed with the root's
    // shape and another's name.
    const person = who.employeeId
      ? await readEmployee(storage, request.tenantId, who.employeeId)
      : null;
    if (who.employeeId && !person) throw new HttpError(401, 'Unauthorized');
    for (const waiting of figures.waiting) {
      const tag = listed.find((one) => one.record.id === waiting.id)!.tag;
      const cancelled = { ...waiting, state: 'cancelled' };
      if ((await storage.putRecord(keys.delivery(day, waiting.id), cancelled, tag)) === 'moved') {
        throw conflict(asItIs(null));
      }
      // The order is then freed to send again; one that moved meanwhile is left as it is.
      const named = waiting.order;
      // A request's order is never deleted.
      const stored = (await storage.getRecord(keys.order(named.day, named.id)))!;
      const ordered = parsed(orderSchema, 'an order', stored);
      if (ordered.request?.id === waiting.id) {
        await storage.putRecord(
          keys.order(named.day, named.id),
          { ...ordered, request: null },
          stored.tag,
        );
      }
    }
    const closed: Reconciliation = {
      day,
      driver,
      requests: figures.delivered.map(({ id, number, total }) => ({ id, number, total })),
      toCollect: figures.toCollect,
      handedIn: body.handedIn,
      difference: gapOf(figures.toCollect, body.handedIn),
      closedBy: person
        ? { id: person.employee.id, code: person.employee.code, name: person.employee.name }
        : { id: null, code: null, name: who.name },
      closedAt: now(),
    };
    if ((await writeClosed(key, closed)) === 'moved') throw conflict(asItIs(null));
    return reconciliationSchema.parse(closed);
  });
}
