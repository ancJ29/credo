import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import {
  AUTH_HEADER,
  CLIENT_HEADER,
  CStorageError,
  type CStorageClient,
  DEVICE_HEADER,
  employeeRoutes,
  customerSchema,
  employeeSchema,
  listImportRoute,
  productSchema,
  normaliseSignInName,
  recordKeys,
  ROUTES,
  type StaffSetupDoc,
  storedClientSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAll, applyCopy, HISTORY_DAYS, MAX_CATCH_UP, startDemo } from './apply';
import { companyConfig, staffSetupOf } from './company';
import { addDays, atMinute } from './days';
import { parseLedger, readLedger, writeLedger } from './ledger';
import { customersOf, productsOf } from './lists';
import { allCopies, type MappedCopy } from './mapping';
import { ANCHOR, dayEvents, staffAsOf } from './staff';

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-apply-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const copyOf = (code: string) => allCopies().find((copy) => copy.code === code)!;
const A1 = copyOf('vat-lieu-quang-tin-dat-1');
const A2 = copyOf('vat-lieu-quang-tin-dat-2');
const B1 = copyOf('phan-phoi-loc-vuong-hai-1');

/** A service of its own on the real c-storage, so no test meets another's records. */
const fresh = async () => (await freshTenant(cs)).client;
const make = async (storage: CStorageClient, copy: MappedCopy) => {
  const made = await createClient(storage, {
    code: copy.code,
    name: copy.company,
    madeAt: Date.now(),
  });
  if (made === 'taken') throw new Error('taken');
  return made;
};
const tenantOf = async (storage: CStorageClient, code: string) =>
  storedClientSchema.parse((await storage.getRecord(recordKeys.client(code)))!.data).id;
const staffOf = async (storage: CStorageClient, code: string) => {
  const listed = await storage.listRecords(
    recordKeys.tenant(await tenantOf(storage, code)).employeePrefix,
  );
  return listed.records
    .map((record) => employeeSchema.parse(record.data))
    .sort((a, b) => (a.code < b.code ? -1 : 1));
};
const everything = async (storage: CStorageClient, code: string) =>
  (await storage.listRecords(recordKeys.tenant(await tenantOf(storage, code)).all)).records;
const standing = (copy: MappedCopy, today: string) =>
  staffAsOf(copy.client, copy.scenario, today)
    .map((p) => [p.code, p.name, p.archived])
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
const read = (people: Awaited<ReturnType<typeof staffOf>>) =>
  people.map((p) => [p.code, p.name, p.archived]);

/** The first day from `from` on that has an event of this kind for the copy. */
function firstEvent(copy: MappedCopy, kind: 'hire' | 'leave', from = addDays(ANCHOR, 12)) {
  for (let day = from; ; day = addDays(day, 1)) {
    const event = dayEvents(copy.client, copy.scenario, day).find((e) => e.kind === kind);
    if (event) return { day, event };
  }
}

/** The storage with a hook before a write or a read, for the test to move or break a record. */
function hooked(
  storage: CStorageClient,
  hooks: {
    beforePut?: (key: string, data: unknown, ifTag?: string | null) => Promise<void>;
    beforeGet?: (key: string) => void;
  },
): CStorageClient {
  return {
    ...storage,
    getRecord: (key) => {
      hooks.beforeGet?.(key);
      return storage.getRecord(key);
    },
    putRecord: async (key, data, ifTag) => {
      await hooks.beforePut?.(key, data, ifTag);
      return await storage.putRecord(key, data, ifTag);
    },
  };
}
const down = () => new CStorageError(null, 'c-storage did not answer');

/** The copy's root as its users would be: signed in through the BFF with the first password. */
async function asRoot(storage: CStorageClient, code: string, password: string) {
  const app = buildApp({ storage, now: () => Date.now(), logger: false });
  const headers = { [CLIENT_HEADER]: code, [DEVICE_HEADER]: 'device-users-0001' };
  const signed = await app.inject({
    method: 'POST',
    url: ROUTES.signIn,
    headers,
    payload: { name: ROOT_NAME, password },
  });
  const auth = { ...headers, [AUTH_HEADER]: signed.json<{ authId: string }>().authId };
  return (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, headers: auth, payload });
}

const TODAY = '2026-10-29';

