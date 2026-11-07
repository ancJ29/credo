import { randomUUID } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  deliveryRoutes,
  documentNumberingSchema,
  driverListReplySchema,
  orderRoutes,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { DAY, ordersTenant } from '../tests/orders';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const UNKNOWN = '00000000-0000-4000-8000-000000000000';

/** A client that fails or moves a chosen write, once armed. */
function flaky() {
  const plan: {
    failOn?: (
      key: string,
      data: unknown,
      ifTag?: string | null,
    ) => 'throw' | 'lost' | 'moved' | 'bump' | 'bump-then-throw' | null;
    /** Once a write has thrown, every read fails too. */
    readsFailAfterThrow?: boolean;
  } = {};
  let down = false;
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    async getRecord(key) {
      if (down) throw new CStorageError(503, 'down');
      return await client.getRecord(key);
    },
    async putRecord(key, data, ifTag) {
      const what = plan.failOn?.(key, data, ifTag) ?? null;
      if (what === 'throw') {
        down = plan.readsFailAfterThrow ?? false;
        throw new CStorageError(503, 'down');
      }
      if (what === 'moved') return 'moved';
      if (what === 'bump' || what === 'bump-then-throw') {
        const current = (await client.getRecord(key))!.data as Record<string, unknown>;
        // The numbering moves by a request given elsewhere; any other record by its extra.
        await client.putRecord(
          key,
          'requests' in current
            ? { ...current, requests: (current.requests as number) + 1 }
            : { ...current, extra: { bumped: true } },
        );
      }
      if (what === 'bump-then-throw')
        throw new CStorageError(null, 'c-storage did not answer a put');
      const saved = await client.putRecord(key, data, ifTag);
      if (what === 'lost') throw new CStorageError(null, 'c-storage did not answer a put');
      return saved;
    },
  });
  return { plan, wrap };
}

describe('Row 22: every route answers 401 unsigned and 403 without its permission', () => {
  it('answers 401 to every route with no handle, and 403 to a person who holds none of the permissions', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const sent = await w.confirmed(await w.made());
    const request = sent.order.request!;
    const routes: ['GET' | 'POST' | 'PUT', string][] = [
      ['GET', orderRoutes.list(DAY, DAY)],
      ['POST', ROUTES.orders],
      ['GET', orderRoutes.one(DAY, draft.order.id)],
      ['PUT', orderRoutes.one(DAY, draft.order.id)],
      ['POST', orderRoutes.confirm(DAY, draft.order.id)],
      ['POST', orderRoutes.send(DAY, draft.order.id)],
      ['POST', orderRoutes.cancel(DAY, draft.order.id)],
      ['GET', deliveryRoutes.list(DAY)],
      ['GET', deliveryRoutes.one(DAY, request.id)],
      ['POST', deliveryRoutes.cancel(DAY, request.id)],
      ['POST', deliveryRoutes.deliver(DAY, request.id)],
      ['GET', deliveryRoutes.photo(DAY, request.id)],
      ['GET', ROUTES.myDeliveries],
      ['GET', ROUTES.drivers],
    ];

    const unsigned = await Promise.all(
      routes.map(([method, url]) =>
        w.t.app.inject({ method, url, payload: method === 'GET' ? undefined : {} }),
      ),
    );
    const refused = await Promise.all(
      routes.map(([method, url]) =>
        method === 'GET' ? w.someone.call.get(url) : w.someone.call.send(method, url, {}),
      ),
    );

    expect(unsigned.map((reply) => reply.statusCode)).toEqual(routes.map(() => 401));
    expect(refused.map((reply) => reply.statusCode)).toEqual(routes.map(() => 403));
  });
});

