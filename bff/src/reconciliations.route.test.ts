import {
  closeRequestFor,
  deliveryListReplySchema,
  deliveryRoutes,
  driverDay,
  orderRoutes,
  reconciliationListReplySchema,
  reconciliationRoutes,
  reconciliationSchema,
  ROUTES,
  TOTAL_MAX,
} from '@credo/shared';
import { CStorageError, type CStorageClient } from '@credo/shared';
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

const PHOTO = `data:image/png;base64,${Buffer.alloc(10, 1).toString('base64')}`;

/** A client that fails or moves the write of a chosen key, while its plan names it. */
function flaky() {
  const plan: {
    on?: (key: string) => 'throw' | 'moved' | 'lost' | 'theirs' | null;
    /** Runs before a read of the key, once the plan sets it, e.g. to take a record away. */
    beforeGet?: (key: string) => Promise<void>;
  } = {};
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    async getRecord(key) {
      await plan.beforeGet?.(key);
      return client.getRecord(key);
    },
    async putRecord(key, data, ifTag) {
      const what = plan.on?.(key) ?? null;
      if (what === 'throw') throw new CStorageError(503, 'down');
      if (what === 'moved') return 'moved';
      if (what === 'theirs') {
        // another close lands first, and ours fails with its answer lost
        await client.putRecord(key, { ...(data as object), handedIn: 1 }, null);
        throw new CStorageError(503, 'answer lost');
      }
      const saved = await client.putRecord(key, data, ifTag);
      // the write landed and its answer was lost
      if (what === 'lost') throw new CStorageError(503, 'answer lost');
      return saved;
    },
  });
  return { plan, wrap };
}

/** A tenant with its office, a viewer, two drivers who sign in, and the calls a day's end makes. */
async function dayEnd(options: Parameters<typeof ordersTenant>[1] = {}) {
  const w = await ordersTenant(cs, options);
  const tung = await w.t.staff('DRV-S', { department: { 'deliveries.canDeliver': true } });
  const nam = await w.t.staff('DRV-T', { department: { 'deliveries.canDeliver': true } });
  const sentTo = async (driver = tung, over: object = {}) => {
    const sent = await w.confirmed(await w.made(over), driver);
    const request = await w.requestDoc(DAY, sent.order.request!.id, driver.call);
    return { order: sent, request };
  };
  const deliver = async (driver = tung, over: object = {}) => {
    const todo = await sentTo(driver, over);
    const reply = await driver.call.send(
      'POST',
      deliveryRoutes.deliver(DAY, todo.request.request.id),
      { version: todo.request.version, photo: PHOTO },
    );
    expect(reply.statusCode).toBe(200);
    return todo;
  };
  /** The day's requests as the office reads them. */
  const requests = async () =>
    deliveryListReplySchema.parse((await w.office.call.get(deliveryRoutes.list(DAY))).json())
      .deliveries;
  /** The close a page makes of a driver's day as it now is. */
  const asked = async (driver: typeof tung, handedIn: number) =>
    closeRequestFor(driverDay(await requests(), driver.employee.id), handedIn);
  const close = (
    driver: typeof tung,
    body: unknown,
    call: { send: typeof w.office.call.send } = w.office.call,
    day = DAY,
  ) => call.send('POST', reconciliationRoutes.close(day, driver.employee.id), body);
  const closed = async (driver = tung, handedIn = 0) => {
    const reply = await close(driver, await asked(driver, handedIn));
    expect(reply.statusCode).toBe(200);
    return reconciliationSchema.parse(reply.json());
  };
  const listed = async (day = DAY, call: { get: typeof w.office.call.get } = w.office.call) => {
    const reply = await call.get(reconciliationRoutes.list(day));
    expect(reply.statusCode).toBe(200);
    return reconciliationListReplySchema.parse(reply.json()).reconciliations;
  };
  return { w, tung, nam, sentTo, deliver, requests, asked, close, closed, listed };
}

