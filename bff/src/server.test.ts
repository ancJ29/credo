import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freePort, freshTenant, startCStorage, type RunningCStorage } from '../tests/c-storage';
import { ROOT, seedUser } from '../tests/tenant';
import { readEnv } from './env';
import { startBff } from './server';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(() => cs.stop());

const environment = (port: number, tenant: Awaited<ReturnType<typeof freshTenant>>) => ({
  PORT: String(port),
  C_STORAGE_URL: cs.baseUrl,
  INTERNAL_ACCESS_KEY: cs.internalAccessKey,
  SERVICE_CODE: tenant.serviceCode,
  SERVICE_ACCESS_KEY: tenant.accessKey,
});

describe('the BFF as a process runs it', () => {
  it('listens on the port the environment names and serves its tenant', async () => {
    const tenant = await freshTenant(cs);
    await seedUser(tenant.client, { ...ROOT, root: true });
    const port = await freePort();
    const app = await startBff(environment(port, tenant), { logger: false });
    try {
      const signedIn = await fetch(`http://127.0.0.1:${port}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-id': 'device-aaaa-0001' },
        body: JSON.stringify(ROOT),
      });
      expect(signedIn.status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${port}/api/config`)).status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('refuses an environment it cannot use, naming the variables and no value', () => {
    const secret = 'a-key-that-must-not-be-echoed';
    expect(() =>
      readEnv({ PORT: 'x', C_STORAGE_URL: 'not a url', INTERNAL_ACCESS_KEY: secret }),
    ).toThrowError(
      expect.objectContaining({
        message: 'invalid environment: PORT, C_STORAGE_URL, SERVICE_CODE, SERVICE_ACCESS_KEY',
      }) as Error,
    );
  });

  it('holds no super-admin key: the environment has no place for one', () => {
    const parsed = readEnv({
      PORT: '3182',
      C_STORAGE_URL: 'http://127.0.0.1:3181',
      INTERNAL_ACCESS_KEY: 'i',
      SERVICE_CODE: 's',
      SERVICE_ACCESS_KEY: 'a',
      X_SUPER_ADMIN_KEY: 'admin',
    });
    expect(Object.keys(parsed)).not.toContain('X_SUPER_ADMIN_KEY');
    expect(parsed.HOST).toBe('127.0.0.1');
  });
});
