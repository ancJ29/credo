import { verifyPassword } from '@credo/bff/password';
import { buildApp } from '@credo/bff';
import {
  type CStorageClient,
  recordKeys,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { DEMO_CONFIG, newRootPassword, ROOT_NAME, seedDemoTenant } from './generator';

/** A c-storage service in memory: records and the tags a read returns. */
function memoryStorage() {
  const records = new Map<string, unknown>();
  const storage: CStorageClient = {
    getRecord: (key) =>
      Promise.resolve(records.has(key) ? { data: records.get(key), tag: `tag-${key}` } : null),
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
  it('The root is the tenant’s first user, made with the tenant, and signs in through the BFF', async () => {
    const { records, storage } = memoryStorage();
    const rootPassword = newRootPassword();

    await seedDemoTenant(storage, { rootPassword });

    expect(storedUserSchema.parse(records.get(recordKeys.user(ROOT_NAME))).root).toBe(true);
    expect(tenantConfigSchema.parse(records.get(recordKeys.config))).toEqual(DEMO_CONFIG);
    const app = buildApp({ storage, now: () => Date.now(), logger: false });
    const signIn = (password: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        headers: { 'x-device-id': 'device-aaaa-0001' },
        payload: { name: ROOT_NAME, password },
      });
    expect((await signIn(rootPassword)).json()).toMatchObject({ user: { root: true } });
    expect((await signIn('not the password')).statusCode).toBe(401);
  });

  it('The password is stored nowhere readable: only its scrypt hash is', async () => {
    const { records, storage } = memoryStorage();
    const rootPassword = newRootPassword();

    await seedDemoTenant(storage, { rootPassword });

    expect(JSON.stringify([...records])).not.toContain(rootPassword);
    const { passwordHash } = storedUserSchema.parse(records.get(recordKeys.user(ROOT_NAME)));
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword(rootPassword, passwordHash)).toBe(true);
  });

  it('makes a new password for each stack, long enough to guess no better than at random', () => {
    const [one, two] = [newRootPassword(), newRootPassword()];

    expect(one).not.toBe(two);
    expect(one.length).toBeGreaterThanOrEqual(16);
  });

  it('never seeds over a tenant that holds data', async () => {
    const { storage } = memoryStorage();
    await seedDemoTenant(storage, { rootPassword: 'first' });

    await expect(seedDemoTenant(storage, { rootPassword: 'second' })).rejects.toThrow(
      'not seeded over',
    );
  });
});