describe('Row 1: the closed days', () => {
  it('A day’s closed days are listed by driver code to those who may see orders, 403 to the others, 401 unsigned, and 400 for a day that is no date', async () => {
    const d = await dayEnd();
    await d.deliver(d.nam);
    await d.deliver(d.tung);
    await d.closed(d.nam, 1);
    await d.closed(d.tung, 2);

    const seen = await d.listed(DAY, d.w.viewer.call);

    expect(seen.map((one) => [one.driver.code, one.handedIn])).toEqual([
      ['DRV-S', 2],
      ['DRV-T', 1],
    ]);
    expect(await d.listed(DAY, d.w.t.rootCall)).toEqual(seen);
    expect(await d.listed('2026-01-01')).toEqual([]);
    const url = reconciliationRoutes.list(DAY);
    expect((await d.w.someone.call.get(url)).statusCode).toBe(403);
    expect((await d.tung.call.get(url)).statusCode).toBe(403);
    expect((await d.w.t.app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await d.w.office.call.get(`${ROUTES.reconciliations}?day=nope`)).statusCode).toBe(400);
  });
});

describe('Rows 4, 11 and 12: the close', () => {
  it('Close the day writes one record under the day and the driver: the delivered requests it covers, their sum made from the records, the cash as typed, the difference, who closed it and the BFF’s clock; the requests still waiting are cancelled and their orders freed to send again', async () => {
    const d = await dayEnd();
    const first = await d.deliver();
    const second = await d.deliver();
    const waiting = await d.sentTo();
    await d.deliver(d.nam);
    const total = first.request.request.total + second.request.request.total;

    const reply = await d.close(d.tung, await d.asked(d.tung, total - 5000));

    expect(reply.statusCode).toBe(200);
    const record = reconciliationSchema.parse(reply.json());
    expect(record).toMatchObject({
      day: DAY,
      driver: d.w.asDriver(d.tung),
      toCollect: total,
      handedIn: total - 5000,
      difference: -5000,
      closedBy: { id: d.w.office.employee.id, code: 'OFFICE', name: d.w.office.employee.name },
    });
    expect(record.requests.map((one) => one.number)).toEqual(
      [first, second].map((one) => one.request.request.number),
    );
    expect(Number.isInteger(record.toCollect) && Number.isInteger(record.difference)).toBe(true);
    expect(record.closedAt).toBeGreaterThan(0);
    // one record, under its key, as the list reads it
    const stored = await d.w.t.client.getRecord(d.w.t.keys.reconciliation(DAY, d.tung.employee.id));
    expect(reconciliationSchema.parse(stored?.data)).toEqual(record);
    expect(await d.listed()).toEqual([record]);
    // the waiting request is cancelled, its order is confirmed with none and offers to send again
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('cancelled');
    const freed = await d.w.read(DAY, waiting.order.order.id);
    expect(freed.order).toMatchObject({ state: 'confirmed', request: null });
    // another driver's day is untouched
    expect((await d.requests()).filter((one) => one.state === 'delivered')).toHaveLength(3);
  });

  it('The root closes without a person: its sign-in name stands in, with no id and no code', async () => {
    const d = await dayEnd();
    await d.deliver();

    const reply = await d.close(d.tung, await d.asked(d.tung, 0), d.w.t.rootCall);

    expect(reconciliationSchema.parse(reply.json()).closedBy).toEqual({
      id: null,
      code: null,
      name: d.w.t.ROOT.name,
    });
  });

  it('A person whose staff record goes between their sign-in and the close closes nothing: a 401, the day’s waiting request is left as it was and no closed day is written', async () => {
    const f = flaky();
    const d = await dayEnd({ wrap: f.wrap });
    await d.deliver();
    const waiting = await d.sentTo();
    const body = await d.asked(d.tung, 0);
    const person = d.w.t.keys.employee(d.w.office.employee.id);
    // the office person holds the right to close; their record goes as the close looks for the day
    f.plan.beforeGet = async (key) => {
      if (!key.includes('.reconciliation.')) return;
      f.plan.beforeGet = undefined;
      await d.w.t.client.removeRecord(person);
    };

    const reply = await d.close(d.tung, body);
    f.plan.beforeGet = undefined;

    expect(reply.statusCode).toBe(401);
    // read by the root: the office person is gone
    const left = await d.w.requestDoc(DAY, waiting.request.request.id, d.w.t.rootCall);
    expect(left.request.state).toBe('waiting');
    expect(await d.listed(DAY, d.w.t.rootCall)).toEqual([]);
  });

  it('A driver whose only request was cancelled closes with nothing to collect and 0', async () => {
    const d = await dayEnd();
    const todo = await d.sentTo();
    await d.w.office.call.send('POST', deliveryRoutes.cancel(DAY, todo.request.request.id), {
      version: todo.request.version,
    });

    const reply = await d.close(d.tung, await d.asked(d.tung, 0));

    expect(reconciliationSchema.parse(reply.json())).toMatchObject({ requests: [], toCollect: 0 });
  });

  it('Cash that is no whole đồng from 0 to the most is a 400, and so is a day whose sum passes the most; nothing is cancelled', async () => {
    const d = await dayEnd();
    const todo = await d.deliver();
    const waiting = await d.sentTo();
    const body = await d.asked(d.tung, 0);

    for (const handedIn of [-1, 0.5, TOTAL_MAX + 1, '5', null]) {
      expect((await d.close(d.tung, { ...body, handedIn })).statusCode, String(handedIn)).toBe(400);
    }
    // a delivered request of the most, written as a second one of the day
    const key = d.w.t.keys.delivery(DAY, todo.request.request.id);
    const stored = (await d.w.t.client.getRecord(key))!;
    const big = { ...(stored.data as object), total: TOTAL_MAX };
    await d.w.t.client.putRecord(key, big, stored.tag);
    const second = d.w.t.keys.delivery(DAY, '00000000-0000-4000-8000-000000000999');
    await d.w.t.client.putRecord(
      second,
      { ...big, id: '00000000-0000-4000-8000-000000000999', number: 'GH-90999' },
      null,
    );
    const heavy = await d.asked(d.tung, 0);
    expect((await d.close(d.tung, heavy)).statusCode).toBe(400);
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('waiting');
    expect(await d.listed()).toEqual([]);
  });
});