describe('a copy brought up to yesterday', () => {
  it('row 5: a new copy holds its company and its staff as they stand, each day to yesterday applied, none after it', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const lines: string[] = [];

    const report = await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    expect(report).toMatchObject({ code: B1.code, status: 'ok', filled: true, skipped: [] });
    expect(report.days).toHaveLength(HISTORY_DAYS);
    expect(report.days.at(-1)).toBe('2026-10-28');
    expect(read(await staffOf(storage, B1.code))).toEqual(standing(B1, TODAY));
    const id = await tenantOf(storage, B1.code);
    const config = tenantConfigSchema.parse(
      (await storage.getRecord(recordKeys.tenant(id).config))!.data,
    );
    expect(config.name).toBe(B1.company);
    expect((await readLedger(storage, id))!.ledger).toEqual({
      client: 'B',
      scenario: 'S2',
      firstDay: '2026-10-22',
      lastDay: '2026-10-28',
      filled: true,
    });
    expect(lines.some((line) => line.includes('filled as of 2026-10-22'))).toBe(true);
  });

  it('row 16: each event is written with the BFF’s clock at its time, and no date is after yesterday', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    const today = addDays(day, 3);

    await applyCopy(storage, B1, today);

    const id = await tenantOf(storage, B1.code);
    const user = await storage.getRecord(
      recordKeys.tenant(id).user(normaliseSignInName(event.person.code)),
    );
    expect((user!.data as { passwordAt: number }).passwordAt).toBe(event.at);
    const people = await staffOf(storage, B1.code);
    const yesterday = addDays(today, -1);
    expect(people.every((p) => String(p.extra.started) <= yesterday)).toBe(true);
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe(yesterday);
  });

  it('row 16: the first fill is written with the BFF’s clock at the morning of its first day', async () => {
    const storage = await fresh();
    await make(storage, B1);

    await applyCopy(storage, B1, TODAY);

    const id = await tenantOf(storage, B1.code);
    const [one] = staffAsOf('B', 'S2', addDays(TODAY, -7));
    const user = await storage.getRecord(recordKeys.tenant(id).user(normaliseSignInName(one.code)));
    expect((user!.data as { passwordAt: number }).passwordAt).toBe(
      atMinute(addDays(TODAY, -7), 6 * 60),
    );
  });

  it('row 17: a second run adds nothing, and a run after k missed days adds those k, in order', async () => {
    const storage = await fresh();
    await make(storage, B1);
    await applyCopy(storage, B1, TODAY);
    const before = JSON.stringify(await everything(storage, B1.code));

    const again = await applyCopy(storage, B1, TODAY);

    expect(again).toMatchObject({ status: 'ok', filled: false, days: [] });
    expect(JSON.stringify(await everything(storage, B1.code))).toBe(before);

    const later = await applyCopy(storage, B1, addDays(TODAY, 3));

    expect(later.days).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(read(await staffOf(storage, B1.code))).toEqual(standing(B1, addDays(TODAY, 3)));
  });

  it('row 17: more than 30 missed days is reported and left, nothing applied', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, TODAY);
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, addDays(TODAY, MAX_CATCH_UP + 1));

    expect(report).toMatchObject({ status: 'too-far', days: [] });
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
    const edge = await applyCopy(storage, A1, addDays(TODAY, MAX_CATCH_UP));
    expect(edge.status).toBe('ok');
    expect(edge.days).toHaveLength(MAX_CATCH_UP);
  });

  it('row 17: a run cut on the second of three missed days leaves the ledger on the first, and the next run applies the other two', async () => {
    const storage = await fresh();
    await make(storage, B1);
    await applyCopy(storage, B1, TODAY);
    const id = await tenantOf(storage, B1.code);
    let opens = 0;
    const cutting = hooked(storage, {
      beforePut: (key) =>
        key.startsWith(`tenant.${id}.session.`) && ++opens === 2
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(cutting, B1, addDays(TODAY, 3))).rejects.toThrow();
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe(TODAY);

    const report = await applyCopy(storage, B1, addDays(TODAY, 3));

    expect(report.days).toEqual([addDays(TODAY, 1), addDays(TODAY, 2)]);
  });

  it('row 1: two partners’ copies of one client are two clients, so what one does never shows in the other', async () => {
    const storage = await fresh();
    const one = await make(storage, A1);
    await make(storage, A2);
    await applyCopy(storage, A1, TODAY);
    await applyCopy(storage, A2, TODAY);
    expect(await tenantOf(storage, A1.code)).not.toBe(await tenantOf(storage, A2.code));
    const first = await staffOf(storage, A1.code);
    expect(read(first)).toEqual(read(await staffOf(storage, A2.code)));

    const root = await asRoot(storage, A1.code, one.password);
    const target = first.find((p) => !p.archived)!;
    const doc = (await root('GET', employeeRoutes.one(target.id))).json<{ version: string }>();
    expect(
      (await root('POST', employeeRoutes.archive(target.id), { version: doc.version })).statusCode,
    ).toBe(200);

    expect((await staffOf(storage, A1.code)).find((p) => p.code === target.code)!.archived).toBe(
      true,
    );
    expect((await staffOf(storage, A2.code)).find((p) => p.code === target.code)!.archived).toBe(
      false,
    );
  });
});

