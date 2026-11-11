import {
  CStorageError,
  type CStorageClient,
  deliveryDocSchema,
  deliveryListReplySchema,
  deliveryPhotoReplySchema,
  deliveryRoutes,
  orderListReplySchema,
  orderRoutes,
  ROUTES,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { DAY, ordersTenant } from '../../tests/orders';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

/** A data URL whose payload decodes to exactly `bytes` bytes. */
const image = (bytes = 10, type = 'png') =>
  `data:image/${type};base64,${Buffer.alloc(bytes, 1).toString('base64')}`;
const PHOTO = image();

/** A client that fails or moves the write of a chosen key, while its plan names it. */
function flaky() {
  const plan: { on?: (key: string) => 'throw' | 'moved' | null } = {};
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    async putRecord(key, data, ifTag) {
      const what = plan.on?.(key) ?? null;
      if (what === 'throw') throw new CStorageError(503, 'down');
      if (what === 'moved') return 'moved';
      return await client.putRecord(key, data, ifTag);
    },
  });
  return { plan, wrap };
}

/** A tenant with its office, two drivers who may sign in and deliver, and the calls a delivery makes. */
async function deliveryTenant(options: Parameters<typeof ordersTenant>[1] = {}) {
  const w = await ordersTenant(cs, options);
  const tung = await w.t.staff('DRV-S', { department: { 'deliveries.canDeliver': true } });
  const nam = await w.t.staff('DRV-T', { department: { 'deliveries.canDeliver': true } });
  /** An order confirmed to a driver, and its request as the driver reads it. */
  const sentTo = async (driver = tung, over: object = {}) => {
    const sent = await w.confirmed(await w.made(over), driver);
    const request = await w.requestDoc(DAY, sent.order.request!.id, driver.call);
    return { order: sent, request };
  };
  const deliver = (
    driver: { call: typeof tung.call },
    id: string,
    version: string,
    photo: unknown = PHOTO,
  ) => driver.call.send('POST', deliveryRoutes.deliver(DAY, id), { version, photo });
  const delivered = async (driver = tung) => {
    const todo = await sentTo(driver);
    const reply = await deliver(driver, todo.request.request.id, todo.request.version);
    expect(reply.statusCode).toBe(200);
    return { ...todo, reply };
  };
  return { w, tung, nam, sentTo, deliver, delivered };
}

describe('Rows 2 and 16: the driver’s list', () => {
  it('My deliveries answers the caller’s own requests of the day, those waiting first and then those delivered, each by number; the cancelled are left out and another driver’s never are', async () => {
    const d = await deliveryTenant();
    const first = await d.sentTo();
    const second = await d.sentTo();
    const third = await d.sentTo();
    const fourth = await d.sentTo();
    await d.sentTo(d.nam);
    await d.w.office.call.send('POST', deliveryRoutes.cancel(DAY, third.request.request.id), {
      version: third.request.version,
    });
    await d.deliver(d.tung, first.request.request.id, first.request.version);

    const reply = await d.tung.call.get(ROUTES.myDeliveries + `?day=${DAY}`);

    expect(reply.statusCode).toBe(200);
    const { deliveries } = deliveryListReplySchema.parse(reply.json());
    expect(deliveries.map((one) => [one.number, one.state])).toEqual([
      [second.request.request.number, 'waiting'],
      [fourth.request.request.number, 'waiting'],
      [first.request.request.number, 'delivered'],
    ]);
    expect(deliveries.every((one) => one.driver.id === d.tung.employee.id)).toBe(true);
    expect(
      deliveryListReplySchema.parse(
        (await d.tung.call.get(`${ROUTES.myDeliveries}?day=2026-01-01`)).json(),
      ).deliveries,
    ).toEqual([]);
  });

  it('answers 403 to the root and to anyone not allowed to deliver, 401 unsigned, and 400 to a day that is no date', async () => {
    const d = await deliveryTenant();
    const url = `${ROUTES.myDeliveries}?day=${DAY}`;

    expect((await d.w.t.rootCall.get(url)).statusCode).toBe(403);
    expect((await d.w.office.call.get(url)).statusCode).toBe(403);
    expect((await d.w.someone.call.get(url)).statusCode).toBe(403);
    expect((await d.w.t.app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await d.tung.call.get(`${ROUTES.myDeliveries}?day=nope`)).statusCode).toBe(400);
  });
});

