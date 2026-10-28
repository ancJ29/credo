import {
  addEmployeeReplySchema,
  configDocSchema,
  createClientReplySchema,
  employeeDocSchema,
  employeeListReplySchema,
  meReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  sessionReplySchema,
  setPasswordReplySchema,
  staffSetupDocSchema,
} from '@credo/shared';
import {
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_EMPLOYEES,
  DEMO_ROOT_NAME,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawApp } from '../tests/render';
import { ApiError } from './api';
import { App } from './App';
import { DICTIONARIES } from './i18n';
import { createFakeApi, fakeParts, parseCue } from './fake';

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** A fake whose device holds the handles `held` names. */
const fake = (cue = '', held: { client?: string; operator?: string } = {}) =>
  createFakeApi({
    device: { authId: () => held.client ?? null, operatorAuthId: () => held.operator ?? null },
    cue: parseCue(cue || null),
  });

const status = async (answer: Promise<unknown>) =>
  await answer.then(
    () => 'answered',
    (error: unknown) => (error instanceof ApiError ? error.status : 'not an ApiError'),
  );

describe('the fake Api', () => {
  it('Every answer of the fake `Api` parses under the shared schema the real answer is read with', async () => {
    const api = fake('', { client: 'fake.session', operator: 'fake.operator' });
    const staff = fake('', { client: `fake.session.${DEMO_EMPLOYEES[3]?.id}` });
    const id = DEMO_EMPLOYEES[3]?.id;
    const checked: Record<string, boolean> = {};
    const parses = (
      name: string,
      schema: { safeParse: (v: unknown) => { success: boolean } },
      answer: unknown,
    ) => {
      checked[name] = schema.safeParse(answer).success;
    };
    parses('getConfig', configDocSchema, await api.getConfig());
    parses('signIn', sessionReplySchema, await api.signIn(DEMO_ROOT_NAME, 'pw'));
    parses(
      'signIn staff',
      sessionReplySchema,
      await api.signIn(DEMO_EMPLOYEES[0]?.code ?? '', 'pw'),
    );
    parses('me', meReplySchema, await api.me());
    parses('me staff', meReplySchema, await staff.me());
    parses(
      'operatorSignIn',
      operatorSessionReplySchema,
      await api.operatorSignIn(OPERATOR_NAME, 'pw'),
    );
    parses('operatorMe', operatorMeReplySchema, await api.operatorMe());
    const setup = await api.getStaffSetup();
    parses('getStaffSetup', staffSetupDocSchema, setup);
    const savedSetup = await api.saveStaffSetup(
      { departments: [{ name: 'Mới', permissions: {}, extra: {} }], positions: [], extra: {} },
      setup.version,
    );
    parses(
      'saveStaffSetup',
      staffSetupDocSchema,
      savedSetup.kind === 'saved' ? savedSetup.doc : null,
    );
    parses('listEmployees', employeeListReplySchema, { employees: await api.listEmployees() });
    parses('getEmployee', employeeDocSchema, await api.getEmployee(id));
    const added = await api.addEmployee({ name: 'Mới', code: 'new-1', extra: {} });
    parses('addEmployee', addEmployeeReplySchema, added.kind === 'added' ? added.reply : null);
    const read = await api.getEmployee(id);
    const saved = await api.saveEmployee(id, {
      version: read.version,
      name: 'Đổi',
      extra: {},
      permissions: { 'staff.canEdit': true },
    });
    parses('saveEmployee', employeeDocSchema, saved.kind === 'saved' ? saved.doc : null);
    parses('setPassword', setPasswordReplySchema, await api.setPassword(id, null));
    const archived = await api.archiveEmployee(id, saved.kind === 'saved' ? saved.doc.version : '');
    parses(
      'archiveEmployee',
      employeeDocSchema,
      archived.kind === 'archived' ? archived.doc : null,
    );
    const savedConfig = await api.saveConfig(DEMO_CONFIG, 'v1');
    parses('saveConfig', configDocSchema, savedConfig.kind === 'saved' ? savedConfig.doc : null);
    const made = await api.makeClient('another-one', 'Another One');
    parses('makeClient', createClientReplySchema, made.kind === 'made' ? made.client : null);

    expect(Object.entries(checked).filter(([, ok]) => !ok)).toEqual([]);
    // a method with no check above would answer unchecked
    expect(Object.keys(api).sort()).toEqual(
      [
        'getConfig',
        'signIn',
        'me',
        'operatorSignIn',
        'operatorMe',
        'getStaffSetup',
        'saveStaffSetup',
        'listEmployees',
        'getEmployee',
        'addEmployee',
        'saveEmployee',
        'setPassword',
        'archiveEmployee',
        'saveConfig',
        'makeClient',
        'signOut',
        'operatorSignOut',
      ].sort(),
    );
  });

  it('The demo company answers as its data set holds it, and a save moves its version', async () => {
    const api = fake();
    expect(await api.getConfig()).toEqual({ config: DEMO_CONFIG, version: 'v1' });

    const renamed = { ...DEMO_CONFIG, name: 'Renamed' };
    expect(await api.saveConfig(renamed, 'v1')).toEqual({
      kind: 'saved',
      doc: { config: renamed, version: 'v2' },
    });
    expect(await api.getConfig()).toEqual({ config: renamed, version: 'v2' });
    expect(await api.saveConfig(DEMO_CONFIG, 'v1')).toEqual({ kind: 'conflict' });
    expect((await api.getConfig()).config.name).toBe('Renamed');
  });

  it('Each load is seeded afresh: a save in one fake is not in the next', async () => {
    const [first, second] = [fake(), fake()];
    await first.saveConfig({ ...DEMO_CONFIG, name: 'Renamed' }, 'v1');

    expect((await second.getConfig()).config.name).toBe(DEMO_CONFIG.name);
    expect(DEMO_CONFIG.name).toBe('Minh Phát');
  });

  it('The data set’s root signs in under its name, in any case, and any other name is a 401', async () => {
    const api = fake();

    expect((await api.signIn(' Root ', 'any')).user).toEqual({
      name: DEMO_ROOT_NAME,
      root: true,
      permissions: {},
    });
    expect(await status(api.signIn('someone', 'any'))).toBe(401);
    expect(await status(api.operatorSignIn('root', 'any'))).toBe(401);
    expect(await api.operatorSignIn(OPERATOR_NAME, 'any')).toMatchObject({
      operator: { name: OPERATOR_NAME },
    });
  });

  it('A device with no handle is a 401 on `me`, the client’s and the operator’s', async () => {
    const api = fake();

    expect(await status(api.me())).toBe(401);
    expect(await status(api.operatorMe())).toBe(401);
    await expect(api.signOut()).resolves.toBeUndefined();
    await expect(api.operatorSignOut()).resolves.toBeUndefined();
  });

  it('The demo company’s code is taken, and any other makes a client with a link', async () => {
    const api = fake();

    expect(await api.makeClient(DEMO_CODE, 'Minh Phát')).toEqual({ kind: 'taken' });
    expect(await api.makeClient('another-one', 'Another One')).toMatchObject({
      kind: 'made',
      client: { link: '/login?client-code=another-one', rootName: DEMO_ROOT_NAME },
    });
  });
});