describe('what its users changed', () => {
  it('row 6: a leaver its users archived first, or whose code they changed, is skipped and named, never forced', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    if (event.kind !== 'leave') throw new Error('a leave');
    for (const change of ['archived', 'recoded'] as const) {
      const storage = await fresh();
      const made = await make(storage, A1);
      await applyCopy(storage, A1, day);
      const root = await asRoot(storage, A1.code, made.password);
      const person = (await staffOf(storage, A1.code)).find((p) => p.code === event.code)!;
      const { version } = (await root('GET', employeeRoutes.one(person.id))).json<{
        version: string;
      }>();
      const reply =
        change === 'archived'
          ? await root('POST', employeeRoutes.archive(person.id), { version })
          : await root('PUT', employeeRoutes.code(person.id), { version, code: 'ZZ-9999' });
      expect(reply.statusCode).toBe(200);
      const lines: string[] = [];

      const report = await applyCopy(storage, A1, addDays(day, 1), (line) => lines.push(line));

      expect(report.status).toBe('ok');
      expect(report.skipped).toEqual([
        change === 'archived'
          ? `${event.code} has already left`
          : `${event.code} is not in the list`,
      ]);
      expect(
        lines.some((line) => line.includes(event.code) && line.includes('left as it is')),
      ).toBe(true);
      const after = (await staffOf(storage, A1.code)).find((p) => p.id === person.id)!;
      expect(after.archived).toBe(change === 'archived');
      expect(after.code).toBe(change === 'archived' ? event.code : 'ZZ-9999');
    }
  });

  it('row 6: a leaver its users changed between the read and the archive is a skip too', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, day);
    const moving = hooked(storage, {
      beforePut: async (key, data) => {
        const record = data as { archived?: boolean };
        if (key.includes('.employee.') && record.archived === true) {
          const found = (await storage.getRecord(key))!;
          const changed = { ...(found.data as { name: string }), name: 'Đã đổi tên' };
          await storage.putRecord(key, changed, found.tag);
        }
      },
    });

    const report = await applyCopy(moving, A1, addDays(day, 1));

    expect(report.status).toBe('ok');
    expect(report.skipped).toEqual([
      `${(event as { code: string }).code} was changed by its users`,
    ]);
  });

  it('row 6: a leaver gone between the read and the archive, a 404, is a skip too', async () => {
    const { day, event } = firstEvent(A1, 'leave');
    if (event.kind !== 'leave') throw new Error('a leave');
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, day);
    const person = (await staffOf(storage, A1.code)).find((p) => p.code === event.code)!;
    const key = recordKeys.tenant(await tenantOf(storage, A1.code)).employee(person.id);
    let reads = 0;
    const vanishing: CStorageClient = {
      ...storage,
      getRecord: (wanted) =>
        wanted === key && ++reads > 1 ? Promise.resolve(null) : storage.getRecord(wanted),
    };

    const report = await applyCopy(vanishing, A1, addDays(day, 1));

    expect(report.status).toBe('ok');
    expect(report.skipped).toEqual([`${event.code} was changed by its users`]);
  });

  it('row 6: a hire whose code its users used first is left as they made it', async () => {
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    const storage = await fresh();
    const made = await make(storage, B1);
    await applyCopy(storage, B1, day);
    const root = await asRoot(storage, B1.code, made.password);
    const added = await root('POST', ROUTES.employees, {
      name: 'Người Khác',
      code: event.person.code,
      extra: {},
    });
    expect(added.statusCode).toBe(201);

    const report = await applyCopy(storage, B1, addDays(day, 1));

    expect(report.skipped).toEqual([`${event.person.code} is already there`]);
    const mine = (await staffOf(storage, B1.code)).find((p) => p.code === event.person.code)!;
    expect(mine.name).toBe('Người Khác');
  });

  it('row 6: a first fill that stopped halfway is finished by the next run, what is there kept', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    const stopped = {
      client: 'A',
      scenario: 'S1' as const,
      firstDay,
      lastDay: addDays(firstDay, -1),
      filled: false,
    };
    expect(await writeLedger(storage, id, stopped, null)).not.toBeNull();
    const setup = (await root('GET', ROUTES.staffSetup)).json<{ version: string }>();
    expect(
      (await root('PUT', ROUTES.staffSetup, { setup: staffSetupOf('S1'), version: setup.version }))
        .statusCode,
    ).toBe(200);
    const [one] = staffAsOf('A', 'S1', firstDay);
    expect(
      (await root('POST', ROUTES.employees, { name: one.name, code: one.code, extra: {} }))
        .statusCode,
    ).toBe(201);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report).toMatchObject({
      status: 'ok',
      filled: true,
      skipped: [`${one.code} is already there`],
    });
    expect(read(await staffOf(storage, A1.code))).toEqual(standing(A1, TODAY));
  });
});

