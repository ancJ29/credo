import {
  addDays,
  addEmployeeReplySchema,
  clientListReplySchema,
  closeRequestFor,
  driverDay,
  importEmployeesReplySchema,
  importCustomersReplySchema,
  importProductsReplySchema,
  customerDocSchema,
  productDocSchema,
  customerListReplySchema,
  deliveryDocSchema,
  deliveryListReplySchema,
  deliveryPhotoReplySchema,
  driverListReplySchema,
  orderDocSchema,
  orderListReplySchema,
  productListReplySchema,
  reconciliationListReplySchema,
  reconciliationSchema,
  TOTAL_MAX,
  configDocSchema,
  createClientReplySchema,
  employeeDocSchema,
  employeeListReplySchema,
  authenticationResponseSchema,
  issueQrReplySchema,
  joinOptionsReplySchema,
  meReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  servicesReplySchema,
  optionsReplySchema,
  passkeyListReplySchema,
  photoReplySchema,
  registrationResponseSchema,
  sessionReplySchema,
  deleteClientReplySchema,
  rootPasswordReplySchema,
  addOperatorReplySchema,
  operatorLinkReplySchema,
  operatorListReplySchema,
  setPasswordReplySchema,
  newestOrdersFirst,
  numberText,
  staffConfig,
  staffSetupDocSchema,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_COLLEAGUE_ID,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_DRIVER_QR_SECRET,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_OPERATOR_ID,
  DEMO_PASSKEYS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TODAY,
  DEMO_PHOTOS,
  DEMO_QR_SECRET,
  DEMO_ROOT_NAME,
  DEMO_SERVICES,
  DEMO_STAFF_SETUP,
  DEMO_WALK_PROOF,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawApp } from '../tests/render';
import { ApiError } from './api';
import { App } from './App';
import { DICTIONARIES } from './i18n';
import { createFakeApi, createFakePasskeys, fakeParts, parseCue } from './fake';
import { PasskeyNotGiven } from './passkeys';

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** A fake whose device holds the handles `held` names. */
const fake = (
  cue = '',
  held: { client?: string; operator?: string } = {},
  signIns = false,
  drift = false,
) =>
  createFakeApi({
    device: { authId: () => held.client ?? null, operatorAuthId: () => held.operator ?? null },
    cue: parseCue(cue || null),
    signIns,
    drift,
  });