describe('Rows 15 and 16: the records sit under their day and id, and a list is never short', () => {
  it('keeps an order and a request under their day and id, and the numbering in its own record', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());

    const order = await w.t.client.getRecord(w.t.keys.order(DAY, sent.order.id));
    const request = await w.t.client.getRecord(w.t.keys.delivery(DAY, sent.order.request!.id));
    const numbering = await w.t.client.getRecord(w.t.keys.documentNumbering);

    expect((order!.data as { number: string }).number).toBe('DH-00001');
    expect((request!.data as { number: string }).number).toBe('GH-00001');
    expect(documentNumberingSchema.parse(numbering!.data)).toEqual({ orders: 1, requests: 1 });
  });

  it('answers 500 to the orders, the requests and the drivers when c-storage says there are more or a record does not parse, naming the kind and never the key', async () => {
    let more = false;
    const w = await ordersTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async listRecords(prefix) {
          const listed = await client.listRecords(prefix);
          return more ? { ...listed, more: true } : listed;
        },
      }),
    });
    await w.confirmed(await w.made());
    more = true;
    const short = await Promise.all([
      w.office.call.get(orderRoutes.list(DAY, DAY)),
      w.office.call.get(deliveryRoutes.list(DAY)),
      w.office.call.get(ROUTES.drivers),
      w.office.call.send('POST', ROUTES.orders, w.body()),
    ]);
    more = false;
    const bad = randomUUID();
    await w.t.client.putRecord(w.t.keys.order(DAY, bad), { id: bad, nothing: 'useful' });
    await w.t.client.putRecord(w.t.keys.delivery(DAY, bad), { id: bad, nothing: 'useful' });
    const broken = await Promise.all([
      w.office.call.get(orderRoutes.list(DAY, DAY)),
      w.office.call.get(deliveryRoutes.list(DAY)),
      w.office.call.get(orderRoutes.one(DAY, bad)),
      w.office.call.get(deliveryRoutes.one(DAY, bad)),
    ]);

    expect(short.map((reply) => reply.statusCode)).toEqual([500, 500, 500, 500]);
    expect(broken.map((reply) => reply.statusCode)).toEqual([500, 500, 500, 500]);
    expect([...short, ...broken].map((reply) => reply.body).join('')).not.toContain(bad);
  });
});

