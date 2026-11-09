import { ROOT_NAME } from '@credo/bff/clients';
import {
  type CStorageClient,
  employeeRoutes,
  deliveryRoutes,
  deliveryRequestSchema,
  employeeSchema,
  orderRoutes,
  orderSchema,
  normaliseSignInName,
  reconciliationRoutes,
  reconciliationSchema,
  recordKeys,
  ROUTES,
} from '@credo/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyCopy, HISTORY_DAYS } from './apply';
import { staffSetupOf } from './company';
import { addDays, atMinute } from './days';
import { readLedger, SEED_BLOCKS, writeLedger } from './ledger';
import { plannedDeliveries, plannedOrders } from './orders';
import { closeOf } from './reconcile';
import { MANAGER, SCENARIOS } from './scenarios';
import { ANCHOR, dayEvents, staffAsOf } from './staff';
import {
  A1,
  A2,
  fresh,
  make,
  tenantOf,
  everything,
  hooked,
  down,
  asRoot,
  TODAY,
  useCStorage,
} from './apply-support';

useCStorage();

describe('the copy’s orders, deliveries and closed days, written with the first fill', () => {
  const FIRST = '2026-10-22';
  const PAST = Array.from({ length: HISTORY_DAYS }, (_, at) => addDays(FIRST, at));
  const read = async (root: Awaited<ReturnType<typeof asRoot>>, url: string) =>
    (await root('GET', url)).json<Record<string, unknown[]>>();
  const requestsOf = async (root: Awaited<ReturnType<typeof asRoot>>, day: string) =>
    (await read(root, deliveryRoutes.list(day))).deliveries.map((one) =>
      deliveryRequestSchema.parse(one),
    );
  const ordersOf = async (root: Awaited<ReturnType<typeof asRoot>>, day: string) =>
    (await read(root, orderRoutes.list(day, day))).orders.map((one) => orderSchema.parse(one));
  const closedOf = async (root: Awaited<ReturnType<typeof asRoot>>, day: string) =>
    (await read(root, reconciliationRoutes.list(day))).reconciliations.map((one) =>
      reconciliationSchema.parse(one),
    );

  let storage: CStorageClient;
  let root: Awaited<ReturnType<typeof asRoot>>;
  let id: string;
  let lines: string[];
  beforeAll(async () => {
    storage = await fresh();
    const made = await make(storage, A1);
    root = await asRoot(storage, A1.code, made.password);
    lines = [];
    await applyCopy(storage, A1, TODAY, (line) => lines.push(line));
    id = await tenantOf(storage, A1.code);
  });

  it('row 13: the week holds each day’s planned orders, none on a Sunday, most sent, a few left drafts, a few cancelled', async () => {
    let drafts = 0;
    let cancelled = 0;
    let sent = 0;
    for (const day of PAST) {
      const held = await ordersOf(root, day);
      const planned = plannedOrders(A1.client, A1.scenario, day);
      expect(held).toHaveLength(planned.length);
      expect(held.map((one) => `${one.customer.code}|${one.madeAt}`).sort()).toEqual(
        planned.map((one) => `${one.customer}|${one.madeAt}`).sort(),
      );
      drafts += held.filter((one) => one.state === 'draft').length;
      cancelled += held.filter((one) => one.state === 'cancelled').length;
      sent += held.filter((one) => ['confirmed', 'fulfilled'].includes(one.state)).length;
    }
    expect(await ordersOf(root, '2026-10-25')).toEqual([]);
    expect(sent).toBeGreaterThan(drafts + cancelled);
    expect(drafts + cancelled).toBeGreaterThan(0);
    expect(lines).toContain(`${A1.code}: 2026-10-25 applied, 0 events`);
    expect(
      lines.some((line) =>
        /: 2026-10-22 orders: \d+ saved, \d+ sent, \d+ cancelled, \d+ left drafts$/.test(line),
      ),
    ).toBe(true);
  });

  it('row 9: every request of a past day was delivered or cancelled, the delivered with a photo under 10 KB and their orders fulfilled; the requests for today wait', async () => {
    const keys = recordKeys.tenant(id);
    let delivered = 0;
    for (const day of PAST) {
      const requests = await requestsOf(root, day);
      for (const request of requests) {
        expect(['delivered', 'cancelled']).toContain(request.state);
        if (request.state !== 'delivered') continue;
        delivered++;
        const photo = (await storage.getRecord(keys.deliveryPhoto(day, request.id)))!.data as {
          photo: string;
        };
        expect(photo.photo.length).toBeLessThan(14_000);
        const order = (await storage.getRecord(keys.order(request.order.day, request.order.id)))!
          .data as { state: string };
        expect(order.state).toBe('fulfilled');
        expect(request.deliveredAt).toBeGreaterThan(request.madeAt);
      }
    }
    const today = await requestsOf(root, TODAY);
    const planned = plannedDeliveries(A1.client, A1.scenario, TODAY).filter(
      (one) => one.madeAt < atMinute(TODAY, 0),
    );
    const waiting = today.filter((request) => request.state === 'waiting');
    expect(waiting).toHaveLength(planned.length);
    expect(today.every((request) => ['waiting', 'cancelled'].includes(request.state))).toBe(true);
    expect(delivered).toBeGreaterThan(20);
    expect(lines).toContain(`${A1.code}: ${waiting.length} requests wait for ${TODAY}, today`);
    expect(
      lines.some((line) => /requests delivered with a photo, the largest \d+ bytes$/.test(line)),
    ).toBe(true);
  });

  it('row 9: every past driver’s day with a request was closed by the office’s manager, with the cash the scenario’s odds hand in, and today’s are open', async () => {
    const closer = SCENARIOS.S1.reconciliation.closer;
    const manager = staffAsOf(A1.client, A1.scenario, ANCHOR).find(
      (one) => one.department === closer && one.position === MANAGER,
    )!;
    let gaps = 0;
    for (const day of PAST) {
      const requests = await requestsOf(root, day);
      const closed = await closedOf(root, day);
      const drivers = new Set(
        requests.filter((one) => one.state === 'delivered').map((one) => one.driver.id),
      );
      expect(closed.map((one) => one.driver.id).sort()).toEqual([...drivers].sort());
      for (const one of closed) {
        const expected = closeOf(A1.client, A1.scenario, day, one.driver.code, one.toCollect);
        expect(one.handedIn).toBe(expected.handedIn);
        expect(one.closedAt).toBe(expected.at);
        expect(one.closedBy.code).toBe(manager.code);
        if (one.difference !== 0) gaps++;
      }
    }
    expect(gaps).toBeGreaterThan(0);
    expect(await closedOf(root, TODAY)).toEqual([]);
  });

  it('row 28: the ledger names the blocks, and a copy filled without them keeps its staff’s days and gets no order', async () => {
    expect((await readLedger(storage, id))!.ledger.blocks).toEqual([...SEED_BLOCKS]);
    const other = await fresh();
    const made = await make(other, A2);
    const otherId = await tenantOf(other, A2.code);
    const otherRoot = await asRoot(other, A2.code, made.password);
    await writeLedger(
      other,
      otherId,
      { client: 'A', scenario: 'S1', firstDay: FIRST, lastDay: addDays(FIRST, -1), filled: false },
      null,
    );
    const quiet: string[] = [];

    const report = await applyCopy(other, A2, TODAY, (line) => quiet.push(line));

    expect(report).toMatchObject({ status: 'ok', filled: true });
    expect(report.days).toHaveLength(HISTORY_DAYS);
    for (const day of PAST) {
      expect(await ordersOf(otherRoot, day)).toEqual([]);
      expect(await requestsOf(otherRoot, day)).toEqual([]);
    }
    expect(quiet.some((line) => line.includes('orders:') || line.includes('deliveries:'))).toBe(
      false,
    );
    expect((await readLedger(other, otherId))!.ledger.blocks).toBeUndefined();
  });

  it('row 27: a day applied again finds its orders there, its requests delivered and its days closed, and writes none twice', async () => {
    const before = (await everything(storage, A1.code)).filter(
      ({ key }) => !key.includes('.session.'),
    );
    const ledger = (await readLedger(storage, id))!;
    const last = addDays(TODAY, -1);
    await writeLedger(storage, id, { ...ledger.ledger, lastDay: addDays(last, -1) }, ledger.tag);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report).toMatchObject({ status: 'ok', days: [last] });
    const orders = plannedOrders(A1.client, A1.scenario, last).length;
    expect(
      report.skipped.filter((line) => /^the order of .* is already there$/.test(line)),
    ).toHaveLength(orders);
    expect(report.skipped.some((line) => /^GH-\d+ is already delivered$/.test(line))).toBe(true);
    expect(report.skipped.some((line) => line.endsWith(`'s ${last} is already closed`))).toBe(true);
    const after = (await everything(storage, A1.code)).filter(
      ({ key }) => !key.includes('.session.') && !key.endsWith('.seed'),
    );
    expect(after.map(({ key }) => key).sort()).toEqual(
      before
        .filter(({ key }) => !key.endsWith('.seed'))
        .map(({ key }) => key)
        .sort(),
    );
  });

  it('row 24: a request whose driver was archived by its users is left waiting and named, its driver’s day left open', async () => {
    const other = await fresh();
    const made = await make(other, A1);
    const otherRoot = await asRoot(other, A1.code, made.password);
    const otherId = await tenantOf(other, A1.code);
    await applyCopy(other, A1, TODAY);
    const waiting = (await requestsOf(otherRoot, TODAY)).find((one) => one.state === 'waiting')!;
    const person = (await read(otherRoot, ROUTES.employees)).employees
      .map((one) => employeeSchema.parse(one))
      .find((one) => one.code === waiting.driver.code)!;
    const doc = (await otherRoot('GET', employeeRoutes.one(person.id))).json<{ version: string }>();
    expect(
      (await otherRoot('POST', employeeRoutes.archive(person.id), { version: doc.version }))
        .statusCode,
    ).toBeLessThan(300);

    const report = await applyCopy(other, A1, addDays(TODAY, 1));

    expect(report.status).toBe('ok');
    expect(report.skipped).toContain(
      `${waiting.number}: its driver has left or may no longer deliver, left waiting`,
    );
    expect(report.skipped).toContain(
      `${waiting.driver.code}'s ${TODAY} has a request still waiting, left open`,
    );
    const again = (await requestsOf(otherRoot, TODAY)).find((one) => one.id === waiting.id)!;
    expect(again.state).toBe('waiting');
    expect(
      (await closedOf(otherRoot, TODAY)).some((one) => one.driver.id === waiting.driver.id),
    ).toBe(false);
    expect((await readLedger(other, otherId))!.ledger.lastDay).toBe(TODAY);
  });

  it('row 24: a driver with no sign-in record stops the run, an office manager with none leaves the days open and named', async () => {
    const other = await fresh();
    await make(other, A1);
    const otherId = await tenantOf(other, A1.code);
    const closer = staffAsOf(A1.client, A1.scenario, ANCHOR).find(
      (one) => one.department === SCENARIOS.S1.reconciliation.closer && one.position === MANAGER,
    )!;
    const hideUsers = (hide: (name: string) => boolean): CStorageClient => ({
      ...other,
      getRecord: (key) =>
        key.startsWith(`tenant.${otherId}.user.`) &&
        hide(key.slice(`tenant.${otherId}.user.`.length))
          ? Promise.resolve(null)
          : other.getRecord(key),
    });
    const closerName = normaliseSignInName(closer.code);

    await expect(
      applyCopy(
        hideUsers((name) => name !== ROOT_NAME && name !== closerName),
        A1,
        TODAY,
      ),
    ).rejects.toThrow(/found no sign-in record for/);

    const second = await applyCopy(
      hideUsers((name) => name === closerName),
      A1,
      TODAY,
    );

    expect(second.skipped.some((line) => line.includes('the office manager has no sign-in'))).toBe(
      true,
    );
  });

  it('row 24: a refusal of a driver’s session that is not the driver leaving stops the run, never a skip', async () => {
    const other = await fresh();
    await make(other, A1);
    const broken: CStorageClient = {
      ...other,
      getRecord: async (key) => {
        const found = await other.getRecord(key);
        const user = (found?.data as { user?: string } | undefined)?.user;
        return key.includes('.session.') && user !== undefined && user !== ROOT_NAME ? null : found;
      },
    };

    await expect(applyCopy(broken, A1, TODAY)).rejects.toThrow(/answered 401/);
  });

  it('row 27: an order or request changed by its users before the seed’s next call is left, named, and only a 404 or a 409 is a skip', async () => {
    const other = await fresh();
    await make(other, A1);
    let confirms = 0;
    let cancels = 0;
    let closes = 0;
    let delivers = 0;
    const moving: CStorageClient = hooked(other, {
      beforePut: async (key, data, ifTag) => {
        const state = (data as { state?: string }).state;
        if (key.includes('.order.') && ifTag && state === 'confirmed' && confirms++ === 0) {
          await other.putRecord(key, data, ifTag);
        }
        if (key.includes('.order.') && ifTag && state === 'cancelled' && cancels++ === 0) {
          await other.putRecord(key, data, ifTag);
        }
        if (key.includes('.delivery.') && ifTag && state === 'delivered' && delivers++ === 0) {
          await other.putRecord(key, data, ifTag);
        }
        if (key.includes('.reconciliation.') && closes++ === 0) {
          await other.putRecord(key, { rival: true }, null);
        }
      },
    });

    const report = await applyCopy(moving, A1, TODAY);

    expect(report.status).toBe('ok');
    expect(
      report.skipped.some((line) =>
        /^DH-\d+ was changed by its users before it was sent$/.test(line),
      ),
    ).toBe(true);
    expect(
      report.skipped.some((line) =>
        /^DH-\d+ was changed by its users before it was cancelled$/.test(line),
      ),
    ).toBe(true);
    expect(report.skipped.some((line) => /^GH-\d+ was changed by its users$/.test(line))).toBe(
      true,
    );
    expect(report.skipped.some((line) => /^GH-\d+ was changed by its users$/.test(line))).toBe(
      true,
    );
    expect(
      report.skipped.some((line) => /'s 2026-10-\d+ was changed by its users, left$/.test(line)),
    ).toBe(true);
  });

  it('row 27: a refusal of a call that is not a 404 or a 409 stops the run red, never a skip', async () => {
    const other = await fresh();
    await make(other, A1);
    const failing = hooked(other, {
      beforePut: (key, data) =>
        key.includes('.delivery.') && (data as { state?: string }).state === 'delivered'
          ? Promise.reject(down())
          : Promise.resolve(),
    });

    await expect(applyCopy(failing, A1, TODAY)).rejects.toThrow(/POST .*\/deliver answered 5\d\d/);
  });

  it('row 27: a driver whose day its users closed is sent nothing more by the seed, the order goes to another driver and the run goes on green', async () => {
    const other = await fresh();
    const made = await make(other, A1);
    await applyCopy(other, A1, addDays(TODAY, -1));
    const last = addDays(TODAY, -1);
    const sent = plannedOrders(A1.client, A1.scenario, last).filter(
      (plan) => plan.outcome !== 'draft',
    );
    const first = sent[0];
    const root = await asRoot(other, A1.code, made.password);
    const { drivers } = (await root('GET', ROUTES.drivers)).json<{
      drivers: { id: string; code: string; name: string }[];
    }>();
    const leaving = new Set(
      dayEvents(A1.client, A1.scenario, first.sendFor).flatMap((e) =>
        e.kind === 'leave' ? [e.code] : [],
      ),
    );
    const eligible = drivers.filter((one) => !leaving.has(one.code));
    const drawn = eligible[Math.floor(first.driverDraw * eligible.length)];
    // The office closed the drawn driver's day for the day the order is sent for.
    await other.putRecord(
      recordKeys.tenant(await tenantOf(other, A1.code)).reconciliation(first.sendFor, drawn.id),
      {
        day: first.sendFor,
        driver: drawn,
        requests: [],
        toCollect: 0,
        handedIn: 0,
        difference: 0,
        closedBy: { id: null, code: null, name: ROOT_NAME },
        closedAt: Date.now(),
      },
      null,
    );
    const lines: string[] = [];

    const report = await applyCopy(other, A1, TODAY, (line) => lines.push(line));

    expect(report.status).toBe('ok');
    const requests = (await root('GET', deliveryRoutes.list(first.sendFor))).json<{
      deliveries: { customer: { code: string }; madeAt: number; driver: { id: string } }[];
    }>().deliveries;
    const mine = requests.find(
      (one) => one.customer.code === first.customer && one.madeAt === first.sentAt,
    );
    expect(mine).toBeDefined();
    expect(mine!.driver.id).not.toBe(drawn.id);
    expect(
      requests.filter((one) => one.driver.id === drawn.id && one.madeAt >= atMinute(last, 0)),
    ).toEqual([]);
    expect(lines).toContain(`${A1.code}: ${drawn.code}'s ${first.sendFor} is closed, sent nothing`);
  });

  it('row 27: a copy with no drivers who deliver leaves its sent orders drafts, a copy with no customers or products leaves its orders, each named', async () => {
    const noDrivers = await fresh();
    const made = await make(noDrivers, A1);
    const noDriversRoot = await asRoot(noDrivers, A1.code, made.password);
    const noDriversId = await tenantOf(noDrivers, A1.code);
    await writeLedger(
      noDrivers,
      noDriversId,
      {
        client: 'A',
        scenario: 'S1',
        firstDay: FIRST,
        lastDay: addDays(FIRST, -1),
        filled: false,
        blocks: SEED_BLOCKS,
      },
      null,
    );
    const setup = staffSetupOf('S1');
    const version = (await noDriversRoot('GET', ROUTES.staffSetup)).json<{ version: string }>();
    expect(
      (
        await noDriversRoot('PUT', ROUTES.staffSetup, {
          setup: {
            ...setup,
            departments: setup.departments.map((one) => ({ ...one, permissions: {} })),
          },
          version: version.version,
        })
      ).statusCode,
    ).toBe(200);

    const report = await applyCopy(noDrivers, A1, TODAY);

    expect(
      report.skipped.some((line) => /^DH-\d+: no driver who delivers, left a draft$/.test(line)),
    ).toBe(true);
    const held = await ordersOf(noDriversRoot, '2026-10-22');
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((one) => one.state === 'draft')).toBe(true);

    const empty = await fresh();
    await make(empty, A2);
    const emptyId = await tenantOf(empty, A2.code);
    await writeLedger(
      empty,
      emptyId,
      {
        client: 'A',
        scenario: 'S1',
        firstDay: FIRST,
        lastDay: addDays(FIRST, -1),
        filled: true,
        blocks: SEED_BLOCKS,
      },
      null,
    );

    const none = await applyCopy(empty, A2, TODAY);

    expect(
      none.skipped.some((line) =>
        /^an order of .* a customer or product is no longer there$/.test(line),
      ),
    ).toBe(true);
  });
});
