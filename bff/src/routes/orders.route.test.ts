import {
  type CStorageClient,
  deliveryDocSchema,
  deliveryListReplySchema,
  deliveryRoutes,
  documentNumberingSchema,
  driverListReplySchema,
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

const listed = async (
  call: { get: (url: string) => Promise<{ json: () => unknown }> },
  from: string,
  to: string,
) => orderListReplySchema.parse((await call.get(orderRoutes.list(from, to))).json()).orders;

describe('Row 1: the permissions to see orders, to make and send them, and to deliver are set as piece 2’s', () => {
  it('lets whoever may see orders read the orders, the requests and the two lists, and no more', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();

    const reads = await Promise.all([
      w.viewer.call.get(orderRoutes.list(DAY, DAY)),
      w.viewer.call.get(orderRoutes.one(DAY, draft.order.id)),
      w.viewer.call.get(deliveryRoutes.list(DAY)),
      w.viewer.call.get(ROUTES.customers),
      w.viewer.call.get(ROUTES.products),
    ]);
    const writes = await Promise.all([
      w.viewer.call.send('POST', ROUTES.orders, w.body()),
      w.viewer.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body(),
        version: draft.version,
      }),
      w.viewer.call.send('POST', orderRoutes.cancel(DAY, draft.order.id), {
        version: draft.version,
      }),
      w.viewer.call.get(ROUTES.drivers),
    ]);

    expect(reads.map((reply) => reply.statusCode)).toEqual([200, 200, 200, 200, 200]);
    expect(writes.map((reply) => reply.statusCode)).toEqual([403, 403, 403, 403]);
  });

  it('refuses whoever may only see orders the confirm, the send and a request’s cancel, and lets them open a request', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const sent = await w.confirmed(await w.made());
    const request = await w.requestDoc(DAY, sent.order.request!.id);

    const writes = await Promise.all([
      w.viewer.call.send('POST', orderRoutes.confirm(DAY, draft.order.id), w.sendBody(draft)),
      w.viewer.call.send('POST', orderRoutes.send(DAY, draft.order.id), w.sendBody(draft)),
      w.viewer.call.send('POST', deliveryRoutes.cancel(DAY, request.request.id), {
        version: request.version,
      }),
    ]);
    const opened = await w.viewer.call.get(deliveryRoutes.one(DAY, request.request.id));

    expect(writes.map((reply) => reply.statusCode)).toEqual([403, 403, 403]);
    expect(opened.statusCode).toBe(200);
  });

  it('lets a person who may deliver, and no more, do none of it: they are only offered in Confirm', async () => {
    const w = await ordersTenant(cs);
    const driver = await w.t.staff('DRV-3', { department: { 'deliveries.canDeliver': true } });

    const replies = await Promise.all([
      driver.call.get(orderRoutes.list(DAY, DAY)),
      driver.call.get(deliveryRoutes.list(DAY)),
      driver.call.get(ROUTES.customers),
      driver.call.send('POST', ROUTES.orders, w.body()),
      w.someone.call.get(orderRoutes.list(DAY, DAY)),
    ]);
    const offered = driverListReplySchema.parse((await w.office.call.get(ROUTES.drivers)).json());

    expect(replies.map((reply) => reply.statusCode)).toEqual([403, 403, 403, 403, 403]);
    expect(offered.drivers.map((driver) => driver.code)).toEqual(['DRV-1', 'DRV-2', 'DRV-3']);
  });

  it('keeps the two imports the root’s alone, whatever orders a person may do', async () => {
    const w = await ordersTenant(cs);

    const sent = await w.office.call.send('POST', '/api/customers/import', { rows: [] });

    expect(sent.statusCode).toBe(403);
  });
});

