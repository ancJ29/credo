import { isDeepStrictEqual } from 'node:util';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME, startingConfig } from '@credo/bff/clients';
import { createSessions } from '@credo/bff/sessions';
import {
  type AddEmployeeReply,
  AUTH_HEADER,
  CLIENT_HEADER,
  type ConfigDoc,
  type CStorageClient,
  DEVICE_HEADER,
  type EmployeeDoc,
  employeeRoutes,
  type EmployeeListReply,
  recordKeys,
  ROUTES,
  type StaffSetupDoc,
  storedClientSchema,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { companyConfig, staffSetupOf } from './company';
import { addDays, atMinute, daysBetween } from './days';
import { type Ledger, readLedger, writeLedger } from './ledger';
import { allCopies, assertLedgerScenario, type MappedCopy } from './mapping';
import { dayEvents, type Person, staffAsOf, type StaffEvent } from './staff';

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

/** The BFF's own code in this process, signed in as the copy's root by a session the BFF's
 * `createSessions` issues, its clock set by the caller to each event's time. No password is read,
 * made or shown for it. */
function driverFor(storage: CStorageClient, tenantId: string, code: string) {
  let clock = 0;
  const now = () => clock;
  const app = buildApp({ storage, now, logger: false });
  const sessions = createSessions({ storage, now, keyOf: recordKeys.tenant(tenantId).session });
  let authId = '';

  async function send(method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
    const reply = await app.inject({
      method,
      url,
      headers: { [CLIENT_HEADER]: code, [DEVICE_HEADER]: DEVICE, [AUTH_HEADER]: authId },
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
    async close() {
      await sessions.end(authId);
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

/** The first fill: the company's settings, its staff setup, and its people as they stood on the
 * morning of `firstDay`. A fill that stopped halfway is finished by the next run: what is there is
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
    } finally {
      await driver.close();
    }
    ledger = { ...ledger, lastDay: day };
    const next = await writeLedger(storage, tenantId, ledger, tag);
    if (next === null) return done('refused', 'the ledger moved under the run, stopped');
    tag = next;
    days.push(day);
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