describe('Rows 4, 5, 6, 13 and 14: Delivered', () => {
  it('Delivered writes the photo, then the request delivered with deliveredAt, then the order fulfilled; the office reads both, and the photo as sent', async () => {
    const d = await deliveryTenant();

    const done = await d.delivered();

    const doc = deliveryDocSchema.parse(done.reply.json());
    expect(doc.request.state).toBe('delivered');
    expect(typeof doc.request.deliveredAt).toBe('number');
    const order = await d.w.read(DAY, done.order.order.id);
    expect(order.order).toMatchObject({
      state: 'fulfilled',
      request: { id: done.request.request.id },
    });
    const listed = orderListReplySchema.parse(
      (await d.w.office.call.get(orderRoutes.list(DAY, DAY))).json(),
    ).orders;
    expect(listed.find((one) => one.id === done.order.order.id)?.state).toBe('fulfilled');
    const photo = await d.w.office.call.get(deliveryRoutes.photo(DAY, doc.request.id));
    expect(deliveryPhotoReplySchema.parse(photo.json())).toEqual({ photo: PHOTO });
    // the photo is a record of its own, outside the day's prefix, so no list reads it
    const stored = await d.w.t.client.getRecord(d.w.t.keys.deliveryPhoto(DAY, doc.request.id));
    expect(stored?.data).toEqual({ photo: PHOTO });
    const day = await d.w.t.client.listRecords(d.w.t.keys.deliveryDayPrefix(DAY));
    expect(
      day.records.some((one) => one.key === d.w.t.keys.deliveryPhoto(DAY, doc.request.id)),
    ).toBe(false);
  });

  it('Delivered is the whole request, marked once, and only by its own driver: another driver, the office and the root are refused, and a request delivered is not changed, cancelled, sent again or delivered again', async () => {
    const d = await deliveryTenant();
    const todo = await d.sentTo();
    const id = todo.request.request.id;
    const { version } = todo.request;

    expect((await d.deliver(d.nam, id, version)).statusCode).toBe(403);
    expect((await d.deliver(d.w.office, id, version)).statusCode).toBe(403);
    expect((await d.deliver({ call: d.w.t.rootCall }, id, version)).statusCode).toBe(403);
    expect((await d.deliver(d.w.someone, id, version)).statusCode).toBe(403);
    expect((await d.w.t.client.getRecord(d.w.t.keys.deliveryPhoto(DAY, id))) === null).toBe(true);
    expect((await d.deliver(d.tung, id, version)).statusCode).toBe(200);

    // again, over the old version or the new: a conflict carrying the request as it is
    const again = await d.deliver(d.tung, id, version);
    expect(again.statusCode).toBe(409);
    expect(deliveryDocSchema.parse(again.json<{ current: unknown }>().current).request.state).toBe(
      'delivered',
    );
    const now = await d.w.requestDoc(DAY, id);
    expect((await d.deliver(d.tung, id, now.version)).statusCode).toBe(409);
    // the office cannot cancel it, nor its order, nor send the order again
    const cancelled = await d.w.office.call.send('POST', deliveryRoutes.cancel(DAY, id), {
      version: now.version,
    });
    expect(cancelled.statusCode).toBe(409);
    const order = await d.w.read(DAY, todo.order.order.id);
    expect(order.order.state).toBe('fulfilled');
    const orderCancel = await d.w.office.call.send(
      'POST',
      orderRoutes.cancel(DAY, order.order.id),
      { version: order.version },
    );
    expect(orderCancel.statusCode).toBe(409);
    expect((await d.w.read(DAY, order.order.id)).order.state).toBe('fulfilled');
    const resend = await d.w.office.call.send('POST', orderRoutes.send(DAY, order.order.id), {
      version: order.version,
      driverId: d.nam.employee.id,
      day: DAY,
    });
    expect(resend.statusCode).toBe(409);
  });

  it('Delivered takes the version read and a photo of at most 200 KB: a missing, oversized or wrong kind of photo, or a version that moved, delivers nothing', async () => {
    const d = await deliveryTenant();
    const todo = await d.sentTo();
    const id = todo.request.request.id;
    const { version } = todo.request;

    for (const photo of [null, '', image(200 * 1024 + 1), image(10, 'gif'), 'nope']) {
      expect((await d.deliver(d.tung, id, version, photo)).statusCode, String(photo)).toBe(400);
    }
    expect((await d.deliver(d.tung, id, 'f'.repeat(64))).statusCode).toBe(409);
    expect((await d.w.requestDoc(DAY, id)).request.state).toBe('waiting');
    // a photo of 200 KB exactly is taken
    expect((await d.deliver(d.tung, id, version, image(200 * 1024))).statusCode).toBe(200);
    expect(
      (await d.deliver(d.tung, '00000000-0000-4000-8000-000000000000', version)).statusCode,
    ).toBe(404);
    expect((await d.deliver(d.tung, 'not-an-id', version)).statusCode).toBe(404);
    expect(
      (
        await d.w.t.app.inject({
          method: 'POST',
          url: deliveryRoutes.deliver(DAY, id),
          payload: { version, photo: PHOTO },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('A driver who is no longer allowed to deliver is refused', async () => {
    const d = await deliveryTenant();
    const todo = await d.sentTo();
    const read = (await d.w.t.rootCall.get('/api/staff-setup')).json<{
      setup: { departments: { id: string; permissions: object }[] };
      version: string;
    }>();
    const departments = read.setup.departments.map((unit) => ({
      ...unit,
      permissions: { ...unit.permissions, 'deliveries.canDeliver': false },
    }));
    await d.w.t.rootCall.send('PUT', '/api/staff-setup', {
      setup: { ...read.setup, departments },
      version: read.version,
    });

    const reply = await d.deliver(d.tung, todo.request.request.id, todo.request.version);

    expect(reply.statusCode).toBe(403);
  });

  it('A stop after the request is written leaves it delivered and its order confirmed, which reads fulfilled, alone and in the list; the order is read again when it moved, three tries, and then left', async () => {
    const f = flaky();
    const d = await deliveryTenant({ wrap: f.wrap });

    // the order's write fails: the call fails, the request is delivered, the order reads fulfilled
    const stopped = await d.sentTo();
    f.plan.on = (key) => (key.includes('.order.') ? 'throw' : null);
    const reply = await d.deliver(d.tung, stopped.request.request.id, stopped.request.version);
    f.plan.on = undefined;
    expect(reply.statusCode).toBe(503);
    expect((await d.w.requestDoc(DAY, stopped.request.request.id)).request.state).toBe('delivered');
    const stored = await d.w.t.client.getRecord(d.w.t.keys.order(DAY, stopped.order.order.id));
    expect((stored?.data as { state: string }).state).toBe('confirmed');
    expect((await d.w.read(DAY, stopped.order.order.id)).order.state).toBe('fulfilled');
    const listed = orderListReplySchema.parse(
      (await d.w.office.call.get(orderRoutes.list(DAY, DAY))).json(),
    ).orders;
    expect(listed.find((one) => one.id === stopped.order.order.id)?.state).toBe('fulfilled');
    // the office cannot cancel it either, as it is confirmed in the record
    const order = await d.w.read(DAY, stopped.order.order.id);
    const cancel = await d.w.office.call.send('POST', orderRoutes.cancel(DAY, order.order.id), {
      version: order.version,
    });
    expect(cancel.statusCode).toBe(409);

    // the order moves once: it is read again and fulfilled
    const once = await d.sentTo();
    let moves = 0;
    f.plan.on = (key) => (key.includes('.order.') && moves++ < 1 ? 'moved' : null);
    expect(
      (await d.deliver(d.tung, once.request.request.id, once.request.version)).statusCode,
    ).toBe(200);
    f.plan.on = undefined;
    const saved = await d.w.t.client.getRecord(d.w.t.keys.order(DAY, once.order.order.id));
    expect((saved?.data as { state: string }).state).toBe('fulfilled');

    // the order moves every time: three tries, then it is left, and the call still answers 200
    const left = await d.sentTo();
    let tries = 0;
    f.plan.on = (key) => {
      if (!key.includes('.order.')) return null;
      tries += 1;
      return 'moved';
    };
    expect(
      (await d.deliver(d.tung, left.request.request.id, left.request.version)).statusCode,
    ).toBe(200);
    f.plan.on = undefined;
    expect(tries).toBe(3);
    expect((await d.w.read(DAY, left.order.order.id)).order.state).toBe('fulfilled');
  });

  it('A stop after the photo leaves a waiting request with a photo nothing reads, written over by the next try; a request moved meanwhile is a conflict', async () => {
    const f = flaky();
    const d = await deliveryTenant({ wrap: f.wrap });
    const todo = await d.sentTo();
    const id = todo.request.request.id;

    f.plan.on = (key) => (key.includes('.delivery.') ? 'throw' : null);
    const stopped = await d.deliver(d.tung, id, todo.request.version);
    f.plan.on = undefined;
    expect(stopped.statusCode).toBe(503);
    expect((await d.w.requestDoc(DAY, id)).request.state).toBe('waiting');
    expect((await d.tung.call.get(deliveryRoutes.photo(DAY, id))).statusCode).toBe(404);

    const other = image(20);
    expect((await d.deliver(d.tung, id, todo.request.version, other)).statusCode).toBe(200);
    expect(
      deliveryPhotoReplySchema.parse((await d.tung.call.get(deliveryRoutes.photo(DAY, id))).json()),
    ).toEqual({ photo: other });

    // the request moves between the read and the write
    const racing = await d.sentTo();
    f.plan.on = (key) => (key.includes('.delivery.') ? 'moved' : null);
    const lost = await d.deliver(d.tung, racing.request.request.id, racing.request.version);
    f.plan.on = undefined;
    expect(lost.statusCode).toBe(409);
    // the photo's record moving every time is a 503
    const busy = await d.sentTo();
    f.plan.on = (key) => (key.includes('delivery-photo') ? 'moved' : null);
    const refused = await d.deliver(d.tung, busy.request.request.id, busy.request.version);
    f.plan.on = undefined;
    expect(refused.statusCode).toBe(503);
  });
});

describe('Row 14: the order is fulfilled only while it is confirmed and names the request', () => {
  it('leaves an order that is no longer confirmed, or no longer names the request, as it is', async () => {
    const d = await deliveryTenant();
    const moved = await d.sentTo();
    const unlinked = await d.sentTo();
    const keys = d.w.t.keys;
    const put = async (id: string, patch: object) => {
      const key = keys.order(DAY, id);
      const held = (await d.w.t.client.getRecord(key))!;
      await d.w.t.client.putRecord(key, { ...(held.data as object), ...patch }, held.tag);
    };
    await put(moved.order.order.id, { state: 'cancelled' });
    await put(unlinked.order.order.id, { request: null });

    for (const todo of [moved, unlinked]) {
      const reply = await d.deliver(d.tung, todo.request.request.id, todo.request.version);
      expect(reply.statusCode).toBe(200);
    }

    const left = (await d.w.t.client.getRecord(keys.order(DAY, moved.order.order.id)))!;
    expect((left.data as { state: string }).state).toBe('cancelled');
    const other = (await d.w.t.client.getRecord(keys.order(DAY, unlinked.order.order.id)))!;
    expect((other.data as { state: string }).state).toBe('confirmed');
  });
});

describe('Row 8: the office cancelled it first', () => {
  it('A request the office cancelled before Delivered was sent tells the driver so (409 with the request as it is), and nothing is delivered', async () => {
    const d = await deliveryTenant();
    const todo = await d.sentTo();
    const id = todo.request.request.id;
    await d.w.office.call.send('POST', orderRoutes.cancel(DAY, todo.order.order.id), {
      version: todo.order.version,
    });

    const reply = await d.deliver(d.tung, id, todo.request.version);

    expect(reply.statusCode).toBe(409);
    expect(deliveryDocSchema.parse(reply.json<{ current: unknown }>().current).request.state).toBe(
      'cancelled',
    );
    expect((await d.w.t.client.getRecord(d.w.t.keys.deliveryPhoto(DAY, id))) === null).toBe(true);
    const mine = deliveryListReplySchema.parse(
      (await d.tung.call.get(`${ROUTES.myDeliveries}?day=${DAY}`)).json(),
    );
    expect(mine.deliveries).toEqual([]);
  });
});

describe('Rows 7 and 17: who reads a request and its photo', () => {
  it('A delivery’s photo is read by those who may see orders and by the driver who took it, by no one else; the photo of a request not delivered is a 404; a request is read by the same', async () => {
    const d = await deliveryTenant();
    const done = await d.delivered();
    const id = done.request.request.id;
    const waiting = await d.sentTo();
    const photo = deliveryRoutes.photo(DAY, id);

    for (const reader of [d.w.office, d.w.viewer, d.tung, { call: d.w.t.rootCall }]) {
      const reply = await reader.call.get(photo);
      expect(reply.statusCode).toBe(200);
      expect(deliveryPhotoReplySchema.parse(reply.json())).toEqual({ photo: PHOTO });
      expect((await reader.call.get(deliveryRoutes.one(DAY, id))).statusCode).toBe(200);
    }
    for (const reader of [d.nam, d.w.someone]) {
      expect((await reader.call.get(photo)).statusCode).toBe(403);
      expect((await reader.call.get(deliveryRoutes.one(DAY, id))).statusCode).toBe(403);
    }
    expect((await d.w.t.app.inject({ method: 'GET', url: photo })).statusCode).toBe(401);
    // a request not delivered has no photo; its own driver reads it, another driver does not
    const open = waiting.request.request.id;
    expect((await d.w.office.call.get(deliveryRoutes.photo(DAY, open))).statusCode).toBe(404);
    expect((await d.tung.call.get(deliveryRoutes.photo(DAY, open))).statusCode).toBe(404);
    expect((await d.tung.call.get(deliveryRoutes.one(DAY, open))).statusCode).toBe(200);
    expect((await d.nam.call.get(deliveryRoutes.one(DAY, open))).statusCode).toBe(403);
    expect((await d.w.office.call.get(deliveryRoutes.photo(DAY, 'nope'))).statusCode).toBe(404);
    // a request that is not there
    const none = '00000000-0000-4000-8000-000000000000';
    expect((await d.tung.call.get(deliveryRoutes.photo(DAY, none))).statusCode).toBe(404);
  });

  it('answers 500 naming the kind when a photo record does not parse', async () => {
    const d = await deliveryTenant();
    const done = await d.delivered();
    const id = done.request.request.id;
    await d.w.t.client.putRecord(d.w.t.keys.deliveryPhoto(DAY, id), { nothing: 'useful' });

    const reply = await d.w.office.call.get(deliveryRoutes.photo(DAY, id));

    expect(reply.statusCode).toBe(500);
    expect(reply.body).not.toContain(id);
  });
});

describe('Row 15: an order’s request is shown while it waits or is delivered', () => {
  it('shows a waiting and a delivered request on its order, and none once the request is cancelled', async () => {
    const d = await deliveryTenant();
    const waiting = await d.sentTo();
    const done = await d.delivered();
    const cancelled = await d.sentTo();
    await d.w.office.call.send('POST', deliveryRoutes.cancel(DAY, cancelled.request.request.id), {
      version: cancelled.request.version,
    });

    expect((await d.w.read(DAY, waiting.order.order.id)).order.request?.id).toBe(
      waiting.request.request.id,
    );
    expect((await d.w.read(DAY, done.order.order.id)).order.request?.id).toBe(
      done.request.request.id,
    );
    expect((await d.w.read(DAY, cancelled.order.order.id)).order.request).toBeNull();
  });
});