describe('Row 2: the orders list is the last 7 days, newest first', () => {
  it('lists the orders of the days asked, the newest day first and within a day the later number first, with the driver of one sent', async () => {
    const w = await ordersTenant(cs);
    const first = await w.made({ day: '2026-10-25' });
    const second = await w.made({ day: '2026-10-27' });
    const third = await w.made({ day: '2026-10-27' });
    const sent = await w.confirmed(third);
    await w.made({ day: '2026-10-10' });

    const week = await listed(w.office.call, '2026-10-21', '2026-10-27');
    const earlier = await listed(w.office.call, '2026-10-14', '2026-10-20');

    expect(week.map((one) => one.number)).toEqual(['DH-00003', 'DH-00002', 'DH-00001']);
    expect(week.map((one) => [one.day, one.state, one.total])).toEqual([
      ['2026-10-27', 'confirmed', 1_590_000],
      ['2026-10-27', 'draft', 1_590_000],
      ['2026-10-25', 'draft', 1_590_000],
    ]);
    expect(week[0].customer.name).toBe('Anh Hùng');
    expect(week[0].request?.driver.code).toBe('DRV-1');
    expect(week[1].request).toBeNull();
    expect(earlier).toEqual([]);
    expect([first.order.id, second.order.id, sent.order.id]).toHaveLength(3);
  });

  it('refuses a span of more than 7 days, a span backwards and a day that is no day, 400', async () => {
    const w = await ordersTenant(cs);

    const replies = await Promise.all([
      w.office.call.get(orderRoutes.list('2026-10-20', '2026-10-27')),
      w.office.call.get(orderRoutes.list('2026-10-27', '2026-10-26')),
      w.office.call.get(orderRoutes.list('2026-10-27', '2026-02-30')),
      w.office.call.get(ROUTES.orders),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400, 400, 400]);
  });
});

describe('Row 3 and 4: a new order is priced by the app, and a confirmed one keeps its prices and customer', () => {
  it('prices each line at the product’s price and sums the total, with the unit and the amount of each line', async () => {
    const w = await ordersTenant(cs);

    const { order } = await w.made({
      lines: [
        { productId: w.ids.sand, quantity: 2 },
        { productId: w.ids.fee, quantity: 1 },
      ],
    });

    expect(
      order.lines.map((line) => [line.code, line.unit, line.price, line.quantity, line.amount]),
    ).toEqual([
      ['VT-2', 'm³', 320000, 2, 640000],
      ['DV-1', 'lần', 50000, 1, 50000],
    ]);
    expect(order.total).toBe(690000);
    expect(order.customer).toMatchObject({ code: 'KH-1', name: 'Anh Hùng' });
    expect(order.state).toBe('draft');
  });

  it('refuses a product twice, a price or a total sent, a quantity that is no whole unit, and a customer or product the lists lack, 400, and writes nothing', async () => {
    const w = await ordersTenant(cs);
    const line = { productId: w.ids.cement, quantity: 1 };
    const unknown = '00000000-0000-4000-8000-000000000000';

    const replies = await Promise.all(
      [
        { lines: [line, line] },
        { lines: [{ ...line, price: 1 }] },
        { total: 1 },
        { lines: [{ ...line, quantity: 1.5 }] },
        { lines: [{ ...line, quantity: 0 }] },
        { customerId: unknown },
        { lines: [{ productId: unknown, quantity: 1 }] },
      ].map((over) => w.office.call.send('POST', ROUTES.orders, w.body(over))),
    );

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400, 400, 400, 400, 400, 400]);
    expect(await listed(w.office.call, DAY, DAY)).toEqual([]);
  });

  it('keeps a confirmed order’s prices, and its customer’s phone and address, as they were, when the lists change after', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const sent = await w.confirmed(draft);
    const keys = w.t.keys;
    await w.t.client.putRecord(keys.product(w.ids.cement), {
      id: w.ids.cement,
      code: 'VT-1',
      name: 'Xi măng đổi',
      unit: 'bao',
      price: 1,
      stocked: true,
      extra: {},
    });
    await w.t.client.putRecord(keys.customer(w.ids.anh), {
      id: w.ids.anh,
      code: 'KH-1',
      name: 'Anh Hùng đổi',
      extra: { phone: '0000', address: 'nơi khác' },
    });

    const again = await w.read(DAY, sent.order.id);
    const request = await w.requestDoc(DAY, again.order.request!.id);

    expect(again.order.total).toBe(1_590_000);
    expect(again.order.lines[0].price).toBe(95000);
    expect(again.order.customer.name).toBe('Anh Hùng');
    expect(again.order.customer.extra).toEqual({ phone: '0901 111 222', address: '12 Lê Lợi' });
    expect(request.request.customer.extra).toEqual({ phone: '0901 111 222', address: '12 Lê Lợi' });
  });
});

