import { isDeepStrictEqual } from 'node:util';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME, startingConfig } from '@credo/bff/clients';
import { createSessions } from '@credo/bff/sessions';
import {
  type AddEmployeeReply,
  AUTH_HEADER,
  CLIENT_HEADER,
  closeRequestFor,
  type ConfigDoc,
  type CStorageClient,
  type Customer,
  DEVICE_HEADER,
  deliveryRoutes,
  type DeliveryDoc,
  type DeliveryRequest,
  type Driver as Deliverer,
  driverDay,
  type EmployeeDoc,
  employeeRoutes,
  type EmployeeListReply,
  IMPORT_CALL_ROWS,
  listImportRoute,
  normaliseSignInName,
  type Order,
  type OrderDoc,
  orderRoutes,
  type Product,
  type Reconciliation,
  reconciliationRoutes,
  recordKeys,
  ROUTES,
  type StaffSetupDoc,
  storedClientSchema,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { DEMO_DELIVERY_PHOTOS } from '@credo/shared/demo';
import { companyConfig, staffSetupOf } from './company';
import { addDays, atMinute, daysBetween } from './days';
import { customersOf, productsOf } from './lists';
import { type Ledger, readLedger, SEED_BLOCKS, type SeedBlock, writeLedger } from './ledger';
import { allCopies, assertLedgerScenario, type MappedCopy } from './mapping';
import { plannedDeliveries, plannedOrders } from './orders';
import { closeOf } from './reconcile';
import { MANAGER, SCENARIOS } from './scenarios';
import { ANCHOR, dayEvents, type Person, staffAsOf, type StaffEvent } from './staff';

/** A first fill holds the last week: this many days, the last of them yesterday. */
export const HISTORY_DAYS = 7;
/** A run applies at most this many missed days; beyond it the copy is reported and left. */
export const MAX_CATCH_UP = 30;
const DEVICE = 'device-seed-0001';
/** The hour a session opens on a day, before its first event. */
const OPENING_MINUTE = 6 * 60;

export type Report = {
  code: string;
  status: 'ok' | 'refused' | 'missing' | 'too-far';
  /** Whether this run did the copy's first fill. */
  filled: boolean;
  /** The days this run applied, in order. */
  days: string[];
  /** What was left as its users had it, one line each. */
  skipped: string[];
  note: string;
};

type Log = (line: string) => void;

/** The copies' routes alone are driven, through the BFF's own functions: no operator signs in, so no
 * passkey is ever checked against this address or challenge signed under this key. */
const NO_OPERATOR = { origin: 'http://localhost', serviceKey: 'the demo seed' };

/** The BFF's own code in this process, signed in as the copy's root by a session the BFF's
 * `createSessions` issues, its clock set by the caller to each event's time. No password is read,
 * made or shown for it. */
function driverFor(storage: CStorageClient, tenantId: string, code: string) {
  let clock = 0;
  const now = () => clock;
  const app = buildApp({ storage, now, ...NO_OPERATOR, logger: false });
  const sessions = createSessions({ storage, now, keyOf: recordKeys.tenant(tenantId).session });
  let authId = '';
  /** The sessions issued to people of the copy during the day, by their sign-in name. */
  const people = new Map<string, string>();

  async function send(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    payload?: unknown,
    as: string = authId,
  ) {
    const reply = await app.inject({
      method,
      url,
      headers: { [CLIENT_HEADER]: code, [DEVICE_HEADER]: DEVICE, [AUTH_HEADER]: as },
      payload: payload as object | undefined,
    });
    return { status: reply.statusCode, json: () => reply.json<unknown>() };
  }
  /** A call that must succeed: any other answer stops the run. */
  async function must<T>(method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
    const reply = await send(method, url, payload);
    if (reply.status >= 300) {
      throw new Error(`the seed's ${method} ${url} answered ${reply.status}`);
    }
    return reply.json() as T;
  }
  return {
    at: (ms: number) => void (clock = ms),
    send,
    must,
    async open(ms: number) {
      clock = ms;
      const root = storedUserSchema.parse(
        (await storage.getRecord(recordKeys.tenant(tenantId).user(ROOT_NAME)))!.data,
      );
      authId = (await sessions.issue(DEVICE, ROOT_NAME, root.generation)).authId;
    },
    /** A session for a person of the copy, by the same issue as the root's and at the clock's
     * time: the sign-in record they were added with names its generation. None when they have no
     * sign-in record. No password is read, made or shown. */
    async sessionOf(name: string) {
      const held = people.get(name);
      if (held) return held;
      const found = await storage.getRecord(recordKeys.tenant(tenantId).user(name));
      if (!found) return null;
      const user = storedUserSchema.parse(found.data);
      const issued = await sessions.issue(DEVICE, name, user.generation);
      people.set(name, issued.authId);
      return issued.authId;
    },
    async close() {
      await sessions.end(authId);
      for (const held of people.values()) await sessions.end(held);
      people.clear();
    },
  };
}
type Driver = ReturnType<typeof driverFor>;

/** Whether a client holds what the operator's create leaves and nothing else: its root, its
 * settings as `createClient` writes them (`startingConfig` under the index's name, whole), and
 * sessions, which a root signing in leaves and nothing sweeps. */
async function isFresh(storage: CStorageClient, tenantId: string, name: string) {
  const keys = recordKeys.tenant(tenantId);
  const listed = await storage.listRecords(keys.all);
  const asMade = (data: unknown) => {
    const config = tenantConfigSchema.safeParse(data);
    return config.success && isDeepStrictEqual(config.data, startingConfig(name));
  };
  return (
    !listed.more &&
    listed.records.every(
      ({ key, data }) =>
        key === keys.user(ROOT_NAME) ||
        key.startsWith(keys.session('')) ||
        (key === keys.config && asMade(data)),
    )
  );
}

type Units = { departments: Map<string, string>; positions: Map<string, string> };

/** Adds a person; a code already taken is what their users did first, and is left. */
async function addPerson(
  driver: Driver,
  units: Units,
  person: Person,
  skipped: string[],
  log: Log,
  code: string,
) {
  const departmentId = units.departments.get(person.department);
  const positionId = units.positions.get(person.position);
  if (!departmentId || !positionId) {
    skipped.push(`${person.code}: its department or position is no longer there`);
    log(`${code}: ${person.code}: its department or position is no longer there, left`);
    return;
  }
  const reply = await driver.send('POST', ROUTES.employees, {
    name: person.name,
    code: person.code,
    extra: person.extra,
    departmentId,
    positionId,
  });
  if (reply.status === 409) {
    skipped.push(`${person.code} is already there`);
    log(`${code}: ${person.code} is already there, left as it is`);
    // A fill cut after this person's add and before their archive: they are archived now.
    if (person.archived) await archivePerson(driver, person.code);
    return;
  }
  if (reply.status >= 300)
    throw new Error(`the seed's POST ${ROUTES.employees} answered ${reply.status}`);
  if (person.archived) {
    const added = reply.json() as AddEmployeeReply;
    await driver.must('POST', employeeRoutes.archive(added.employee.employee.id), {
      version: added.employee.version,
    });
  }
}

async function unitsOf(driver: Driver): Promise<Units> {
  const { setup } = await driver.must<StaffSetupDoc>('GET', ROUTES.staffSetup);
  return {
    departments: new Map(setup.departments.map((unit) => [unit.name, unit.id])),
    positions: new Map(setup.positions.map((unit) => [unit.name, unit.id])),
  };
}

/** The company's customers and products, through the root's two import routes, 100 rows a call, as
 * the app sends them. A code already there is what its users did first: skipped and named. Any
 * other refusal stops the run. */
async function addLists(driver: Driver, copy: MappedCopy, skipped: string[], log: Log) {
  const lists = {
    customers: customersOf(copy.client, copy.scenario),
    products: productsOf(copy.client, copy.scenario),
  };
  for (const kind of ['customers', 'products'] as const) {
    let added = 0;
    for (let from = 0; from < lists[kind].length; from += IMPORT_CALL_ROWS) {
      const sent = lists[kind].slice(from, from + IMPORT_CALL_ROWS);
      const { results } = await driver.must<{ results: { kind: string; reason?: string }[] }>(
        'POST',
        listImportRoute(kind),
        { rows: sent },
      );
      results.forEach((result, at) => {
        if (result.kind === 'added') {
          added++;
        } else if (result.reason === 'taken') {
          skipped.push(`${sent[at].code} is already in the ${kind}`);
          log(`${copy.code}: ${sent[at].code} is already in the ${kind}, left as it is`);
        } else {
          throw new Error(`the seed's ${kind} import refused ${sent[at].code}: ${result.reason}`);
        }
      });
    }
    log(`${copy.code}: ${added} ${kind} added`);
  }
}

/** The first fill: the company's settings, its staff setup, and its people as they stood on the
 * morning of `firstDay`, then its customers and products. A fill that stopped halfway is finished by the next run: what is there is
 * kept. */
async function fill(
  driver: Driver,
  copy: MappedCopy,
  firstDay: string,
  skipped: string[],
  log: Log,
) {
  const config = await driver.must<ConfigDoc>('GET', ROUTES.config);
  await driver.must('PUT', ROUTES.config, {
    config: companyConfig(copy.client, copy.company),
    version: config.version,
  });
  const setup = await driver.must<StaffSetupDoc>('GET', ROUTES.staffSetup);
  if (setup.setup.departments.length === 0) {
    await driver.must('PUT', ROUTES.staffSetup, {
      setup: staffSetupOf(copy.scenario),
      version: setup.version,
    });
  }
  const units = await unitsOf(driver);
  const people = staffAsOf(copy.client, copy.scenario, firstDay);
  for (const person of people) await addPerson(driver, units, person, skipped, log, copy.code);
  await addLists(driver, copy, skipped, log);
  log(`${copy.code}: filled as of ${firstDay}, ${people.length} people`);
}

/** Archives the person with this code if they are there and active. Says why not otherwise; only a
 * 409 or a 404 on the archive is a change by their users, any other answer stops the run. */
async function archivePerson(driver: Driver, code: string) {
  const { employees } = await driver.must<EmployeeListReply>('GET', ROUTES.employees);
  const found = employees.find((employee) => employee.code === code);
  if (!found) return 'is not in the list';
  if (found.archived) return 'has already left';
  const url = employeeRoutes.one(found.id);
  const { version } = await driver.must<EmployeeDoc>('GET', url);
  const reply = await driver.send('POST', employeeRoutes.archive(found.id), { version });
  if ([409, 404].includes(reply.status)) return 'was changed by its users';
  if (reply.status >= 300)
    throw new Error(`the seed's POST ${url}/archive answered ${reply.status}`);
  return null;
}

async function leave(
  driver: Driver,
  event: Extract<StaffEvent, { kind: 'leave' }>,
  skipped: string[],
  log: Log,
  code: string,
) {
  const why = await archivePerson(driver, event.code);
  if (why === null) return;
  skipped.push(`${event.code} ${why}`);
  log(`${code}: ${event.code} ${why}, left as it is`);
}

/** A call whose answer is read by status: its body when it succeeded, nothing when it was
 * refused by a 404 or a 409 (what its users did first). Any other refusal stops the run. */
async function unlessChanged<T>(
  call: Promise<{ status: number; json: () => unknown }>,
  what: string,
) {
  const reply = await call;
  if (reply.status === 404 || reply.status === 409) return null;
  if (reply.status >= 300) throw new Error(`the seed's ${what} answered ${reply.status}`);
  return reply.json() as T;
}

/** What a day's orders did, for the log. */
type OrderStats = { saved: number; sent: number; cancelled: number; drafts: number };

/** One day's orders, saved at their times as the root: each is confirmed to a driver who delivers
 * (one leaving before the request's day is not chosen) and some are cancelled, as the day's plan
 * says. An order already in the day's list (the same customer at the same time) is what a
 * previous run or its users left, and is skipped and named; only a 404 or a 409 is a skip. */
async function dayOrders(
  driver: Driver,
  copy: MappedCopy,
  day: string,
  skipped: string[],
  log: Log,
): Promise<OrderStats> {
  const stats: OrderStats = { saved: 0, sent: 0, cancelled: 0, drafts: 0 };
  const planned = plannedOrders(copy.client, copy.scenario, day);
  if (planned.length === 0) return stats;
  const { customers } = await driver.must<{ customers: Customer[] }>('GET', ROUTES.customers);
  const { products } = await driver.must<{ products: Product[] }>('GET', ROUTES.products);
  const { drivers } = await driver.must<{ drivers: Deliverer[] }>('GET', ROUTES.drivers);
  const { orders } = await driver.must<{ orders: Order[] }>('GET', orderRoutes.list(day, day));
  const held = new Set(orders.map((one) => `${one.customer.code}|${one.madeAt}`));
  const leaving = new Map<string, Set<string>>();
  const leaversOn = (date: string) => {
    if (!leaving.has(date)) {
      const events = dayEvents(copy.client, copy.scenario, date);
      leaving.set(date, new Set(events.flatMap((e) => (e.kind === 'leave' ? [e.code] : []))));
    }
    return leaving.get(date)!;
  };
  for (const plan of planned) {
    const customer = customers.find((one) => one.code === plan.customer);
    const lines = plan.lines.map((line) => ({
      productId: products.find((one) => one.code === line.product)?.id,
      quantity: line.quantity,
    }));
    if (!customer || lines.some((line) => line.productId === undefined)) {
      skipped.push(
        `an order of ${plan.customer} on ${day}: a customer or product is no longer there`,
      );
      log(
        `${copy.code}: an order of ${plan.customer} on ${day}: a customer or product is no longer there, left`,
      );
      continue;
    }
    if (held.has(`${plan.customer}|${plan.madeAt}`)) {
      skipped.push(`the order of ${plan.customer} on ${day} is already there`);
      log(`${copy.code}: the order of ${plan.customer} on ${day} is already there, left as it is`);
      continue;
    }
    driver.at(plan.madeAt);
    const saved = await driver.must<OrderDoc>('POST', ROUTES.orders, {
      day,
      customerId: customer.id,
      lines,
      extra: {},
    });
    stats.saved++;
    if (plan.outcome === 'draft') {
      stats.drafts++;
      continue;
    }
    const eligible = drivers.filter((one) => !leaversOn(plan.sendFor).has(one.code));
    if (eligible.length === 0) {
      skipped.push(`${saved.order.number}: no driver who delivers, left a draft`);
      log(`${copy.code}: ${saved.order.number}: no driver who delivers, left a draft`);
      stats.drafts++;
      continue;
    }
    driver.at(plan.sentAt);
    const confirmed = await unlessChanged<OrderDoc>(
      driver.send('POST', orderRoutes.confirm(day, saved.order.id), {
        version: saved.version,
        driverId: eligible[Math.floor(plan.driverDraw * eligible.length)].id,
        day: plan.sendFor,
      }),
      `POST ${orderRoutes.confirm(day, saved.order.id)}`,
    );
    if (confirmed === null) {
      skipped.push(`${saved.order.number} was changed by its users before it was sent`);
      log(`${copy.code}: ${saved.order.number} was changed by its users before it was sent, left`);
      continue;
    }
    stats.sent++;
    if (plan.outcome === 'cancelled') {
      driver.at(plan.cancelAt);
      const cancelled = await unlessChanged<OrderDoc>(
        driver.send('POST', orderRoutes.cancel(day, saved.order.id), {
          version: confirmed.version,
        }),
        `POST ${orderRoutes.cancel(day, saved.order.id)}`,
      );
      if (cancelled === null) {
        skipped.push(`${saved.order.number} was changed by its users before it was cancelled`);
        log(
          `${copy.code}: ${saved.order.number} was changed by its users before it was cancelled, left`,
        );
      } else {
        stats.cancelled++;
      }
    }
  }
  log(
    `${copy.code}: ${day} orders: ${stats.saved} saved, ${stats.sent} sent, ${stats.cancelled} cancelled, ${stats.drafts} left drafts`,
  );
  return stats;
}

/** What a day's deliveries did, for the log: how many, and the largest photo in bytes. */
type DeliveryStats = { delivered: number; largest: number };

/** The size of a photo's picture in bytes, from its data URL. */
const pictureBytes = (photo: string) => Buffer.from(photo.split(',')[1], 'base64').length;

/**
 * One day's requests delivered at their times, each by its own driver with one of the drawn
 * photos. Only the requests this seed sent are found: a request is the one the day's plan sent at
 * that time to that customer, so one its users made is never delivered. A request that is no
 * longer waiting, or whose driver the list of drivers no longer holds (left, or not allowed to
 * deliver), is skipped and named; any other refusal, a 401 or 403 included, stops the run.
 */
async function dayDeliveries(
  driver: Driver,
  copy: MappedCopy,
  day: string,
  skipped: string[],
  log: Log,
): Promise<DeliveryStats> {
  const stats: DeliveryStats = { delivered: 0, largest: 0 };
  const planned = plannedDeliveries(copy.client, copy.scenario, day);
  if (planned.length === 0) return stats;
  const { deliveries } = await driver.must<{ deliveries: DeliveryRequest[] }>(
    'GET',
    deliveryRoutes.list(day),
  );
  const { drivers } = await driver.must<{ drivers: Deliverer[] }>('GET', ROUTES.drivers);
  const photos = [...new Set(Object.values(DEMO_DELIVERY_PHOTOS))];
  for (const plan of planned) {
    const request = deliveries.find(
      (one) => one.customer.code === plan.customer && one.madeAt === plan.sentAt,
    );
    // A request before the copy's first day was never sent.
    if (!request) continue;
    if (request.state !== 'waiting') {
      skipped.push(`${request.number} is already ${request.state}`);
      log(`${copy.code}: ${request.number} is already ${request.state}, left as it is`);
      continue;
    }
    // A driver the seed reads as archived or no longer allowed to deliver is what their users
    // did; any other refusal, a broken session included, stops the run.
    if (!drivers.some((one) => one.id === request.driver.id)) {
      skipped.push(`${request.number}: its driver has left or may no longer deliver, left waiting`);
      log(
        `${copy.code}: ${request.number}: its driver has left or may no longer deliver, left waiting`,
      );
      continue;
    }
    driver.at(plan.deliverAt);
    const as = await driver.sessionOf(normaliseSignInName(request.driver.code));
    if (as === null) throw new Error(`the seed found no sign-in record for ${request.driver.code}`);
    const photo = photos[Math.floor(plan.photoDraw * photos.length)];
    const url = deliveryRoutes.one(day, request.id);
    const read = await unlessChanged<DeliveryDoc>(
      driver.send('GET', url, undefined, as),
      `GET ${url}`,
    );
    const done = read
      ? await unlessChanged<DeliveryDoc>(
          driver.send(
            'POST',
            deliveryRoutes.deliver(day, request.id),
            { version: read.version, photo },
            as,
          ),
          `POST ${deliveryRoutes.deliver(day, request.id)}`,
        )
      : null;
    if (done === null) {
      skipped.push(`${request.number} was changed by its users`);
      log(`${copy.code}: ${request.number} was changed by its users, left`);
      continue;
    }
    stats.delivered++;
    stats.largest = Math.max(stats.largest, pictureBytes(photo));
  }
  log(
    `${copy.code}: ${day} deliveries: ${stats.delivered} delivered with a photo, largest ${stats.largest} bytes`,
  );
  return stats;
}

/** The sign-in name of the person who closes the copy's days: the manager of the department the
 * scenario names, who never leaves. */
function closerOf(copy: MappedCopy) {
  const { closer } = SCENARIOS[copy.scenario].reconciliation;
  const person = staffAsOf(copy.client, copy.scenario, ANCHOR).find(
    (one) => one.department === closer && one.position === MANAGER,
  )!;
  return normaliseSignInName(person.code);
}

/**
 * One day's drivers' days closed at the day's end by the office's manager, each with the cash the
 * scenario's odds hand in. A driver's day with a request still waiting, or already closed, is
 * left as it is and named. Only a 404 or a 409 is a skip.
 */
async function dayCloses(
  driver: Driver,
  copy: MappedCopy,
  day: string,
  skipped: string[],
  log: Log,
) {
  const { deliveries } = await driver.must<{ deliveries: DeliveryRequest[] }>(
    'GET',
    deliveryRoutes.list(day),
  );
  const { reconciliations } = await driver.must<{ reconciliations: Reconciliation[] }>(
    'GET',
    reconciliationRoutes.list(day),
  );
  // A driver whose requests were all cancelled has nothing to settle: only those with a request
  // that is delivered or still waiting are met.
  const drivers = [
    ...new Map(
      deliveries
        .filter((one) => one.state !== 'cancelled')
        .map((one) => [one.driver.id, one.driver]),
    ).values(),
  ].sort((a, b) => (a.code < b.code ? -1 : 1));
  let closed = 0;
  let gaps = 0;
  for (const one of drivers) {
    if (reconciliations.some((already) => already.driver.id === one.id)) {
      skipped.push(`${one.code}'s ${day} is already closed`);
      log(`${copy.code}: ${one.code}'s ${day} is already closed, left as it is`);
      continue;
    }
    const figures = driverDay(deliveries, one.id);
    if (figures.waiting.length > 0) {
      skipped.push(`${one.code}'s ${day} has a request still waiting, left open`);
      log(`${copy.code}: ${one.code}'s ${day} has a request still waiting, left open`);
      continue;
    }
    const { handedIn, at } = closeOf(copy.client, copy.scenario, day, one.code, figures.toCollect);
    driver.at(at);
    const as = await driver.sessionOf(closerOf(copy));
    if (!as) {
      skipped.push(`${day}: the office manager has no sign-in, ${one.code}'s day left open`);
      log(`${copy.code}: ${day}: the office manager has no sign-in, ${one.code}'s day left open`);
      continue;
    }
    const url = reconciliationRoutes.close(day, one.id);
    const result = await unlessChanged<Reconciliation>(
      driver.send('POST', url, closeRequestFor(figures, handedIn), as),
      `POST ${url}`,
    );
    if (result === null) {
      skipped.push(`${one.code}'s ${day} was changed by its users, left`);
      log(`${copy.code}: ${one.code}'s ${day} was changed by its users, left`);
      continue;
    }
    closed++;
    if (result.difference !== 0) gaps++;
  }
  log(`${copy.code}: ${day} closed: ${closed} drivers' days, ${gaps} with a gap`);
}

/**
 * Brings one mapped copy up to yesterday. A client with no ledger is filled only if it holds what
 * the operator's create left; the ledger is written first, so two runs cannot both start a fill.
 * Each missed day after the ledger's last is applied in order, the BFF's clock at each event's time,
 * and the ledger moves past a day only after the day is applied; a ledger that moved under the run
 * stops it. A change its users made wins: an event whose target they changed is skipped, named, and
 * only a 409 or a 404 is a skip.
 */
export async function applyCopy(
  storage: CStorageClient,
  copy: MappedCopy,
  today: string,
  log: Log = () => undefined,
): Promise<Report> {
  const through = addDays(today, -1);
  const skipped: string[] = [];
  const days: string[] = [];
  let filled = false;
  const done = (status: Report['status'], note: string): Report => {
    log(`${copy.code}: ${note}`);
    return { code: copy.code, status, filled, days, skipped, note };
  };

  const index = await storage.getRecord(recordKeys.client(copy.code));
  if (!index) return done('missing', 'not on this service, left');
  const { id: tenantId, name } = storedClientSchema.parse(index.data);

  let current = await readLedger(storage, tenantId);
  if (!current) {
    if (!(await isFresh(storage, tenantId, name))) {
      return done('refused', 'holds more than a new client does, left');
    }
    const firstDay = addDays(through, -(HISTORY_DAYS - 1));
    const first: Ledger = {
      client: copy.client,
      scenario: copy.scenario,
      firstDay,
      lastDay: addDays(firstDay, -1),
      filled: false,
      blocks: SEED_BLOCKS,
    };
    const tag = await writeLedger(storage, tenantId, first, null);
    if (tag === null) return done('refused', 'another run holds it, left');
    current = { ledger: first, tag };
  }
  let { ledger, tag } = current;
  if (ledger.client !== copy.client) {
    return done('refused', `the ledger names client ${ledger.client}, the mapping ${copy.client}`);
  }
  try {
    assertLedgerScenario(copy.code, ledger.scenario);
  } catch (error) {
    return done('refused', (error as Error).message);
  }

  const missed = daysBetween(addDays(ledger.lastDay, 1), addDays(through, 1));
  if (missed.length > MAX_CATCH_UP) {
    return done('too-far', `${missed.length} days behind, more than ${MAX_CATCH_UP}, left`);
  }

  const driver = driverFor(storage, tenantId, copy.code);
  if (!ledger.filled) {
    await driver.open(atMinute(ledger.firstDay, OPENING_MINUTE));
    try {
      await fill(driver, copy, ledger.firstDay, skipped, log);
    } finally {
      await driver.close();
    }
    ledger = { ...ledger, filled: true };
    const next = await writeLedger(storage, tenantId, ledger, tag);
    if (next === null) return done('refused', 'the ledger moved under the run, stopped');
    tag = next;
    filled = true;
  }
  const blocks: readonly SeedBlock[] = ledger.blocks ?? [];
  const delivered = { delivered: 0, largest: 0 };
  for (const day of missed) {
    await driver.open(atMinute(day, OPENING_MINUTE));
    try {
      const events = dayEvents(copy.client, copy.scenario, day);
      for (const event of events) {
        driver.at(event.at);
        if (event.kind === 'hire') {
          await addPerson(driver, await unitsOf(driver), event.person, skipped, log, copy.code);
        } else {
          await leave(driver, event, skipped, log, copy.code);
        }
      }
      log(`${copy.code}: ${day} applied, ${events.length} events`);
      // Each block needs the one before it: a day's orders, then the requests delivered, then the
      // drivers' days closed.
      if (blocks.includes('orders')) await dayOrders(driver, copy, day, skipped, log);
      if (blocks.includes('deliveries')) {
        const stats = await dayDeliveries(driver, copy, day, skipped, log);
        delivered.delivered += stats.delivered;
        delivered.largest = Math.max(delivered.largest, stats.largest);
      }
      if (blocks.includes('reconciliations')) await dayCloses(driver, copy, day, skipped, log);
      if (blocks.includes('deliveries') && day === through) {
        driver.at(atMinute(addDays(day, 1), OPENING_MINUTE));
        const { deliveries } = await driver.must<{ deliveries: DeliveryRequest[] }>(
          'GET',
          deliveryRoutes.list(addDays(day, 1)),
        );
        const waiting = deliveries.filter((one) => one.state === 'waiting').length;
        log(`${copy.code}: ${waiting} requests wait for ${addDays(day, 1)}, today`);
      }
    } finally {
      await driver.close();
    }
    ledger = { ...ledger, lastDay: day };
    const next = await writeLedger(storage, tenantId, ledger, tag);
    if (next === null) return done('refused', 'the ledger moved under the run, stopped');
    tag = next;
    days.push(day);
  }
  if (delivered.delivered > 0) {
    log(
      `${copy.code}: ${delivered.delivered} requests delivered with a photo, the largest ${delivered.largest} bytes`,
    );
  }
  return done('ok', `up to ${through}`);
}

/** Every copy of the mapping, or one partner's, each brought up to yesterday. A code that is not
 * in the mapping is never read. An error that stops a copy names it. */
export async function applyAll(storage: CStorageClient, today: string, log: Log, partner?: string) {
  return await Promise.all(
    allCopies()
      .filter((copy) => partner === undefined || copy.partner === partner)
      .map((copy) =>
        applyCopy(storage, copy, today, log).catch((error: unknown) => {
          throw new Error(`${copy.code}: ${(error as Error).message}`, { cause: error });
        }),
      ),
  );
}

export type DemoCopy = MappedCopy & { rootPassword: string };

/**
 * What `pnpm demo` makes: each mapped copy (or one partner's) made by the operator's own create,
 * filled as of four days ago, then three daily runs to yesterday, so the morning's path runs on
 * every start. The root's first password is returned once, for the caller to show.
 */
export async function startDemo(
  storage: CStorageClient,
  today: string,
  partner?: string,
): Promise<DemoCopy[]> {
  const chosen = allCopies().filter((copy) => partner === undefined || copy.partner === partner);
  if (chosen.length === 0) throw new Error('no copy in the mapping for that partner');
  return await Promise.all(
    chosen.map(async (copy) => {
      const made = await createClient(storage, {
        code: copy.code,
        name: copy.company,
        madeAt: Date.now(),
      });
      if (made === 'taken') throw new Error(`${copy.code}: the service already holds it`);
      for (const back of [3, 2, 1, 0]) {
        const report = await applyCopy(storage, copy, addDays(today, -back));
        if (report.status !== 'ok') throw new Error(`${copy.code}: ${report.note}`);
      }
      return { ...copy, rootPassword: made.password };
    }),
  );
}