const CREDENTIAL = {
  id: 'k',
  rawId: 'k',
  type: 'public-key' as const,
  response: {},
  clientExtensionResults: {},
};
const CONFIRM = { token: 'fake.token', response: CREDENTIAL };
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
    parses('operatorPasskeyOptions', optionsReplySchema, await api.operatorPasskeyOptions());
    parses(
      'operatorPasskeySignIn',
      operatorSessionReplySchema,
      await api.operatorPasskeySignIn({ token: 'fake.token', response: CREDENTIAL }),
    );
    parses('operatorMe', operatorMeReplySchema, await api.operatorMe());
    parses(
      'operatorJoinOptions',
      joinOptionsReplySchema,
      await api.operatorJoinOptions(DEMO_JOIN_TOKEN),
    );
    parses('operatorPasskeys', passkeyListReplySchema, {
      passkeys: await api.operatorPasskeys(),
    });
    parses(
      'operatorPasskeyConfirmOptions',
      optionsReplySchema,
      await api.operatorPasskeyConfirmOptions('add'),
    );
    parses('operatorPasskeyAddOptions', optionsReplySchema, await api.operatorPasskeyAddOptions());
    parses('operatorPasskeyAdd', passkeyListReplySchema, {
      passkeys: await api.operatorPasskeyAdd({
        token: 'fake.token',
        response: CREDENTIAL,
        confirm: CONFIRM,
      }),
    });
    const removed = await api.operatorPasskeyRemove(DEMO_PASSKEYS[0]?.id ?? '', CONFIRM);
    parses(
      'operatorPasskeyRemove',
      passkeyListReplySchema,
      removed.kind === 'removed' ? { passkeys: removed.passkeys } : null,
    );
    parses(
      'operatorJoin',
      operatorSessionReplySchema,
      await api.operatorJoin({ link: DEMO_JOIN_TOKEN, token: 'fake.token', response: CREDENTIAL }),
    );
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
    const firstCustomer = (await api.listCustomers())[0];
    parses('getCustomer', customerDocSchema, await api.getCustomer(firstCustomer.id));
    const savedCustomer = await api.saveCustomer(firstCustomer.id, {
      version: 'c1',
      name: 'Đổi',
      extra: {},
    });
    parses(
      'saveCustomer',
      customerDocSchema,
      savedCustomer.kind === 'saved' ? savedCustomer.doc : null,
    );
    const addedCustomer = await api.addCustomer({ code: 'kh-91', name: 'Thêm', extra: {} });
    parses(
      'addCustomer',
      customerDocSchema,
      addedCustomer.kind === 'added' ? addedCustomer.doc : null,
    );
    parses('listProducts', productListReplySchema, { products: await api.listProducts() });
    const firstProduct = (await api.listProducts())[0];
    parses('getProduct', productDocSchema, await api.getProduct(firstProduct.id));
    const savedProduct = await api.saveProduct(firstProduct.id, {
      version: 'p1',
      name: 'Đổi',
      unit: 'bao',
      price: 1000,
      stocked: false,
      extra: {},
    });
    parses(
      'saveProduct',
      productDocSchema,
      savedProduct.kind === 'saved' ? savedProduct.doc : null,
    );
    const addedProduct = await api.addProduct({
      code: 'vt-91',
      name: 'Thêm',
      unit: 'bao',
      price: 5000,
      stocked: false,
      extra: {},
    });
    parses('addProduct', productDocSchema, addedProduct.kind === 'added' ? addedProduct.doc : null);
    parses(
      'importCustomers',
      importCustomersReplySchema,
      await api.importCustomers([{ code: 'kh-90', name: 'Nhập', extra: {} }]),
    );
    parses(
      'importProducts',
      importProductsReplySchema,
      await api.importProducts([
        { code: 'vt-90', name: 'Nhập', unit: 'bao', price: 5000, stocked: true, extra: {} },
      ]),
    );
    // the orders, on a fake whose setup is the data set's
    const shop = fake('', { client: 'fake.session' });
    const week = await shop.listOrders('2026-10-29', DEMO_TODAY);
    parses('listOrders', orderListReplySchema, { orders: week });
    const draft = week.find((one) => one.state === 'draft')!;
    const read0 = await shop.getOrder(draft.day, draft.id);
    parses('getOrder', orderDocSchema, read0);
    const customer = DEMO_CUSTOMERS[0];
    const line = { productId: DEMO_PRODUCTS[1].id, quantity: 2 };
    const made0 = await shop.createOrder({
      day: DEMO_TODAY,
      customerId: customer.id,
      lines: [line],
      extra: {},
    });
    parses('createOrder', orderDocSchema, made0);
    const saved0 = await shop.saveOrder(DEMO_TODAY, made0.order.id, {
      day: DEMO_TODAY,
      customerId: customer.id,
      lines: [line, { productId: DEMO_PRODUCTS[2].id, quantity: 1 }],
      extra: {},
      version: made0.version,
    });
    parses('saveOrder', orderDocSchema, saved0.kind === 'done' ? saved0.doc : null);
    const drivers = await shop.listDrivers();
    parses('listDrivers', driverListReplySchema, { drivers });
    const confirmed0 = await shop.confirmOrder(DEMO_TODAY, made0.order.id, {
      version: saved0.kind === 'done' ? saved0.doc.version : '',
      driverId: drivers[0].id,
      day: DEMO_TODAY,
    });
    parses('confirmOrder', orderDocSchema, confirmed0.kind === 'done' ? confirmed0.doc : null);
    const todays = await shop.listDeliveries(DEMO_TODAY);
    parses('listDeliveries', deliveryListReplySchema, { deliveries: todays });
    const waiting = todays.find((one) => one.state === 'waiting')!;
    const request0 = await shop.getDelivery(DEMO_TODAY, waiting.id);
    parses('getDelivery', deliveryDocSchema, request0);
    const cancelled0 = await shop.cancelDelivery(DEMO_TODAY, waiting.id, {
      version: request0.version,
    });
    parses('cancelDelivery', deliveryDocSchema, cancelled0.kind === 'done' ? cancelled0.doc : null);
    const sent0 = await shop.sendOrder(waiting.order.day, waiting.order.id, {
      version: (await shop.getOrder(waiting.order.day, waiting.order.id)).version,
      driverId: drivers[0].id,
      day: DEMO_TODAY,
    });
    parses('sendOrder', orderDocSchema, sent0.kind === 'done' ? sent0.doc : null);
    const mine = fake('', { client: `fake.session.${DEMO_EMPLOYEES[4]?.id}` });
    const listedMine = await mine.myDeliveries(DEMO_TODAY);
    parses('myDeliveries', deliveryListReplySchema, { deliveries: listedMine });
    const toDeliver = listedMine.find((one) => one.state === 'waiting')!;
    const delivered0 = await mine.deliver(DEMO_TODAY, toDeliver.id, {
      version: 'g1',
      photo: DEMO_WALK_PROOF,
    });
    parses('deliver', deliveryDocSchema, delivered0.kind === 'done' ? delivered0.doc : null);
    parses(
      'getDeliveryPhoto',
      deliveryPhotoReplySchema,
      await mine.getDeliveryPhoto(DEMO_TODAY, toDeliver.id),
    );
    parses('listReconciliations', reconciliationListReplySchema, {
      reconciliations: await shop.listReconciliations(addDays(DEMO_TODAY, -1)),
    });
    const settling = fake('', { client: 'fake.session' });
    const tungId = DEMO_EMPLOYEES.find((one) => one.code === 'EMP-0005')!.id;
    const closing = await settling.closeDay(
      DEMO_TODAY,
      tungId,
      closeRequestFor(driverDay(await settling.listDeliveries(DEMO_TODAY), tungId), 1),
    );
    parses(
      'closeDay',
      reconciliationSchema,
      closing.kind === 'closed' ? closing.reconciliation : null,
    );
    const cancelledOrder = await shop.cancelOrder(draft.day, draft.id, { version: read0.version });
    parses(
      'cancelOrder',
      orderDocSchema,
      cancelledOrder.kind === 'done' ? cancelledOrder.doc : null,
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
    const restored = await api.restoreEmployee(
      id,
      archived.kind === 'archived' ? archived.doc.version : '',
    );
    parses(
      'restoreEmployee',
      employeeDocSchema,
      restored.kind === 'restored' ? restored.doc : null,
    );
    const coded = await api.changeCode(id, {
      version: restored.kind === 'restored' ? restored.doc.version : '',
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
    const { build, storage } = await api.operatorServices();
    parses('operatorServices', servicesReplySchema, { build, storage });
    const made = await api.makeClient('another-one', 'Another One');
    parses('makeClient', createClientReplySchema, made.kind === 'made' ? made.client : null);
    parses('listOperators', operatorListReplySchema, { operators: await api.listOperators() });
    const colleague = await api.addOperator({ name: 'Thu Hà', confirm: CONFIRM });
    parses(
      'addOperator',
      addOperatorReplySchema,
      colleague.kind === 'made' ? { id: colleague.id, link: colleague.link } : null,
    );
    parses(
      'newOperatorLink',
      operatorLinkReplySchema,
      await api.newOperatorLink(DEMO_COLLEAGUE_ID, { confirm: CONFIRM }),
    );
    await api.deleteOperator(DEMO_COLLEAGUE_ID, { confirm: CONFIRM });
    checked['deleteOperator'] = true;
    parses(
      'setRootPassword',
      rootPasswordReplySchema,
      await api.setRootPassword('hoa-sen', { password: null, confirm: CONFIRM }),
    );
    parses(
      'deleteClient',
      deleteClientReplySchema,
      await api.deleteClient('hoa-sen', { confirm: CONFIRM }),
    );

    expect(Object.entries(checked).filter(([, ok]) => !ok)).toEqual([]);
    // a method with no check above would answer unchecked
    expect(Object.keys(api).sort()).toEqual(
      [
        'getConfig',
        'signIn',
        'me',
        'operatorPasskeyOptions',
        'operatorPasskeySignIn',
        'operatorJoinOptions',
        'operatorJoin',
        'operatorPasskeys',
        'operatorPasskeyConfirmOptions',
        'operatorPasskeyAddOptions',
        'operatorPasskeyAdd',
        'operatorPasskeyRemove',
        'operatorServices',
        'operatorMe',
        'getStaffSetup',
        'saveStaffSetup',
        'listEmployees',
        'getEmployee',
        'addEmployee',
        'importEmployees',
        'listCustomers',
        'getCustomer',
        'addCustomer',
        'saveCustomer',
        'listProducts',
        'getProduct',
        'addProduct',
        'saveProduct',
        'importCustomers',
        'importProducts',
        'listOrders',
        'getOrder',
        'createOrder',
        'saveOrder',
        'confirmOrder',
        'sendOrder',
        'cancelOrder',
        'listDeliveries',
        'getDelivery',
        'cancelDelivery',
        'listReconciliations',
        'closeDay',
        'listDrivers',
        'myDeliveries',
        'deliver',
        'getDeliveryPhoto',
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
        'restoreEmployee',
        'saveConfig',
        'makeClient',
        'setRootPassword',
        'deleteClient',
        'listOperators',
        'addOperator',
        'newOperatorLink',
        'deleteOperator',
        'listClients',
        'signOut',
        'operatorSignOut',
      ].sort(),
    );
  });

  it('D: The fake makes the data set’s invented password when none is typed, answers a typed one with none, and refuses as the BFF does', async () => {
    const api = fake('', { operator: 'fake.operator' });
    const typed = 'Abcdef1!';

    expect(await api.setRootPassword('hoa-sen', { password: null, confirm: CONFIRM })).toEqual({
      made: 'Fake-password-1!',
    });
    expect(await api.setRootPassword('hoa-sen', { password: typed, confirm: CONFIRM })).toEqual({
      made: null,
    });
    expect(
      await status(api.setRootPassword('hoa-sen', { password: 'weak', confirm: CONFIRM })),
    ).toBe(400);
    expect(await status(api.setRootPassword('nobody', { password: null, confirm: CONFIRM }))).toBe(
      404,
    );
    expect(
      await status(fake().setRootPassword('hoa-sen', { password: null, confirm: CONFIRM })),
    ).toBe(401);
    for (const cue of ['setRootPassword:401', 'setRootPassword:403', 'setRootPassword:503']) {
      const cued = fake(cue, { operator: 'fake.operator' });
      const expected = Number(cue.split(':')[1]);
      expect(
        await status(cued.setRootPassword('hoa-sen', { password: null, confirm: CONFIRM })),
      ).toBe(expected);
      expect(
        (await cued.setRootPassword('hoa-sen', { password: null, confirm: CONFIRM })).made,
      ).toBe('Fake-password-1!');
    }
  });

  it('The fake deletes a client from its own list, refusing as the BFF orders: the session, the client, the body', async () => {
    const api = fake('', { operator: 'fake.operator' });

    expect(await status(fake().deleteClient('hoa-sen', { confirm: CONFIRM }))).toBe(401);
    expect(await status(api.deleteClient('nobody', {} as never))).toBe(404);
    expect(await status(api.deleteClient('hoa-sen', {} as never))).toBe(400);
    expect(await status(api.deleteClient('hoa-sen', null))).toBe(400);
    expect((await api.listClients()).map((one) => one.code)).toContain('hoa-sen');
    expect(await api.deleteClient('hoa-sen', { confirm: CONFIRM })).toEqual({ left: 0 });
    expect((await api.listClients()).map((one) => one.code)).not.toContain('hoa-sen');
    expect(await status(api.deleteClient('hoa-sen', { confirm: CONFIRM }))).toBe(404);
    // the code is free again
    expect(await api.makeClient('hoa-sen', 'Hoa Sen')).toMatchObject({ kind: 'made' });
  });

  it('B1: The fake lists the data set’s operators with the reader marked, and adds one by a name, invited, the name taken refused whatever its capitals', async () => {
    const api = fake('', { operator: 'fake.operator' });
    const first = await api.listOperators();
    expect(first.map((one) => [one.name, one.state, one.you])).toEqual([
      ['Lan Anh', 'invited', false],
      ['Minh Quân', 'active', false],
      ['operator', 'active', true],
    ]);

    const made = await api.addOperator({ name: ' Thu Hà ', confirm: CONFIRM });
    const second = await api.addOperator({ name: 'Kim Ngân', confirm: CONFIRM });
    expect(made).toMatchObject({ kind: 'made' });
    expect(second).toMatchObject({ kind: 'made' });
    expect(made.kind === 'made' && made.link).not.toBe(second.kind === 'made' && second.link);
    const listed = await api.listOperators();
    expect(listed).toHaveLength(5);
    expect(listed.find((one) => one.name === 'Thu Hà')).toMatchObject({
      state: 'invited',
      addedBy: 'operator',
      addedByTerminal: false,
      passkeys: 0,
      signedInAt: null,
    });
    expect(await api.addOperator({ name: 'THU hà', confirm: CONFIRM })).toEqual({ kind: 'taken' });
    expect(await api.listOperators()).toHaveLength(5);
    expect(await status(api.addOperator({ name: ' ', confirm: CONFIRM }))).toBe(400);
    expect(await status(fake().listOperators())).toBe(401);
    expect(await status(fake().addOperator({ name: 'Zed', confirm: CONFIRM }))).toBe(401);
  });

  it('B2 row 9: The fake makes a colleague’s new link, the same for an invited one, and deletes one: gone from the roster, the ones they added reading no adder, their name free; never oneself, never one not there', async () => {
    const api = fake('', { operator: 'fake.operator' });
    const invited = '00000000-0000-4000-8000-000000000202';
    const first = await api.newOperatorLink(DEMO_COLLEAGUE_ID, { confirm: CONFIRM });
    const second = await api.newOperatorLink(invited, { confirm: CONFIRM });
    expect(first.link).toMatch(/^\/operator\/join#.{43}$/);
    expect(second.link).not.toBe(first.link);
    expect(await status(api.newOperatorLink(DEMO_OPERATOR_ID, { confirm: CONFIRM }))).toBe(403);
    expect(await status(api.newOperatorLink('nobody', { confirm: CONFIRM }))).toBe(404);
    expect(await status(api.deleteOperator(DEMO_OPERATOR_ID, { confirm: CONFIRM }))).toBe(403);
    expect(await status(api.deleteOperator('nobody', { confirm: CONFIRM }))).toBe(404);
    expect(await status(api.newOperatorLink(invited, {} as never))).toBe(400);
    expect(await status(api.deleteOperator(invited, {} as never))).toBe(400);
    expect(await status(fake().deleteOperator(invited, { confirm: CONFIRM }))).toBe(401);
    expect(await status(fake().newOperatorLink(invited, { confirm: CONFIRM }))).toBe(401);

    await api.addOperator({ name: 'Thu Hà', confirm: CONFIRM });
    await api.deleteOperator(DEMO_COLLEAGUE_ID, { confirm: CONFIRM });
    expect((await api.listOperators()).map((one) => one.name)).not.toContain('Minh Quân');
    expect(await status(api.deleteOperator(DEMO_COLLEAGUE_ID, { confirm: CONFIRM }))).toBe(404);
    expect(await api.addOperator({ name: 'minh quân', confirm: CONFIRM })).toMatchObject({
      kind: 'made',
    });
  });

  it('B2 row 2: the operators an operator deleted added read no adder; the fake’s joined operator deletes the data set’s first, whom Lan Anh was added by', async () => {
    const api = fake('', { operator: 'fake.operator.joined' });
    // the joined operator is Lan Anh: never their own link or delete, a colleague's yes
    expect(
      await status(
        api.newOperatorLink('00000000-0000-4000-8000-000000000202', { confirm: CONFIRM }),
      ),
    ).toBe(403);
    expect(
      await status(
        api.deleteOperator('00000000-0000-4000-8000-000000000202', { confirm: CONFIRM }),
      ),
    ).toBe(403);
    expect(await api.newOperatorLink(DEMO_OPERATOR_ID, { confirm: CONFIRM })).toHaveProperty(
      'link',
    );
    await api.deleteOperator(DEMO_OPERATOR_ID, { confirm: CONFIRM });
    const listed = await api.listOperators();
    expect(listed.find((one) => one.name === 'Lan Anh')).toMatchObject({
      addedBy: null,
      addedByTerminal: false,
    });
  });

  it('B1: A cue makes the roster’s calls answer once as asked, then the fake goes on; the joined operator reads active, themselves', async () => {
    for (const cue of ['listOperators:401', 'listOperators:503']) {
      const cued = fake(cue, { operator: 'fake.operator' });
      expect(await status(cued.listOperators())).toBe(Number(cue.split(':')[1]));
      expect(await cued.listOperators()).toHaveLength(3);
    }
    const cued = fake('addOperator:409', { operator: 'fake.operator' });
    expect(await cued.addOperator({ name: 'Zed', confirm: CONFIRM })).toEqual({ kind: 'taken' });
    expect(await cued.addOperator({ name: 'Zed', confirm: CONFIRM })).toMatchObject({
      kind: 'made',
    });

    // an operator who joined by the link adds one under their own name
    const lanAnh = fake('', { operator: 'fake.operator.joined' });
    await lanAnh.addOperator({ name: 'Zed', confirm: CONFIRM });
    expect((await lanAnh.listOperators()).find((one) => one.name === 'Zed')?.addedBy).toBe(
      'Lan Anh',
    );

    const joined = fake('', { operator: 'fake.operator' });
    await joined.operatorJoin({ link: DEMO_JOIN_TOKEN, token: 'fake.token', response: CREDENTIAL });
    const handle = fake('', { operator: 'fake.operator.joined' });
    const lan = (await handle.listOperators()).find((one) => one.name === 'Lan Anh');
    expect(lan).toMatchObject({ you: true });
    const after = (await joined.listOperators()).find((one) => one.name === 'Lan Anh');
    expect(after).toMatchObject({ state: 'active', passkeys: 1, you: false });
    expect(after?.signedInAt).not.toBeNull();
    expect((await joined.listOperators()).find((one) => one.name === 'Minh Quân')).toMatchObject({
      state: 'active',
      passkeys: 1,
    });
  });

  it('C: The fake answers a name’s sixth wrong try with a wait of 30 seconds, refuses a try within it with what is left, and doubles the next', async () => {
    vi.useFakeTimers();
    try {
      const api = fake('', { client: 'fake.session' });
      for (let tries = 1; tries <= 5; tries += 1) {
        expect(await status(api.signIn('nobody', 'pw'))).toBe(401);
      }
      await expect(api.signIn('NOBODY', 'pw')).rejects.toMatchObject({
        status: 429,
        waitSeconds: 30,
      });
      vi.advanceTimersByTime(10_000);
      await expect(api.signIn('nobody', 'pw')).rejects.toMatchObject({ waitSeconds: 20 });
      vi.advanceTimersByTime(20_000);
      await expect(api.signIn('nobody', 'pw')).rejects.toMatchObject({ waitSeconds: 60 });
      expect((await api.signIn(DEMO_ROOT_NAME, 'pw')).user.root).toBe(true);
    } finally {
      vi.useRealTimers();
    }
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
      startDate: true,
      birthDate: true,
      address: true,
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
        'orders.canView': true,
        'orders.canEdit': true,
        'deliveries.canDeliver': false,
      },
    });
    // the warehouse sees, and nothing more
    expect((await api.signIn(bao?.code ?? '', 'pw')).user.permissions).toEqual({
      'staff.canView': true,
      'staff.canCreate': false,
      'staff.canEdit': false,
      'staff.canDelete': false,
      'settings.canEdit': false,
      'orders.canView': false,
      'orders.canEdit': false,
      'deliveries.canDeliver': false,
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

  it('A person who left is switched back on: the flag goes, the version moves, a stale version is a conflict and the record is as it was', async () => {
    const api = fake();
    const left = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0008')!;
    const read = await api.getEmployee(left.id);
    expect(read.employee.archived).toBe(true);

    expect(await api.restoreEmployee(left.id, 'e99')).toEqual({ kind: 'conflict' });
    const restored = await api.restoreEmployee(left.id, read.version);
    expect(restored.kind).toBe('restored');
    if (restored.kind !== 'restored') return;
    expect(restored.doc.version).not.toBe(read.version);
    expect(restored.doc.employee).toEqual({ ...read.employee, archived: false });
    expect((await api.getEmployee(left.id)).employee.archived).toBe(false);
    // the version read before is now stale
    expect(await api.restoreEmployee(left.id, read.version)).toEqual({ kind: 'conflict' });
  });

  it('A customer is read with a version, saved over it, and a save over an older one is a conflict; one not there is null, and saving it is a 404', async () => {
    const api = fake();
    const one = (await api.listCustomers())[0];
    const read = await api.getCustomer(one.id);
    expect(read).toMatchObject({ customer: one, version: 'c1' });
    const save = (version: string) =>
      api.saveCustomer(one.id, { version, name: 'Đổi', extra: { phone: '0900' } });

    const saved = await save('c1');
    expect(saved).toMatchObject({
      kind: 'saved',
      doc: { customer: { name: 'Đổi', extra: { phone: '0900' } }, version: 'c2' },
    });
    expect(await save('c1')).toEqual({ kind: 'conflict' });
    expect(await api.getCustomer('missing')).toBeNull();
    expect(await status(api.saveCustomer('missing', { version: 'c1', name: 'x', extra: {} }))).toBe(
      404,
    );
  });

  it('A product is read with a version, saved over it, and a save over an older one is a conflict; one not there is null, and saving it is a 404', async () => {
    const api = fake();
    const one = (await api.listProducts())[0];
    const read = await api.getProduct(one.id);
    expect(read).toMatchObject({ product: one, version: 'p1' });
    const save = (version: string) =>
      api.saveProduct(one.id, {
        version,
        name: 'Đổi',
        unit: 'tấn',
        price: 120000,
        stocked: !one.stocked,
        extra: { note: 'x' },
      });

    const saved = await save('p1');
    expect(saved).toMatchObject({
      kind: 'saved',
      doc: {
        product: {
          name: 'Đổi',
          unit: 'tấn',
          price: 120000,
          stocked: !one.stocked,
          extra: { note: 'x' },
        },
        version: 'p2',
      },
    });
    expect(await save('p1')).toEqual({ kind: 'conflict' });
    expect(await api.getProduct('missing')).toBeNull();
    expect(
      await status(
        api.saveProduct('missing', {
          version: 'p1',
          name: 'x',
          unit: 'x',
          price: 1,
          stocked: true,
          extra: {},
        }),
      ),
    ).toBe(404);
  });

  it('A save over a newer version is a conflict, and a person who is not there is a 404', async () => {
    const api = fake();
    const id = bao?.id ?? '';
    const read = await api.getEmployee(id);
    const save = (version: string) => api.saveEmployee(id, { version, name: 'Đổi', extra: {} });

    expect((await save(read.version)).kind).toBe('saved');
    expect(await save(read.version)).toEqual({ kind: 'conflict' });
    expect(await api.archiveEmployee(id, read.version)).toEqual({ kind: 'conflict' });
    expect(await api.restoreEmployee(id, read.version)).toEqual({ kind: 'conflict' });
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
      { code: 'vt-90', name: 'Một', unit: 'bao', price: 5000, stocked: true, extra: {} },
      { code: 'VT-91', name: 'Giá sai', unit: 'bao', price: 0, stocked: true, extra: {} },
      { code: 'VT-001', name: 'Đã có', unit: 'bao', price: 5000, stocked: true, extra: {} },
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

  it('An add puts in the record the import would: a version of its own, the code in capitals, a code the list holds in either case refused as taken and nothing written, a body the import would refuse a 400, for whoever may edit orders alone', async () => {
    const api = fake('', root);

    const customer = await api.addCustomer({
      code: 'kh-90',
      name: 'Một',
      extra: { phone: '0900' },
    });
    expect(customer).toMatchObject({
      kind: 'added',
      doc: { customer: { code: 'KH-90', name: 'Một', extra: { phone: '0900' } }, version: 'c1' },
    });
    const id = customer.kind === 'added' ? customer.doc.customer.id : '';
    expect(await api.getCustomer(id)).toEqual(customer.kind === 'added' ? customer.doc : null);
    expect(await api.addCustomer({ code: 'Kh-90', name: 'Lặp', extra: {} })).toEqual({
      kind: 'taken',
    });
    expect(await api.addCustomer({ code: 'kh-001', name: 'Lặp', extra: {} })).toEqual({
      kind: 'taken',
    });
    expect(await status(api.addCustomer({ code: 'a b', name: 'x', extra: {} }))).toBe(400);
    expect(
      await status(api.addCustomer({ id, code: 'KH-92', name: 'x', extra: {} } as never)),
    ).toBe(400);
    expect((await api.listCustomers()).length).toBe(DEMO_CUSTOMERS.length + 1);
    // a save over the version the add gave is accepted, and moves it
    expect(await api.saveCustomer(id, { version: 'c1', name: 'Hai', extra: {} })).toMatchObject({
      kind: 'saved',
      doc: { version: 'c2' },
    });

    const product = await api.addProduct({
      code: 'vt-90',
      name: 'Một',
      unit: 'bao',
      price: 5000,
      stocked: false,
      extra: {},
    });
    expect(product).toMatchObject({
      kind: 'added',
      doc: { product: { code: 'VT-90', stocked: false, price: 5000 }, version: 'p1' },
    });
    expect(
      await api.addProduct({
        code: 'VT-90',
        name: 'Lặp',
        unit: 'bao',
        price: 5000,
        stocked: false,
        extra: {},
      }),
    ).toEqual({ kind: 'taken' });
    expect(
      await status(
        api.addProduct({
          code: 'VT-93',
          name: 'x',
          unit: 'bao',
          price: 0,
          stocked: false,
          extra: {},
        }),
      ),
    ).toBe(400);
    expect((await api.listProducts()).length).toBe(DEMO_PRODUCTS.length + 1);

    // the warehouse may not see orders: refused before the body is read, even a bad one
    const staff = fake('', { client: `fake.session.${DEMO_EMPLOYEES[3]?.id}` });
    expect(await status(staff.addCustomer({ code: 'KH-95', name: 'x', extra: {} }))).toBe(403);
    expect(await status(staff.addProduct({} as never))).toBe(403);
    // the office may edit orders
    const office = fake('', { client: `fake.session.${DEMO_EMPLOYEES[0]?.id}` });
    expect(await office.addCustomer({ code: 'KH-95', name: 'x', extra: {} })).toMatchObject({
      kind: 'added',
    });
  });

  it('A cue on an add: 409 answers the code as taken once, 503 and 403 raise, and the add then goes on', async () => {
    const taken = fake('addCustomer:409', root);
    expect(await taken.addCustomer({ code: 'KH-90', name: 'x', extra: {} })).toEqual({
      kind: 'taken',
    });
    expect(await taken.addCustomer({ code: 'KH-90', name: 'x', extra: {} })).toMatchObject({
      kind: 'added',
    });
    const product = {
      code: 'VT-90',
      name: 'x',
      unit: 'bao',
      price: 5000,
      stocked: false,
      extra: {},
    };
    expect(await fake('addProduct:409', root).addProduct(product)).toEqual({ kind: 'taken' });
    expect(await status(fake('addProduct:503', root).addProduct(product))).toBe(503);
    expect(await status(fake('addCustomer:403', root).addCustomer(product))).toBe(403);
  });

  it('The two lists answer 403 to anyone who may not see orders, and the two imports to anyone but the root; a cue’s 403, 409 or 503 comes once, the call then answering as the data set does', async () => {
    const staff = fake('', { client: `fake.session.${DEMO_EMPLOYEES[3]?.id}` });
    const office = fake('', { client: `fake.session.${DEMO_EMPLOYEES[0]?.id}` });
    const row = { code: 'KH-90', name: 'Một', extra: {} };
    const product = {
      code: 'VT-90',
      name: 'Một',
      unit: 'bao',
      price: 5000,
      stocked: true,
      extra: {},
    };

    expect(await status(staff.listCustomers())).toBe(403);
    expect(await status(staff.listProducts())).toBe(403);
    expect(await status(staff.importCustomers([row]))).toBe(403);
    expect(await status(staff.importProducts([product]))).toBe(403);
    // the office sees both lists, and imports into neither
    expect((await office.listCustomers()).length).toBe(DEMO_CUSTOMERS.length);
    expect((await office.listProducts()).length).toBe(DEMO_PRODUCTS.length);
    expect(await status(office.importCustomers([row]))).toBe(403);
    expect(await status(office.importProducts([product]))).toBe(403);

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
    expect(setup.fields).toEqual({
      personalPhone: true,
      photo: true,
      startDate: true,
      birthDate: true,
      address: true,
    });
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

    for (const call of [
      'saveStaffSetup',
      'addEmployee',
      'saveEmployee',
      'saveCustomer',
      'saveProduct',
      'archiveEmployee',
      'restoreEmployee',
    ]) {
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

  it('An address’s cue is a call and one of the five statuses, or the authenticator’s “not given”, or it is no cue', () => {
    expect(parseCue('saveConfig:409')).toEqual({ call: 'saveConfig', status: 409 });
    expect(parseCue('me:403')).toEqual({ call: 'me', status: 403 });
    expect(parseCue('me:401')).toEqual({ call: 'me', status: 401 });
    expect(parseCue('me:404')).toEqual({ call: 'me', status: 404 });
    expect(parseCue('passkey:notGiven')).toEqual({ call: 'passkey', status: 'notGiven' });
    expect(parseCue('operatorServices:silent')).toEqual({
      call: 'operatorServices',
      status: 'silent',
    });
    expect(parseCue('me:418')).toBeNull();
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
    const { api, device, passkeys } = fakeParts('?fake', memory())!;
    drawApp(<App api={api} device={device} passkeys={passkeys} build="dev" test />);

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(DEMO_CONFIG.name);
    expect(device.clientCode()).toBe(DEMO_CODE);
  });

  it('A reload after signing in keeps the fake: the tab remembers the switch, so the address may lose `?fake`, and the cue is not repeated', async () => {
    const tab = memory({ 'credo.language': 'en' });
    expect(fakeParts('', tab)).toBeNull();

    fakeParts('?fake&cue=signIn:503', tab);
    const reloaded = fakeParts('', tab);

    expect(reloaded).not.toBeNull();
    drawApp(
      <App
        api={reloaded!.api}
        device={reloaded!.device}
        passkeys={reloaded!.passkeys}
        build="dev"
        test
      />,
    );
    await signInAs();
    expect(await screen.findByRole('heading', { level: 2, name: 'Orders' })).toBeTruthy();
    expect(fakeParts('', memory())).toBeNull();
  });

  it('The root signs in on the fake and lands on the orders', async () => {
    const { api, device, passkeys } = fakeParts('?fake', memory({ 'credo.language': 'en' }))!;
    drawApp(<App api={api} device={device} passkeys={passkeys} build="dev" test />);

    await signInAs();

    expect(await screen.findByRole('heading', { level: 2, name: 'Orders' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });

  it('The address’s cue is read: the call it names answers its status, and the page says the service is unavailable', async () => {
    const { api, device, passkeys } = fakeParts(
      '?fake&cue=signIn:503',
      memory({ 'credo.language': 'en' }),
    )!;
    drawApp(<App api={api} device={device} passkeys={passkeys} build="dev" test />);

    await signInAs();

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
    expect(device.authId()).toBeNull();
  });

  it('A sign-in that failed on the service can be sent again after "Try again", and signs in', async () => {
    const { api, device, passkeys } = fakeParts(
      '?fake&cue=signIn:503',
      memory({ 'credo.language': 'en' }),
    )!;
    drawApp(<App api={api} device={device} passkeys={passkeys} build="dev" test />);

    await signInAs();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    const button = await screen.findByRole('button', { name: 'Sign In' });
    expect(button.hasAttribute('disabled')).toBe(false);
    await signInAs();
    expect(await screen.findByRole('heading', { level: 2, name: 'Orders' })).toBeTruthy();
    expect(device.authId()).toBe('fake.session');
  });
});

describe('the fake’s passkey calls', () => {
  const held = { operator: 'fake.operator' };

  it('A passkey sign-in answers the data set’s operator, with the id a later passkey names, whatever the device answered', async () => {
    const api = fake('');
    const reply = await api.operatorPasskeySignIn({ token: 'fake.token', response: CREDENTIAL });

    expect(reply.operator).toEqual({ id: DEMO_OPERATOR_ID, name: OPERATOR_NAME });
    expect(reply.authId).toBe('fake.operator');
    expect(reply.expiresAt).toBeGreaterThan(Date.now());
    await expect(fake('', held).operatorMe()).resolves.toEqual({
      operator: { id: DEMO_OPERATOR_ID, name: OPERATOR_NAME },
    });
  });

  it('A passkey the data set does not know opens nothing: the sign-in cue makes it a 401 once', async () => {
    const api = fake('operatorPasskeySignIn:401');

    expect(await status(api.operatorPasskeySignIn({ token: 't', response: CREDENTIAL }))).toBe(401);
    await expect(
      api.operatorPasskeySignIn({ token: 't', response: CREDENTIAL }),
    ).resolves.toMatchObject({ operator: { name: OPERATOR_NAME } });
  });

  it('The invited operator’s link names whose it is and who made it; any other, or a link already used, is a 404', async () => {
    const api = fake('');

    await expect(api.operatorJoinOptions(DEMO_JOIN_TOKEN)).resolves.toMatchObject({
      name: DEMO_INVITED_NAME,
      madeBy: OPERATOR_NAME,
    });
    expect(await status(api.operatorJoinOptions('x'.repeat(43)))).toBe(404);
    expect(
      await status(api.operatorJoin({ link: 'x'.repeat(43), token: 't', response: CREDENTIAL })),
    ).toBe(404);

    const joined = await api.operatorJoin({
      link: DEMO_JOIN_TOKEN,
      token: 't',
      response: CREDENTIAL,
    });
    expect(joined.operator.name).toBe(DEMO_INVITED_NAME);
    expect(joined.authId).not.toBe('fake.operator');
    expect(await status(api.operatorJoinOptions(DEMO_JOIN_TOKEN))).toBe(404);
    expect(
      await status(api.operatorJoin({ link: DEMO_JOIN_TOKEN, token: 't', response: CREDENTIAL })),
    ).toBe(404);
  });

  it('A dead link can be cued on the join’s options, once', async () => {
    const api = fake('operatorJoinOptions:404');

    expect(await status(api.operatorJoinOptions(DEMO_JOIN_TOKEN))).toBe(404);
    await expect(api.operatorJoinOptions(DEMO_JOIN_TOKEN)).resolves.toMatchObject({
      name: DEMO_INVITED_NAME,
    });
  });

  it('Once joined, `me` names the new operator, not the data set’s, and they hold the one passkey they made', async () => {
    const joined = fake('', { operator: 'fake.operator.joined' });
    await expect(joined.operatorMe()).resolves.toMatchObject({
      operator: { name: DEMO_INVITED_NAME },
    });

    const api = fake('', { operator: 'fake.operator.joined' });
    await api.operatorJoin({ link: DEMO_JOIN_TOKEN, token: 't', response: CREDENTIAL });
    expect(await api.operatorPasskeys()).toHaveLength(1);
  });

  it('The operator’s own passkeys are the data set’s two, a device with no handle is a 401, one is added and one is removed', async () => {
    expect(await status(fake('').operatorPasskeys())).toBe(401);
    expect(
      await status(
        fake('').operatorPasskeyAdd({ token: 't', response: CREDENTIAL, confirm: CONFIRM }),
      ),
    ).toBe(401);
    expect(await status(fake('').operatorPasskeyRemove('x', CONFIRM))).toBe(401);

    const api = fake('', held);
    expect(await api.operatorPasskeys()).toEqual(DEMO_PASSKEYS);
    const added = await api.operatorPasskeyAdd({
      token: 't',
      response: CREDENTIAL,
      confirm: CONFIRM,
    });
    expect(added).toHaveLength(3);
    expect(added[2]?.lastUsedAt).toBeNull();
    expect(new Set(added.map((passkey) => passkey.id)).size).toBe(3);

    const removed = await api.operatorPasskeyRemove(DEMO_PASSKEYS[0]?.id ?? '', CONFIRM);
    expect(removed.kind === 'removed' && removed.passkeys.map((p) => p.id)).toEqual([
      DEMO_PASSKEYS[1]?.id,
      added[2]?.id,
    ]);
    expect(await status(api.operatorPasskeyRemove('missing', CONFIRM))).toBe(404);
  });

  it('The last passkey is not removed: the answer is a result and the passkey stays', async () => {
    const api = fake('', held);
    await api.operatorPasskeyRemove(DEMO_PASSKEYS[0]?.id ?? '', CONFIRM);

    expect(await api.operatorPasskeyRemove(DEMO_PASSKEYS[1]?.id ?? '', CONFIRM)).toEqual({
      kind: 'last',
    });
    expect(await api.operatorPasskeys()).toHaveLength(1);
  });

  it('The options of a sign-in and of an add are asked of a device with no handle only for the sign-in', async () => {
    expect(await status(fake('').operatorPasskeyOptions())).toBe('answered');
    expect(await status(fake('').operatorPasskeyAddOptions())).toBe(401);
    expect(await status(fake('', held).operatorPasskeyAddOptions())).toBe('answered');
    expect(await status(fake('').operatorPasskeyConfirmOptions('add'))).toBe(401);
    expect(await status(fake('', held).operatorPasskeyConfirmOptions('remove'))).toBe('answered');
  });

  it('A “not given” cue touches no call of the Api', async () => {
    const api = fake('operatorMe:notGiven', held);

    await expect(api.operatorMe()).resolves.toMatchObject({ operator: { name: OPERATOR_NAME } });
  });
});

describe('the fake’s services call', () => {
  const held = { operator: 'fake.operator' };

  it('C: The services answer from the data set: one build, the times and the moment fixed at their source; a device with no handle is a 401', async () => {
    expect(await fake('', held).operatorServices()).toEqual({
      build: DEMO_SERVICES.build,
      storage: { build: DEMO_SERVICES.build, ms: DEMO_SERVICES.storageMs },
      bffMs: DEMO_SERVICES.bffMs,
      checkedAt: DEMO_SERVICES.checkedAt,
    });
    expect(await status(fake('').operatorServices())).toBe(401);
  });

  it('C: `drift` has c-storage a build ahead of the others, as a deploy half done leaves it', async () => {
    const reply = await fake('', held, false, true).operatorServices();

    expect(reply.build).toBe(DEMO_SERVICES.build);
    expect(reply.storage.build).toBe(DEMO_SERVICES.driftBuild);
  });

  it('C: The cue makes the call answer the BFF’s 503 once, or nothing at all, and then goes on from the data set', async () => {
    const down = fake('operatorServices:503', held);
    await expect(down.operatorServices()).rejects.toMatchObject({ status: 503, bff: true });
    await expect(down.operatorServices()).resolves.toMatchObject({ build: DEMO_SERVICES.build });

    const silent = fake('operatorServices:silent', held);
    await expect(silent.operatorServices()).rejects.toMatchObject({ status: null, bff: false });
    await expect(silent.operatorServices()).resolves.toMatchObject({ build: DEMO_SERVICES.build });
  });

  it('C: `&drift` on the address has the fake’s c-storage a build ahead, and the app is given the data set’s build', async () => {
    const parts = fakeParts('?fake&drift', memory({ 'credo.operator': 'x' }))!;

    expect(parts.build).toBe(DEMO_SERVICES.build);
    parts.device.setOperatorAuthId('fake.operator');
    expect((await parts.api.operatorServices()).storage.build).toBe(DEMO_SERVICES.driftBuild);
    const plain = fakeParts('?fake', memory())!;
    plain.device.setOperatorAuthId('fake.operator');
    expect((await plain.api.operatorServices()).storage.build).toBe(DEMO_SERVICES.build);
  });
});

describe('the fake authenticator', () => {
  const options = { challenge: 'fake' };

  it('Answers a registration and a sign-in with a credential the shared schemas take, after a tick', async () => {
    const passkeys = createFakePasskeys({ cue: null });
    let answered = false;
    const pending = passkeys.register(options).then((answer) => {
      answered = true;
      return answer;
    });

    expect(answered).toBe(false);
    expect(registrationResponseSchema.safeParse(await pending).success).toBe(true);
    expect(
      authenticationResponseSchema.safeParse(await passkeys.authenticate(options)).success,
    ).toBe(true);
  });

  it('The cue “passkey:notGiven” makes the first ceremony, of either kind, not given, once', async () => {
    const registering = createFakePasskeys({ cue: parseCue('passkey:notGiven') });
    await expect(registering.register(options)).rejects.toBeInstanceOf(PasskeyNotGiven);
    await expect(registering.register(options)).resolves.toMatchObject({ type: 'public-key' });

    const signing = createFakePasskeys({ cue: parseCue('passkey:notGiven') });
    await expect(signing.authenticate(options)).rejects.toBeInstanceOf(PasskeyNotGiven);
    await expect(signing.authenticate(options)).resolves.toMatchObject({ type: 'public-key' });
  });

  it('Another call’s cue, or none, is not the authenticator’s', async () => {
    for (const cue of [parseCue('operatorMe:503'), parseCue('operatorMe:notGiven'), null]) {
      await expect(createFakePasskeys({ cue }).register(options)).resolves.toBeDefined();
    }
  });

  it('The app is given the fake authenticator with the fake Api on `?fake`', async () => {
    const parts = fakeParts('?fake&cue=passkey:notGiven', memory())!;

    await expect(parts.passkeys.authenticate(options)).rejects.toBeInstanceOf(PasskeyNotGiven);
  });
});

describe('the fake Api’s orders and delivery requests', () => {
  const root = { client: 'fake.session' };
  const office = { client: `fake.session.${DEMO_EMPLOYEES[0]?.id}` };
  const warehouse = { client: `fake.session.${DEMO_EMPLOYEES[3]?.id}` };
  const order = DEMO_ORDERS.find((one) => one.state === 'draft' && one.day === DEMO_TODAY)!;
  const sent = DEMO_ORDERS.find((one) => one.request?.day === DEMO_TODAY)!;
  const driver = DEMO_DELIVERIES[0].driver;
  const lines = [{ productId: DEMO_PRODUCTS[1].id, quantity: 2 }];
  const save = { day: order.day, customerId: DEMO_CUSTOMERS[0].id, lines, extra: {} };

  it('The fake’s calls answer as the BFF does: the week newest first, a record by its day and id, a day of requests by driver, the drivers allowed to deliver who have not left', async () => {
    const api = fake('', office);

    const week = await api.listOrders(addDays(DEMO_TODAY, -6), DEMO_TODAY);
    expect(week.map((one) => one.number)).toEqual(
      [...DEMO_ORDERS].sort(newestOrdersFirst).map((one) => one.number),
    );
    expect(
      (await api.listOrders(DEMO_TODAY, DEMO_TODAY)).every((one) => one.day === DEMO_TODAY),
    ).toBe(true);
    expect(await status(api.listOrders(DEMO_TODAY, addDays(DEMO_TODAY, -1)))).toBe(400);
    expect(await status(api.listOrders(addDays(DEMO_TODAY, -7), DEMO_TODAY))).toBe(400);
    // a record is found by its day and id together
    expect((await api.getOrder(order.day, order.id)).order.number).toBe(order.number);
    expect(await status(api.getOrder(addDays(order.day, -1), order.id))).toBe(404);
    expect(await status(api.getOrder(order.day, 'nope'))).toBe(404);
    expect(await status(api.getDelivery(DEMO_TODAY, 'nope'))).toBe(404);
    // a day's requests, by driver code and then number
    const day = await api.listDeliveries(DEMO_TODAY);
    expect(day.map((one) => [one.driver.code, one.number])).toEqual(
      [...day].map((one) => [one.driver.code, one.number]).sort(),
    );
    expect(day.every((one) => one.day === DEMO_TODAY)).toBe(true);
    // the drivers: allowed to deliver by their layers, and not left
    expect((await api.listDrivers()).map((one) => one.code)).toEqual(['EMP-0005', 'EMP-0006']);
    const left = fake('', root);
    const setup = await left.getStaffSetup();
    await left.saveStaffSetup(
      {
        ...setup.setup,
        departments: setup.setup.departments.map((unit) => ({ ...unit, extra: {} })),
        positions: setup.setup.positions.map((unit) => ({ ...unit, extra: {} })),
      },
      setup.version,
    );
    const archived = await left.getEmployee(DEMO_EMPLOYEES[5].id);
    await left.archiveEmployee(archived.employee.id, archived.version);
    expect((await left.listDrivers()).map((one) => one.code)).toEqual(['EMP-0005']);
  });

  it('answer 403 to anyone who may not see or edit orders', async () => {
    const seeing = fake('', warehouse);
    const view = fake('', root);
    for (const answer of [
      seeing.listOrders(DEMO_TODAY, DEMO_TODAY),
      seeing.getOrder(order.day, order.id),
      seeing.listDeliveries(DEMO_TODAY),
      seeing.getDelivery(DEMO_TODAY, DEMO_DELIVERIES[0].id),
      seeing.createOrder(save),
      seeing.saveOrder(order.day, order.id, { ...save, version: 'o1' }),
      seeing.confirmOrder(order.day, order.id, {
        version: 'o1',
        driverId: driver.id,
        day: order.day,
      }),
      seeing.sendOrder(order.day, order.id, { version: 'o1', driverId: driver.id, day: order.day }),
      seeing.cancelOrder(order.day, order.id, { version: 'o1' }),
      seeing.cancelDelivery(DEMO_TODAY, DEMO_DELIVERIES[0].id, { version: 'g1' }),
      seeing.listDrivers(),
    ]) {
      expect(await status(answer)).toBe(403);
    }
    expect(await status(view.listDrivers())).toBe('answered');
  });

  it('Each save is priced by the fake as the BFF prices it; an order is numbered past every number given, and a customer or a product the lists lack is a 400', async () => {
    const api = fake('', office);

    const made = await api.createOrder(save);
    expect(made.order).toMatchObject({
      number: numberText('DH-', DEMO_ORDERS.length + 1),
      state: 'draft',
      day: order.day,
      total: DEMO_PRODUCTS[1].price * 2,
      request: null,
    });
    expect((await api.createOrder(save)).order.number).toBe(
      numberText('DH-', DEMO_ORDERS.length + 2),
    );
    expect(await status(api.createOrder({ ...save, customerId: 'nobody' }))).toBe(400);
    expect(
      await status(api.createOrder({ ...save, lines: [{ productId: 'nothing', quantity: 1 }] })),
    ).toBe(400);
    // the draft is saved again over its version; the day cannot move
    const again = await api.saveOrder(order.day, made.order.id, {
      ...save,
      lines: [{ productId: DEMO_PRODUCTS[2].id, quantity: 3 }],
      version: made.version,
    });
    expect(again).toMatchObject({ kind: 'done', doc: { version: 'o2' } });
    expect(
      again.kind === 'done' && again.doc.order.lines.map((one) => [one.code, one.amount]),
    ).toEqual([['VT-002', 960_000]]);
    expect(
      await status(
        api.saveOrder(order.day, made.order.id, {
          ...save,
          day: addDays(order.day, 1),
          version: 'o2',
        }),
      ),
    ).toBe(400);
  });

  it('A write over a moved version, or a step the state does not allow, is a conflict that carries the order as it is', async () => {
    const api = fake('', office);
    const confirmAs = { driverId: driver.id, day: DEMO_TODAY };

    const stale = await api.saveOrder(order.day, order.id, { ...save, version: 'o9' });
    expect(stale).toMatchObject({ kind: 'conflict', current: { order: { number: order.number } } });
    expect(
      await api.confirmOrder(order.day, order.id, { version: 'o9', ...confirmAs }),
    ).toMatchObject({ kind: 'conflict' });
    // a confirmed order is not saved again, nor confirmed again, nor sent while it has a live request
    expect(
      await api.saveOrder(sent.day, sent.id, { ...save, day: sent.day, version: 'o1' }),
    ).toMatchObject({ kind: 'conflict' });
    expect(
      await api.confirmOrder(sent.day, sent.id, { version: 'o1', ...confirmAs }),
    ).toMatchObject({ kind: 'conflict' });
    expect(await api.sendOrder(sent.day, sent.id, { version: 'o1', ...confirmAs })).toMatchObject({
      kind: 'conflict',
    });
    // a draft is not sent again
    expect(await api.sendOrder(order.day, order.id, { version: 'o1', ...confirmAs })).toMatchObject(
      { kind: 'conflict' },
    );
    // a cancelled order is not cancelled again
    const cancelled = DEMO_ORDERS.find((one) => one.state === 'cancelled')!;
    expect(await api.cancelOrder(cancelled.day, cancelled.id, { version: 'o1' })).toMatchObject({
      kind: 'conflict',
    });
    // a request is cancelled once
    const gone = DEMO_DELIVERIES.find((one) => one.state === 'cancelled')!;
    expect(await api.cancelDelivery(gone.day, gone.id, { version: 'g1' })).toMatchObject({
      kind: 'conflict',
    });
    expect(await api.cancelDelivery(gone.day, gone.id, { version: 'g7' })).toMatchObject({
      kind: 'conflict',
    });
  });

  it('Confirm needs a driver who is allowed to deliver and has not left, and a day on or after the order’s: anything else is a 400', async () => {
    const api = fake('', office);
    const read = await api.getOrder(order.day, order.id);

    for (const bad of [
      { driverId: DEMO_EMPLOYEES[0].id, day: DEMO_TODAY },
      { driverId: 'nobody', day: DEMO_TODAY },
      { driverId: driver.id, day: addDays(order.day, -1) },
    ]) {
      expect(
        await status(api.confirmOrder(order.day, order.id, { version: read.version, ...bad })),
      ).toBe(400);
    }
    const done = await api.confirmOrder(order.day, order.id, {
      version: read.version,
      driverId: driver.id,
      day: addDays(DEMO_TODAY, 1),
    });
    expect(done).toMatchObject({
      kind: 'done',
      doc: {
        order: {
          state: 'confirmed',
          request: {
            number: numberText('GH-', DEMO_DELIVERIES.length + 1),
            day: addDays(DEMO_TODAY, 1),
          },
        },
      },
    });
    const next = await api.listDeliveries(addDays(DEMO_TODAY, 1));
    const made = next.find((one) => one.order.id === order.id);
    expect(made).toMatchObject({
      state: 'waiting',
      total: order.total,
      order: { number: order.number },
    });
    expect(made?.customer).toEqual(order.customer);
  });

  it('Cancelling a request leaves its order confirmed with none; sending it again makes a new request with a new number; cancelling an order cancels its request', async () => {
    const api = fake('', office);
    const live = sent.request!;
    const request = await api.getDelivery(live.day, live.id);

    const cancelled = await api.cancelDelivery(live.day, live.id, { version: request.version });
    expect(cancelled).toMatchObject({ kind: 'done', doc: { request: { state: 'cancelled' } } });
    const orderNow = await api.getOrder(sent.day, sent.id);
    expect(orderNow.order).toMatchObject({ state: 'confirmed', request: null });
    const again = await api.sendOrder(sent.day, sent.id, {
      version: orderNow.version,
      driverId: driver.id,
      day: DEMO_TODAY,
    });
    expect(again).toMatchObject({
      kind: 'done',
      doc: { order: { request: { number: numberText('GH-', DEMO_DELIVERIES.length + 1) } } },
    });
    // the order cancelled takes its live request with it
    const sentAgain = again.kind === 'done' ? again.doc : null;
    const stopped = await api.cancelOrder(sent.day, sent.id, { version: sentAgain?.version ?? '' });
    expect(stopped).toMatchObject({
      kind: 'done',
      doc: { order: { state: 'cancelled', request: null } },
    });
    const all = await api.listDeliveries(DEMO_TODAY);
    expect(all.filter((one) => one.order.id === sent.id).map((one) => one.state)).toEqual([
      'cancelled',
      'cancelled',
    ]);
    // a cancelled order with no live request is cancelled the same way (the draft has none)
    expect(await api.cancelOrder(order.day, order.id, { version: 'o1' })).toMatchObject({
      kind: 'done',
    });
  });

  it('answer a cue’s 403, 409 or 503 once, the call then answering as the data set does', async () => {
    const calls: Record<string, (api: ReturnType<typeof fake>) => Promise<unknown>> = {
      listOrders: (api) => api.listOrders(DEMO_TODAY, DEMO_TODAY),
      getOrder: (api) => api.getOrder(order.day, order.id),
      createOrder: (api) => api.createOrder(save),
      saveOrder: (api) => api.saveOrder(order.day, order.id, { ...save, version: 'o1' }),
      confirmOrder: (api) =>
        api.confirmOrder(order.day, order.id, {
          version: 'o1',
          driverId: driver.id,
          day: DEMO_TODAY,
        }),
      sendOrder: (api) =>
        api.sendOrder(sent.day, sent.id, { version: 'o1', driverId: driver.id, day: DEMO_TODAY }),
      cancelOrder: (api) => api.cancelOrder(order.day, order.id, { version: 'o1' }),
      listDeliveries: (api) => api.listDeliveries(DEMO_TODAY),
      getDelivery: (api) =>
        api.getDelivery(DEMO_TODAY, DEMO_DELIVERIES.find((one) => one.day === DEMO_TODAY)!.id),
      cancelDelivery: (api) =>
        api.cancelDelivery(sent.request!.day, sent.request!.id, { version: 'g1' }),
      listDrivers: (api) => api.listDrivers(),
    };
    const conflicting = ['saveOrder', 'confirmOrder', 'sendOrder', 'cancelOrder', 'cancelDelivery'];

    for (const [name, call] of Object.entries(calls)) {
      for (const code of [403, 409, 503]) {
        const cued = fake(`${name}:${code}`, root);
        if (code === 409 && conflicting.includes(name)) {
          expect(await call(cued), `${name} ${code}`).toMatchObject({ kind: 'conflict' });
        } else {
          expect(await status(call(cued)), `${name} ${code}`).toBe(code);
        }
        expect(await status(call(cued)), `${name} again`).toBe('answered');
      }
    }
  });

  it('serves no one a driver while the data set’s drivers’ departments lack the right', async () => {
    const api = createFakeApi({
      device: { authId: () => 'fake.session', operatorAuthId: () => null },
      cue: null,
      noDrivers: true,
    });

    expect(await api.listDrivers()).toEqual([]);
  });

  it('?fake gives the pages the data set’s today, whatever day the page is opened on, and `no-drivers` takes the right away', async () => {
    const parts = fakeParts('?fake&no-drivers', memory());

    expect(parts?.today()).toBe(DEMO_TODAY);
    expect(await parts?.api.listDrivers()).toEqual([]);
  });
});

describe('the fake Api’s deliveries', () => {
  const as = (code: string) => ({
    client: `fake.session.${DEMO_EMPLOYEES.find((one) => one.code === code)!.id}`,
  });
  const tung = as('EMP-0005');
  const nam = as('EMP-0006');
  const todays = (code: string) =>
    DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY && one.driver.code === code);
  const waiting = todays('EMP-0005').find((one) => one.state === 'waiting')!;
  const photo = DEMO_WALK_PROOF;

  it('My deliveries lists the driver’s own requests of a day, those waiting first and then those delivered, each by number; the office’s cancelled one is not listed, and another driver’s never is', async () => {
    const api = fake('', tung);

    const mine = await api.myDeliveries(DEMO_TODAY);

    expect(mine.map((one) => [one.number, one.state])).toEqual([
      [waiting.number, 'waiting'],
      ...todays('EMP-0005')
        .filter((one) => one.state === 'delivered')
        .map((one) => [one.number, 'delivered']),
    ]);
    expect(mine.every((one) => one.driver.code === 'EMP-0005')).toBe(true);
    expect(mine.some((one) => one.state === 'cancelled')).toBe(false);
    expect((await fake('', nam).myDeliveries(DEMO_TODAY)).map((one) => one.driver.code)).toEqual([
      'EMP-0006',
      'EMP-0006',
    ]);
    expect(await api.myDeliveries(addDays(DEMO_TODAY, 9))).toEqual([]);
  });

  it('Only someone allowed to deliver, never the root, has deliveries: anyone else is a 403', async () => {
    const office = as('EMP-0001');
    const root = { client: 'fake.session' };
    for (const held of [root, office]) {
      const api = fake('', held);
      for (const answer of [
        api.myDeliveries(DEMO_TODAY),
        api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo }),
      ]) {
        expect(await status(answer)).toBe(403);
      }
    }
  });

  it('Delivered is the whole request, once, by its own driver only: another driver, the office and the root are refused, and a photo the shared schema refuses is a 400', async () => {
    const api = fake('', tung);

    expect(
      await status(fake('', nam).deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo })),
    ).toBe(403);
    expect(await status(api.deliver(DEMO_TODAY, 'nope', { version: 'g1', photo }))).toBe(404);
    expect(
      await status(api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo: 'not a photo' })),
    ).toBe(400);
    expect((await api.getDelivery(DEMO_TODAY, waiting.id)).request.state).toBe('waiting');

    const done = await api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo });
    expect(done).toMatchObject({ kind: 'done', doc: { request: { state: 'delivered' } } });
    expect(done.kind === 'done' && typeof done.doc.request.deliveredAt).toBe('number');
    // a second send finds it delivered: a conflict carrying it as it is, nothing written over
    expect(await api.deliver(DEMO_TODAY, waiting.id, { version: 'g2', photo })).toMatchObject({
      kind: 'conflict',
      current: { request: { state: 'delivered' } },
    });
  });

  it('A send over a version that moved is a conflict that carries the request as it is, and nothing is delivered', async () => {
    const api = fake('', tung);

    expect(await api.deliver(DEMO_TODAY, waiting.id, { version: 'g9', photo })).toMatchObject({
      kind: 'conflict',
      current: { request: { id: waiting.id, state: 'waiting' } },
    });
    expect((await api.getDelivery(DEMO_TODAY, waiting.id)).request.state).toBe('waiting');
  });

  it('The order is fulfilled when its request is delivered, and a delivered request and its order are not changed, sent again or cancelled after', async () => {
    // one fake whose person changes: the driver delivers, then the office reads and tries to change
    let held = tung.client;
    const api = createFakeApi({
      device: { authId: () => held, operatorAuthId: () => null },
      cue: null,
    });
    const order = DEMO_ORDERS.find((one) => one.id === waiting.order.id)!;
    const read = await api.getDelivery(DEMO_TODAY, waiting.id);

    await api.deliver(DEMO_TODAY, waiting.id, { version: read.version, photo });

    held = as('EMP-0001').client;
    const fulfilled = await api.getOrder(order.day, order.id);
    expect(fulfilled.order).toMatchObject({ state: 'fulfilled', request: { id: waiting.id } });
    expect(
      await api.cancelOrder(order.day, order.id, { version: fulfilled.version }),
    ).toMatchObject({ kind: 'conflict', current: { order: { state: 'fulfilled' } } });
    expect(
      await api.cancelDelivery(DEMO_TODAY, waiting.id, {
        version: (await api.getDelivery(DEMO_TODAY, waiting.id)).version,
      }),
    ).toMatchObject({ kind: 'conflict', current: { request: { state: 'delivered' } } });
    expect(
      await api.sendOrder(order.day, order.id, {
        version: fulfilled.version,
        driverId: waiting.driver.id,
        day: DEMO_TODAY,
      }),
    ).toMatchObject({ kind: 'conflict' });
    // the office cannot mark it, whatever it sends
    expect(await status(api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo }))).toBe(403);
  });

  it('A delivery’s photo is read by those who may see orders and by its own driver, by no one else; the photo of a request not delivered is a 404', async () => {
    const delivered = DEMO_DELIVERIES.find(
      (one) => one.state === 'delivered' && one.driver.code === 'EMP-0005',
    )!;

    for (const held of [as('EMP-0001'), tung, { client: 'fake.session' }]) {
      expect(await fake('', held).getDeliveryPhoto(delivered.day, delivered.id)).toEqual({
        photo: DEMO_DELIVERY_PHOTOS[delivered.id],
      });
    }
    for (const held of [nam, as('EMP-0004')]) {
      expect(await status(fake('', held).getDeliveryPhoto(delivered.day, delivered.id))).toBe(403);
      expect(await status(fake('', held).getDelivery(delivered.day, delivered.id))).toBe(403);
    }
    expect(await fake('', tung).getDelivery(delivered.day, delivered.id)).toMatchObject({
      request: { id: delivered.id },
    });
    expect(await status(fake('', tung).getDeliveryPhoto(DEMO_TODAY, waiting.id))).toBe(404);
    // a photo sent is read back as sent
    const api = fake('', tung);
    await api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo });
    expect(await api.getDeliveryPhoto(DEMO_TODAY, waiting.id)).toEqual({ photo });
  });

  it('answer a cue’s 403, 409 or 503 once; `deliver:409` has the office cancel the request first, so the driver meets it cancelled', async () => {
    const calls: Record<string, (api: ReturnType<typeof fake>) => Promise<unknown>> = {
      myDeliveries: (api) => api.myDeliveries(DEMO_TODAY),
      getDeliveryPhoto: (api) =>
        api.getDeliveryPhoto(
          DEMO_TODAY,
          DEMO_DELIVERIES.find((one) => one.day === DEMO_TODAY && one.state === 'delivered')!.id,
        ),
    };
    for (const [name, call] of Object.entries(calls)) {
      for (const code of [403, 503]) {
        const cued = fake(`${name}:${code}`, tung);
        expect(await status(call(cued)), `${name} ${code}`).toBe(code);
        expect(await status(call(cued)), `${name} again`).toBe('answered');
      }
    }
    expect(
      await status(
        fake('deliver:503', tung).deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo }),
      ),
    ).toBe(503);
    expect(
      await status(
        fake('deliver:403', tung).deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo }),
      ),
    ).toBe(403);

    const api = fake('deliver:409', tung);
    const answer = await api.deliver(DEMO_TODAY, waiting.id, { version: 'g1', photo });
    expect(answer).toMatchObject({
      kind: 'conflict',
      current: { request: { state: 'cancelled' } },
    });
    // the driver's list no longer holds it
    expect((await api.myDeliveries(DEMO_TODAY)).some((one) => one.id === waiting.id)).toBe(false);
    expect((await api.getDelivery(DEMO_TODAY, waiting.id)).request.state).toBe('cancelled');
  });

  it('The data set holds a QR code for the driver, which signs them in once', async () => {
    const api = fake('', { client: 'fake.session' }, true);
    const tungPerson = DEMO_EMPLOYEES.find((one) => one.code === 'EMP-0005')!;

    expect((await api.signInQr(tungPerson.id, DEMO_DRIVER_QR_SECRET)).user.name).toBe(
      tungPerson.name,
    );
    expect(await status(api.signInQr(tungPerson.id, DEMO_DRIVER_QR_SECRET))).toBe(401);
  });
});

