import {
  addEmployeeReplySchema,
  CStorageError,
  type CStorageClient,
  employeeDocSchema,
  employeeListReplySchema,
  passwordIsValid,
  storedUserSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { staffTenant } from '../tests/staff';
import { seedEmployee, signIn, withAuth } from '../tests/tenant';
import { verifyPassword } from './password';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Tenant = Awaited<ReturnType<typeof staffTenant>>;
type Call = Tenant['rootCall'];

const person = (over: object = {}) => ({ name: 'Mai Linh', code: 'EMP-1', extra: {}, ...over });
const add = (call: Call, over: object = {}) => call.send('POST', '/api/employees', person(over));
const added = async (call: Call, over: object = {}) => {
  const reply = await add(call, over);
  expect(reply.statusCode).toBe(201);
  return addEmployeeReplySchema.parse(reply.json());
};
const doc = async (call: Call, id: string) =>
  employeeDocSchema.parse((await call.get(`/api/employees/${id}`)).json());
const list = async (call: Call) =>
  employeeListReplySchema.parse((await call.get('/api/employees')).json()).employees;
const codes = async (call: Call) => (await list(call)).map((employee) => employee.code);
const me = (t: Tenant, authId: string) =>
  t.app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) });

/** A client that fails (as c-storage being down would) on the first call `fails` names. */
function failing(
  fails: (call: string, key: string) => boolean,
): (c: CStorageClient) => CStorageClient {
  return (client) => ({
    ...client,
    async getRecord(key) {
      if (fails('get', key)) throw new CStorageError(503, 'down');
      return await client.getRecord(key);
    },
    async putRecord(key, data, ifTag) {
      if (fails('put', key)) throw new CStorageError(503, 'down');
      return await client.putRecord(key, data, ifTag);
    },
    async listRecords(prefix) {
      return await client.listRecords(prefix);
    },
  });
}

describe('The root adds a person with a name, a code, a phone, a department, a position and a note, and is then shown their sign-in name and a first password once, to copy and hand over; the password is never shown again and is kept only as its hash', () => {
  it('adds the person, answers their sign-in name and a password that follows the rule, and signs them in', async () => {
    const t = await staffTenant(cs);
    const setup = await t.setup({
      departments: [{ name: 'Sales', permissions: {}, extra: {} }],
      positions: [{ name: 'Clerk', permissions: {}, extra: {} }],
    });
    const [dept] = setup.setup.departments;
    const [pos] = setup.setup.positions;
    const extra = { phone: '0901 234 567', note: 'Starts Monday', nested: { a: [1, null] } };
    const reply = await added(t.rootCall, {
      code: 'emp-0001',
      extra,
      departmentId: dept.id,
      positionId: pos.id,
    });

    expect(reply.employee.employee).toMatchObject({
      code: 'EMP-0001',
      name: 'Mai Linh',
      extra,
      archived: false,
      permissions: {},
      department: { id: dept.id, name: 'Sales' },
      position: { id: pos.id, name: 'Clerk' },
    });
    expect(reply.employee.signIn).toEqual({ name: 'EMP-0001', ready: true });
    expect(passwordIsValid(reply.password as string)).toBe(true);

    const signedIn = await signIn(t.app, { name: 'emp-0001', password: reply.password as string });
    expect(signedIn.response.statusCode).toBe(200);
  });

  it('keeps the password only as its hash, and shows it in no later answer', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);
    const password = reply.password as string;
    const stored = await t.client.getRecord(t.keys.user('emp-1'));
    const user = storedUserSchema.parse(stored?.data);
    expect(user.employeeId).toBe(reply.employee.employee.id);
    expect(await verifyPassword(password, user.passwordHash as string)).toBe(true);
    const everything = [
      JSON.stringify(stored),
      JSON.stringify(await t.client.getRecord(t.keys.employee(reply.employee.employee.id))),
      (await t.rootCall.get(`/api/employees/${reply.employee.employee.id}`)).body,
      (await t.rootCall.get('/api/employees')).body,
    ].join('\n');
    expect(everything).not.toContain(password);
  });

  it('refuses a department or position the setup does not hold, 400, and writes nothing', async () => {
    const t = await staffTenant(cs);
    const unknown = '3f2a91bc-0000-4000-8000-000000000001';
    for (const over of [{ departmentId: unknown }, { positionId: unknown }]) {
      expect((await add(t.rootCall, over)).statusCode).toBe(400);
    }
    expect(await codes(t.rootCall)).toEqual([]);
    expect(await t.client.getRecord(t.keys.user('emp-1'))).toBeNull();
  });
});

describe('Someone allowed to add people adds one with a name, a code, a phone and a note, without a department, a position or a sign-in, which the root gives; the person’s page says they cannot sign in yet', () => {
  it('adds the person with no password and no units, and they cannot sign in yet', async () => {
    const t = await staffTenant(cs);
    const clerk = await t.staff('CLERK', {
      own: { 'staff.canCreate': true, 'staff.canView': true },
    });
    const reply = await added(clerk.call, { extra: { phone: '0901' } });
    expect(reply.password).toBeNull();
    expect(reply.employee.employee).toMatchObject({ department: null, position: null });
    expect(reply.employee.signIn).toEqual({ name: 'EMP-1', ready: false });
    const page = await doc(clerk.call, reply.employee.employee.id);
    expect(page.signIn.ready).toBe(false);
    const attempt = await signIn(t.app, { name: 'EMP-1', password: 'Any-password-1!' });
    expect(attempt.response.statusCode).toBe(401);
  });

  it('refuses a department or a position from someone who is not the root, 403, and writes nothing', async () => {
    const t = await staffTenant(cs);
    const clerk = await t.staff('CLERK', { own: { 'staff.canCreate': true } });
    const setup = await t.setup({
      departments: [{ name: 'Sales', permissions: {}, extra: {} }],
      positions: [{ name: 'Clerk', permissions: {}, extra: {} }],
    });
    const dept = setup.setup.departments[0].id;
    const pos = setup.setup.positions[0].id;
    for (const over of [{ departmentId: dept }, { positionId: pos }]) {
      expect((await add(clerk.call, over)).statusCode).toBe(403);
    }
    expect(await t.client.getRecord(t.keys.user('emp-1'))).toBeNull();
    const refused = await add((await t.staff('PLAIN', { own: { 'staff.canView': true } })).call);
    expect(refused.statusCode).toBe(403);
  });
});

