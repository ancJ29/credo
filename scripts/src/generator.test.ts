import { createHash } from 'node:crypto';
import { verifyPassword } from '@credo/bff/password';
import { buildApp } from '@credo/bff';
import {
  clientLinkPath,
  CStorageError,
  clientListReplySchema,
  type CStorageClient,
  recordKeys,
  storedClientSchema,
  storedOperatorSchema,
  storedUserSchema,
  type Employee,
  type StaffSetupDoc,
  tenantConfigSchema,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_EMPLOYEES,
  DEMO_PHOTOS,
  DEMO_PRODUCTS,
  DEMO_ROOT_NAME,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { newOperatorPassword, ROOT_NAME, seedClient, seedDemo } from './generator';

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
  };
  return { records, storage };
}

describe('the demo generator', () => {
  it('The demo client is made by the operator’s create, its root signs in through the BFF, and so does the operator', async () => {
    const { records, storage } = memoryStorage();
    const operatorPassword = newOperatorPassword();

    const { rootPassword } = await seedDemo(storage, { operatorPassword });

    const index = storedClientSchema.parse(records.get(recordKeys.client(DEMO_CODE)));
    const keys = recordKeys.tenant(index.id);
    expect(storedUserSchema.parse(records.get(keys.user(ROOT_NAME))).root).toBe(true);
    expect(tenantConfigSchema.parse(records.get(keys.config))).toEqual(DEMO_CONFIG);
    const app = buildApp({ storage, now: () => Date.now(), logger: false });
    const signIn = (url: string, headers: Record<string, string>, name: string, password: string) =>
      app.inject({
        method: 'POST',
        url,
        headers: { 'x-device-id': 'device-aaaa-0001', ...headers },
        payload: { name, password },
      });
    const root = (password: string) =>
      signIn('/api/auth/sign-in', { 'x-client-code': DEMO_CODE }, ROOT_NAME, password);
    expect((await root(rootPassword)).json()).toMatchObject({ user: { root: true } });
    expect((await root('not the password')).statusCode).toBe(401);
    const operator = await signIn('/api/operator/sign-in', {}, OPERATOR_NAME, operatorPassword);
    expect(operator.json()).toMatchObject({ operator: { name: OPERATOR_NAME } });
  });

  it('The demo client holds the data set’s customers and products, each under a minted id, with the stocked flag as the data set has it', async () => {
    const { records, storage } = memoryStorage();
    await seedDemo(storage, { operatorPassword: newOperatorPassword() });

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

    await expect(seedDemo(down, { operatorPassword: newOperatorPassword() })).rejects.toThrow(
      'products import did not add every row',
    );
  });

  it('The passwords are stored nowhere readable: only their scrypt hashes are', async () => {
    const { records, storage } = memoryStorage();
    const operatorPassword = newOperatorPassword();

    const { rootPassword } = await seedDemo(storage, { operatorPassword });

    const all = JSON.stringify([...records]);
    expect(all).not.toContain(rootPassword);
    expect(all).not.toContain(operatorPassword);
    const stored = storedOperatorSchema.parse(records.get(recordKeys.operatorUser(OPERATOR_NAME)));
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword(operatorPassword, stored.passwordHash)).toBe(true);
  });

  it('The data set names the root as the BFF does, so the fake’s sign-in is the real one’s', () => {
    expect(DEMO_ROOT_NAME).toBe(ROOT_NAME);
  });

  it('makes a new password for each stack, long enough to guess no better than at random', () => {
    const [one, two] = [newOperatorPassword(), newOperatorPassword()];

    expect(one).not.toBe(two);
    expect(one.length).toBeGreaterThanOrEqual(16);
  });

  it('never seeds over a service that holds data, the operator’s or the demo client’s', async () => {
    const { records, storage } = memoryStorage();
    await seedDemo(storage, { operatorPassword: 'first' });
    await expect(seedDemo(storage, { operatorPassword: 'second' })).rejects.toThrow(
      'not seeded over',
    );

    records.delete(recordKeys.client(DEMO_CODE));
    await expect(seedDemo(storage, { operatorPassword: 'third' })).rejects.toThrow(
      'not seeded over',
    );
    records.delete(recordKeys.operatorUser(OPERATOR_NAME));
    records.set(recordKeys.client(DEMO_CODE), {});
    await expect(seedDemo(storage, { operatorPassword: 'fourth' })).rejects.toThrow(
      'not seeded over',
    );

    // one of the data set's other clients already there
    records.delete(recordKeys.operatorUser(OPERATOR_NAME));
    records.delete(recordKeys.client(DEMO_CODE));
    await expect(seedDemo(storage, { operatorPassword: 'fifth' })).rejects.toThrow(
      'not seeded over',
    );
  });

  it('The stack’s operator lists the data set’s three clients with their fixed days, the demo company’s name as made, and newest first', async () => {
    const { storage } = memoryStorage();
    const operatorPassword = newOperatorPassword();
    await seedDemo(storage, { operatorPassword });
    const app = buildApp({ storage, now: () => Date.now(), logger: false });
    const session = await app.inject({
      method: 'POST',
      url: '/api/operator/sign-in',
      headers: { 'x-device-id': 'device-aaaa-0001' },
      payload: { name: OPERATOR_NAME, password: operatorPassword },
    });

    const listed = await app.inject({
      method: 'GET',
      url: '/api/operator/clients',
      headers: { 'x-auth-id': session.json<{ authId: string }>().authId },
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
      const app = buildApp({ storage, now: () => Date.now(), logger: false });
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