describe('what its users changed, after a cut or a rename', () => {
  it('row 6: a fill cut between a former person’s add and archive is finished by the next run, that person archived', async () => {
    const storage = await fresh();
    await make(storage, A1);
    let cut = false;
    const dying = hooked(storage, {
      beforePut: (key, data) => {
        if (!cut && key.includes('.employee.') && (data as { archived?: boolean }).archived) {
          cut = true;
          return Promise.reject(down());
        }
        return Promise.resolve();
      },
    });
    await expect(applyCopy(dying, A1, TODAY)).rejects.toThrow(/archive answered 5\d\d/);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('ok');
    expect(read(await staffOf(storage, A1.code))).toEqual(standing(A1, TODAY));
  });

  it('row 6: a hire into a department or position its users renamed is skipped and named, never added with none in silence', async () => {
    const { day, event } = firstEvent(B1, 'hire');
    if (event.kind !== 'hire') throw new Error('a hire');
    for (const unit of ['departments', 'positions'] as const) {
      const storage = await fresh();
      const made = await make(storage, B1);
      await applyCopy(storage, B1, day);
      const root = await asRoot(storage, B1.code, made.password);
      const doc = (await root('GET', ROUTES.staffSetup)).json<StaffSetupDoc>();
      const taken = unit === 'departments' ? event.person.department : event.person.position;
      const setup = {
        ...doc.setup,
        [unit]: doc.setup[unit].map((u) =>
          u.name === taken ? { ...u, name: `${u.name} mới` } : u,
        ),
      };
      expect(
        (await root('PUT', ROUTES.staffSetup, { setup, version: doc.version })).statusCode,
      ).toBe(200);
      const lines: string[] = [];

      const report = await applyCopy(storage, B1, addDays(day, 1), (line) => lines.push(line));

      expect(report.status).toBe('ok');
      expect(report.skipped).toEqual([
        `${event.person.code}: its department or position is no longer there`,
      ]);
      expect(lines.some((line) => line.includes(event.person.code) && line.includes('left'))).toBe(
        true,
      );
      expect((await staffOf(storage, B1.code)).some((p) => p.code === event.person.code)).toBe(
        false,
      );
    }
  });

  it('row 6: a staff setup its users changed before a cut fill is finished is kept, never saved over', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    await writeLedger(
      storage,
      id,
      {
        client: 'A',
        scenario: 'S1',
        firstDay,
        lastDay: addDays(firstDay, -1),
        filled: false,
      },
      null,
    );
    const doc = (await root('GET', ROUTES.staffSetup)).json<{ version: string }>();
    const own = staffSetupOf('S1');
    const mine = {
      ...own,
      departments: [...own.departments, { name: 'Phòng mới', permissions: {}, extra: {} }],
    };
    expect(
      (await root('PUT', ROUTES.staffSetup, { setup: mine, version: doc.version })).statusCode,
    ).toBe(200);

    expect((await applyCopy(storage, A1, TODAY)).status).toBe('ok');

    const after = (await root('GET', ROUTES.staffSetup)).json<StaffSetupDoc>();
    expect(after.setup.departments.map((u) => u.name)).toContain('Phòng mới');
  });
});