describe('Row 5: a draft is saved and changed again, or confirmed; a confirmed order is not changed', () => {
  it('changes a draft over its version, repricing it, and keeps its number', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();

    const saved = w.orderDoc(
      await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body({ customerId: w.ids.lan, lines: [{ productId: w.ids.sand, quantity: 1 }] }),
        version: draft.version,
      }),
    );

    expect(saved.order.number).toBe(draft.order.number);
    expect(saved.order.customer.code).toBe('KH-2');
    expect(saved.order.total).toBe(320000);
    expect(saved.version).not.toBe(draft.version);
    expect((await w.read(DAY, draft.order.id)).order.total).toBe(320000);
  });

  it('refuses a save of a confirmed order, 409, and the order stays as it was', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());

    const reply = await w.office.call.send('PUT', orderRoutes.one(DAY, sent.order.id), {
      ...w.body({ lines: [{ productId: w.ids.fee, quantity: 1 }] }),
      version: sent.version,
    });

    expect(reply.statusCode).toBe(409);
    expect(reply.json<{ current: { order: { total: number } } }>().current.order.total).toBe(
      1_590_000,
    );
    expect((await w.read(DAY, sent.order.id)).order.total).toBe(1_590_000);
  });
});

describe('Row 6: each order and each request has a number that is never given twice', () => {
  it('numbers orders DH- and requests GH-, counting past a cancelled one’s', async () => {
    const w = await ordersTenant(cs);
    const one = await w.made();
    await w.cancelled(one);
    const two = await w.made();
    const sent = await w.confirmed(two);
    const request = await w.requestDoc(DAY, sent.order.request!.id);

    expect([one.order.number, two.order.number]).toEqual(['DH-00001', 'DH-00002']);
    expect(request.request.number).toBe('GH-00001');
    const cancelRequest = await w.office.call.send(
      'POST',
      deliveryRoutes.cancel(DAY, request.request.id),
      { version: request.version },
    );
    expect(cancelRequest.statusCode).toBe(200);
    const after = await w.read(DAY, two.order.id);
    const again = w.orderDoc(
      await w.office.call.send('POST', orderRoutes.send(DAY, two.order.id), w.sendBody(after)),
    );
    expect(again.order.request?.number).toBe('GH-00002');
    expect((await w.made()).order.number).toBe('DH-00003');
    const numbering = await w.t.client.getRecord(w.t.keys.documentNumbering);
    expect(documentNumberingSchema.parse(numbering!.data)).toEqual({ orders: 3, requests: 2 });
  });
});