describe('A code is 2 to 20 of the letters A to Z, digits and hyphens, unique in the company in any case, among people who left too, and is the person’s sign-in name; a code already taken is refused, and its holder is unchanged', () => {
  it('keeps a code in capitals and refuses one that is not 2 to 20 of A to Z, digits and hyphens', async () => {
    const t = await staffTenant(cs);
    for (const code of ['a', 'has space', 'x'.repeat(21), 'a_b', 'é1', '']) {
      expect((await add(t.rootCall, { code })).statusCode, code).toBe(400);
    }
    for (const code of ['ab', `A${'-'.repeat(19)}`, 'a1-b2']) {
      expect((await add(t.rootCall, { code })).statusCode, code).toBe(201);
    }
    expect(await codes(t.rootCall)).toEqual(['A-------------------', 'A1-B2', 'AB']);
  });

  it('refuses a code taken in any case, one held by a person who left, and the root’s name, leaving its holder as it was', async () => {
    const t = await staffTenant(cs);
    const first = await added(t.rootCall, { name: 'First holder', code: 'EMP-1' });
    const id = first.employee.employee.id;
    for (const code of ['EMP-1', 'emp-1', ' Emp-1 ']) {
      expect((await add(t.rootCall, { name: 'Second', code })).statusCode, code).toBe(409);
    }
    const archived = await t.rootCall.send('POST', `/api/employees/${id}/archive`, {
      version: first.employee.version,
    });
    expect(archived.statusCode).toBe(200);
    expect((await add(t.rootCall, { name: 'Second', code: 'emp-1' })).statusCode).toBe(409);
    expect((await add(t.rootCall, { name: 'Second', code: 'ROOT' })).statusCode).toBe(409);
    expect((await doc(t.rootCall, id)).employee).toMatchObject({
      name: 'First holder',
      archived: true,
    });
    expect(await codes(t.rootCall)).toEqual(['EMP-1']);
  });
});

describe('The staff list shows each person’s name, code, department, position and phone, in code order; people who left are hidden, and a filter shows them', () => {
  it('answers every person, those who left too, in code order, each with their phone in extra', async () => {
    const t = await staffTenant(cs);
    await added(t.rootCall, { name: 'Third', code: 'EMP-3', extra: { phone: '3' } });
    const second = await added(t.rootCall, {
      name: 'Second',
      code: 'EMP-2',
      extra: { phone: '2' },
    });
    await added(t.rootCall, { name: 'First', code: 'EMP-10', extra: { phone: '1' } });
    await t.rootCall.send('POST', `/api/employees/${second.employee.employee.id}/archive`, {
      version: second.employee.version,
    });
    const people = await list(t.rootCall);
    expect(people.map((p) => [p.code, p.name, p.archived, p.extra['phone']])).toEqual([
      ['EMP-10', 'First', false, '1'],
      ['EMP-2', 'Second', true, '2'],
      ['EMP-3', 'Third', false, '3'],
    ]);
  });
});

describe('A person’s page shows their details, their note, how they sign in and whether they can yet; someone allowed changes their name, phone and note there', () => {
  it('answers a person’s page with their sign-in, 404 for no one, and 403 to someone who may not see it', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { extra: { phone: '0901', note: 'Night shift' } });
    const id = reply.employee.employee.id;
    const page = await doc(t.rootCall, id);
    expect(page).toEqual(reply.employee);
    expect(page.employee.extra).toEqual({ phone: '0901', note: 'Night shift' });
    for (const missing of ['3f2a91bc-0000-4000-8000-000000000001', 'not-an-id']) {
      expect((await t.rootCall.get(`/api/employees/${missing}`)).statusCode).toBe(404);
    }
    const plain = await t.staff('PLAIN', { own: { 'staff.canCreate': true } });
    expect((await plain.call.get(`/api/employees/${id}`)).statusCode).toBe(403);
  });

  it('lets someone allowed change a name and `extra`, which a save replaces whole', async () => {
    const t = await staffTenant(cs);
    const editor = await t.staff('EDITOR', { own: { 'staff.canEdit': true } });
    const reply = await added(t.rootCall, { extra: { phone: '1', note: 'old', keep: 'me' } });
    const id = reply.employee.employee.id;
    const saved = await editor.call.send('PUT', `/api/employees/${id}`, {
      version: reply.employee.version,
      name: 'Mai Linh Tran',
      extra: { phone: '2', note: 'new' },
    });
    expect(saved.statusCode).toBe(200);
    const page = employeeDocSchema.parse(saved.json());
    expect(page.employee).toMatchObject({
      name: 'Mai Linh Tran',
      extra: { phone: '2', note: 'new' },
    });
    expect(page.version).not.toBe(reply.employee.version);
    expect(await doc(t.rootCall, id)).toEqual(page);
  });
});

