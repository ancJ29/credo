import { randomUUID } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  importEmployeesReplySchema,
  IMPORT_CALL_ROWS,
  IMPORT_ROUTE,
  storedUserSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { personCalls, staffTenant } from '../tests/staff';
import { seedEmployee, signIn } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const { added, doc, codes } = personCalls;

type Tenant = Awaited<ReturnType<typeof staffTenant>>;

/** The root's import of rows; an answer that is not a 200 fails on its status. */
async function imported(t: Tenant, rows: unknown[]) {
  const reply = await t.rootCall.send('POST', IMPORT_ROUTE, { rows });
  expect(reply.statusCode).toBe(200);
  return importEmployeesReplySchema.parse(reply.json()).results;
}

const row = (over: object = {}) => ({ name: 'Mai Linh', extra: {}, ...over });

describe('Only the root imports staff: no permission allows it, and the server checks it', () => {
  it('refuses a person who may add staff, 403, and one not signed in, 401, and adds no one', async () => {
    const t = await staffTenant(cs);
    const office = await t.staff('OFFICE', {
      own: { 'staff.canCreate': true, 'staff.canView': true },
    });

    const refused = await office.call.send('POST', IMPORT_ROUTE, {
      rows: [row({ code: 'NEW-1' })],
    });
    const unknown = await t.app.inject({
      method: 'POST',
      url: IMPORT_ROUTE,
      payload: { rows: [row()] },
      headers: { 'x-client': 'acme-co' },
    });

    expect(refused.statusCode).toBe(403);
    expect(unknown.statusCode).toBe(401);
    expect(await codes(t.rootCall)).toEqual(['OFFICE']);
  });
});

