import {
  addEmployeeReplySchema,
  clientListReplySchema,
  importEmployeesReplySchema,
  importCustomersReplySchema,
  importProductsReplySchema,
  customerListReplySchema,
  productListReplySchema,
  configDocSchema,
  createClientReplySchema,
  employeeDocSchema,
  employeeListReplySchema,
  issueQrReplySchema,
  meReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  photoReplySchema,
  sessionReplySchema,
  setPasswordReplySchema,
  staffConfig,
  staffSetupDocSchema,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_EMPLOYEES,
  DEMO_PRODUCTS,
  DEMO_PHOTOS,
  DEMO_QR_SECRET,
  DEMO_ROOT_NAME,
  DEMO_STAFF_SETUP,
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
const fake = (cue = '', held: { client?: string; operator?: string } = {}, signIns = false) =>
  createFakeApi({
    device: { authId: () => held.client ?? null, operatorAuthId: () => held.operator ?? null },
    cue: parseCue(cue || null),
    signIns,
  });

const DEMO_PHOTO = Object.values(DEMO_PHOTOS)[0];

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
    parses(
      'importEmployees',
      importEmployeesReplySchema,
      await api.importEmployees([{ name: 'Nhập', extra: {} }]),
    );
    parses('listCustomers', customerListReplySchema, { customers: await api.listCustomers() });
    parses('listProducts', productListReplySchema, { products: await api.listProducts() });
    parses(
      'importCustomers',
      importCustomersReplySchema,
      await api.importCustomers([{ code: 'kh-90', name: 'Nhập', extra: {} }]),
    );
    parses(
      'importProducts',
      importProductsReplySchema,
      await api.importProducts([
        { code: 'vt-90', name: 'Nhập', unit: 'bao', price: 5000, extra: {} },
      ]),
    );
    const read = await api.getEmployee(id);
    const saved = await api.saveEmployee(id, {
      version: read.version,
      name: 'Đổi',
      extra: {},
      permissions: { 'staff.canEdit': true },
    });
    parses('saveEmployee', employeeDocSchema, saved.kind === 'saved' ? saved.doc : null);
    parses('setPassword', setPasswordReplySchema, await api.setPassword(id, null));
    parses('getPhoto', photoReplySchema, await api.getPhoto(id));
    const photo = await api.savePhoto(id, { photo: DEMO_PHOTO, version: '' });
    parses('savePhoto', photoReplySchema, photo.kind === 'saved' ? photo.reply : null);
    const archived = await api.archiveEmployee(id, saved.kind === 'saved' ? saved.doc.version : '');
    parses(
      'archiveEmployee',
      employeeDocSchema,
      archived.kind === 'archived' ? archived.doc : null,
    );
    const coded = await api.changeCode(id, {
      version: archived.kind === 'archived' ? archived.doc.version : '',
      code: 'moi-1',
    });
    parses('changeCode', employeeDocSchema, coded.kind === 'changed' ? coded.doc : null);
    // the company has turned on the email and the QR code
    const on = fake('', { client: 'fake.session' }, true);
    const onDoc = await on.getEmployee(id);
    const emailed = await on.setEmail(id, {
      version: onDoc.version,
      email: 'Hung@Minh-Phat.Example',
    });
    parses('setEmail', employeeDocSchema, emailed.kind === 'set' ? emailed.doc : null);
    const bao = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!;
    parses('signInQr', sessionReplySchema, await on.signInQr(bao.id, DEMO_QR_SECRET));
    parses('issueQr', issueQrReplySchema, await on.issueQr(id));
    const changed = await on.changePassword('Old-password-1!', 'New-password-2@');
    parses(
      'changePassword',
      sessionReplySchema,
      changed.kind === 'changed' ? changed.session : null,
    );
    const savedConfig = await api.saveConfig(DEMO_CONFIG, 'v1');
    parses('saveConfig', configDocSchema, savedConfig.kind === 'saved' ? savedConfig.doc : null);
    parses('listClients', clientListReplySchema, { clients: await api.listClients() });
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
        'importEmployees',
        'listCustomers',
        'listProducts',
        'importCustomers',
        'importProducts',
        'saveEmployee',
        'setPassword',
        'changeCode',
        'setEmail',
        'issueQr',
        'signInQr',
        'changePassword',
        'getPhoto',
        'savePhoto',
        'archiveEmployee',
        'saveConfig',
        'makeClient',
        'listClients',
        'signOut',
        'operatorSignOut',
      ].sort(),
    );
  });

  it('C: The fake signs no one in by email while the company has the email sign-in off', async () => {
    const api = fake('', { client: 'fake.session' }, true);
    const hung = DEMO_EMPLOYEES[1];
    const read = await api.getEmployee(hung.id);
    await api.setEmail(hung.id, { version: read.version, email: 'hung@minh-phat.example' });
    const switchEmail = async (email: boolean) => {
      const held = await api.getStaffSetup();
      const saved = await api.saveStaffSetup(
        { ...held.setup, fields: { ...staffConfig(held.setup).fields, email } },
        held.version,
      );
      expect(saved.kind).toBe('saved');
    };

    await switchEmail(false);
    expect(await status(api.signIn('hung@minh-phat.example', 'pw'))).toBe(401);
    expect((await api.signIn(hung.code, 'pw')).user.name).toBe(hung.name);
    expect((await api.getEmployee(hung.id)).employee.email).toBe('hung@minh-phat.example');
    // The email is set only while the company has the sign-in on, as the BFF has it: a 403.
    const held = await api.getEmployee(hung.id);
    expect(await status(api.setEmail(hung.id, { version: held.version, email: null }))).toBe(403);
    expect((await api.getEmployee(hung.id)).employee.email).toBe('hung@minh-phat.example');
    await switchEmail(true);
    expect((await api.signIn('hung@minh-phat.example', 'pw')).user.name).toBe(hung.name);
  });

  it('C: A person given an email signs in with it or with the code, in any case, until it is taken back, and a second person’s same email is refused', async () => {
    const api = fake('', { client: 'fake.session' }, true);
    const [lan, hung] = [DEMO_EMPLOYEES[0], DEMO_EMPLOYEES[1]];
    const read = await api.getEmployee(hung.id);

    const given = await api.setEmail(hung.id, {
      version: read.version,
      email: ' Hung@Minh-Phat.Example ',
    });
    expect(given.kind === 'set' && given.doc.employee.email).toBe('hung@minh-phat.example');
    expect((await api.signIn('HUNG@minh-phat.example', 'pw')).user.name).toBe(hung.name);
    expect((await api.signIn(hung.code, 'pw')).user.name).toBe(hung.name);

    // a second person's same email is a taken email; the version moved is a conflict
    const lanRead = await api.getEmployee(lan.id);
    expect(
      await api.setEmail(lan.id, { version: lanRead.version, email: 'hung@minh-phat.example' }),
    ).toEqual({ kind: 'taken' });
    expect(await api.setEmail(lan.id, { version: 'e99', email: 'lan@minh-phat.example' })).toEqual({
      kind: 'conflict',
    });
    expect(await status(api.setEmail('missing', { version: 'e1', email: null }))).toBe(404);
    // the cue makes the save a conflict once
    const cued = fake('setEmail:409', { client: 'fake.session' }, true);
    expect(await cued.setEmail(lan.id, { version: lanRead.version, email: null })).toEqual({
      kind: 'conflict',
    });

    // the person's own email is not taken against themselves; taking it back signs it out
    const same = given.kind === 'set' ? given.doc : null;
    const again = await api.setEmail(hung.id, {
      version: same!.version,
      email: 'hung@minh-phat.example',
    });
    expect(again.kind).toBe('set');
    const removed = await api.setEmail(hung.id, {
      version: again.kind === 'set' ? again.doc.version : '',
      email: null,
    });
    expect(removed.kind === 'set' && removed.doc.employee.email).toBeUndefined();
    expect(await status(api.signIn('hung@minh-phat.example', 'pw'))).toBe(401);

    // someone who left, or who was given no password yet, does not sign in by email either
    const noPassword = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0007')!;
    const noRead = await api.getEmployee(noPassword.id);
    await api.setEmail(noPassword.id, { version: noRead.version, email: 'anh@minh-phat.example' });
    expect(await status(api.signIn('anh@minh-phat.example', 'pw'))).toBe(401);
    const left = DEMO_EMPLOYEES.find((person) => person.archived)!;
    const leftRead = await api.getEmployee(left.id);
    await api.setEmail(left.id, { version: leftRead.version, email: 'huy@minh-phat.example' });
    expect(await status(api.signIn('huy@minh-phat.example', 'pw'))).toBe(401);
  });

  it('C: Two fresh fakes mint the same QR link for the same person, so a screen that shows it reads the same on every build', async () => {
    const bao = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!;
    const first = await fake('', { client: 'fake.session' }, true).issueQr(bao.id);
    const second = await fake('', { client: 'fake.session' }, true).issueQr(bao.id);

    expect(second.link).toBe(first.link);
  });

  it('C: A QR code signs in once as the person it was shown for, a new code cancels the last, and a company with the QR sign-in off shows and accepts none', async () => {
    const api = fake('', { client: 'fake.session' }, true);
    const bao = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!;

    // the data set holds one for the phone's walk, and spending it uses it up
    expect((await api.signInQr(bao.id, DEMO_QR_SECRET)).user.name).toBe(bao.name);
    expect(await status(api.signInQr(bao.id, DEMO_QR_SECRET))).toBe(401);

    const first = await api.issueQr(bao.id);
    const second = await api.issueQr(bao.id);
    const secretOf = (link: string) => link.split('.').pop()!;
    expect(first.link).toBe(`/login?client-code=${DEMO_CODE}&qr=${bao.id}.${secretOf(first.link)}`);
    expect(second.expiresAt - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(second.expiresAt - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(await status(api.signInQr(bao.id, secretOf(first.link)))).toBe(401);
    expect((await api.signInQr(bao.id, secretOf(second.link))).authId).toBe(
      `fake.session.${bao.id}`,
    );
    expect(await status(api.signInQr(bao.id, secretOf(second.link)))).toBe(401);
    expect(await status(api.signInQr('missing', secretOf(second.link)))).toBe(401);
    expect(await status(api.issueQr('missing'))).toBe(404);

    // someone who left is refused whatever the code says
    const left = DEMO_EMPLOYEES.find((person) => person.archived)!;
    const issued = await api.issueQr(left.id);
    const archivedRead = await api.getEmployee(left.id);
    expect(archivedRead.employee.archived).toBe(true);
    expect(await status(api.signInQr(left.id, secretOf(issued.link)))).toBe(401);

    // the data set turns the QR sign-in off: nothing is shown, and nothing signs in
    const off = fake('', { client: 'fake.session' });
    expect(await status(off.issueQr(bao.id))).toBe(403);
    expect(await status(off.signInQr(bao.id, DEMO_QR_SECRET))).toBe(401);
  });

  it('C: Anyone signed in changes their own password, a wrong current one is said and not an error, and a password off the rule is a 400', async () => {
    const staff = fake('', { client: `fake.session.${DEMO_EMPLOYEES[0]?.id}` });
    const changed = await staff.changePassword('Old-password-1!', 'New-password-2@');

    expect(changed.kind === 'changed' && changed.session.user.name).toBe(DEMO_EMPLOYEES[0]?.name);
    expect(changed.kind === 'changed' && changed.session.authId).toBe(
      `fake.session.${DEMO_EMPLOYEES[0]?.id}`,
    );
    const root = fake('', { client: 'fake.session' });
    const rootChanged = await root.changePassword('Old-password-1!', 'New-password-2@');
    expect(rootChanged.kind === 'changed' && rootChanged.session.user.root).toBe(true);
    expect(await status(root.changePassword('Old-password-1!', 'weak'))).toBe(400);
    expect(await status(fake().changePassword('Old-password-1!', 'New-password-2@'))).toBe(401);

    // the cue makes the current password wrong, once
    const cued = fake('changePassword:403', { client: 'fake.session' });
    expect(await cued.changePassword('x', 'New-password-2@')).toEqual({ kind: 'wrong' });
    expect((await cued.changePassword('x', 'New-password-2@')).kind).toBe('changed');
  });

  it('C: `&sign-ins` on the address has the company use the email and the QR sign-ins', async () => {
    const { api } = fakeParts('?fake&sign-ins', memory())!;
    const { setup } = await api.getStaffSetup();
    expect(setup.fields).toMatchObject({ email: true, qr: true });

    const { api: plain } = fakeParts('?fake', memory())!;
    expect((await plain.getStaffSetup()).setup.fields).toEqual({
      personalPhone: true,
      photo: true,
    });
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

  it('A code any listed client holds is taken, and any other makes a client with a link', async () => {
    const api = fake('', { operator: 'fake.operator' });

    for (const client of DEMO_CLIENTS) {
      expect(await api.makeClient(client.code, client.name), client.code).toEqual({
        kind: 'taken',
      });
    }
    expect(await api.makeClient('another-one', 'Another One')).toMatchObject({
      kind: 'made',
      client: { link: '/login?client-code=another-one', rootName: DEMO_ROOT_NAME },
    });
    expect(await api.makeClient('another-one', 'Again')).toEqual({ kind: 'taken' });
  });

  it('The client list answers the data set’s three newest first, then a client made since leads it, and a device without the operator’s handle is a 401', async () => {
    const api = fake('', { operator: 'fake.operator' });
    const first = await api.listClients();

    expect(first.map((client) => client.code)).toEqual(['binh-an', 'hoa-sen', DEMO_CODE]);
    expect(first[0]).toEqual({
      code: 'binh-an',
      name: 'Bình An',
      madeAt: Date.UTC(2026, 9, 21, 12),
      link: '/login?client-code=binh-an',
    });

    await api.makeClient('another-one', 'Another One');
    const second = await api.listClients();
    expect(second.map((client) => client.code)).toEqual([
      'another-one',
      'binh-an',
      'hoa-sen',
      DEMO_CODE,
    ]);
    expect(second[0]?.name).toBe('Another One');
    expect(second[0]?.madeAt).toBeGreaterThan(Date.UTC(2026, 9, 21, 12));

    expect(await status(fake().listClients())).toBe(401);
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
        'settings.canEdit': false,
      },
    });
    // the warehouse sees, and nothing more
    expect((await api.signIn(bao?.code ?? '', 'pw')).user.permissions).toEqual({
      'staff.canView': true,
      'staff.canCreate': false,
      'staff.canEdit': false,
      'staff.canDelete': false,
      'settings.canEdit': false,
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

  it('The fake lists the staff in code order, as the BFF does, a person added later among the rest', async () => {
    const api = fake('', { client: 'fake.session' });
    await api.addEmployee({ name: 'Đầu', code: 'a-1', extra: {} });
    await api.addEmployee({ name: 'Giữa', code: 'emp-00005', extra: {} });

    const codes = (await api.listEmployees()).map((person) => person.code);

    expect(codes.slice(0, 3)).toEqual(['A-1', 'EMP-00005', 'EMP-0001']);
    expect(codes).toEqual([...codes].sort((a, b) => (a < b ? -1 : 1)));
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

describe('the fake Api’s import', () => {
  it('The rows that hold are added as people without a sign-in, each through the same add as one by hand: a code left empty is numbered past every code given, one taken is refused, and the cue fails the call whole', async () => {
    const api = fake('', { client: 'fake.session' });
    const { results } = await api.importEmployees([
      { name: 'Một', extra: { phone: '0900' } },
      { name: 'Hai', code: 'nv-7', extra: {}, departmentId: DEMO_STAFF_SETUP.departments[0]?.id },
      { name: 'Ba', code: 'emp-0002', extra: {} },
      { name: 'Bốn', extra: {} },
    ]);

    expect(results.map((result) => result.kind)).toEqual(['added', 'added', 'refused', 'added']);
    expect(results[2]).toEqual({ kind: 'refused', reason: 'taken' });
    const added = results.flatMap((result) => (result.kind === 'added' ? [result.employee] : []));
    expect(added.map((person) => person.code)).toEqual(['EMP-0009', 'NV-7', 'EMP-0010']);
    expect(added[1]?.department?.name).toBe('Kho');
    for (const person of added) {
      expect((await api.getEmployee(person.id)).signIn.ready, person.code).toBe(false);
    }
    expect((await api.listEmployees()).map((person) => person.code)).toContain('NV-7');

    const failing = fake('importEmployees:503', { client: 'fake.session' });
    expect(await status(failing.importEmployees([{ name: 'Một', extra: {} }]))).toBe(503);
    expect(await failing.listEmployees()).toHaveLength(DEMO_EMPLOYEES.length);
  });
});

describe('the fake Api’s customers and products', () => {
  const root = { client: 'fake.session' };

  it('The fake’s four calls answer as the BFF does: both lists in code order, the rows that hold added as records under a minted id with the code in capitals, one whose code is in the list or was given by an earlier row refused as taken, one the add would refuse as invalid, and the list then holding what was added', async () => {
    const api = fake('', root);

    expect((await api.listCustomers()).map((one) => one.code)).toEqual(
      DEMO_CUSTOMERS.map((one) => one.code),
    );
    const customers = await api.importCustomers([
      { code: 'kh-90', name: 'Một', extra: { phone: '0900' } },
      { code: 'KH-002', name: 'Đã có', extra: {} },
      { code: 'KH-90', name: 'Lặp', extra: {} },
      { code: 'a b', name: 'Mã sai', extra: {} },
      { code: 'KH-91', name: '', extra: {} },
    ] as Parameters<typeof api.importCustomers>[0]);
    expect(
      customers.results.map((result) => (result.kind === 'added' ? 'added' : result.reason)),
    ).toEqual(['added', 'taken', 'taken', 'invalid', 'invalid']);
    const added = customers.results[0];
    expect(added?.kind === 'added' && added.record).toMatchObject({
      code: 'KH-90',
      name: 'Một',
      extra: { phone: '0900' },
    });
    expect((await api.listCustomers()).map((one) => one.code)).toEqual([
      ...DEMO_CUSTOMERS.map((one) => one.code),
      'KH-90',
    ]);

    const products = await api.importProducts([
      { code: 'vt-90', name: 'Một', unit: 'bao', price: 5000, extra: {} },
      { code: 'VT-91', name: 'Giá sai', unit: 'bao', price: 0, extra: {} },
      { code: 'VT-001', name: 'Đã có', unit: 'bao', price: 5000, extra: {} },
    ]);
    expect(
      products.results.map((result) => (result.kind === 'added' ? 'added' : result.reason)),
    ).toEqual(['added', 'invalid', 'taken']);
    expect((await api.listProducts()).map((one) => [one.code, one.price]).at(-1)).toEqual([
      'VT-90',
      5000,
    ]);
    expect((await api.listProducts()).map((one) => one.code)).toEqual(
      [...DEMO_PRODUCTS.map((one) => one.code), 'VT-90'].sort(),
    );
  });

  it('The four calls answer 403 to anyone but the root, and a cue’s 403, 409 or 503 once, the call then answering as the data set does', async () => {
    const staff = fake('', { client: `fake.session.${DEMO_EMPLOYEES[0]?.id}` });
    const row = { code: 'KH-90', name: 'Một', extra: {} };
    const product = { code: 'VT-90', name: 'Một', unit: 'bao', price: 5000, extra: {} };

    expect(await status(staff.listCustomers())).toBe(403);
    expect(await status(staff.listProducts())).toBe(403);
    expect(await status(staff.importCustomers([row]))).toBe(403);
    expect(await status(staff.importProducts([product]))).toBe(403);

    for (const code of [403, 409, 503]) {
      for (const name of ['listCustomers', 'listProducts', 'importCustomers', 'importProducts']) {
        const cued = fake(`${name}:${code}`, root) as unknown as Record<
          string,
          (rows?: unknown[]) => Promise<unknown>
        >;
        const rows =
          name === 'importCustomers' ? [row] : name === 'importProducts' ? [product] : [];
        expect(await status(cued[name](rows)), `${name} ${code}`).toBe(code);
        expect(await status(cued[name](rows)), `${name} again`).toBe('answered');
      }
    }
  });
});

describe('the fake Api’s import, a row the system is busy on', () => {
  it('A row whose add fails with a 503 is its own result, busy, and the call goes on to the next row; any other failure fails the call', async () => {
    const api = fake('addEmployee:503', { client: 'fake.session' });
    const reply = await api.importEmployees([
      { name: 'Một', code: 'nv-1', extra: {} },
      { name: 'Hai', code: 'nv-2', extra: {} },
    ]);

    expect(
      reply.results.map((result) => (result.kind === 'added' ? 'added' : result.reason)),
    ).toEqual(['busy', 'added']);
    expect((await api.listEmployees()).map((person) => person.code)).toEqual(
      expect.arrayContaining(['NV-2']),
    );
    expect((await api.listEmployees()).map((person) => person.code)).not.toContain('NV-1');

    const forbidden = fake('addEmployee:403', { client: 'fake.session' });
    expect(await status(forbidden.importEmployees([{ name: 'Một', extra: {} }]))).toBe(403);
  });
});

describe('the fake Api’s record and list', () => {
  const [, hung, chau, , , , , left] = DEMO_EMPLOYEES;

  it('A code left empty is the next number under the company’s prefix and length, counted past every code ever given, people who left included', async () => {
    const api = fake();

    const first = await api.addEmployee({ name: 'Một', extra: {} });
    // the data set's highest code is the one who left, EMP-0008
    expect(first.kind === 'added' && first.reply.employee.employee.code).toBe('EMP-0009');
    const second = await api.addEmployee({ name: 'Hai', code: '', extra: {} });
    expect(second.kind === 'added' && second.reply.employee.employee.code).toBe('EMP-0010');
    // a numbering the root saved is the one used
    const setup = await api.getStaffSetup();
    await api.saveStaffSetup(
      { ...setup.setup, numbering: { prefix: 'NV', digits: 3 } },
      setup.version,
    );
    const third = await api.addEmployee({ name: 'Ba', extra: {} });
    expect(third.kind === 'added' && third.reply.employee.employee.code).toBe('NV001');
    // and a code given is kept as given, in capitals
    const given = await api.addEmployee({ name: 'Bốn', code: 'nv-7', extra: {} });
    expect(given.kind === 'added' && given.reply.employee.employee.code).toBe('NV-7');
  });

  it('The root changes a person’s code: the person is then found under the new one, a code taken or a version moved is a result, and a person who is not there is a 404', async () => {
    const api = fake();
    const id = chau?.id ?? '';
    const read = await api.getEmployee(id);

    expect(await api.changeCode(id, { version: 'e0', code: 'NEW-9' })).toEqual({
      kind: 'conflict',
    });
    expect(
      await api.changeCode(id, { version: read.version, code: ` ${hung?.code.toLowerCase()} ` }),
    ).toEqual({
      kind: 'taken',
    });
    expect(await api.changeCode(id, { version: read.version, code: left?.code ?? '' })).toEqual({
      kind: 'taken',
    });
    const changed = await api.changeCode(id, { version: read.version, code: 'new-9' });
    expect(changed.kind === 'changed' && changed.doc).toMatchObject({
      employee: { code: 'NEW-9' },
      signIn: { name: 'NEW-9' },
      version: 'e2',
    });
    // the same code on the same person is not taken by themselves
    const again = await api.changeCode(id, { version: 'e2', code: 'NEW-9' });
    expect(again.kind).toBe('changed');
    expect(await status(api.changeCode('missing', { version: 'e1', code: 'NEW-8' }))).toBe(404);
    // it signs in under the new code, and the old is free
    expect((await api.signIn('new-9', 'pw')).authId).toBe(`fake.session.${id}`);
    expect(await status(api.signIn(chau?.code ?? '', 'pw'))).toBe(401);
  });

  it('A photo is read with its version, saved over the version read, and a moved one is a conflict', async () => {
    const api = fake();
    const photo = DEMO_PHOTO;

    // the data set holds one photo, the others have none yet
    expect(await api.getPhoto(chau?.id ?? '')).toEqual({ photo, version: 'p1' });
    expect(await api.getPhoto(hung?.id ?? '')).toEqual({ photo: null, version: '' });
    // a conflict carries the photo as it is now, for the page to take
    expect(await api.savePhoto(hung?.id ?? '', { photo, version: 'p1' })).toEqual({
      kind: 'conflict',
      current: { photo: null, version: '' },
    });
    expect(await api.savePhoto(hung?.id ?? '', { photo, version: '' })).toEqual({
      kind: 'saved',
      reply: { photo, version: 'p1' },
    });
    expect(await api.savePhoto(hung?.id ?? '', { photo, version: 'p1' })).toEqual({
      kind: 'saved',
      reply: { photo, version: 'p2' },
    });
    expect(await status(api.getPhoto('missing'))).toBe(404);
    expect(await status(api.savePhoto('missing', { photo, version: '' }))).toBe(404);
  });

  it('A saved staff setup keeps its fields, its own fields and its numbering, and one saved without them keeps the stored ones, as the BFF does', async () => {
    const api = fake();
    const { setup, version } = await api.getStaffSetup();
    expect(setup.fields).toEqual({ personalPhone: true, photo: true });
    expect(setup.customFields).toHaveLength(4);

    const changed = {
      ...setup,
      fields: { personalPhone: false, photo: false },
      customFields: [],
      numbering: { prefix: 'X-', digits: 2 },
    };
    const kept = await api.saveStaffSetup(changed, version);
    expect(kept.kind === 'saved' && kept.doc.setup).toMatchObject(changed);

    const bare = await api.saveStaffSetup(
      { departments: [], positions: [], extra: {} },
      kept.kind === 'saved' ? kept.doc.version : '',
    );
    expect(bare.kind === 'saved' && bare.doc.setup).toEqual({
      departments: [],
      positions: [],
      fields: changed.fields,
      customFields: changed.customFields,
      numbering: changed.numbering,
      extra: {},
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

    // Each 409 is awaited under `resolves`, so a call that throws instead fails on the assertion.
    const api = fake('saveConfig:409');
    await expect(api.saveConfig(DEMO_CONFIG, 'v1')).resolves.toEqual({ kind: 'conflict' });
    await expect(api.saveConfig(DEMO_CONFIG, 'v1')).resolves.toMatchObject({ kind: 'saved' });

    const listed = fake('listClients:503', { operator: 'fake.operator' });
    expect(await status(listed.listClients())).toBe(503);
    await expect(listed.listClients()).resolves.toHaveLength(3);

    const failing = fake('makeClient:503');
    expect(await status(failing.makeClient('another-one', 'x'))).toBe(503);
    await expect(failing.makeClient('another-one', 'x')).resolves.toMatchObject({ kind: 'made' });

    const clients = fake('makeClient:409');
    await expect(clients.makeClient('another-one', 'x')).resolves.toEqual({ kind: 'taken' });
    await expect(clients.makeClient('another-one', 'x')).resolves.toMatchObject({ kind: 'made' });

    for (const call of ['saveStaffSetup', 'addEmployee', 'saveEmployee', 'archiveEmployee']) {
      const cued = fake(`${call}:409`) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      await expect(cued[call]?.('x', 'x'), call).resolves.toMatchObject({
        kind: call === 'addEmployee' ? 'taken' : 'conflict',
      });
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
    const { api, device } = fakeParts('?fake', memory())!;
    drawApp(<App api={api} device={device} test />);

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(DEMO_CONFIG.name);
    expect(device.clientCode()).toBe(DEMO_CODE);
  });

  it('A reload after signing in keeps the fake: the tab remembers the switch, so the address may lose `?fake`, and the cue is not repeated', async () => {
    const tab = memory({ 'credo.language': 'en' });
    expect(fakeParts('', tab)).toBeNull();

    fakeParts('?fake&cue=signIn:503', tab);
    const reloaded = fakeParts('', tab);

    expect(reloaded).not.toBeNull();
    drawApp(<App api={reloaded!.api} device={reloaded!.device} test />);
    await signInAs();
    expect(await screen.findByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(fakeParts('', memory())).toBeNull();
  });

  it('The root signs in on the fake and lands on Settings', async () => {
    const { api, device } = fakeParts('?fake', memory({ 'credo.language': 'en' }))!;
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect(await screen.findByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });

  it('The address’s cue is read: the call it names answers its status, and the page says the service is unavailable', async () => {
    const { api, device } = fakeParts('?fake&cue=signIn:503', memory({ 'credo.language': 'en' }))!;
    drawApp(<App api={api} device={device} test />);

    await signInAs();

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
    expect(device.authId()).toBeNull();
  });

  it('A sign-in that failed on the service can be sent again after "Try again", and signs in', async () => {
    const { api, device } = fakeParts('?fake&cue=signIn:503', memory({ 'credo.language': 'en' }))!;
    drawApp(<App api={api} device={device} test />);

    await signInAs();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    const button = await screen.findByRole('button', { name: 'Sign In' });
    expect(button.hasAttribute('disabled')).toBe(false);
    await signInAs();
    expect(await screen.findByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });
});
