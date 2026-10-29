import { verifyPassword } from '@credo/bff/password';
import { buildApp } from '@credo/bff';
import {
  type CStorageClient,
  recordKeys,
  storedClientSchema,
  storedOperatorSchema,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { DEMO_CODE, DEMO_CONFIG, DEMO_ROOT_NAME, OPERATOR_NAME } from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { newOperatorPassword, ROOT_NAME, seedDemo } from './generator';

/** A c-storage service in memory: records and the tags a read returns. */
function memoryStorage() {
  const records = new Map<string, unknown>();
  const storage: CStorageClient = {
    getRecord: (key) =>
      Promise.resolve(records.has(key) ? { data: records.get(key), tag: `tag-${key}` } : null),
    listRecords: (prefix) =>
      Promise.resolve({
        records: [...records]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, data]) => ({ key, data, tag: `tag-${key}` })),
        more: false,
      }),
    putRecord: (key, data, ifTag) => {
      if (ifTag === null && records.has(key)) return Promise.resolve('moved');
      records.set(key, data);
      return Promise.resolve('saved');
    },
    removeRecord: (key) => {
      records.delete(key);
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
  });
});