describe('The rows that hold are added as people without a sign-in, each through the same checks as one added by hand', () => {
  it('adds each row as a person with no password, in the order sent, and answers each with the person', async () => {
    const t = await staffTenant(cs);

    const results = await imported(t, [
      row({ code: 'nv-1', name: 'One', extra: { note: 'a' } }),
      row({ code: 'NV-2', name: 'Two' }),
    ]);

    expect(results.map((result) => result.kind)).toEqual(['added', 'added']);
    const [one, two] = results.map((result) =>
      result.kind === 'added' ? result.employee : (undefined as never),
    );
    expect(one).toMatchObject({ code: 'NV-1', name: 'One', extra: { note: 'a' }, archived: false });
    expect(two).toMatchObject({ code: 'NV-2', name: 'Two' });
    expect(await codes(t.rootCall)).toEqual(['NV-1', 'NV-2']);
    expect((await doc(t.rootCall, one.id)).signIn).toEqual({ name: 'NV-1', ready: false });
    const stored = storedUserSchema.parse((await t.client.getRecord(t.keys.user('nv-1')))?.data);
    expect(stored).toMatchObject({ passwordHash: null, root: false, employeeId: one.id });
    expect(
      (await signIn(t.app, { name: 'NV-1', password: 'any password at all' })).response.statusCode,
    ).toBe(401);
  });

  it('links a department and a position by the id the setup minted, with their names', async () => {
    const t = await staffTenant(cs);
    const saved = await t.setup({
      departments: [{ name: 'Sales', permissions: {}, extra: {} }],
      positions: [{ name: 'Lead', permissions: {}, extra: {} }],
    });
    const department = saved.setup.departments[0];
    const position = saved.setup.positions[0];

    const [result] = await imported(t, [
      row({ code: 'NV-1', departmentId: department.id, positionId: position.id }),
    ]);

    expect(result).toMatchObject({
      kind: 'added',
      employee: {
        department: { id: department.id, name: 'Sales' },
        position: { id: position.id, name: 'Lead' },
      },
    });
  });

  it('numbers a row with no code past a code typed by an earlier row of the call, one after another in the order sent', async () => {
    const t = await staffTenant(cs);
    const first = await added(t.rootCall, { code: undefined });
    await t.rootCall.send('PUT', `/api/employees/${first.employee.employee.id}/code`, {
      version: first.employee.version,
      code: 'BOSS',
    });

    const results = await imported(t, [row({ code: 'EMP-0005' }), row(), row()]);

    expect(
      results.map((result) => (result.kind === 'added' ? result.employee.code : result.reason)),
    ).toEqual(['EMP-0005', 'EMP-0006', 'EMP-0007']);
    expect(await codes(t.rootCall)).toEqual(['BOSS', 'EMP-0005', 'EMP-0006', 'EMP-0007']);
  });

  it('never numbers a row with a freed number: a code a change freed counts as given', async () => {
    const t = await staffTenant(cs);
    const first = await added(t.rootCall, { code: undefined });
    expect(first.employee.employee.code).toBe('EMP-0001');
    await t.rootCall.send('PUT', `/api/employees/${first.employee.employee.id}/code`, {
      version: first.employee.version,
      code: 'BOSS',
    });

    const results = await imported(t, [row(), row()]);

    expect(
      results.map((result) => (result.kind === 'added' ? result.employee.code : result.reason)),
    ).toEqual(['EMP-0002', 'EMP-0003']);
  });

  it('lists the people once for a call, at its first numbered row, however many rows are numbered; a call of typed codes lists no one', async () => {
    let listings = 0;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async listRecords(prefix) {
          if (prefix === t.keys.employeePrefix) listings++;
          return await client.listRecords(prefix);
        },
      }),
    });

    await imported(t, [row(), row(), row({ code: 'NV-1' }), row()]);
    const afterNumbered = listings;
    await imported(t, [row({ code: 'NV-2' }), row({ code: 'NV-3' })]);

    expect(afterNumbered).toBe(1);
    expect(listings).toBe(1);
  });

  it('refuses a row whose code is taken, in the company or by an earlier row of the call, and adds the rest', async () => {
    const t = await staffTenant(cs);
    await seedEmployee(t.client, t.id, { code: 'EMP-1', name: 'Held' });

    const results = await imported(t, [
      row({ code: 'emp-1' }),
      row({ code: 'NV-1', name: 'First' }),
      row({ code: 'NV-1', name: 'Second' }),
      row({ code: 'NV-2' }),
    ]);

    expect(results.map((result) => (result.kind === 'added' ? 'added' : result.reason))).toEqual([
      'taken',
      'added',
      'taken',
      'added',
    ]);
    expect(await codes(t.rootCall)).toEqual(['EMP-1', 'NV-1', 'NV-2']);
    const kept = (await t.rootCall.get('/api/employees')).json<{
      employees: { code: string; name: string }[];
    }>();
    expect(kept.employees.find((person) => person.code === 'NV-1')?.name).toBe('First');
    expect(kept.employees.find((person) => person.code === 'EMP-1')?.name).toBe('Held');
  });

  it('refuses a row the add would refuse as invalid, a department the setup lacks or a code or name that is no good, and writes nothing for it', async () => {
    const t = await staffTenant(cs);
    const unknown = '3f2a91bc-0000-4000-8000-000000000001';

    const results = await imported(t, [
      row({ code: 'NV-1', departmentId: unknown }),
      row({ code: 'NV-2', positionId: unknown }),
      row({ code: 'has space' }),
      { extra: {}, code: 'NV-3' },
      row({ code: 'NV-4', password: 'x' }),
      'a row that is no object',
      row({ code: 'NV-5' }),
    ]);

    expect(results.map((result) => (result.kind === 'added' ? 'added' : result.reason))).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'added',
    ]);
    expect(await codes(t.rootCall)).toEqual(['NV-5']);
    expect(await t.client.getRecord(t.keys.user('nv-1'))).toBeNull();
  });

  it('answers 400 to a call with no rows, with more than a call’s 100, or with a key it does not know, and adds no one', async () => {
    const t = await staffTenant(cs);
    const send = (payload: unknown) => t.rootCall.send('POST', IMPORT_ROUTE, payload);

    const many = Array.from({ length: IMPORT_CALL_ROWS + 1 }, (_, at) => row({ code: `NV-${at}` }));
    const answers = await Promise.all([
      send({ rows: [] }),
      send({ rows: many }),
      send({ rows: [row()], extra: 1 }),
      send({}),
      send(undefined),
    ]);

    expect(answers.map((answer) => answer.statusCode)).toEqual([400, 400, 400, 400, 400]);
    expect(await codes(t.rootCall)).toEqual([]);
  });

  it('takes a whole call of 100 rows', async () => {
    const t = await staffTenant(cs);

    const results = await imported(
      t,
      Array.from({ length: IMPORT_CALL_ROWS }, (_, at) => row({ code: `NV-${at}` })),
    );

    expect(results.filter((result) => result.kind === 'added')).toHaveLength(IMPORT_CALL_ROWS);
    expect(await codes(t.rootCall)).toHaveLength(IMPORT_CALL_ROWS);
  });
});

