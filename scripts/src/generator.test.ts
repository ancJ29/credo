import { createHash } from 'node:crypto';
import { buildApp } from '@credo/bff';
import { joinByLink } from '@credo/bff/tests/join';
import {
  addDays,
  clientLinkPath,
  CStorageError,
  clientListReplySchema,
  type CStorageClient,
  recordKeys,
  storedClientSchema,
  storedAccountSchema,
  storedLinkSchema,
  storedRosterSchema,
  sha256Hex,
  storedUserSchema,
  type DeliveryRequest,
  type Employee,
  type Order,
  type Reconciliation,
  type StaffSetupDoc,
  tenantConfigSchema,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_OPERATOR_ID,
  DEMO_PASSKEYS,
  DEMO_ORDERS,
  DEMO_PHOTOS,
  DEMO_PRODUCTS,
  DEMO_RECONCILIATIONS,
  DEMO_ROOT_NAME,
  DEMO_STAFF_SETUP,
  DEMO_TODAY,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { ROOT_NAME, seedClient, seedDemo } from './generator';

/** A c-storage service in memory: records, each with a tag of c-storage's form that changes at every
 * write, and a write over a tag that moved refused. */
function memoryStorage() {
  const records = new Map<string, unknown>();
  const tags = new Map<string, string>();
  let writes = 0;
  const storage: CStorageClient = {
    getRecord: (key) =>
      Promise.resolve(
        records.has(key) ? { data: records.get(key), tag: tags.get(key) as string } : null,
      ),
    listRecords: (prefix) =>
      Promise.resolve({
        records: [...records]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, data]) => ({ key, data, tag: tags.get(key) as string })),
        more: false,
      }),
    putRecord: (key, data, ifTag) => {
      if (ifTag === null ? records.has(key) : tags.get(key) !== ifTag) {
        return Promise.resolve('moved');
      }
      records.set(key, data);
      tags.set(key, createHash('sha256').update(String(writes++)).digest('hex'));
      return Promise.resolve('saved');
    },
    removeRecord: (key) => {
      records.delete(key);
      tags.delete(key);
      return Promise.resolve('removed');
    },
    health: () => Promise.resolve({ buildVersion: 'dev' }),
  };
  return { records, storage };
}

const ORIGIN = 'http://localhost:3181';
/** The app on the generator's storage, as a stack's BFF is, with the address the operator opens. */
const appOn = (storage: CStorageClient) =>
  buildApp({ storage, now: () => Date.now(), origin: ORIGIN, serviceKey: 'a-key', logger: false });