describe('the copy’s customers and products, written by the first fill', () => {
  const listsOf = async (storage: CStorageClient, code: string) => {
    const keys = recordKeys.tenant(await tenantOf(storage, code));
    const customers = (await storage.listRecords(keys.customerPrefix)).records.map((one) =>
      customerSchema.parse(one.data),
    );
    const products = (await storage.listRecords(keys.productPrefix)).records.map((one) =>
      productSchema.parse(one.data),
    );
    return { customers, products };
  };
  const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : 1);

  it('row 22: the first fill writes the copy’s customers and products through the import routes, every record parsing, and the same client gives the same lists', async () => {
    const storage = await fresh();
    await make(storage, B1);
    const lines: string[] = [];

    const report = await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    expect(report.status).toBe('ok');
    const { customers, products } = await listsOf(storage, B1.code);
    const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;
    expect(customers.map(strip).sort(byCode)).toEqual(
      customersOf(B1.client, B1.scenario).sort(byCode),
    );
    expect(products.map(strip).sort(byCode)).toEqual(
      productsOf(B1.client, B1.scenario).sort(byCode),
    );
    expect(products).toHaveLength(251);
    expect(products.filter((one) => !one.stocked)).toHaveLength(1);
    expect(lines).toContain(`${B1.code}: 80 customers added`);
    expect(lines).toContain(`${B1.code}: 251 products added`);
  });

  it('row 22: a copy of the same scenario holds the same lists, since they follow the client', async () => {
    const one = await fresh();
    const other = await fresh();
    await make(one, A1);
    await make(other, A2);

    await applyCopy(one, A1, TODAY);
    await applyCopy(other, A2, TODAY);

    const [first, second] = [await listsOf(one, A1.code), await listsOf(other, A2.code)];
    expect(first.customers.map((c) => c.code).sort()).toEqual(
      second.customers.map((c) => c.code).sort(),
    );
    expect(first.customers.map((c) => c.name).sort()).toEqual(
      second.customers.map((c) => c.name).sort(),
    );
  });

  it('row 22: a fill cut after the people finishes on the next run, a code already there skipped and named, the rest added', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    const root = await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const firstDay = addDays(TODAY, -7);
    await writeLedger(
      storage,
      id,
      { client: 'A', scenario: 'S1', firstDay, lastDay: addDays(firstDay, -1), filled: false },
      null,
    );
    const first = customersOf(A1.client, A1.scenario)[0];
    const placed = await root('POST', listImportRoute('customers'), {
      rows: [{ code: first.code, name: 'Chỗ đã có', extra: {} }],
    });
    expect(placed.statusCode).toBe(200);

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('ok');
    expect(report.skipped).toContain(`${first.code} is already in the customers`);
    const { customers } = await listsOf(storage, A1.code);
    expect(customers).toHaveLength(30);
    expect(customers.find((one) => one.code === first.code)?.name).toBe('Chỗ đã có');
  });

  it('row 22: a refusal other than a code already there stops the run red, naming the list and the code', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const breaking = hooked(storage, {
      beforePut: (key) => (key.includes('.product.') ? Promise.reject(down()) : Promise.resolve()),
    });

    await expect(applyCopy(breaking, A1, TODAY)).rejects.toThrow(
      /products import refused VT-001: busy/,
    );
  });
});