describe('Row 7: Confirm names a driver and a day, and makes the order confirmed with its request', () => {
  it('confirms a draft to a driver on a day, and the order shows the request’s number, driver and day', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();

    const sent = await w.confirmed(draft, w.driverTwo, { day: '2026-10-29' });

    expect(sent.order.state).toBe('confirmed');
    expect(sent.order.request).toMatchObject({
      number: 'GH-00001',
      day: '2026-10-29',
      driver: w.asDriver(w.driverTwo),
    });
  });

  it('refuses a day before the order’s, a driver who may not deliver, one who left and one who is no one, 400, and sends nothing', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const left = await w.t.staff(
      'LEFT',
      {
        department: { 'deliveries.canDeliver': true },
      },
      {},
    );
    const archive = await w.t.rootCall.send('POST', `/api/employees/${left.employee.id}/archive`, {
      version: (await w.t.rootCall.get(`/api/employees/${left.employee.id}`)).json<{
        version: string;
      }>().version,
    });
    expect(archive.statusCode).toBe(200);
    const confirm = (over: object) =>
      w.office.call.send(
        'POST',
        orderRoutes.confirm(DAY, draft.order.id),
        w.sendBody(draft, w.driverOne, over),
      );

    const replies = await Promise.all([
      confirm({ day: '2026-10-27' }),
      confirm({ driverId: w.someone.employee.id }),
      confirm({ driverId: left.employee.id }),
      confirm({ driverId: '00000000-0000-4000-8000-000000000000' }),
    ]);

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400, 400, 400]);
    expect((await w.read(DAY, draft.order.id)).order.state).toBe('draft');
    const requests = deliveryListReplySchema.parse(
      (await w.office.call.get(deliveryRoutes.list(DAY))).json(),
    );
    expect(requests.deliveries).toEqual([]);
  });
});

describe('Row 8: a request carries the order’s number, customer, lines and total, and an order has one at a time', () => {
  it('makes the request with the order’s number, its customer as at the order, the lines and the total to collect', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());

    const { request } = await w.requestDoc(DAY, sent.order.request!.id);

    expect(request).toMatchObject({
      number: 'GH-00001',
      state: 'waiting',
      day: DAY,
      total: 1_590_000,
      order: { id: sent.order.id, day: DAY, number: 'DH-00001' },
      driver: w.asDriver(w.driverOne),
    });
    expect(request.customer.extra).toEqual({ phone: '0901 111 222', address: '12 Lê Lợi' });
    expect(request.lines.map((line) => [line.code, line.quantity])).toEqual([
      ['VT-1', 10],
      ['VT-2', 2],
    ]);
  });

  it('refuses to confirm or send an order that has a request waiting, 409, and makes no second request', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());

    const confirm = await w.office.call.send(
      'POST',
      orderRoutes.confirm(DAY, sent.order.id),
      w.sendBody(sent),
    );
    const send = await w.office.call.send(
      'POST',
      orderRoutes.send(DAY, sent.order.id),
      w.sendBody(sent),
    );

    expect([confirm.statusCode, send.statusCode]).toEqual([409, 409]);
    const requests = deliveryListReplySchema.parse(
      (await w.office.call.get(deliveryRoutes.list(DAY))).json(),
    );
    expect(requests.deliveries).toHaveLength(1);
  });
});

describe('Row 9: delivery requests show a day’s, and the office opens one', () => {
  it('lists a day’s requests by driver code and then number, and no other day’s, and opens one', async () => {
    const w = await ordersTenant(cs);
    const a = await w.confirmed(await w.made(), w.driverTwo);
    const b = await w.confirmed(await w.made(), w.driverOne);
    const c = await w.confirmed(await w.made(), w.driverTwo);
    await w.confirmed(await w.made(), w.driverOne, { day: '2026-10-29' });

    const reply = await w.office.call.get(deliveryRoutes.list(DAY));
    const requests = deliveryListReplySchema.parse(reply.json()).deliveries;
    const opened = deliveryDocSchema.parse(
      (await w.office.call.get(deliveryRoutes.one(DAY, requests[0].id))).json(),
    );

    expect(requests.map((one) => [one.driver.code, one.number])).toEqual([
      ['DRV-1', 'GH-00002'],
      ['DRV-2', 'GH-00001'],
      ['DRV-2', 'GH-00003'],
    ]);
    expect(opened.request.order.id).toBe(b.order.id);
    expect([a.order.id, c.order.id]).toHaveLength(2);
  });
});