describe('Rows 17 and 23: a save names ids and quantities, and a day is a real one', () => {
  it('refuses a total over 10^15, a quantity over 100,000, more than 50 lines, a day that is no day and a key it does not know, 400', async () => {
    const w = await ordersTenant(cs);
    const send = (over: object) => w.office.call.send('POST', ROUTES.orders, w.body(over));
    const many = Array.from({ length: 51 }, () => ({ productId: randomUUID(), quantity: 1 }));

    const replies = await Promise.all([
      send({ lines: [{ productId: w.ids.sand, quantity: 100_001 }] }),
      send({ lines: many }),
      send({ day: '2026-02-30' }),
      send({ day: '28/10/2026' }),
      send({ unknown: true }),
      send({ lines: [] }),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400, 400, 400, 400, 400]);
  });

  it('refuses a total past 10^15, 400', async () => {
    const w = await ordersTenant(cs);
    await w.t.client.putRecord(w.t.keys.product(w.ids.sand), {
      id: w.ids.sand,
      code: 'VT-2',
      name: 'Cát xây',
      unit: 'm³',
      price: 10 ** 12,
      stocked: true,
      extra: {},
    });

    const reply = await w.office.call.send(
      'POST',
      ROUTES.orders,
      w.body({ lines: [{ productId: w.ids.sand, quantity: 100_000 }] }),
    );
    const edge = await w.office.call.send(
      'POST',
      ROUTES.orders,
      w.body({ lines: [{ productId: w.ids.sand, quantity: 1000 }] }),
    );

    expect(reply.statusCode).toBe(400);
    expect(edge.statusCode).toBe(201);
  });

  it('refuses a save with no version, or for another day than the order’s, 400', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const url = orderRoutes.one(DAY, draft.order.id);

    const replies = await Promise.all([
      w.office.call.send('PUT', url, w.body()),
      w.office.call.send('PUT', url, { ...w.body({ day: '2026-10-29' }), version: draft.version }),
      w.office.call.send('POST', orderRoutes.confirm(DAY, draft.order.id), {}),
      w.office.call.send('POST', orderRoutes.cancel(DAY, draft.order.id), {}),
      w.office.call.send('POST', deliveryRoutes.cancel(DAY, UNKNOWN), {}),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400, 400, 400, 400]);
  });

  it('answers 404 to an order or a request that is not there, or named by something that is no day or id', async () => {
    const w = await ordersTenant(cs);
    const version = { version: 'a'.repeat(64) };

    const replies = await Promise.all([
      w.office.call.get(orderRoutes.one(DAY, UNKNOWN)),
      w.office.call.get(orderRoutes.one('not-a-day', UNKNOWN)),
      w.office.call.get(orderRoutes.one(DAY, 'not-an-id')),
      w.office.call.send('PUT', orderRoutes.one(DAY, UNKNOWN), { ...w.body(), ...version }),
      w.office.call.send('POST', orderRoutes.cancel(DAY, UNKNOWN), version),
      w.office.call.get(deliveryRoutes.one(DAY, UNKNOWN)),
      w.office.call.get(deliveryRoutes.one('not-a-day', UNKNOWN)),
      w.office.call.get(deliveryRoutes.one(DAY, 'not-an-id')),
      w.office.call.send('POST', deliveryRoutes.cancel(DAY, UNKNOWN), version),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual(Array(9).fill(404));
  });

  it('refuses a deliveries list with no day or a day that is no day, 400', async () => {
    const w = await ordersTenant(cs);

    const replies = await Promise.all([
      w.office.call.get(ROUTES.deliveries),
      w.office.call.get(`${ROUTES.deliveries}?day=2026-13-01`),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400]);
  });
});

describe('Row 18: a number is raised over its tag before its record is written', () => {
  it('reads the numbering again when it moved and gives the next number, and gives up with 503 after three tries, writing no order', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    await w.made();
    let bumps = 0;
    f.plan.failOn = (key, _data, ifTag) =>
      key.endsWith('document-numbering') && ifTag !== undefined && bumps++ < 1 ? 'bump' : null;
    const once = await w.made();
    f.plan.failOn = (key, _data, ifTag) =>
      key.endsWith('document-numbering') && ifTag !== undefined ? 'moved' : null;

    const refused = await w.office.call.send('POST', ROUTES.orders, w.body());
    f.plan.failOn = undefined;
    const next = await w.made();

    expect(once.order.number).toBe('DH-00002');
    expect(refused.statusCode).toBe(503);
    expect(next.order.number).toBe('DH-00003');
    expect(
      (await w.office.call.get(orderRoutes.list(DAY, DAY))).json<{ orders: unknown[] }>().orders,
    ).toHaveLength(3);
  });
});