describe('only a 409 or a 404 is a skip', () => {
  const armed = async (kind: 'hire' | 'leave') => {
    const { day } = firstEvent(kind === 'hire' ? B1 : A1, kind);
    const copy = kind === 'hire' ? B1 : A1;
    const storage = await fresh();
    await make(storage, copy);
    await applyCopy(storage, copy, day);
    return { storage, copy, next: addDays(day, 1) };
  };

  it('row 18: a write that fails on a hire stops the run red', async () => {
    const { storage, copy, next } = await armed('hire');
    const breaking = hooked(storage, {
      beforePut: (key, data) =>
        key.includes('.employee.') && (data as { archived: boolean }).archived === false
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(
      /POST \/api\/employees answered 5\d\d/,
    );
  });

  it('row 18: a write that fails on a leaver’s archive stops the run red', async () => {
    const { storage, copy, next } = await armed('leave');
    const breaking = hooked(storage, {
      beforePut: (key, data) =>
        key.includes('.employee.') && (data as { archived: boolean }).archived === true
          ? Promise.reject(down())
          : Promise.resolve(),
    });
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(/archive answered 5\d\d/);
  });

  it('row 18: a read that fails stops the run red, and its session is ended', async () => {
    const { storage, copy, next } = await armed('hire');
    let broken = false;
    const breaking = hooked(storage, {
      beforeGet: (key) => {
        if (broken && key.endsWith('.staff-setup')) throw down();
      },
    });
    broken = true;
    await expect(applyCopy(breaking, copy, next)).rejects.toThrow(
      /GET \/api\/staff-setup answered 5\d\d/,
    );
    const sessions = await storage.listRecords(
      recordKeys.tenant(await tenantOf(storage, copy.code)).session(''),
    );
    expect(sessions.records).toEqual([]);
  });
});

describe('the error a run ends with', () => {
  it('row 18: the copy that stops a run red is named in the error, whichever copy of the mapping it is', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await make(storage, B1);
    const idB = await tenantOf(storage, B1.code);
    const breaking = hooked(storage, {
      beforePut: (key) =>
        key.startsWith(`tenant.${idB}.employee.`) ? Promise.reject(down()) : Promise.resolve(),
    });

    await expect(applyAll(breaking, TODAY, () => undefined)).rejects.toThrow(
      new RegExp(`^${B1.code}: .*answered 5\\d\\d`),
    );
  });
});

describe('which clients are touched', () => {
  it('row 8: a client with a code outside the mapping, one someone used first, and one not made are left', async () => {
    const storage = await fresh();
    await createClient(storage, {
      code: 'check-1700000000',
      name: 'A deploy’s check',
      madeAt: Date.now(),
    });
    const used = await make(storage, A1);
    const root = await asRoot(storage, A1.code, used.password);
    expect(
      (await root('POST', ROUTES.employees, { name: 'Ai Đó', code: 'AD-1', extra: {} })).statusCode,
    ).toBe(201);
    const checkBefore = JSON.stringify(await everything(storage, 'check-1700000000'));
    const usedBefore = JSON.stringify(await everything(storage, A1.code));
    const lines: string[] = [];

    const reports = await applyAll(storage, TODAY, (line) => lines.push(line));

    expect(reports).toHaveLength(6);
    const byCode = Object.fromEntries(reports.map((r) => [r.code, r.status]));
    expect(byCode[A1.code]).toBe('refused');
    expect(byCode[A2.code]).toBe('missing');
    expect(Object.values(byCode).filter((status) => status === 'missing')).toHaveLength(5);
    expect(JSON.stringify(await everything(storage, 'check-1700000000'))).toBe(checkBefore);
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(usedBefore);
    expect(lines.join('\n')).not.toContain('check-1700000000');
  });

  it('row 8: a copy whose root only signed in before the first fill is still filled, and a week on, its session long expired, is still kept up', async () => {
    const storage = await fresh();
    const made = await make(storage, A1);
    await asRoot(storage, A1.code, made.password);
    const id = await tenantOf(storage, A1.code);
    const left = (await everything(storage, A1.code))
      .map((record) => record.key)
      .filter(
        (key) =>
          key !== recordKeys.tenant(id).config && key !== recordKeys.tenant(id).user(ROOT_NAME),
      );
    expect(left).toHaveLength(1);
    expect(left[0].startsWith(recordKeys.tenant(id).session(''))).toBe(true);

    expect((await applyCopy(storage, A1, TODAY)).status).toBe('ok');
    expect((await applyCopy(storage, A1, addDays(TODAY, 9))).status).toBe('ok');
  });

  it('row 8: a copy whose name, logo, colour, languages or default language its users changed before the first fill is refused, never overwritten', async () => {
    const changes = {
      name: 'Tên khách tự đặt',
      logo: companyConfig('B', B1.company).logo,
      colour: '#112233',
      languages: ['vi'],
      defaultLanguage: 'en',
    };
    for (const [field, value] of Object.entries(changes)) {
      const storage = await fresh();
      const made = await make(storage, B1);
      const root = await asRoot(storage, B1.code, made.password);
      const doc = (await root('GET', ROUTES.config)).json<{ config: object; version: string }>();
      const changed = {
        ...doc.config,
        [field]: value,
        ...(field === 'languages' ? { defaultLanguage: 'vi' } : {}),
      };
      expect(
        (await root('PUT', ROUTES.config, { config: changed, version: doc.version })).statusCode,
      ).toBe(200);
      expect((await root('POST', ROUTES.signOut)).statusCode).toBe(204);
      const id = await tenantOf(storage, B1.code);

      const report = await applyCopy(storage, B1, TODAY);

      expect(report.status).toBe('refused');
      const config = tenantConfigSchema.parse(
        (await storage.getRecord(recordKeys.tenant(id).config))!.data,
      );
      expect(config[field as keyof typeof config]).toEqual(value);
    }
  });

  it('row 8: a list that has more past what was read is not a new client', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const prefix = recordKeys.tenant(await tenantOf(storage, A1.code)).all;
    const long: CStorageClient = {
      ...storage,
      listRecords: async (wanted) => {
        const listed = await storage.listRecords(wanted);
        return wanted === prefix ? { ...listed, more: true } : listed;
      },
    };

    expect((await applyCopy(long, A1, TODAY)).status).toBe('refused');
  });

  it('row 21: a ledger naming another scenario than the mapping is refused, never switched', async () => {
    const storage = await fresh();
    await make(storage, A1);
    const id = await tenantOf(storage, A1.code);
    const wrong = {
      client: 'A',
      scenario: 'S2' as const,
      firstDay: '2026-10-22',
      lastDay: '2026-10-28',
      filled: true,
    };
    await writeLedger(storage, id, wrong, null);
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('refused');
    expect(report.note).toContain('the ledger names S2, the mapping S1');
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
  });

  it('row 21: a ledger naming another client than the mapping is refused, never switched', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await applyCopy(storage, A1, '2026-10-28');
    const id = await tenantOf(storage, A1.code);
    const found = (await storage.getRecord(recordKeys.tenant(id).seed))!;
    await storage.putRecord(
      recordKeys.tenant(id).seed,
      { ...(found.data as object), client: 'C' },
      found.tag,
    );
    const before = JSON.stringify(await everything(storage, A1.code));

    const report = await applyCopy(storage, A1, TODAY);

    expect(report.status).toBe('refused');
    expect(report.note).toContain('the ledger names client C, the mapping A');
    expect(JSON.stringify(await everything(storage, A1.code))).toBe(before);
  });

  it('applyAll with a partner reaches that partner’s copies alone', async () => {
    const storage = await fresh();
    await make(storage, A1);
    await make(storage, B1);
    const reports = await applyAll(storage, TODAY, () => undefined, 'p1');
    expect(reports.map((r) => [r.code, r.status]).sort()).toEqual([
      [B1.code, 'ok'],
      [A1.code, 'ok'],
    ]);
  });
});

