import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freePort, freshTenant, startCStorage, type RunningCStorage } from '../tests/c-storage';
import { CODE, ORIGIN, ROOT, seedTenant } from '../tests/tenant';
import { readAppOrigin, readEnv, readStorageEnv } from './env';
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
  APP_ORIGIN: ORIGIN,
});

describe('the BFF as a process runs it', () => {
  it('listens on the port the environment names and serves its tenant', async () => {
    const tenant = await freshTenant(cs);
    await seedTenant(tenant.client, CODE);
    const port = await freePort();
    const app = await startBff(environment(port, tenant), { logger: false });
    try {
      const signedIn = await fetch(`http://127.0.0.1:${port}/api/auth/sign-in`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-device-id': 'device-aaaa-0001',
          'x-client-code': CODE,
        },
        body: JSON.stringify(ROOT),
      });
      expect(signedIn.status).toBe(200);
      expect(
        (await fetch(`http://127.0.0.1:${port}/api/config`, { headers: { 'x-client-code': CODE } }))
          .status,
      ).toBe(404);
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
        message:
          'invalid environment: PORT, C_STORAGE_URL, SERVICE_CODE, SERVICE_ACCESS_KEY, APP_ORIGIN',
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
      APP_ORIGIN: ORIGIN,
      X_SUPER_ADMIN_KEY: 'admin',
    });
    expect(Object.keys(parsed)).not.toContain('X_SUPER_ADMIN_KEY');
    expect(parsed.HOST).toBe('127.0.0.1');
  });

  it('takes APP_ORIGIN as an origin that is https, or localhost for the local stack, and no other', () => {
    const base = {
      PORT: '3182',
      C_STORAGE_URL: 'http://127.0.0.1:3181',
      INTERNAL_ACCESS_KEY: 'i',
      SERVICE_CODE: 's',
      SERVICE_ACCESS_KEY: 'a',
    };
    for (const good of [
      'https://d111abc.cloudfront.net',
      'http://localhost:3181',
      'https://console.example.vn',
    ]) {
      expect(readEnv({ ...base, APP_ORIGIN: good }).APP_ORIGIN, good).toBe(good);
    }
    // An address, a path, a plain-http host that is not localhost: a passkey would be bound wrongly.
    const bad = [
      'http://127.0.0.1:3181',
      'http://example.com',
      'https://x.example/app',
      'https://x.example/',
      'localhost',
      '',
    ];
    for (const value of bad) {
      expect(() => readEnv({ ...base, APP_ORIGIN: value }), value).toThrowError(
        'invalid environment: APP_ORIGIN',
      );
    }
    expect(() => readEnv(base)).toThrowError('invalid environment: APP_ORIGIN');
  });

  it('gives the ops scripts the four c-storage variables without the app’s address, and the address alone', () => {
    const four = {
      C_STORAGE_URL: 'http://127.0.0.1:3181',
      INTERNAL_ACCESS_KEY: 'i',
      SERVICE_CODE: 's',
      SERVICE_ACCESS_KEY: 'a',
    };
    expect(readStorageEnv(four)).toEqual(four);
    expect(() => readStorageEnv({ ...four, SERVICE_CODE: '' })).toThrowError(
      'invalid environment: SERVICE_CODE',
    );
    expect(readAppOrigin({ APP_ORIGIN: ORIGIN })).toBe(ORIGIN);
    expect(() => readAppOrigin({ APP_ORIGIN: 'http://example.com' })).toThrowError(
      'invalid environment: APP_ORIGIN',
    );
  });
});