describe('A save over someone else’s newer one is refused, what was typed is kept, and the page offers the newer details', () => {
  it('answers 409 with the newer details when the version moved, and changes nothing', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);
    const id = reply.employee.employee.id;
    const save = (version: string, name: string) =>
      t.rootCall.send('PUT', `/api/employees/${id}`, { version, name, extra: {} });
    const newer = employeeDocSchema.parse(
      (await save(reply.employee.version, 'Saved by another')).json(),
    );
    const stale = await save(reply.employee.version, 'Saved from the old page');
    expect(stale.statusCode).toBe(409);
    expect(stale.json<{ current: unknown }>().current).toEqual(newer);
    expect(await doc(t.rootCall, id)).toEqual(newer);
    expect((await save(newer.version, 'Retried over the newer')).statusCode).toBe(200);
  });

  it('refuses a version that is no tag, 400, before c-storage', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);
    const refused = await t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
      version: 'e1',
      name: 'X',
      extra: {},
    });
    expect(refused.statusCode).toBe(400);
  });
});

describe('The root gives a person a password, typed twice or made by the app, of at least 8 characters with a capital, a small letter, a digit and one of `@$!%*?&`; it is shown once, and it signs the person out on every device', () => {
  it('sets a typed password that follows the rule and refuses one that does not', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    for (const password of [
      'Short1!',
      'alllowercase1!',
      'ALLUPPERCASE1!',
      'NoDigits!!',
      'NoSymbol123a',
    ]) {
      expect(
        (await t.rootCall.send('PUT', `/api/employees/${id}/password`, { password })).statusCode,
        password,
      ).toBe(400);
    }
    const set = await t.rootCall.send('PUT', `/api/employees/${id}/password`, {
      password: 'TypedPass1!',
    });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toEqual({ password: 'TypedPass1!' });
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: 'TypedPass1!' })).response.statusCode,
    ).toBe(200);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(401);
  });

  it('makes a password when asked to, shown once, and gives a person added without one a sign-in', async () => {
    const t = await staffTenant(cs);
    const clerk = await t.staff('CLERK', { own: { 'staff.canCreate': true } });
    const bare = await added(clerk.call, { code: 'EMP-1' });
    const id = bare.employee.employee.id;
    const made = await t.rootCall.send('PUT', `/api/employees/${id}/password`, { password: null });
    const { password } = made.json<{ password: string }>();
    expect(passwordIsValid(password)).toBe(true);
    expect((await doc(t.rootCall, id)).signIn.ready).toBe(true);
    expect((await signIn(t.app, { name: 'EMP-1', password })).response.statusCode).toBe(200);
    expect((await t.rootCall.get(`/api/employees/${id}`)).body).not.toContain(password);
  });

  it('signs the person out on every device: a session issued before the new password is a 401', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const pc = await signIn(t.app, { name: 'EMP-1', password: reply.password as string });
    const phone = await signIn(
      t.app,
      { name: 'EMP-1', password: reply.password as string },
      'device-bbbb-0002',
    );
    expect((await me(t, pc.body.authId)).statusCode).toBe(200);
    t.time.advance(1000);
    await t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}/password`, {
      password: 'TypedPass1!',
    });
    expect((await me(t, pc.body.authId)).statusCode).toBe(401);
    expect((await me(t, phone.body.authId)).statusCode).toBe(401);
    const again = await signIn(t.app, { name: 'EMP-1', password: 'TypedPass1!' });
    expect((await me(t, again.body.authId)).statusCode).toBe(200);
  });

  it('is the root’s alone: someone with every permission is refused, 403, and nothing changes', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const boss = await t.staff('BOSS', {
      own: {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'staff.canDelete': true,
      },
    });
    const refused = await boss.call.send(
      'PUT',
      `/api/employees/${reply.employee.employee.id}/password`,
      {
        password: 'TypedPass1!',
      },
    );
    expect(refused.statusCode).toBe(403);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(200);
  });

  it('answers 404 for no one, and 409 for a person whose sign-in record is not theirs', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const put = (id: string) =>
      t.rootCall.send('PUT', `/api/employees/${id}/password`, { password: null });
    expect((await put('3f2a91bc-0000-4000-8000-000000000001')).statusCode).toBe(404);
    await t.client.removeRecord(t.keys.user('emp-1'));
    expect((await put(reply.employee.employee.id)).statusCode).toBe(409);
  });
});

describe('Someone allowed archives a person who left, after a check: they are stopped at their next step and cannot sign in again, and their record and code are kept; no one is un-archived, so someone who returns is added again under a new code', () => {
  it('archives with the version read: the person’s next step is a 401, and they cannot sign in again', async () => {
    const t = await staffTenant(cs);
    const keeper = await t.staff('KEEPER', { own: { 'staff.canDelete': true } });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const own = await signIn(t.app, { name: 'EMP-1', password: reply.password as string });
    expect((await me(t, own.body.authId)).statusCode).toBe(200);

    const done = await keeper.call.send(
      'POST',
      `/api/employees/${reply.employee.employee.id}/archive`,
      {
        version: reply.employee.version,
      },
    );
    expect(done.statusCode).toBe(200);
    expect(employeeDocSchema.parse(done.json()).employee.archived).toBe(true);
    expect((await me(t, own.body.authId)).statusCode).toBe(401);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(401);
    expect(await t.client.getRecord(t.keys.user('emp-1'))).not.toBeNull();
    expect(await t.client.getRecord(t.keys.employee(reply.employee.employee.id))).not.toBeNull();
  });

  it('refuses an archive over a version that moved, 409, by someone who may not, 403, and has no way back', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    const url = `/api/employees/${id}/archive`;
    const plain = await t.staff('PLAIN', { own: { 'staff.canEdit': true } });
    expect(
      (await plain.call.send('POST', url, { version: reply.employee.version })).statusCode,
    ).toBe(403);
    const moved = await t.rootCall.send('PUT', `/api/employees/${id}`, {
      version: reply.employee.version,
      name: 'Renamed',
      extra: {},
    });
    const stale = await t.rootCall.send('POST', url, { version: reply.employee.version });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<{ current: unknown }>().current).toEqual(moved.json());
    expect((await doc(t.rootCall, id)).employee.archived).toBe(false);

    const current = employeeDocSchema.parse(moved.json());
    await t.rootCall.send('POST', url, { version: current.version });
    const back = await t.rootCall.send('PUT', `/api/employees/${id}`, {
      version: (await doc(t.rootCall, id)).version,
      name: 'Back',
      extra: {},
      archived: false,
    });
    expect(back.statusCode).toBe(400);
    expect((await doc(t.rootCall, id)).employee.archived).toBe(true);
  });
});

describe('A person signs in with their code and password on the company’s link, on a PC or a phone', () => {
  it('signs a person in by their code in any case, answers who they are, and refuses one with no password yet', async () => {
    const t = await staffTenant(cs);
    const staff = await t.staff('EMP-7', { department: { 'staff.canView': true } });
    for (const [name, device] of [
      ['emp-7', 'device-aaaa-0001'],
      [' EMP-7 ', 'device-bbbb-0002'],
    ] as const) {
      const reply = await signIn(t.app, { name, password: staff.password as string }, device);
      expect(reply.response.statusCode).toBe(200);
      expect(reply.response.json<{ user: unknown }>().user).toEqual({
        name: 'A person',
        root: false,
        permissions: {
          'staff.canView': true,
          'staff.canCreate': false,
          'staff.canEdit': false,
          'staff.canDelete': false,
        },
      });
    }
    await seedEmployee(t.client, t.id, { code: 'NOPASS', password: null });
    expect(
      (await signIn(t.app, { name: 'NOPASS', password: 'Any-password-1!' })).response.statusCode,
    ).toBe(401);
    expect((await signIn(t.app, { name: 'EMP-7', password: 'wrong' })).response.statusCode).toBe(
      401,
    );
  });
});

describe('Each department and each position carries what its staff may do, and each person may carry their own; the person’s beats the position’s, which beats the department’s, and what none of them allows is refused', () => {
  const canList = async (call: Call) => (await call.get('/api/employees')).statusCode;

  it('allows what the department allows, the position refuses over it, the person allows over that, and refuses what none allows', async () => {
    const t = await staffTenant(cs);
    const none = await t.staff('NONE');
    const dept = await t.staff('DEPT', { department: { 'staff.canView': true } });
    const refused = await t.staff('POS', {
      department: { 'staff.canView': true },
      position: { 'staff.canView': false },
    });
    const own = await t.staff('OWN', {
      department: { 'staff.canView': true },
      position: { 'staff.canView': false },
      own: { 'staff.canView': true },
    });
    const position = await t.staff('POSALLOWS', { position: { 'staff.canView': true } });
    expect(await canList(none.call)).toBe(403);
    expect(await canList(dept.call)).toBe(200);
    expect(await canList(refused.call)).toBe(403);
    expect(await canList(own.call)).toBe(200);
    expect(await canList(position.call)).toBe(200);
  });
});

describe('Piece 2’s permissions are to see the staff list, to add a person, to change a person’s name and details, and to archive a person; the root sets them at any of the three levels', () => {
  it('lets the root set them on a department, a position and a person, each taking effect on the one resolved answer', async () => {
    const t = await staffTenant(cs);
    const staff = await t.staff('EMP-9');
    const permissionsOf = async () =>
      (await me(t, staff.authId)).json<{ user: { permissions: Record<string, boolean> } }>().user
        .permissions;
    expect((await permissionsOf())['staff.canView']).toBe(false);

    const setup = (await t.rootCall.get('/api/staff-setup')).json<{
      setup: { departments: { permissions: object }[]; positions: { permissions: object }[] };
      version: string;
    }>();
    const save = async (departments: object[], positions: object[], version: string) =>
      (
        await t.rootCall.send('PUT', '/api/staff-setup', {
          setup: { departments, positions, extra: {} },
          version,
        })
      ).json<{ setup: typeof setup.setup; version: string }>();
    const withDept = await save(
      [
        {
          ...setup.setup.departments[0],
          permissions: { 'staff.canView': true, 'staff.canEdit': true },
        },
      ],
      setup.setup.positions,
      setup.version,
    );
    expect(await permissionsOf()).toMatchObject({ 'staff.canView': true, 'staff.canEdit': true });
    await save(
      withDept.setup.departments,
      [
        {
          ...withDept.setup.positions[0],
          permissions: { 'staff.canEdit': false, 'staff.canDelete': true },
        },
      ],
      withDept.version,
    );
    expect(await permissionsOf()).toMatchObject({
      'staff.canEdit': false,
      'staff.canDelete': true,
    });

    const page = await doc(t.rootCall, staff.employee.id);
    const saved = await t.rootCall.send('PUT', `/api/employees/${staff.employee.id}`, {
      version: page.version,
      name: page.employee.name,
      extra: {},
      permissions: { 'staff.canEdit': true, 'staff.canCreate': true },
    });
    expect(saved.statusCode).toBe(200);
    expect(await permissionsOf()).toEqual({
      'staff.canView': true,
      'staff.canCreate': true,
      'staff.canEdit': true,
      'staff.canDelete': true,
    });
  });
});

describe('Only the root gives a sign-in or a password, issues a QR code, changes a person’s department, position, permissions, code or email, keeps the staff setup, or imports staff; no permission allows any of these, so no one can take over a colleague’s sign-in or raise what anyone may do', () => {
  it('refuses someone holding every permission each root-only call, 403, and changes nothing', async () => {
    const t = await staffTenant(cs);
    const boss = await t.staff('BOSS', {
      own: {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'staff.canDelete': true,
      },
    });
    const setup = await t.setup({
      departments: [{ name: 'Sales', permissions: {}, extra: {} }],
      positions: [{ name: 'Clerk', permissions: {}, extra: {} }],
    });
    const dept = setup.setup.departments[0];
    const reply = await added(t.rootCall, { code: 'EMP-1', departmentId: dept.id });
    const id = reply.employee.employee.id;
    const body = (over: object) => ({
      version: reply.employee.version,
      name: 'X',
      extra: {},
      ...over,
    });
    const attempts = [
      boss.call.send('PUT', '/api/staff-setup', {
        setup: { departments: [], positions: [], extra: {} },
        version: setup.version,
      }),
      boss.call.send('PUT', `/api/employees/${id}/password`, { password: null }),
      add(boss.call, { code: 'EMP-2', departmentId: dept.id }),
      boss.call.send('PUT', `/api/employees/${id}`, body({ departmentId: null })),
      boss.call.send(
        'PUT',
        `/api/employees/${id}`,
        body({ positionId: setup.setup.positions[0].id }),
      ),
      boss.call.send(
        'PUT',
        `/api/employees/${id}`,
        body({ permissions: { 'staff.canDelete': true } }),
      ),
    ];
    for (const attempt of await Promise.all(attempts)) expect(attempt.statusCode).toBe(403);
    expect((await doc(t.rootCall, id)).employee).toEqual(reply.employee.employee);
    expect((await t.rootCall.get('/api/staff-setup')).json()).toEqual(setup);
    expect(await codes(t.rootCall)).toEqual(['BOSS', 'EMP-1']);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(200);
  });

  it('lets someone allowed to change a person send the unit and permissions they already hold, and no other', async () => {
    const t = await staffTenant(cs);
    const editor = await t.staff('EDITOR', { own: { 'staff.canEdit': true } });
    const setup = await t.setup({
      departments: [{ name: 'Sales', permissions: {}, extra: {} }],
    });
    const dept = setup.setup.departments[0];
    const reply = await added(t.rootCall, { code: 'EMP-1', departmentId: dept.id });
    const same = await editor.call.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
      version: reply.employee.version,
      name: 'Renamed',
      extra: {},
      departmentId: dept.id,
      positionId: null,
      permissions: {},
    });
    expect(same.statusCode).toBe(200);
    expect(employeeDocSchema.parse(same.json()).employee).toMatchObject({
      name: 'Renamed',
      department: { id: dept.id, name: 'Sales' },
    });
  });

  it('lets the root change a person’s department, position and permissions, a link left as it is keeping its saved name', async () => {
    const t = await staffTenant(cs);
    const first = await t.setup({
      departments: [
        { name: 'Sales', permissions: {}, extra: {} },
        { name: 'Shops', permissions: {}, extra: {} },
      ],
      positions: [{ name: 'Clerk', permissions: {}, extra: {} }],
    });
    const [sales, shops] = first.setup.departments;
    const clerk = first.setup.positions[0];
    const reply = await added(t.rootCall, { code: 'EMP-1', departmentId: sales.id });
    await t.setup({ departments: [shops], positions: [clerk] });
    const page = await doc(t.rootCall, reply.employee.employee.id);
    const put = (over: object) =>
      t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
        version: page.version,
        name: 'Mai Linh',
        extra: {},
        ...over,
      });
    const kept = await put({ departmentId: sales.id });
    expect(employeeDocSchema.parse(kept.json()).employee.department).toEqual({
      id: sales.id,
      name: 'Sales',
    });
    const moved = employeeDocSchema.parse(
      (
        await put({
          departmentId: shops.id,
          positionId: clerk.id,
          permissions: { 'staff.canView': true },
        })
      ).json(),
    );
    expect(moved.employee).toMatchObject({
      department: { id: shops.id, name: 'Shops' },
      position: { id: clerk.id, name: 'Clerk' },
      permissions: { 'staff.canView': true },
    });
    expect((await put({ departmentId: '3f2a91bc-0000-4000-8000-000000000001' })).statusCode).toBe(
      400,
    );
  });
});

describe('The BFF checks the same permissions on every call, whatever the screen shows, and a change the root makes takes effect at that person’s next step', () => {
  const routes = (id: string) =>
    [
      ['GET', '/api/staff-setup'],
      ['PUT', '/api/staff-setup'],
      ['GET', '/api/employees'],
      ['POST', '/api/employees'],
      ['GET', `/api/employees/${id}`],
      ['PUT', `/api/employees/${id}`],
      ['POST', `/api/employees/${id}/archive`],
      ['PUT', `/api/employees/${id}/password`],
    ] as const;

  it('answers 401 to every staff route without a session and 403 to someone holding no permission', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall);
    const none = await t.staff('NONE');
    for (const [method, url] of routes(reply.employee.employee.id)) {
      const bare = await t.app.inject({ method, url, payload: {} });
      expect(bare.statusCode, `${method} ${url} unsigned`).toBe(401);
      const refused = await none.call.send(method === 'GET' ? 'PUT' : method, url, {});
      const got = method === 'GET' ? await none.call.get(url) : refused;
      expect(got.statusCode, `${method} ${url} with no permission`).toBe(403);
    }
  });

  it('takes a change at the person’s next step, with no new sign-in', async () => {
    const t = await staffTenant(cs);
    const staff = await t.staff('EMP-9', { department: { 'staff.canView': true } });
    expect((await staff.call.get('/api/employees')).statusCode).toBe(200);
    const setup = (await t.rootCall.get('/api/staff-setup')).json<{
      setup: { departments: object[]; positions: object[] };
      version: string;
    }>();
    const department = setup.setup.departments[0] as { permissions: object };
    await t.rootCall.send('PUT', '/api/staff-setup', {
      setup: {
        ...setup.setup,
        departments: [{ ...department, permissions: { 'staff.canView': false } }],
        extra: {},
      },
      version: setup.version,
    });
    expect((await staff.call.get('/api/employees')).statusCode).toBe(403);
  });
});

describe('Every record a client’s UI shows carries `extra`: a JSON object of at most 8 KB and five levels, with no key `__proto__`, `constructor` or `prototype`; the BFF stores and returns it untouched, each reader defaults it to `{}`, and a save replaces it whole', () => {
  it('stores `extra` untouched and returns the same bytes, and a save replaces it whole', async () => {
    const t = await staffTenant(cs);
    const extra = { b: 1, a: { z: [1, 2, { y: null }], k: 'ký tự' }, unknownKey: true };
    const reply = await added(t.rootCall, { extra });
    expect(JSON.stringify(reply.employee.employee.extra)).toBe(JSON.stringify(extra));
    expect(
      (await t.client.getRecord(t.keys.employee(reply.employee.employee.id)))?.data,
    ).toMatchObject({ extra });
    const saved = await t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
      version: reply.employee.version,
      name: 'Mai Linh',
      extra: { only: 1 },
    });
    expect(employeeDocSchema.parse(saved.json()).employee.extra).toEqual({ only: 1 });
  });

  it('refuses `extra` over 8 KB, past five levels, with a forbidden key, or not an object, 400, and stores nothing', async () => {
    const t = await staffTenant(cs);
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    const sixDeep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect((await add(t.rootCall, { code: 'AA', extra: deep })).statusCode).toBe(201);
    const forbidden = '{"name":"X","code":"BB","extra":{"__proto__":{"admin":true}}}';
    for (const raw of [
      JSON.stringify(person({ code: 'CC', extra: { pad: 'x'.repeat(8 * 1024) } })),
      JSON.stringify(person({ code: 'DD', extra: sixDeep })),
      JSON.stringify(person({ code: 'EE', extra: [1] })),
      JSON.stringify(person({ code: 'FF', extra: { constructor: 1 } })),
      forbidden,
    ]) {
      const refused = await t.app.inject({
        method: 'POST',
        url: '/api/employees',
        headers: { ...withAuth(t.root), 'content-type': 'application/json' },
        payload: raw,
      });
      expect(refused.statusCode, raw.slice(0, 60)).toBe(400);
    }
    expect(await codes(t.rootCall)).toEqual(['AA']);
  });

  it('defaults `extra` to {} for a person stored before it existed', async () => {
    const t = await staffTenant(cs);
    const old = await seedEmployee(t.client, t.id, { code: 'OLD' });
    const { extra: _dropped, ...without } = old.employee;
    await t.client.putRecord(t.keys.employee(old.employee.id), without);
    expect((await doc(t.rootCall, old.employee.id)).employee.extra).toEqual({});
    expect((await list(t.rootCall))[0]?.extra).toEqual({});
  });
});

describe('A permission layer that cannot be read answers 503, never a partial set', () => {
  it('answers 503 for a staff member’s call while the setup or their record cannot be read, and 200 once it can', async () => {
    let down: 'setup' | 'person' | null = null;
    const t = await staffTenant(cs, {
      wrap: failing(
        (call, key) =>
          call === 'get' &&
          ((down === 'setup' && key.endsWith('.staff-setup')) ||
            (down === 'person' && key.includes('.employee.'))),
      ),
    });
    const staff = await t.staff('EMP-9', { department: { 'staff.canView': true } });
    for (const which of ['setup', 'person'] as const) {
      down = which;
      for (const response of [await staff.call.get('/api/employees'), await me(t, staff.authId)]) {
        expect(response.statusCode, which).toBe(503);
        expect(response.json()).toEqual({ error: 'Service unavailable' });
      }
      expect(
        (await signIn(t.app, { name: 'EMP-9', password: staff.password as string })).response
          .statusCode,
      ).toBe(503);
    }
    down = null;
    expect((await staff.call.get('/api/employees')).statusCode).toBe(200);
  });

  it('reads no layer for the root, who needs none', async () => {
    const t = await staffTenant(cs, {
      wrap: failing(
        (call, key) =>
          call === 'get' && (key.endsWith('.staff-setup') || key.includes('.employee.')),
      ),
    });
    expect((await me(t, t.root)).statusCode).toBe(200);
  });
});

describe('Each person is one record under a minted id; their sign-in record names that id; a sign-in record its person does not name back signs no one in, and the next add or new code of that code takes it over with its tag', () => {
  it('leaves a sign-in that signs no one in when the person’s write fails, and the next add of that code takes it over', async () => {
    let failPerson = true;
    const t = await staffTenant(cs, {
      wrap: failing((call, key) => failPerson && call === 'put' && key.includes('.employee.')),
    });
    const failed = await add(t.rootCall, { code: 'EMP-1' });
    expect(failed.statusCode).toBe(503);
    expect(await codes(t.rootCall)).toEqual([]);
    const stale = storedUserSchema.parse((await t.client.getRecord(t.keys.user('emp-1')))?.data);
    expect(stale.employeeId).not.toBeNull();
    // Its person was never written, so nothing names it back: no one signs in by it.
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: 'Any-password-1!' })).response.statusCode,
    ).toBe(401);

    failPerson = false;
    const retried = await added(t.rootCall, { code: 'emp-1' });
    expect(await codes(t.rootCall)).toEqual(['EMP-1']);
    const taken = storedUserSchema.parse((await t.client.getRecord(t.keys.user('emp-1')))?.data);
    expect(taken.employeeId).toBe(retried.employee.employee.id);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: retried.password as string })).response
        .statusCode,
    ).toBe(200);
  });

  it('signs no one in by a sign-in record whose person names another code, and refuses one that does not parse, 409', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const own = await signIn(t.app, { name: 'EMP-1', password: reply.password as string });
    const page = await doc(t.rootCall, reply.employee.employee.id);
    await t.client.putRecord(t.keys.employee(page.employee.id), {
      ...page.employee,
      code: 'EMP-2',
    });
    expect((await me(t, own.body.authId)).statusCode).toBe(401);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(401);

    await t.client.putRecord(t.keys.user('emp-3'), { nonsense: true });
    expect((await add(t.rootCall, { code: 'EMP-3' })).statusCode).toBe(409);
  });
});

describe('Every write names the tag it read; a moved record answers 409 with the current one; a numbered code lost to a race takes the next number, three times at most', () => {
  /** A client that, after reading the key `suffix` names, lets `move` change the record, `times` times. */
  function movesAfterRead(suffix: string, times: number, move: () => Promise<unknown>) {
    let left = times;
    return (client: CStorageClient): CStorageClient => ({
      ...client,
      async getRecord(key) {
        const found = await client.getRecord(key);
        if (key.endsWith(suffix) && left > 0) {
          left--;
          await move();
        }
        return found;
      },
    });
  }

  it('re-reads and writes the password again when the sign-in moved without cause, and answers 503 when it keeps moving', async () => {
    let touch: () => Promise<unknown> = () => Promise.resolve();
    const t = await staffTenant(cs, { wrap: movesAfterRead('.user.emp-1', 1, () => touch()) });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const bump = async () => {
      const found = await t.client.getRecord(t.keys.user('emp-1'));
      const user = storedUserSchema.parse(found?.data);
      await t.client.putRecord(t.keys.user('emp-1'), { ...user, passwordAt: user.passwordAt + 1 });
    };
    touch = bump;
    const url = `/api/employees/${reply.employee.employee.id}/password`;
    const once = await t.rootCall.send('PUT', url, { password: 'TypedPass1!' });
    expect(once.statusCode).toBe(200);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: 'TypedPass1!' })).response.statusCode,
    ).toBe(200);

    // The add's own read of the sign-in uses one move, which leaves three for the password.
    const stuck = await staffTenant(cs, { wrap: movesAfterRead('.user.emp-1', 4, () => touch()) });
    const other = await added(stuck.rootCall, { code: 'EMP-1' });
    touch = async () => {
      const found = await stuck.client.getRecord(stuck.keys.user('emp-1'));
      const user = storedUserSchema.parse(found?.data);
      await stuck.client.putRecord(stuck.keys.user('emp-1'), {
        ...user,
        passwordAt: user.passwordAt + 1,
      });
    };
    const refused = await stuck.rootCall.send(
      'PUT',
      `/api/employees/${other.employee.employee.id}/password`,
      {
        password: 'TypedPass1!',
      },
    );
    expect(refused.statusCode).toBe(503);
    expect(await signIn(stuck.app, { name: 'EMP-1', password: 'TypedPass1!' })).toMatchObject({
      response: { statusCode: 401 },
    });
  });

  it('takes over a failed add’s sign-in again when it moves between the read and the write, and gives up as taken after three', async () => {
    let touch: () => Promise<unknown> = () => Promise.resolve();
    const t = await staffTenant(cs, { wrap: movesAfterRead('.user.emp-1', 1, () => touch()) });
    // A sign-in record no person names back, as a failed add leaves it.
    const stale = {
      passwordHash: null,
      root: false,
      employeeId: '3f2a91bc-0000-4000-8000-000000000001',
      passwordAt: 0,
    };
    await t.client.putRecord(t.keys.user('emp-1'), stale);
    touch = () => t.client.putRecord(t.keys.user('emp-1'), { ...stale, passwordAt: 1 });
    expect((await add(t.rootCall, { code: 'EMP-1' })).statusCode).toBe(201);

    let moves = 0;
    const busy = await staffTenant(cs, { wrap: movesAfterRead('.user.emp-1', 3, () => touch()) });
    await busy.client.putRecord(busy.keys.user('emp-1'), stale);
    touch = () => busy.client.putRecord(busy.keys.user('emp-1'), { ...stale, passwordAt: ++moves });
    expect((await add(busy.rootCall, { code: 'EMP-1' })).statusCode).toBe(409);
    expect(await codes(busy.rootCall)).toEqual([]);
  });
});

describe('The BFF’s list answers 500 when c-storage says there are more, or when a record under the prefix does not parse, naming its kind and never its key; it never answers a short list', () => {
  it('answers 500 for a record that does not parse, and logs its kind and not its key', async () => {
    const lines: string[] = [];
    const t = await staffTenant(cs, {
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    await added(t.rootCall, { code: 'EMP-1' });
    const badId = '3f2a91bc-0000-4000-8000-0000000000aa';
    await t.client.putRecord(t.keys.employee(badId), { code: 'x' });
    const answer = await t.rootCall.get('/api/employees');
    expect(answer.statusCode).toBe(500);
    expect(answer.json()).toEqual({ error: 'Internal error' });
    const log = lines.join('\n');
    expect(log).toContain('an employee record does not parse');
    expect(log).not.toContain(badId);
    expect((await t.rootCall.get(`/api/employees/${badId}`)).statusCode).toBe(500);
  });

  it('answers 500 when c-storage says there are more, never a short list', async () => {
    const t = await staffTenant(cs, {
      wrap: (client) => ({
        ...client,
        listRecords: async (prefix) => ({ ...(await client.listRecords(prefix)), more: true }),
      }),
    });
    await added(t.rootCall, { code: 'EMP-1' });
    const answer = await t.rootCall.get('/api/employees');
    expect(answer.statusCode).toBe(500);
    expect(answer.json()).toEqual({ error: 'Internal error' });
  });

  it('reads a broken staff setup as a 500 too', async () => {
    const t = await staffTenant(cs);
    await t.client.putRecord(t.keys.staffSetup, { departments: 'none' });
    expect((await t.rootCall.get('/api/staff-setup')).statusCode).toBe(500);
  });
});

describe('Every write names the tag it read: a write that finds the record gone or moved is refused, never made blind', () => {
  /** A client whose first write to a key `suffix` ends may be turned into a refusal, and whose
   * first read of one may remove the record behind it. */
  const racing = (opts: { refuse?: string; removeAfterRead?: string; armed?: () => boolean }) => {
    let refused = false;
    let removed = false;
    return (client: CStorageClient): CStorageClient => ({
      ...client,
      async getRecord(key) {
        const found = await client.getRecord(key);
        if (
          opts.removeAfterRead &&
          key.includes(opts.removeAfterRead) &&
          opts.armed?.() &&
          !removed
        ) {
          removed = true;
          await client.removeRecord(key);
        }
        return found;
      },
      async putRecord(key, data, ifTag) {
        if (opts.refuse && key.includes(opts.refuse) && !refused && ifTag !== undefined) {
          refused = true;
          return 'moved';
        }
        return await client.putRecord(key, data, ifTag);
      },
    });
  };

  it('answers 409 with the current setup when the setup moves between its read and its write', async () => {
    const t = await staffTenant(cs, { wrap: racing({ refuse: '.staff-setup' }) });
    const read = (await t.rootCall.get('/api/staff-setup')).json<{ version: string }>();
    const raced = await t.rootCall.send('PUT', '/api/staff-setup', {
      setup: { departments: [], positions: [], extra: {} },
      version: read.version,
    });
    expect(raced.statusCode).toBe(409);
    expect(raced.json<{ current: { version: string } }>().current.version).toBe('');
  });

  it('answers 409 with no current person when the person is removed between the read and the write', async () => {
    let armed = false;
    const t = await staffTenant(cs, {
      wrap: racing({ removeAfterRead: '.employee.', armed: () => armed }),
    });
    const reply = await added(t.rootCall);
    armed = true;
    const raced = await t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
      version: reply.employee.version,
      name: 'Raced',
      extra: {},
    });
    expect(raced.statusCode).toBe(409);
    expect(raced.json<{ current: unknown }>().current).toBeNull();
  });

  it('reads a failed claim of the sign-in name again and claims it, when it was refused and then found gone', async () => {
    const t = await staffTenant(cs, { wrap: racing({ refuse: '.user.emp-1' }) });
    expect((await add(t.rootCall, { code: 'EMP-1' })).statusCode).toBe(201);
    expect(await codes(t.rootCall)).toEqual(['EMP-1']);
  });

  it('takes over a sign-in record that names no person at all, as one a failed add left', async () => {
    const t = await staffTenant(cs);
    await t.client.putRecord(t.keys.user('emp-1'), {
      passwordHash: null,
      root: false,
      employeeId: null,
      passwordAt: 0,
    });
    expect((await add(t.rootCall, { code: 'EMP-1' })).statusCode).toBe(201);
  });

  it('answers 503 when a record already sits under a fresh person id', async () => {
    const t = await staffTenant(cs, {
      wrap: (client) => ({
        ...client,
        putRecord: async (key, data, ifTag) =>
          key.includes('.employee.') ? 'moved' : await client.putRecord(key, data, ifTag),
      }),
    });
    expect((await add(t.rootCall, { code: 'EMP-1' })).statusCode).toBe(503);
  });

  it('lets someone allowed to change a person send no unit at all, or the unit and permissions they hold', async () => {
    const t = await staffTenant(cs);
    const editor = await t.staff('EDITOR', { own: { 'staff.canEdit': true } });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const send = (over: object) =>
      editor.call.send('PUT', `/api/employees/${reply.employee.employee.id}`, {
        version: reply.employee.version,
        name: 'Same',
        extra: {},
        ...over,
      });
    expect((await send({ departmentId: null })).statusCode).toBe(200);
  });
});