describe('the fake Api’s days settled', () => {
  const as = (code: string) => ({
    client: `fake.session.${DEMO_EMPLOYEES.find((one) => one.code === code)!.id}`,
  });
  const office = as('EMP-0001');
  const tung = DEMO_EMPLOYEES.find((one) => one.code === 'EMP-0005')!;
  const nam = DEMO_EMPLOYEES.find((one) => one.code === 'EMP-0006')!;
  const YESTERDAY = addDays(DEMO_TODAY, -1);
  /** The close a page makes of a driver's day as the fake now holds it. */
  const askFor = async (api: ReturnType<typeof fake>, driverId: string, handedIn: number) =>
    closeRequestFor(driverDay(await api.listDeliveries(DEMO_TODAY), driverId), handedIn);

  it('The fake’s two calls answer as the BFF does: a day’s closed days by driver code, and a close that cancels what waits, frees its orders, and writes the closed day once, as the person or the root who closed it', async () => {
    const api = fake('', office);

    const past = await api.listReconciliations(YESTERDAY);
    expect(past.map((one) => [one.driver.code, one.difference])).toEqual([['EMP-0006', -20_000]]);
    expect(await api.listReconciliations(DEMO_TODAY)).toEqual([]);
    // two drivers closed on one day come in code order
    expect(
      (await api.listReconciliations(addDays(DEMO_TODAY, -6))).map((one) => one.driver.code),
    ).toEqual(['EMP-0005', 'EMP-0006']);
    const waiting = (await api.listDeliveries(DEMO_TODAY)).find(
      (one) => one.driver.id === tung.id && one.state === 'waiting',
    )!;

    const closed = await api.closeDay(DEMO_TODAY, tung.id, await askFor(api, tung.id, 47_380_000));

    expect(closed).toMatchObject({
      kind: 'closed',
      reconciliation: {
        day: DEMO_TODAY,
        toCollect: 47_400_000,
        handedIn: 47_380_000,
        difference: -20_000,
        closedBy: { code: 'EMP-0001' },
      },
    });
    // the request that waited is cancelled over its tag, its order freed to be sent again
    expect((await api.getDelivery(DEMO_TODAY, waiting.id)).request.state).toBe('cancelled');
    expect((await api.getOrder(waiting.order.day, waiting.order.id)).order.request).toBeNull();
    expect((await api.listReconciliations(DEMO_TODAY)).map((one) => one.driver.code)).toEqual([
      'EMP-0005',
    ]);
    // closed once: a second close, or the same set again, closes nothing
    expect(await api.closeDay(DEMO_TODAY, tung.id, await askFor(api, tung.id, 47_400_000))).toEqual(
      {
        kind: 'moved',
      },
    );
    // the root closes without a person: its sign-in name stands in
    const root = fake('', { client: 'fake.session' });
    const byRoot = await root.closeDay(DEMO_TODAY, nam.id, await askFor(root, nam.id, 0));
    expect(byRoot).toMatchObject({
      kind: 'closed',
      reconciliation: { closedBy: { id: null, code: null, name: DEMO_ROOT_NAME }, toCollect: 0 },
    });
  });

  it('Anyone who may not see orders is refused the list, and anyone who may not edit them the close; a driver with no request that day is a 404, and cash that is no whole đồng a 400', async () => {
    const request = { delivered: [], waiting: [], handedIn: 0 };
    const warehouse = fake('', as('EMP-0004'));

    expect(await status(warehouse.listReconciliations(DEMO_TODAY))).toBe(403);
    expect(await status(warehouse.closeDay(DEMO_TODAY, tung.id, request))).toBe(403);
    const api = fake('', office);
    expect(await status(api.closeDay(DEMO_TODAY, DEMO_EMPLOYEES[0].id, request))).toBe(404);
    expect(await status(api.closeDay(addDays(DEMO_TODAY, 1), tung.id, request))).toBe(404);
    for (const handedIn of [-1, 0.5, TOTAL_MAX + 1]) {
      expect(await status(api.closeDay(DEMO_TODAY, tung.id, { ...request, handedIn }))).toBe(400);
    }
  });

  it('A close that names another set of requests than the day holds closes nothing and cancels nothing', async () => {
    const api = fake('', office);
    const ask = await askFor(api, tung.id, 5);

    for (const wrong of [
      { ...ask, delivered: [] },
      { ...ask, waiting: [] },
      { ...ask, waiting: [...ask.waiting, ask.delivered[0]] },
    ]) {
      expect(await api.closeDay(DEMO_TODAY, tung.id, wrong)).toEqual({ kind: 'moved' });
    }
    expect(await api.listReconciliations(DEMO_TODAY)).toEqual([]);
    expect(
      (await api.listDeliveries(DEMO_TODAY)).filter(
        (one) => one.driver.id === tung.id && one.state === 'waiting',
      ),
    ).toHaveLength(1);
  });

  it('A day past the most a day can hold cannot be closed: a 400, and nothing is cancelled', async () => {
    let who = office.client;
    const api = createFakeApi({
      device: { authId: () => who, operatorAuthId: () => null },
      cue: null,
    });
    const products = await api.listProducts();
    const customer = (await api.listCustomers())[0];
    const lines = products.map((one) => ({ productId: one.id, quantity: 100_000 }));
    // the most an order of the data set's products comes to, delivered over and over
    for (let count = 0; count < 500; count += 1) {
      who = office.client;
      const made = await api.createOrder({
        day: DEMO_TODAY,
        customerId: customer.id,
        lines,
        extra: {},
      });
      const sent = await api.confirmOrder(DEMO_TODAY, made.order.id, {
        version: made.version,
        driverId: nam.id,
        day: DEMO_TODAY,
      });
      const request = sent.kind === 'done' ? sent.doc.order.request! : null;
      who = as('EMP-0006').client;
      await api.deliver(DEMO_TODAY, request!.id, { version: 'g1', photo: DEMO_WALK_PROOF });
    }
    who = office.client;

    expect(await status(api.closeDay(DEMO_TODAY, nam.id, await askFor(api, nam.id, 0)))).toBe(400);
    // the two waiting requests it had are delivered or still waiting, but none cancelled by the refusal
    expect(await api.listReconciliations(DEMO_TODAY)).toEqual([]);
  });

  it('A driver whose day is closed is sent nothing more for it, and the driver’s phone no longer lists the requests the close cancelled', async () => {
    let who = office.client;
    const api = createFakeApi({
      device: { authId: () => who, operatorAuthId: () => null },
      cue: null,
    });
    const draft = DEMO_ORDERS.find((one) => one.state === 'draft' && one.day === DEMO_TODAY)!;
    const send = { version: 'o1', driverId: tung.id, day: DEMO_TODAY };
    who = as('EMP-0005').client;
    expect((await api.myDeliveries(DEMO_TODAY)).map((one) => one.state)).toEqual([
      'waiting',
      'delivered',
    ]);
    who = office.client;
    await api.closeDay(DEMO_TODAY, tung.id, await askFor(api, tung.id, 47_400_000));

    // confirm refuses the closed driver and day, and still sends another day
    expect(await status(api.confirmOrder(draft.day, draft.id, send))).toBe(400);
    expect(
      await status(api.confirmOrder(draft.day, draft.id, { ...send, day: addDays(DEMO_TODAY, 1) })),
    ).toBe('answered');
    who = as('EMP-0005').client;
    expect((await api.myDeliveries(DEMO_TODAY)).map((one) => one.state)).toEqual(['delivered']);
  });

  it('The fake’s two calls answer a cue’s 403, 409 or 503 once, and `closeDay:409` has the driver deliver the waiting request first, as the full run does', async () => {
    for (const code of [403, 503]) {
      for (const name of ['listReconciliations', 'closeDay']) {
        const cued = fake(`${name}:${code}`, office);
        const call = async () =>
          name === 'closeDay'
            ? await cued.closeDay(DEMO_TODAY, tung.id, await askFor(cued, tung.id, 5))
            : await cued.listReconciliations(DEMO_TODAY);
        expect(await status(call()), `${name} ${code}`).toBe(code);
        expect(await status(call()), `${name} again`).toBe('answered');
      }
    }
    const api = fake('closeDay:409', office);
    const ask = await askFor(api, tung.id, 5);

    expect(await api.closeDay(DEMO_TODAY, tung.id, ask)).toEqual({ kind: 'moved' });
    // nothing is closed, the waiting request is delivered, its order fulfilled and its photo held
    expect(await api.listReconciliations(DEMO_TODAY)).toEqual([]);
    const now = driverDay(await api.listDeliveries(DEMO_TODAY), tung.id);
    expect(now.waiting).toEqual([]);
    expect(now.delivered).toHaveLength(2);
    expect((await api.getDeliveryPhoto(DEMO_TODAY, ask.waiting[0])).photo).toBe(DEMO_WALK_PROOF);
    const freed = now.delivered.find((one) => one.id === ask.waiting[0])!;
    expect((await api.getOrder(freed.order.day, freed.order.id)).order.state).toBe('fulfilled');
    // the cue came once: the same close, over the new set, goes through
    expect((await api.closeDay(DEMO_TODAY, tung.id, closeRequestFor(now, 51_180_000))).kind).toBe(
      'closed',
    );
  });
});