describe('the fake Api’s staff', () => {
  const [lan, , , bao, , , noPassword, left] = DEMO_EMPLOYEES;

  it('A person signs in under their code, in any case, with the permissions their department, position and own settings resolve to; the root’s add, and a password, make a person able to', async () => {
    const api = fake();

    const signedIn = await api.signIn(' emp-0001 ', 'pw');
    expect(signedIn.authId).toBe(`fake.session.${lan?.id}`);
    // office: view, create, edit; manager: delete
    expect(signedIn.user).toEqual({
      name: lan?.name,
      root: false,
      permissions: {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'staff.canDelete': true,
      },
    });
    // the warehouse sees, and nothing more
    expect((await api.signIn(bao?.code ?? '', 'pw')).user.permissions).toEqual({
      'staff.canView': true,
      'staff.canCreate': false,
      'staff.canEdit': false,
      'staff.canDelete': false,
    });

    // a person who left, one with no password yet and one unknown are each a 401
    for (const code of [left?.code, noPassword?.code, 'EMP-9999']) {
      expect(await status(api.signIn(code ?? '', 'pw')), String(code)).toBe(401);
    }
    await api.setPassword(noPassword?.id ?? '', null);
    expect((await api.signIn(noPassword?.code ?? '', 'pw')).user.root).toBe(false);
  });

  it('`me` answers the person the handle names, and the root for the root’s own', async () => {
    const staff = fake('', { client: `fake.session.${lan?.id}` });
    const root = fake('', { client: 'fake.session' });
    const stranger = fake('', { client: 'fake.session.unknown' });

    expect((await staff.me()).user.name).toBe(lan?.name);
    expect((await root.me()).user.root).toBe(true);
    // a handle that names nobody in the data set is the root's: a fake keeps no other sessions
    expect((await stranger.me()).user.root).toBe(true);
  });

  it('Only the root’s add gives a department, a position and a first password; a code is taken in any case, those who left too', async () => {
    const held = { client: `fake.session.${lan?.id}` };
    const api = fake('', held);
    const request = { name: 'Mới', code: 'new-1', extra: {} };

    const given = await api.addEmployee({
      ...request,
      departmentId: lan?.department?.id,
      positionId: lan?.position?.id,
    });
    expect(given.kind === 'added' && given.reply.password).toBeNull();
    expect(given.kind === 'added' && given.reply.employee.employee).toMatchObject({
      department: null,
      position: null,
    });
    held.client = 'fake.session';
    expect(await api.addEmployee({ ...request, code: 'NEW-1' })).toEqual({ kind: 'taken' });
    expect(await api.addEmployee({ ...request, code: left?.code.toLowerCase() ?? '' })).toEqual({
      kind: 'taken',
    });
    const rooted = await api.addEmployee({
      name: 'Gốc',
      code: 'new-2',
      extra: {},
      departmentId: lan?.department?.id,
    });
    expect(rooted.kind === 'added' && rooted.reply.employee.employee.department?.name).toBe(
      'Văn phòng',
    );
    expect(rooted.kind === 'added' && rooted.reply.password).toMatch(/^Fake-password/);
  });

  it('A save over a newer version is a conflict, and a person who is not there is a 404', async () => {
    const api = fake();
    const id = bao?.id ?? '';
    const read = await api.getEmployee(id);
    const save = (version: string) => api.saveEmployee(id, { version, name: 'Đổi', extra: {} });

    expect((await save(read.version)).kind).toBe('saved');
    expect(await save(read.version)).toEqual({ kind: 'conflict' });
    expect(await api.archiveEmployee(id, read.version)).toEqual({ kind: 'conflict' });
    expect(await status(api.getEmployee('missing'))).toBe(404);
    expect(await api.saveStaffSetup({ departments: [], positions: [], extra: {} }, 's0')).toEqual({
      kind: 'conflict',
    });
  });
});