describe('Rows 5 and 17: a closed day is final', () => {
  it('A closed day keeps its cash and gap as typed and is not closed twice: the second close is a 409 carrying the day as it is, and a confirm or a send to that driver for that day is a 400', async () => {
    const d = await dayEnd();
    await d.deliver();
    const draft = await d.w.made();
    const record = await d.closed(d.tung, 7);

    const again = await d.close(d.tung, await d.asked(d.tung, 99_999));

    expect(again.statusCode).toBe(409);
    expect(again.json<{ current: { reconciliation: unknown } }>().current.reconciliation).toEqual(
      record,
    );
    expect(await d.listed()).toEqual([record]);
    const refused = await d.w.office.call.send(
      'POST',
      orderRoutes.confirm(DAY, draft.order.id),
      d.w.sendBody(draft, d.tung),
    );
    expect(refused.statusCode).toBe(400);
    expect(JSON.stringify(refused.json())).toContain('not closed');
    // the other driver, and the same driver on another day, are sent as before
    expect(
      (
        await d.w.office.call.send(
          'POST',
          orderRoutes.confirm(DAY, draft.order.id),
          d.w.sendBody(draft, d.nam),
        )
      ).statusCode,
    ).toBe(200);
    const later = await d.w.made();
    expect(
      (
        await d.w.office.call.send(
          'POST',
          orderRoutes.confirm(DAY, later.order.id),
          d.w.sendBody(later, d.tung, { day: '2026-10-29' }),
        )
      ).statusCode,
    ).toBe(200);
    // sending again a cancelled request's order is refused the same way
    const cancelled = await d.sentTo(d.nam);
    await d.w.office.call.send('POST', deliveryRoutes.cancel(DAY, cancelled.request.request.id), {
      version: cancelled.request.version,
    });
    const order = await d.w.read(DAY, cancelled.order.order.id);
    const sendAgain = await d.w.office.call.send(
      'POST',
      orderRoutes.send(DAY, order.order.id),
      d.w.sendBody(order, d.tung),
    );
    expect(sendAgain.statusCode).toBe(400);
  });
});