describe('Rows 19 and 20: every write names the tag, and a stop between two writes leaves a valid state', () => {
  it('answers 409 with the current record when a write finds the record moved under it, on the save, the confirm, the order’s cancel and the request’s cancel', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    const other = await w.made();
    const sent = await w.confirmed(await w.made());
    const third = await w.confirmed(await w.made());
    const request = await w.requestDoc(DAY, third.order.request!.id);
    f.plan.failOn = (key) =>
      key.includes('.order.') || key.includes('.delivery.') ? 'moved' : null;

    const replies = await Promise.all([
      w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body(),
        version: draft.version,
      }),
      w.office.call.send('POST', orderRoutes.confirm(DAY, other.order.id), w.sendBody(other)),
      w.office.call.send('POST', orderRoutes.cancel(DAY, sent.order.id), { version: sent.version }),
      w.office.call.send('POST', deliveryRoutes.cancel(DAY, request.request.id), {
        version: request.version,
      }),
    ]);
    f.plan.failOn = undefined;

    expect(replies.map((reply) => reply.statusCode)).toEqual([409, 409, 409, 409]);
    expect((await w.read(DAY, other.order.id)).order.state).toBe('draft');
    expect((await w.requestDoc(DAY, request.request.id)).request.state).toBe('waiting');
  });

  it('shows an order as sent to no one when its request write failed after the order’s, in its page and in the list, and sends it again', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    f.plan.failOn = (key) => (key.includes('.delivery.') ? 'throw' : null);

    const failed = await w.office.call.send(
      'POST',
      orderRoutes.confirm(DAY, draft.order.id),
      w.sendBody(draft),
    );
    f.plan.failOn = undefined;
    const shown = await w.read(DAY, draft.order.id);
    const listed = (await w.office.call.get(orderRoutes.list(DAY, DAY))).json<{
      orders: { request: unknown }[];
    }>();
    const again = w.orderDoc(
      await w.office.call.send(
        'POST',
        orderRoutes.send(DAY, draft.order.id),
        w.sendBody(shown, w.driverTwo),
      ),
    );

    expect(failed.statusCode).toBe(503);
    expect(shown.order).toMatchObject({ state: 'confirmed', request: null });
    expect(listed.orders[0].request).toBeNull();
    expect(again.order.request).toMatchObject({
      number: 'GH-00002',
      driver: w.asDriver(w.driverTwo),
    });
  });

  it('counts the request as made when its write landed and its answer was lost', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    f.plan.failOn = (key) => (key.includes('.delivery.') ? 'lost' : null);

    const sent = w.orderDoc(
      await w.office.call.send('POST', orderRoutes.confirm(DAY, draft.order.id), w.sendBody(draft)),
    );
    f.plan.failOn = undefined;

    expect(sent.order.request?.number).toBe('GH-00001');
  });

  it('counts a draft’s save as saved when its write landed and its answer was lost, and fails when it did not land', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    const other = await w.made();
    const url = orderRoutes.one(DAY, draft.order.id);
    const save = (over: object, version: string) =>
      w.office.call.send('PUT', url, { ...w.body(over), version });
    const aimed = (key: string) => key.includes('.order.');

    f.plan.failOn = (key) => (aimed(key) ? 'lost' : null);
    const lost = w.orderDoc(
      await save({ lines: [{ productId: w.ids.fee, quantity: 4 }] }, draft.version),
    );
    f.plan.failOn = (key) => (aimed(key) ? 'throw' : null);
    const down = await save({ lines: [{ productId: w.ids.fee, quantity: 5 }] }, lost.version);
    f.plan.failOn = undefined;
    const stored = await w.read(DAY, draft.order.id);

    expect(lost.order.total).toBe(200000);
    expect(lost.version).not.toBe(draft.version);
    expect(down.statusCode).toBe(503);
    expect(stored).toEqual(lost);
    expect((await w.read(DAY, other.order.id)).version).toBe(other.version);
  });

  it('does not read another writer’s write as its own lost save: the failure stands and their record is kept', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    // our write is never made, and by the re-read someone else's write holds the record
    f.plan.failOn = (key) => (key.includes('.order.') ? 'bump-then-throw' : null);

    const reply = await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
      ...w.body(),
      version: draft.version,
    });
    f.plan.failOn = undefined;

    expect(reply.statusCode).toBe(503);
    expect((await w.read(DAY, draft.order.id)).order.extra).toEqual({ bumped: true });
  });

  it('answers 503 when the store says a record already sat under the fresh id', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    f.plan.failOn = (key, _data, ifTag) =>
      key.includes('.order.') && ifTag === null ? 'moved' : null;

    const reply = await w.office.call.send('POST', ROUTES.orders, w.body());

    expect(reply.statusCode).toBe(503);
  });

  it('answers the write’s own 503 when a draft’s save threw and the re-read to recover it failed too', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const draft = await w.made();
    f.plan.failOn = (key) => (key.includes('.order.') ? 'throw' : null);
    f.plan.readsFailAfterThrow = true;

    const reply = await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
      day: DAY,
      customerId: draft.order.customer.id,
      lines: draft.order.lines.map(({ productId, quantity }) => ({ productId, quantity })),
      extra: {},
      version: draft.version,
    });

    expect(reply.statusCode).toBe(503);
  });

  it('reads a cancelled order’s request as none when the order write failed after the request was cancelled, and cancels the order again', async () => {
    const f = flaky();
    const w = await ordersTenant(cs, { wrap: f.wrap });
    const sent = await w.confirmed(await w.made());
    f.plan.failOn = (key) => (key.includes('.order.') ? 'throw' : null);

    const failed = await w.office.call.send('POST', orderRoutes.cancel(DAY, sent.order.id), {
      version: sent.version,
    });
    f.plan.failOn = undefined;
    const shown = await w.read(DAY, sent.order.id);
    const done = await w.cancelled(shown);

    expect(failed.statusCode).toBe(503);
    expect(shown.order).toMatchObject({ state: 'confirmed', request: null });
    expect(done.order.state).toBe('cancelled');
  });

  it('cancels an order whose request is gone from the store, and a request whose order is gone, unlinked or linked to another', async () => {
    const w = await ordersTenant(cs);
    const gone = await w.confirmed(await w.made());
    await w.t.client.removeRecord(w.t.keys.delivery(DAY, gone.order.request!.id));
    const cancelledOrder = await w.cancelled(gone);

    const a = await w.confirmed(await w.made());
    const b = await w.confirmed(await w.made());
    const c = await w.confirmed(await w.made());
    const ra = await w.requestDoc(DAY, a.order.request!.id);
    const rb = await w.requestDoc(DAY, b.order.request!.id);
    const rc = await w.requestDoc(DAY, c.order.request!.id);
    await w.t.client.removeRecord(w.t.keys.order(DAY, a.order.id));
    const bStored = await w.t.client.getRecord(w.t.keys.order(DAY, b.order.id));
    await w.t.client.putRecord(w.t.keys.order(DAY, b.order.id), {
      ...(bStored!.data as object),
      request: null,
    });
    const cStored = await w.t.client.getRecord(w.t.keys.order(DAY, c.order.id));
    await w.t.client.putRecord(w.t.keys.order(DAY, c.order.id), {
      ...(cStored!.data as { request: object }),
      request: { ...(cStored!.data as { request: object }).request, id: UNKNOWN },
    });
    const replies = await Promise.all(
      [ra, rb, rc].map((r) =>
        w.office.call.send('POST', deliveryRoutes.cancel(DAY, r.request.id), {
          version: r.version,
        }),
      ),
    );

    expect(cancelledOrder.order.state).toBe('cancelled');
    expect(replies.map((reply) => reply.statusCode)).toEqual([200, 200, 200]);
    expect((await w.read(DAY, c.order.id)).order.request).toBeNull();
  });
});