describe('A row that fails other than by a refusal is its own result, busy, and the call goes on: each call answers one result per row', () => {
  it('answers a row whose code may be a running add’s as busy, and adds the rows before and after it', async () => {
    const t = await staffTenant(cs);
    // A claim no person names back, younger than the longest an add runs.
    await t.client.putRecord(t.keys.user('nv-2'), {
      passwordHash: null,
      root: false,
      employeeId: randomUUID(),
      passwordAt: t.time.now(),
      generation: randomUUID(),
    });

    const results = await imported(t, [
      row({ code: 'NV-1' }),
      row({ code: 'NV-2' }),
      row({ code: 'NV-3' }),
    ]);

    expect(results.map((result) => result.kind === 'added' || result.reason)).toEqual([
      true,
      'busy',
      true,
    ]);
    expect(await codes(t.rootCall)).toEqual(['NV-1', 'NV-3']);
  });

  it('answers a row the store fails on as busy, and adds the rows before and after it', async () => {
    let failOn: string | null = null;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (failOn && key.includes('.employee.') && (data as { code: string }).code === failOn) {
            throw new CStorageError(503, 'down');
          }
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });
    failOn = 'NV-2';

    const results = await imported(t, [
      row({ code: 'NV-1' }),
      row({ code: 'NV-2' }),
      row({ code: 'NV-3' }),
    ]);
    failOn = null;

    expect(results.map((result) => result.kind === 'added' || result.reason)).toEqual([
      true,
      'busy',
      true,
    ]);
    expect(await codes(t.rootCall)).toEqual(['NV-1', 'NV-3']);
  });

  it('answers a row as added, with the person it wrote, when the store fails on the read after the write', async () => {
    let failReads = false;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async getRecord(key) {
          if (failReads && key.includes('.employee.')) throw new CStorageError(503, 'down');
          return await client.getRecord(key);
        },
        async putRecord(key, data, ifTag) {
          const saved = await client.putRecord(key, data, ifTag);
          if (key.includes('.employee.')) failReads = true;
          return saved;
        },
      }),
    });

    const results = await imported(t, [row({ code: 'NV-1' }), row({ code: 'NV-2' })]);
    failReads = false;

    expect(results.map((result) => result.kind)).toEqual(['added', 'added']);
    expect(await codes(t.rootCall)).toEqual(['NV-1', 'NV-2']);
  });

  it('ends the call as a 500, with the rows before it kept, on a failure that is no outage and no refusal', async () => {
    const t = await staffTenant(cs);
    await t.client.putRecord(t.keys.staffNumbering, { given: 'not a record' });

    const reply = await t.rootCall.send('POST', IMPORT_ROUTE, {
      rows: [row({ code: 'NV-1' }), row(), row({ code: 'NV-3' })],
    });

    expect(reply.statusCode).toBe(500);
    expect(await codes(t.rootCall)).toEqual(['NV-1']);
  });
});