describe('Row 10: the office cancels a waiting request, and its order offers to send it again', () => {
  it('cancels the request, leaves the order confirmed with no request, and sends it again as a new request with a new number', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());
    const first = await w.requestDoc(DAY, sent.order.request!.id);

    const cancel = await w.office.call.send('POST', deliveryRoutes.cancel(DAY, first.request.id), {
      version: first.version,
    });
    const afterCancel = await w.read(DAY, sent.order.id);
    const again = w.orderDoc(
      await w.office.call.send(
        'POST',
        orderRoutes.send(DAY, sent.order.id),
        w.sendBody(afterCancel, w.driverTwo),
      ),
    );

    expect(deliveryDocSchema.parse(cancel.json()).request.state).toBe('cancelled');
    expect(afterCancel.order).toMatchObject({ state: 'confirmed', request: null });
    expect(again.order.request).toMatchObject({
      number: 'GH-00002',
      driver: w.asDriver(w.driverTwo),
    });
    expect((await w.requestDoc(DAY, first.request.id)).request.state).toBe('cancelled');
    expect((await w.requestDoc(DAY, again.order.request!.id)).request.state).toBe('waiting');
  });

  it('refuses a request already cancelled, 409', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());
    const first = await w.requestDoc(DAY, sent.order.request!.id);
    await w.office.call.send('POST', deliveryRoutes.cancel(DAY, first.request.id), {
      version: first.version,
    });

    const second = await w.office.call.send('POST', deliveryRoutes.cancel(DAY, first.request.id), {
      version: first.version,
    });

    expect(second.statusCode).toBe(409);
    expect(second.json<{ current: { request: { state: string } } }>().current.request.state).toBe(
      'cancelled',
    );
  });
});

describe('Row 11: the office cancels a draft, or a confirmed order whose request waits', () => {
  it('cancels a draft, which stays in the list as cancelled under its number', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();

    const done = await w.cancelled(draft);

    expect(done.order).toMatchObject({ state: 'cancelled', number: 'DH-00001', request: null });
    expect((await listed(w.office.call, DAY, DAY)).map((one) => one.state)).toEqual(['cancelled']);
  });

  it('cancels a confirmed order and its waiting request with it', async () => {
    const w = await ordersTenant(cs);
    const sent = await w.confirmed(await w.made());

    const done = await w.cancelled(sent);

    expect(done.order).toMatchObject({ state: 'cancelled', request: null });
    expect((await w.requestDoc(DAY, sent.order.request!.id)).request.state).toBe('cancelled');
  });

  it('refuses to cancel an order already cancelled, 409', async () => {
    const w = await ordersTenant(cs);
    const done = await w.cancelled(await w.made());

    const reply = await w.office.call.send('POST', orderRoutes.cancel(DAY, done.order.id), {
      version: done.version,
    });

    expect(reply.statusCode).toBe(409);
  });
});

describe('Row 12: a save or a confirm over someone else’s newer one is refused and offers theirs', () => {
  it('answers 409 with the current order to a save over a version that moved, and to a confirm over one, and changes nothing', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const theirs = w.orderDoc(await w.viewer.call.get(orderRoutes.one(DAY, draft.order.id)));
    const other = await w.t.staff('OFFICE-2', {
      own: { 'orders.canView': true, 'orders.canEdit': true },
    });
    const newer = w.orderDoc(
      await other.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body({ lines: [{ productId: w.ids.fee, quantity: 3 }] }),
        version: theirs.version,
      }),
    );

    const save = await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
      ...w.body(),
      version: draft.version,
    });
    const confirm = await w.office.call.send(
      'POST',
      orderRoutes.confirm(DAY, draft.order.id),
      w.sendBody(draft),
    );

    expect([save.statusCode, confirm.statusCode]).toEqual([409, 409]);
    for (const reply of [save, confirm]) {
      expect(reply.json<{ current: { version: string } }>().current.version).toBe(newer.version);
    }
    expect((await w.read(DAY, draft.order.id)).order.total).toBe(150000);
    expect((await w.read(DAY, draft.order.id)).version).toBe(newer.version);
    expect(
      deliveryListReplySchema.parse((await w.office.call.get(deliveryRoutes.list(DAY))).json())
        .deliveries,
    ).toEqual([]);
  });

  it('offers no driver when no one may deliver, and refuses a confirm, 400', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const setup = (await w.t.rootCall.get('/api/staff-setup')).json<{
      setup: { departments: object[]; positions: object[]; extra: object };
      version: string;
    }>();
    const without = {
      ...setup.setup,
      departments: setup.setup.departments.map((unit) => ({ ...unit, permissions: {} })),
    };
    const saved = await w.t.rootCall.send('PUT', '/api/staff-setup', {
      setup: without,
      version: setup.version,
    });
    expect(saved.statusCode).toBe(200);

    const drivers = await w.t.rootCall.get(ROUTES.drivers);
    const confirm = await w.t.rootCall.send(
      'POST',
      orderRoutes.confirm(DAY, draft.order.id),
      w.sendBody(draft),
    );

    expect(driverListReplySchema.parse(drivers.json()).drivers).toEqual([]);
    expect(confirm.statusCode).toBe(400);
  });
});