describe('Row 21: the driver must be active and hold the right when the request is made', () => {
  it('answers the people who deliver by their department, position or own layer, and not one who left or whose own layer refuses', async () => {
    const w = await ordersTenant(cs);
    await w.t.staff('BY-POS', { position: { 'deliveries.canDeliver': true } });
    await w.t.staff('BY-OWN', { own: { 'deliveries.canDeliver': true } });
    await w.t.staff('REFUSED', {
      department: { 'deliveries.canDeliver': true },
      own: { 'deliveries.canDeliver': false },
    });

    const reply = await w.office.call.get(ROUTES.drivers);

    expect(driverListReplySchema.parse(reply.json()).drivers.map((one) => one.code)).toEqual([
      'BY-OWN',
      'BY-POS',
      'DRV-1',
      'DRV-2',
    ]);
  });
});

describe('Row 2 with a request cancelled on the same day: the list keeps the driver of the order still sent', () => {
  it('shows the driver of an order whose request waits, beside a request of the day that was cancelled', async () => {
    const w = await ordersTenant(cs);
    const kept = await w.confirmed(await w.made());
    const dropped = await w.confirmed(await w.made(), w.driverTwo);
    const request = await w.requestDoc(DAY, dropped.order.request!.id);
    await w.office.call.send('POST', deliveryRoutes.cancel(DAY, request.request.id), {
      version: request.version,
    });

    const listed = (await w.office.call.get(orderRoutes.list(DAY, DAY))).json<{
      orders: { id: string; request: { driver: { code: string } } | null }[];
    }>().orders;

    expect(
      listed.map((one) => [one.id === kept.order.id, one.request?.driver.code ?? null]),
    ).toEqual([
      [false, null],
      [true, 'DRV-1'],
    ]);
  });
});