describe('the ledger and the run’s session', () => {
  it('row 19: the session is ended with the run, and nothing of a password is read, kept or printed', async () => {
    const storage = await fresh();
    const made = await make(storage, B1);
    const lines: string[] = [];

    await applyCopy(storage, B1, TODAY, (line) => lines.push(line));

    const id = await tenantOf(storage, B1.code);
    expect((await storage.listRecords(recordKeys.tenant(id).session(''))).records).toEqual([]);
    expect(lines.length).toBeGreaterThan(5);
    expect(lines.join('\n')).not.toContain(made.password);
    expect(JSON.stringify(await everything(storage, B1.code))).not.toContain(made.password);
    expect(lines.join('\n')).not.toMatch(/password|scrypt/i);
  });

  it('row 20: the ledger sits outside every list the BFF reads, and two runs at once leave one correct copy', async () => {
    const storage = await fresh();
    await make(storage, B1);

    const reports = await Promise.all([
      applyCopy(storage, B1, TODAY),
      applyCopy(storage, B1, TODAY),
    ]);

    const id = await tenantOf(storage, B1.code);
    const people = await staffOf(storage, B1.code);
    expect(new Set(people.map((p) => p.code)).size).toBe(people.length);
    expect(read(people)).toEqual(standing(B1, TODAY));
    expect((await readLedger(storage, id))!.ledger.lastDay).toBe('2026-10-28');
    expect(reports.some((r) => r.status === 'ok')).toBe(true);
    expect(await storage.getRecord(recordKeys.tenant(id).seed)).not.toBeNull();
  });

  it('row 20: a ledger another run wrote first stops this run, at the start, after the fill and after a day', async () => {
    const moveLedger = async (storage: CStorageClient, key: string, ifTag?: string | null) => {
      if (!key.endsWith('.seed')) return;
      if (ifTag === null) {
        await storage.putRecord(key, { rival: true }, null);
        return;
      }
      const found = (await storage.getRecord(key))!;
      await storage.putRecord(key, { ...(found.data as object), moved: true }, found.tag);
    };
    // at the start: the ledger is written by a rival between the read and the first write
    const first = await fresh();
    await make(first, A1);
    const atStart = hooked(first, {
      beforePut: (key, _data, ifTag) => moveLedger(first, key, ifTag),
    });
    expect(await applyCopy(atStart, A1, TODAY)).toMatchObject({
      status: 'refused',
      note: 'another run holds it, left',
    });

    // after the fill
    const second = await fresh();
    await make(second, A1);
    const afterFill = hooked(second, {
      beforePut: (key, _data, ifTag) =>
        ifTag === null ? Promise.resolve() : moveLedger(second, key, ifTag),
    });
    expect(await applyCopy(afterFill, A1, TODAY)).toMatchObject({
      status: 'refused',
      filled: false,
    });

    // after a day: the fill done, the rival moves the ledger as the first day finishes
    const third = await fresh();
    await make(third, A1);
    await applyCopy(third, A1, TODAY);
    const idThird = await tenantOf(third, A1.code);
    const before = (await readLedger(third, idThird))!.ledger.lastDay;
    const afterDay = hooked(third, {
      beforePut: (key, _data, ifTag) => moveLedger(third, key, ifTag),
    });
    const report = await applyCopy(afterDay, A1, addDays(TODAY, 1));
    expect(report).toMatchObject({ status: 'refused', days: [] });
    expect((await readLedger(third, idThird))!.ledger.lastDay).toBe(before);
  });

  it('reads a ledger that does not parse as an error, and a write read back as another’s as moved', async () => {
    expect(() => parseLedger(null)).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S9',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S1',
        firstDay: 'x',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 7,
        scenario: 'S1',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: true,
      }),
    ).toThrow('does not parse');
    expect(() =>
      parseLedger({
        client: 'A',
        scenario: 'S1',
        firstDay: '2026-10-01',
        lastDay: '2026-10-01',
        filled: 'yes',
      }),
    ).toThrow('does not parse');
    const good = {
      client: 'A',
      scenario: 'S1' as const,
      firstDay: '2026-10-01',
      lastDay: '2026-10-02',
      filled: true,
    };
    expect(parseLedger(good)).toEqual(good);
    const storage = await fresh();
    const other = hooked(storage, {});
    const swapped: CStorageClient = {
      ...other,
      getRecord: () =>
        Promise.resolve({ data: { ...good, lastDay: '2026-10-09' }, tag: 'a'.repeat(64) }),
    };
    expect(await writeLedger(swapped, 'swapped', good, null)).toBeNull();
    expect(await writeLedger(storage, 'id', good, null)).toMatch(/^[0-9a-f]{64}$/);
    expect(await writeLedger(storage, 'id', good, null)).toBeNull();
  });
});