/** The re-save of a draft, row by row of the edit-an-order plan. */
describe('Edit row 1: a draft’s save stores the customer, the lines and the order’s own extra', () => {
  it('stores them, keeps the number, and answers the order with its new version', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made({ extra: { note: 'gate code 4' } });

    const saved = w.orderDoc(
      await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body({
          customerId: w.ids.lan,
          lines: [{ productId: w.ids.fee, quantity: 2 }],
          extra: { note: 'gate code 4', floor: 3 },
        }),
        version: draft.version,
      }),
    );

    const stored = await w.read(DAY, draft.order.id);
    expect(saved).toEqual(stored);
    expect(saved.version).not.toBe(draft.version);
    expect(saved.order).toMatchObject({
      number: draft.order.number,
      state: 'draft',
      total: 100000,
      extra: { note: 'gate code 4', floor: 3 },
    });
    expect(saved.order.customer.code).toBe('KH-2');
    expect(saved.order.lines.map((line) => [line.code, line.quantity])).toEqual([['DV-1', 2]]);
  });
});

describe('Edit row 4: only a draft is saved; a confirmed, a fulfilled and a cancelled order are refused', () => {
  it('answers 409 with the order as it is now to each, and writes nothing', async () => {
    const w = await ordersTenant(cs);
    const driver = await w.t.staff('DRV-S', { department: { 'deliveries.canDeliver': true } });
    const confirmed = await w.confirmed(await w.made());
    const toDeliver = await w.confirmed(await w.made(), driver);
    const request = await w.requestDoc(DAY, toDeliver.order.request!.id, driver.call);
    const delivered = await driver.call.send(
      'POST',
      deliveryRoutes.deliver(DAY, request.request.id),
      {
        version: request.version,
        photo: `data:image/png;base64,${Buffer.alloc(10, 1).toString('base64')}`,
      },
    );
    expect(delivered.statusCode).toBe(200);
    const fulfilled = await w.read(DAY, toDeliver.order.id);
    const cancelled = await w.cancelled(await w.made());
    expect([confirmed, fulfilled, cancelled].map((doc) => doc.order.state)).toEqual([
      'confirmed',
      'fulfilled',
      'cancelled',
    ]);

    for (const doc of [confirmed, fulfilled, cancelled]) {
      const before = await w.t.client.getRecord(w.t.keys.order(DAY, doc.order.id));
      const reply = await w.office.call.send('PUT', orderRoutes.one(DAY, doc.order.id), {
        ...w.body({ lines: [{ productId: w.ids.fee, quantity: 1 }] }),
        version: doc.version,
      });

      expect(reply.statusCode).toBe(409);
      expect(reply.json<{ current: unknown }>().current).toEqual(await w.read(DAY, doc.order.id));
      expect(await w.t.client.getRecord(w.t.keys.order(DAY, doc.order.id))).toEqual(before);
    }
  });
});