describe('the demo generator', () => {
  it('The demo client is made by the operator’s create, its root signs in through the BFF, and the invited operator joins by the link', async () => {
    const { records, storage } = memoryStorage();

    const { rootPassword, invitedToken } = await seedDemo(storage);

    const index = storedClientSchema.parse(records.get(recordKeys.client(DEMO_CODE)));
    const keys = recordKeys.tenant(index.id);
    expect(storedUserSchema.parse(records.get(keys.user(ROOT_NAME))).root).toBe(true);
    expect(tenantConfigSchema.parse(records.get(keys.config))).toEqual(DEMO_CONFIG);
    const app = appOn(storage);
    const root = (password: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        headers: { 'x-device-id': 'device-aaaa-0001', 'x-client-code': DEMO_CODE },
        payload: { name: ROOT_NAME, password },
      });
    expect((await root(rootPassword)).json()).toMatchObject({ user: { root: true } });
    expect((await root('not the password')).statusCode).toBe(401);
    const joined = await joinByLink(app, invitedToken, ORIGIN);
    expect(joined.session.operator.name).toBe(DEMO_INVITED_NAME);
  });

  it('The demo client holds the data set’s customers and products, each under a minted id, with the stocked flag as the data set has it', async () => {
    const { records, storage } = memoryStorage();
    await seedDemo(storage);

    const index = storedClientSchema.parse(records.get(recordKeys.client(DEMO_CODE)));
    const keys = recordKeys.tenant(index.id);
    const customers = (await storage.listRecords(keys.customerPrefix)).records.map(
      (one) => one.data,
    );
    const products = (await storage.listRecords(keys.productPrefix)).records.map((one) => one.data);

    const withoutId = ({ id: _id, ...row }: { id: string }) => row;
    const byCode = (a: object, b: object) =>
      (a as { code: string }).code < (b as { code: string }).code ? -1 : 1;
    expect(customers.map((one) => withoutId(one as { id: string })).sort(byCode)).toEqual(
      DEMO_CUSTOMERS.map(withoutId).sort(byCode),
    );
    expect(products.map((one) => withoutId(one as { id: string })).sort(byCode)).toEqual(
      DEMO_PRODUCTS.map(withoutId).sort(byCode),
    );
    expect(DEMO_PRODUCTS.some((one) => !one.stocked)).toBe(true);
    expect(products.some((one) => (one as { stocked: boolean }).stocked === false)).toBe(true);
  });

  it('stops the run when a list’s import does not add every row', async () => {
    const { storage } = memoryStorage();
    const down: CStorageClient = {
      ...storage,
      putRecord: (key, data, ifTag) =>
        key.includes('.product.')
          ? Promise.reject(new CStorageError(503, 'down'))
          : storage.putRecord(key, data, ifTag),
    };

    await expect(seedDemo(down)).rejects.toThrow('products import did not add every row');
  });

  it('The operators are the data set’s: the active one with its two passkeys at their fixed times, the invited one with a link the first made, and nothing readable stored: hashes alone', async () => {
    const { records, storage } = memoryStorage();

    const { rootPassword, invitedToken, operatorHandle } = await seedDemo(storage);

    const all = JSON.stringify([...records]);
    expect(all).not.toContain(rootPassword);
    expect(all).not.toContain(invitedToken);
    expect(all).not.toContain(operatorHandle.split('.')[1]);
    const roster = storedRosterSchema.parse(records.get(recordKeys.operatorRoster));
    expect(roster.operators).toEqual([
      expect.objectContaining({
        id: DEMO_OPERATOR_ID,
        name: OPERATOR_NAME,
        state: 'active',
        addedBy: null,
      }),
      expect.objectContaining({
        name: DEMO_INVITED_NAME,
        state: 'invited',
        addedBy: DEMO_OPERATOR_ID,
      }),
    ]);
    const held = storedAccountSchema.parse(
      records.get(recordKeys.operatorAccount(DEMO_OPERATOR_ID)),
    );
    expect(held.linkHash).toBeNull();
    expect(
      held.passkeys.map(({ id, addedAt, lastUsedAt }) => ({ id, addedAt, lastUsedAt })),
    ).toEqual(DEMO_PASSKEYS);
    for (const { publicKey } of held.passkeys) {
      const key = Buffer.from(publicKey, 'base64url');
      expect([key.length, key[0]]).toEqual([77, 0xa5]);
    }
    const invited = storedAccountSchema.parse(
      records.get(recordKeys.operatorAccount(roster.operators[1].id)),
    );
    expect(invited.passkeys).toEqual([]);
    const hash = await sha256Hex(invitedToken);
    expect(invited.linkHash).toBe(hash);
    expect(storedLinkSchema.parse(records.get(recordKeys.operatorLink(hash)))).toMatchObject({
      operatorId: roster.operators[1].id,
      madeBy: DEMO_OPERATOR_ID,
    });
  });

  it('The active operator is signed in by the handle the seed gives, and its passkeys read through the BFF as the fake’s do', async () => {
    const { storage } = memoryStorage();
    const { operatorHandle } = await seedDemo(storage);
    const app = appOn(storage);
    const headers = { 'x-auth-id': operatorHandle };

    const me = await app.inject({ method: 'GET', url: '/api/operator/me', headers });
    const listed = await app.inject({ method: 'GET', url: '/api/operator/passkeys', headers });

    expect(me.json()).toEqual({ operator: { id: DEMO_OPERATOR_ID, name: OPERATOR_NAME } });
    expect(listed.json()).toEqual({
      passkeys: DEMO_PASSKEYS.map(({ id, addedAt, lastUsedAt }) => ({ id, addedAt, lastUsedAt })),
    });
  });

  it('The data set names the root as the BFF does, so the fake’s sign-in is the real one’s', () => {
    expect(DEMO_ROOT_NAME).toBe(ROOT_NAME);
  });

  it('makes a link of its own for each stack', async () => {
    const [one, two] = [
      await seedDemo(memoryStorage().storage),
      await seedDemo(memoryStorage().storage),
    ];

    expect(one.invitedToken).not.toBe(two.invitedToken);
    expect(one.invitedToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never seeds over a service that holds data, the operator’s or the demo client’s', async () => {
    const { records, storage } = memoryStorage();
    await seedDemo(storage);
    await expect(seedDemo(storage)).rejects.toThrow('not seeded over');

    // the operator's line gone, the operator's account still there
    records.delete(recordKeys.operatorRoster);
    await expect(seedDemo(storage)).rejects.toThrow('not seeded over');

    // the operator's account gone too, the demo client still there
    records.delete(recordKeys.operatorRoster);
    records.delete(recordKeys.operatorAccount(DEMO_OPERATOR_ID));
    await expect(seedDemo(storage)).rejects.toThrow('not seeded over');

    // the demo client gone too, one of the data set's other clients still there
    records.delete(recordKeys.operatorRoster);
    records.delete(recordKeys.operatorAccount(DEMO_OPERATOR_ID));
    records.delete(recordKeys.client(DEMO_CODE));
    await expect(seedDemo(storage)).rejects.toThrow('not seeded over');
  });

  it('The stack’s operator lists the data set’s three clients with their fixed days, the demo company’s name as made, and newest first', async () => {
    const { storage } = memoryStorage();
    const { invitedToken } = await seedDemo(storage);
    const app = appOn(storage);
    const { session } = await joinByLink(app, invitedToken, ORIGIN);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/operator/clients',
      headers: { 'x-auth-id': session.authId },
    });

    expect(clientListReplySchema.parse(listed.json()).clients).toEqual(
      [...DEMO_CLIENTS]
        .sort((a, b) => b.madeAt - a.madeAt)
        .map((client) => ({ ...client, link: clientLinkPath(client.code) })),
    );
  });

  it('A client made through the stack’s seed door is made now, and one given a time is made then', async () => {
    const { records, storage } = memoryStorage();
    const before = Date.now();
    await seedClient(storage, 'walk-1');
    await seedClient(storage, 'walk-2', 42);

    expect(
      storedClientSchema.parse(records.get(recordKeys.client('walk-1'))).madeAt,
    ).toBeGreaterThanOrEqual(before);
    expect(storedClientSchema.parse(records.get(recordKeys.client('walk-2'))).madeAt).toBe(42);
  });

  describe('one data set for the fake and the stack', () => {
    /** A call to the BFF over this storage, as the person holding `authId` (the root's when none). */
    function bff(storage: CStorageClient, code: string) {
      const app = appOn(storage);
      const call = (
        method: 'GET' | 'POST',
        url: string,
        authId?: string,
        payload?: Record<string, unknown>,
      ) =>
        app.inject({
          method,
          url,
          headers: {
            'x-client-code': code,
            'x-device-id': 'device-aaaa-0001',
            ...(authId ? { 'x-auth-id': authId } : {}),
          },
          payload,
        });
      const signIn = async (name: string, password: string) => {
        const reply = await call('POST', '/api/auth/sign-in', undefined, { name, password });
        return reply.statusCode === 200 ? reply.json<{ authId: string }>().authId : null;
      };
      return { call, signIn };
    }

    it('The staff the BFF lists are the data set’s people, in the units its setup names, with what each holds', async () => {
      const { storage } = memoryStorage();
      const { code, rootPassword } = await seedClient(storage, 'walk-1');
      const { call, signIn } = bff(storage, code);
      const root = (await signIn(ROOT_NAME, rootPassword))!;

      const listed = (await call('GET', '/api/employees', root)).json<{ employees: Employee[] }>();
      const setup = (await call('GET', '/api/staff-setup', root)).json<StaffSetupDoc>().setup;

      const nameless = ({ id: _id, ...unit }: { id: string }) => unit;
      expect(setup.departments.map(nameless)).toEqual(DEMO_STAFF_SETUP.departments.map(nameless));
      expect(setup.positions.map(nameless)).toEqual(DEMO_STAFF_SETUP.positions.map(nameless));
      // The field switches, the company's own fields and the numbering are the data set's too.
      expect(setup.fields).toEqual(DEMO_STAFF_SETUP.fields);
      expect(setup.customFields).toEqual(DEMO_STAFF_SETUP.customFields);
      expect(setup.numbering).toEqual(DEMO_STAFF_SETUP.numbering);
      const link = (unit: { name: string } | null) => unit?.name ?? null;
      const shape = (person: Employee) => ({
        code: person.code,
        name: person.name,
        department: link(person.department),
        position: link(person.position),
        permissions: person.permissions,
        archived: person.archived,
        extra: person.extra,
      });
      expect(listed.employees.map(shape)).toEqual(
        [...DEMO_EMPLOYEES].sort((a, b) => (a.code < b.code ? -1 : 1)).map(shape),
      );
      // A person's unit is the one the setup now holds under its minted id.
      for (const person of listed.employees) {
        const held = setup.departments.find((unit) => unit.id === person.department?.id);
        expect(held?.name ?? null, person.code).toBe(link(person.department));
      }
    });

    it('The week of orders and requests the BFF lists is the data set’s, with its numbers, days, states, drivers and times', async () => {
      const { storage } = memoryStorage();
      const { code, rootPassword } = await seedClient(storage, 'walk-1');
      const { call, signIn } = bff(storage, code);
      const root = (await signIn(ROOT_NAME, rootPassword))!;

      const orders = (
        await call('GET', `/api/orders?from=${addDays(DEMO_TODAY, -6)}&to=${DEMO_TODAY}`, root)
      ).json<{ orders: Order[] }>().orders;
      const requests: DeliveryRequest[] = [];
      for (let back = 6; back >= -1; back--) {
        const day = addDays(DEMO_TODAY, -back);
        requests.push(
          ...(await call('GET', `/api/deliveries?day=${day}`, root)).json<{
            deliveries: DeliveryRequest[];
          }>().deliveries,
        );
      }

      const orderShape = (order: Order) => ({
        number: order.number,
        day: order.day,
        state: order.state,
        customer: order.customer.code,
        lines: order.lines.map((line) => [line.code, line.quantity, line.amount]),
        total: order.total,
        request: order.request && [
          order.request.number,
          order.request.day,
          order.request.driver.code,
        ],
        madeAt: order.madeAt,
      });
      const requestShape = (request: DeliveryRequest) => ({
        number: request.number,
        day: request.day,
        state: request.state,
        driver: request.driver.code,
        order: request.order.number,
        total: request.total,
        madeAt: request.madeAt,
        deliveredAt: request.deliveredAt,
      });
      const byNumber = <T extends { number: string }>(a: T, b: T) =>
        a.number.localeCompare(b.number);
      expect(orders.map(orderShape).sort(byNumber)).toEqual(
        DEMO_ORDERS.map(orderShape).sort(byNumber),
      );
      expect(requests.map(requestShape).sort(byNumber)).toEqual(
        DEMO_DELIVERIES.map(requestShape).sort(byNumber),
      );
      // each delivered request holds its drawn photo, read back through the route
      for (const request of requests.filter((one) => one.state === 'delivered')) {
        const mine = DEMO_DELIVERIES.find((one) => one.number === request.number)!;
        const photo = (
          await call('GET', `/api/deliveries/${request.day}/${request.id}/photo`, root)
        ).json<{ photo: string }>().photo;
        expect(photo, request.number).toBe(DEMO_DELIVERY_PHOTOS[mine.id]);
      }
    });

    it('The data set’s past days are closed through the route, as EMP-0001 at the time the data set gives, with its cash and its requests, and today’s are open', async () => {
      const { storage } = memoryStorage();
      const { code, rootPassword } = await seedClient(storage, 'walk-1');
      const { call, signIn } = bff(storage, code);
      const root = (await signIn(ROOT_NAME, rootPassword))!;
      const closed: Reconciliation[] = [];
      for (let back = 6; back >= 0; back--) {
        const day = addDays(DEMO_TODAY, -back);
        closed.push(
          ...(await call('GET', `/api/reconciliations?day=${day}`, root)).json<{
            reconciliations: Reconciliation[];
          }>().reconciliations,
        );
      }
      const shape = (one: Reconciliation) => ({
        day: one.day,
        driver: one.driver.code,
        requests: one.requests.map((request) => [request.number, request.total]),
        toCollect: one.toCollect,
        handedIn: one.handedIn,
        difference: one.difference,
        closedBy: one.closedBy.code,
        closedAt: one.closedAt,
      });

      expect(closed.map(shape)).toEqual(DEMO_RECONCILIATIONS.map(shape));
      expect(closed.some((one) => one.day === DEMO_TODAY)).toBe(false);
    });

    it('Each photo the data set holds is on its person, and no one else has one', async () => {
      const { storage } = memoryStorage();
      const { code, rootPassword } = await seedClient(storage, 'walk-1');
      const { call, signIn } = bff(storage, code);
      const root = (await signIn(ROOT_NAME, rootPassword))!;
      const listed = (await call('GET', '/api/employees', root)).json<{ employees: Employee[] }>();

      const photoOf = async (person: Employee) =>
        (await call('GET', `/api/employees/${person.id}/photo`, root)).json<{
          photo: string | null;
        }>().photo;
      const held = Object.fromEntries(
        await Promise.all(
          listed.employees.map(async (person): Promise<[string, string | null]> => [
            person.code,
            await photoOf(person),
          ]),
        ),
      );

      const expected = Object.fromEntries(
        DEMO_EMPLOYEES.map((person) => [person.code, DEMO_PHOTOS[person.id] ?? null]),
      );
      expect(Object.values(expected).filter((photo) => photo !== null)).toHaveLength(
        Object.keys(DEMO_PHOTOS).length,
      );
      expect(held).toEqual(expected);
    });

    it('Each data-set person signs in with the first password the generator returns, except the one the data set gives no sign-in', async () => {
      const { storage } = memoryStorage();
      const { code, people } = await seedClient(storage, 'walk-1');
      const { call, signIn } = bff(storage, code);

      const withSignIn = DEMO_EMPLOYEES.filter((person) => person.code !== 'EMP-0007');
      expect(Object.keys(people).sort()).toEqual(withSignIn.map((person) => person.code).sort());
      for (const person of withSignIn.filter((p) => !p.archived)) {
        expect(await signIn(person.code, people[person.code]), person.code).not.toBeNull();
        expect(await signIn(person.code, 'not the password'), person.code).toBeNull();
      }
      expect(await signIn('EMP-0008', people['EMP-0008'])).toBeNull();
      expect(await signIn('EMP-0007', 'any password at all')).toBeNull();
      // What the data set gives the office person is what the BFF resolves for them.
      const office = (await signIn('EMP-0001', people['EMP-0001']))!;
      const me = (await call('GET', '/api/auth/me', office)).json<{
        user: { permissions: Record<string, boolean> };
      }>();
      expect(me.user.permissions).toMatchObject({
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'staff.canDelete': true,
      });
      const driver = (await signIn('EMP-0005', people['EMP-0005']))!;
      expect((await call('GET', '/api/employees', driver)).statusCode).toBe(403);
    });

    it('Each full run starts on a client of its own: a second client holds the data set afresh, whatever the first was changed to, and a code taken is refused', async () => {
      const { storage } = memoryStorage();
      const first = await seedClient(storage, 'walk-1');
      const one = bff(storage, 'walk-1');
      const root = (await one.signIn(ROOT_NAME, first.rootPassword))!;
      await one.call('POST', '/api/employees', root, {
        name: 'Mai Linh',
        code: 'EMP-0100',
        extra: {},
      });

      const second = await seedClient(storage, 'walk-2');
      const two = bff(storage, 'walk-2');
      const other = (await two.signIn(ROOT_NAME, second.rootPassword))!;

      const count = async (b: ReturnType<typeof bff>, authId: string) =>
        (await b.call('GET', '/api/employees', authId)).json<{ employees: unknown[] }>().employees
          .length;
      expect(await count(one, root)).toBe(DEMO_EMPLOYEES.length + 1);
      expect(await count(two, other)).toBe(DEMO_EMPLOYEES.length);
      expect(second.rootPassword).not.toBe(first.rootPassword);
      await expect(seedClient(storage, 'walk-1')).rejects.toThrow('not seeded over');
    });

    it('A data set the BFF would refuse stops the run, saying which call', async () => {
      const { storage } = memoryStorage();
      const refusing: CStorageClient = {
        ...storage,
        putRecord: (key, data, ifTag) =>
          key.endsWith('.staff-setup')
            ? Promise.resolve('moved')
            : storage.putRecord(key, data, ifTag),
      };

      await expect(seedClient(refusing, 'walk-1')).rejects.toThrow(
        /PUT \/api\/staff-setup answered 409/,
      );
    });
  });
});