describe('Row 6: who may close', () => {
  it('Those who may make and send orders close a driver’s day; those who may only see orders, the driver and anyone else are refused, and an unsigned call is a 401', async () => {
    const d = await dayEnd();
    await d.deliver();
    const body = await d.asked(d.tung, 0);

    expect((await d.close(d.tung, body, d.w.viewer.call)).statusCode).toBe(403);
    expect((await d.close(d.tung, body, d.tung.call)).statusCode).toBe(403);
    expect((await d.close(d.tung, body, d.w.someone.call)).statusCode).toBe(403);
    const unsigned = await d.w.t.app.inject({
      method: 'POST',
      url: reconciliationRoutes.close(DAY, d.tung.employee.id),
      payload: body,
    });
    expect(unsigned.statusCode).toBe(401);
    expect(await d.listed()).toEqual([]);
    expect((await d.close(d.tung, body)).statusCode).toBe(200);
  });
});

describe('Rows 7, 14 and 15: the figures are the app’s', () => {
  it('A delivery made between opening the day and closing it closes nothing: the close is a 409 carrying the day as it now is, and a close over the new figures goes through', async () => {
    const d = await dayEnd();
    await d.deliver();
    const waiting = await d.sentTo();
    const stale = await d.asked(d.tung, 0);
    const request = await d.w.requestDoc(DAY, waiting.request.request.id, d.tung.call);
    expect(
      (
        await d.tung.call.send('POST', deliveryRoutes.deliver(DAY, waiting.request.request.id), {
          version: request.version,
          photo: PHOTO,
        })
      ).statusCode,
    ).toBe(200);

    const reply = await d.close(d.tung, stale);

    expect(reply.statusCode).toBe(409);
    const { current } = reply.json<{
      current: { delivered: string[]; waiting: string[]; reconciliation: unknown };
    }>();
    expect(current.delivered).toHaveLength(2);
    expect(current.waiting).toEqual([]);
    expect(current.reconciliation).toBeNull();
    expect(await d.listed()).toEqual([]);
    expect((await d.close(d.tung, await d.asked(d.tung, 0))).statusCode).toBe(200);
  });

  it('A close that names another set of requests than the day holds closes nothing, and a sum typed beside them is refused', async () => {
    const d = await dayEnd();
    const first = await d.deliver();
    const waiting = await d.sentTo();
    const body = await d.asked(d.tung, 0);

    for (const wrong of [
      { ...body, delivered: [] },
      { ...body, waiting: [] },
      { ...body, delivered: [...body.delivered, waiting.request.request.id] },
    ]) {
      expect((await d.close(d.tung, wrong)).statusCode).toBe(409);
    }
    expect(
      (await d.close(d.tung, { ...body, toCollect: first.request.request.total })).statusCode,
    ).toBe(400);
    expect((await d.close(d.tung, { ...body, extra: 1 })).statusCode).toBe(400);
    expect((await d.close(d.tung, { delivered: ['x'], waiting: [], handedIn: 0 })).statusCode).toBe(
      400,
    );
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('waiting');
    expect(await d.listed()).toEqual([]);
  });

  it('A driver with no request that day, a day or a driver that is no id, are a 404', async () => {
    const d = await dayEnd();
    await d.deliver();
    const body = await d.asked(d.tung, 0);

    expect((await d.close(d.nam, body)).statusCode).toBe(404);
    expect((await d.close(d.tung, body, d.w.office.call, '2026-11-30')).statusCode).toBe(404);
    expect((await d.close(d.tung, body, d.w.office.call, 'nope')).statusCode).toBe(404);
    const badId = await d.w.office.call.send(
      'POST',
      reconciliationRoutes.close(DAY, 'not-an-id'),
      body,
    );
    expect(badId.statusCode).toBe(404);
  });
});