describe('Edit row 5: a version that is not a tag is a 400, never a conflict', () => {
  it('refuses a version that is no tag, whatever the order’s state', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    const sent = await w.confirmed(await w.made());
    const url = (doc: typeof draft) => orderRoutes.one(DAY, doc.order.id);
    const bad = ['x', 'A'.repeat(64), 'a'.repeat(63), 7, null];

    const replies = await Promise.all(
      [draft, sent].flatMap((doc) =>
        bad.map((version) => w.office.call.send('PUT', url(doc), { ...w.body(), version })),
      ),
    );

    expect(replies.map((reply) => reply.statusCode)).toEqual(bad.concat(bad).map(() => 400));
    expect((await w.read(DAY, draft.order.id)).version).toBe(draft.version);
  });
});

describe('Edit row 6: a first save carrying a version is refused', () => {
  it('answers 400 and makes no order, whether the version is a tag or not', async () => {
    const w = await ordersTenant(cs);

    const replies = await Promise.all(
      ['a'.repeat(64), 'x'].map((version) =>
        w.office.call.send('POST', ROUTES.orders, { ...w.body(), version }),
      ),
    );

    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400]);
    expect(await listed(w.office.call, DAY, DAY)).toEqual([]);
    expect(
      documentNumberingSchema.safeParse(
        (await w.t.client.getRecord(w.t.keys.documentNumbering))?.data,
      ).success,
    ).toBe(false);
  });
});

describe('Edit row 7: a save reprices every line at the products’ prices as they are now', () => {
  it('takes today’s price for a line whose product moved, and answers the repriced total', async () => {
    const w = await ordersTenant(cs);
    const draft = await w.made();
    expect(draft.order.total).toBe(1_590_000);
    await w.t.client.putRecord(w.t.keys.product(w.ids.cement), {
      id: w.ids.cement,
      code: 'VT-1',
      name: 'Xi măng',
      unit: 'bao',
      price: 100000,
      stocked: true,
      extra: {},
    });
    expect((await w.read(DAY, draft.order.id)).order.total).toBe(1_590_000);

    const saved = w.orderDoc(
      await w.office.call.send('PUT', orderRoutes.one(DAY, draft.order.id), {
        ...w.body(),
        version: draft.version,
      }),
    );

    expect(saved.order.lines.map((line) => [line.code, line.price, line.amount])).toEqual([
      ['VT-1', 100000, 1_000_000],
      ['VT-2', 320000, 640000],
    ]);
    expect(saved.order.total).toBe(1_640_000);
    expect((await w.read(DAY, draft.order.id)).order.total).toBe(1_640_000);
  });
});

describe('Row 3 and 4, by key: a save reads only the customer and the products it names', () => {
  it('gets the customer and each product once by its key, lists nothing, and refuses one the company lacks, 400', async () => {
    const reads: string[] = [];
    const w = await ordersTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        getRecord: (key) => (reads.push(`get ${key}`), client.getRecord(key)),
        listRecords: (prefix, after) => (
          reads.push(`list ${prefix}`),
          client.listRecords(prefix, after)
        ),
      }),
    });
    const unknown = '00000000-0000-4000-8000-000000000000';
    reads.length = 0;

    await w.made({
      lines: [
        { productId: w.ids.sand, quantity: 2 },
        { productId: w.ids.fee, quantity: 1 },
      ],
    });
    const own = w.t.keys;
    const priced = reads.filter(
      (read) => read.includes('.customer.') || read.includes('.product.'),
    );
    expect(priced.sort()).toEqual(
      [
        `get ${own.customer(w.ids.anh)}`,
        `get ${own.product(w.ids.sand)}`,
        `get ${own.product(w.ids.fee)}`,
      ].sort(),
    );

    const replies = await Promise.all(
      [{ customerId: unknown }, { lines: [{ productId: unknown, quantity: 1 }] }].map((over) =>
        w.office.call.send('POST', ROUTES.orders, w.body(over)),
      ),
    );
    expect(replies.map((reply) => reply.statusCode)).toEqual([400, 400]);
  });
});