describe('what pnpm demo makes', () => {
  it('row 22: the mapped copies are made by the operator’s create, filled to four days ago, then run three days', async () => {
    const storage = await fresh();

    const copies = await startDemo(storage, TODAY, 'p1');

    expect(copies.map((c) => c.code).sort()).toEqual([B1.code, A1.code].sort());
    for (const copy of copies) {
      expect(copy.rootPassword.length).toBeGreaterThan(8);
      const id = await tenantOf(storage, copy.code);
      expect((await readLedger(storage, id))!.ledger).toMatchObject({
        firstDay: '2026-10-19',
        lastDay: '2026-10-28',
        filled: true,
      });
      expect(read(await staffOf(storage, copy.code))).toEqual(standing(copy, TODAY));
    }
    await expect(startDemo(storage, TODAY, 'p1')).rejects.toThrow('already holds it');
    await expect(startDemo(storage, TODAY, 'nobody')).rejects.toThrow('no copy in the mapping');
  });

  it('row 22: a copy whose run is refused stops the start', async () => {
    const storage = await fresh();
    const rival = hooked(storage, {
      beforePut: async (key, _data, ifTag) => {
        if (key.endsWith('.seed') && ifTag === null)
          await storage.putRecord(key, { rival: true }, null);
      },
    });
    await expect(startDemo(rival, TODAY, 'p2')).rejects.toThrow('another run holds it');
  });
});