describe('Row 16: the close’s writes', () => {
  it('A stop after the waiting requests are cancelled leaves the day open with those cancelled, and the next close, over the day as it now is, goes on', async () => {
    const f = flaky();
    const d = await dayEnd({ wrap: f.wrap });
    await d.deliver();
    const waiting = await d.sentTo();
    f.plan.on = (key) => (key.includes('.reconciliation.') ? 'throw' : null);

    const stopped = await d.close(d.tung, await d.asked(d.tung, 0));
    f.plan.on = undefined;

    expect(stopped.statusCode).toBe(503);
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('cancelled');
    expect(await d.listed()).toEqual([]);
    // the old set names a request that is cancelled now: a 409, and the page reads the day again
    expect((await d.close(d.tung, await d.asked(d.tung, 0))).statusCode).toBe(200);
  });

  it('A request that moved between the read and its cancel stops the close with a 409, and a closed day that landed with its answer lost is the close', async () => {
    const f = flaky();
    const d = await dayEnd({ wrap: f.wrap });
    await d.deliver();
    const waiting = await d.sentTo();
    const body = await d.asked(d.tung, 0);
    f.plan.on = (key) => (key.includes('.delivery.') ? 'moved' : null);
    expect((await d.close(d.tung, body)).statusCode).toBe(409);
    f.plan.on = undefined;
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('waiting');
    expect(await d.listed()).toEqual([]);

    // the closed day is written and its answer is lost: the record is there, the close stands
    f.plan.on = (key) => (key.includes('.reconciliation.') ? 'lost' : null);
    const reply = await d.close(d.tung, await d.asked(d.tung, 3));
    f.plan.on = undefined;
    expect(reply.statusCode).toBe(200);
    expect((await d.listed()).map((one) => one.handedIn)).toEqual([3]);

    // another close sat under the key: the lost answer is a conflict, and the record is theirs
    const e = await dayEnd({ wrap: f.wrap });
    await e.deliver();
    const asked = await e.asked(e.tung, 5);
    f.plan.on = (key) => (key.includes('.reconciliation.') ? 'moved' : null);
    expect((await e.close(e.tung, asked)).statusCode).toBe(409);
    f.plan.on = (key) => (key.includes('.reconciliation.') ? 'theirs' : null);
    expect((await e.close(e.tung, asked)).statusCode).toBe(409);
    f.plan.on = undefined;
    expect((await e.listed()).map((one) => one.handedIn)).toEqual([1]);
  });

  it('An order that moved meanwhile is left as it is: its request reads cancelled whatever it names', async () => {
    const f = flaky();
    const d = await dayEnd({ wrap: f.wrap });
    const waiting = await d.sentTo();
    f.plan.on = (key) => (key.includes('.order.') ? 'throw' : null);

    const stopped = await d.close(d.tung, await d.asked(d.tung, 0));
    f.plan.on = undefined;

    expect(stopped.statusCode).toBe(503);
    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('cancelled');
    expect((await d.w.read(DAY, waiting.order.order.id)).order.request).toBeNull();
  });

  it('An order that no longer names the request is left as it is when the request is cancelled', async () => {
    const d = await dayEnd();
    const waiting = await d.sentTo();
    const key = d.w.t.keys.order(DAY, waiting.order.order.id);
    const stored = (await d.w.t.client.getRecord(key))!;
    const elsewhere = { ...(stored.data as object), request: null };
    await d.w.t.client.putRecord(key, elsewhere, stored.tag);

    expect((await d.close(d.tung, await d.asked(d.tung, 0))).statusCode).toBe(200);

    expect((await d.w.requestDoc(DAY, waiting.request.request.id)).request.state).toBe('cancelled');
    expect((await d.w.t.client.getRecord(key))?.data).toEqual(elsewhere);
  });
});