describe('the cue', () => {
  it('The fake answers 403, 409 or 503 once, on the call its cue names, and otherwise from the data set', async () => {
    for (const code of [403, 503]) {
      const api = fake(`getConfig:${code}`);
      expect(await status(api.getConfig()), String(code)).toBe(code);
      await expect(api.getConfig(), String(code)).resolves.toMatchObject({
        config: { name: DEMO_CONFIG.name },
      });
    }

    const api = fake('saveConfig:409');
    expect(await api.saveConfig(DEMO_CONFIG, 'v1')).toEqual({ kind: 'conflict' });
    expect((await api.saveConfig(DEMO_CONFIG, 'v1')).kind).toBe('saved');

    const clients = fake('makeClient:409');
    expect(await clients.makeClient('another-one', 'x')).toEqual({ kind: 'taken' });
    expect((await clients.makeClient('another-one', 'x')).kind).toBe('made');

    for (const call of ['saveStaffSetup', 'addEmployee', 'saveEmployee', 'archiveEmployee']) {
      const cued = fake(`${call}:409`) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const answer = (await cued[call]?.('x', 'x')) as { kind: string };
      expect(answer.kind, call).toBe(call === 'addEmployee' ? 'taken' : 'conflict');
    }

    const other = fake('signIn:409');
    expect(await status(other.signIn(DEMO_ROOT_NAME, 'pw'))).toBe(409);
    await expect(other.signIn(DEMO_ROOT_NAME, 'pw')).resolves.toMatchObject({
      user: { root: true },
    });
  });

  it('A cue names one call: the others answer from the data set as if none were there', async () => {
    const api = fake('saveConfig:503');

    await expect(api.getConfig()).resolves.toMatchObject({ config: { name: DEMO_CONFIG.name } });
    expect(await status(api.saveConfig(DEMO_CONFIG, 'v1'))).toBe(503);
  });

  it('An address’s cue is a call and one of the three statuses, or it is no cue', () => {
    expect(parseCue('saveConfig:409')).toEqual({ call: 'saveConfig', status: 409 });
    expect(parseCue('me:403')).toEqual({ call: 'me', status: 403 });
    expect(parseCue('me:404')).toBeNull();
    expect(parseCue('me')).toBeNull();
    expect(parseCue(':503')).toBeNull();
    expect(parseCue(null)).toBeNull();
  });
});

async function signInAs() {
  await userEvent.type(await screen.findByLabelText(/Username/), DEMO_ROOT_NAME);
  await userEvent.type(screen.getByLabelText(/Password/), 'pw');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('?fake', () => {
  it('The app boots on the data set: the sign-in already wears the demo company’s name', async () => {
    const { api, device } = fakeParts('?fake', memory());
    drawApp(<App api={api} device={device} test />);

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(DEMO_CONFIG.name);
    expect(device.clientCode()).toBe(DEMO_CODE);
  });

  it('The root signs in on the fake and lands on Settings', async () => {
    const { api, device } = fakeParts('?fake', memory({ 'credo.language': 'en' }));
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect(await screen.findByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });

  it('The address’s cue is read: the call it names answers its status, and the page says the service is unavailable', async () => {
    const { api, device } = fakeParts('?fake&cue=signIn:503', memory({ 'credo.language': 'en' }));
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
    expect(device.authId()).toBeNull();
  });
});
