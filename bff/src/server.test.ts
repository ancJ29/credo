import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freePort, freshTenant, startCStorage, type RunningCStorage } from '../tests/c-storage';
import { CODE, ORIGIN, ROOT, scoped, seedTenant, signIn, withAuth } from '../tests/tenant';
import { customerRoutes, readEntriesByTarget, recordKeys } from '@credo/shared';
import { clientOf, type RunningAudit, startAudit } from '../tests/audit';
import { readAppOrigin, readEnv, readLambdaEnv, readStorageEnv } from './env';
import { buildBff, startBff } from './server';

let cs: RunningCStorage;
let audit: RunningAudit;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
  audit = await startAudit(inject('auditBinary'));
});
afterAll(async () => {
  await cs.stop();
  await audit.stop();
});

const DOOR = 'door-key-one';

const environment = (port: number, tenant: Awaited<ReturnType<typeof freshTenant>>) => ({
  PORT: String(port),
  C_STORAGE_URL: cs.baseUrl,
  INTERNAL_ACCESS_KEY: cs.internalAccessKey,
  SERVICE_CODE: tenant.serviceCode,
  SERVICE_ACCESS_KEY: tenant.accessKey,
  APP_ORIGIN: ORIGIN,
  FRONT_DOOR_KEYS: DOOR,
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
          'x-front-door-key': DOOR,
        },
        body: JSON.stringify(ROOT),
      });
      expect(signedIn.status).toBe(200);
      expect(
        (
          await fetch(`http://127.0.0.1:${port}/api/config`, {
            headers: { 'x-client-code': CODE, 'x-front-door-key': DOOR },
          })
        ).status,
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
          'invalid environment: PORT, C_STORAGE_URL, SERVICE_CODE, SERVICE_ACCESS_KEY, APP_ORIGIN, FRONT_DOOR_KEYS',
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
      FRONT_DOOR_KEYS: 'k',
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
      FRONT_DOOR_KEYS: 'k',
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

describe('the front door, as the BFF is given it', () => {
  const logged: string[] = [];
  const stream = { write: (line: string) => void logged.push(line) };
  async function bffWith(keys: string) {
    const tenant = await freshTenant(cs);
    await seedTenant(tenant.client, CODE);
    const app = buildBff(readLambdaEnv({ ...environment(0, tenant), FRONT_DOOR_KEYS: keys }), {
      logger: false,
    });
    return app;
  }
  const config = (key?: string) => ({
    method: 'GET' as const,
    url: '/api/config',
    headers: { 'x-client-code': CODE, ...(key === undefined ? {} : { 'x-front-door-key': key }) },
  });

  // Case 1: a call without the key, or with a wrong one, is 403, and no company is looked up.
  it('refuses a call without the key, or with a wrong one, before any company is looked up', async () => {
    const app = await bffWith('door-key-one');
    try {
      for (const key of [undefined, '', 'door-key-on', 'door-key-one ', 'DOOR-KEY-ONE']) {
        const answer = await app.inject(config(key));
        expect(answer.statusCode, String(key)).toBe(403);
        expect(answer.json()).toEqual({ error: 'Forbidden' });
      }
      // The same call with a company the store does not know is 404 only once the key is right.
      const unknown = {
        ...config('door-key-one'),
        headers: { 'x-client-code': 'no-such-co', 'x-front-door-key': 'door-key-one' },
      };
      expect((await app.inject(unknown)).statusCode).toBe(404);
      const unknownBare = { ...unknown, headers: { 'x-client-code': 'no-such-co' } };
      expect((await app.inject(unknownBare)).statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  // Case 2: an unknown path without the key is 403, not 404.
  it('answers 403, not 404, for a path that does not exist when the key is missing', async () => {
    const app = await bffWith('door-key-one');
    try {
      expect((await app.inject({ method: 'GET', url: '/no/such/path' })).statusCode).toBe(403);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/no/such/path',
            headers: { 'x-front-door-key': 'door-key-one' },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });

  // Case 3: while two keys are set, a call with either is answered.
  it('answers a call with either of two keys, and refuses a third', async () => {
    const app = await bffWith('door-key-old,door-key-new');
    try {
      // A fresh company has no settings yet: 404 is the answer from behind the door.
      expect((await app.inject(config('door-key-old'))).statusCode).toBe(404);
      expect((await app.inject(config('door-key-new'))).statusCode).toBe(404);
      expect((await app.inject(config('door-key-third'))).statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  // Case 6: no log line of a refused call holds the key.
  it('writes no log line of a refused call that holds a key, sent or set', async () => {
    const tenant = await freshTenant(cs);
    const app = buildBff(
      readLambdaEnv({ ...environment(0, tenant), FRONT_DOOR_KEYS: 'set-door-key-aaaa' }),
      { logger: { level: 'trace', stream } as never },
    );
    try {
      const answer = await app.inject(config('sent-wrong-key-bbbb'));
      expect(answer.statusCode).toBe(403);
      const text = logged.join('');
      expect(text).toContain('403');
      expect(text).not.toContain('set-door-key-aaaa');
      expect(text).not.toContain('sent-wrong-key-bbbb');
    } finally {
      await app.close();
    }
  });
});

describe('the audit service, as the BFF is given it', () => {
  const base = {
    PORT: '3182',
    C_STORAGE_URL: 'http://127.0.0.1:3181',
    INTERNAL_ACCESS_KEY: 'i',
    SERVICE_CODE: 's',
    SERVICE_ACCESS_KEY: 'a',
    APP_ORIGIN: ORIGIN,
    FRONT_DOOR_KEYS: 'k',
  };

  it('is optional, but only as a pair: one without the other names the missing variable and no value', () => {
    expect(readEnv(base).AUDIT_URL).toBeUndefined();
    expect(readLambdaEnv(base).AUDIT_KEY).toBeUndefined();
    const both = { AUDIT_URL: 'http://127.0.0.1:3184', AUDIT_KEY: 'k' };
    expect(readEnv({ ...base, ...both })).toMatchObject(both);
    expect(readLambdaEnv({ ...base, ...both })).toMatchObject(both);
    expect(() => readEnv({ ...base, AUDIT_URL: both.AUDIT_URL })).toThrowError(
      'invalid environment: AUDIT_KEY',
    );
    expect(() => readLambdaEnv({ ...base, AUDIT_KEY: 'secret-key' })).toThrowError(
      'invalid environment: AUDIT_KEY',
    );
  });

  it('writes a save’s entry through the client the environment builds', async () => {
    const tenant = await freshTenant(cs);
    const id = await seedTenant(tenant.client, CODE);
    const customer = { id: crypto.randomUUID(), code: 'KH-1', name: 'Mai', extra: {} };
    await tenant.client.putRecord(recordKeys.tenant(id).customer(customer.id), customer);
    const app = buildBff(
      readLambdaEnv({ ...environment(0, tenant), AUDIT_URL: audit.keyedUrl, AUDIT_KEY: audit.key }),
      { logger: false },
    );
    try {
      const inside = scoped(app, CODE);
      const call = {
        inject: (options: Parameters<typeof inside.inject>[0]) =>
          inside.inject({ ...options, headers: { 'x-front-door-key': DOOR, ...options.headers } }),
      };
      const { body } = await signIn(call);
      const route = customerRoutes.one(customer.id);
      const doc = (
        await call.inject({ method: 'GET', url: route, headers: withAuth(body.authId) })
      ).json<{ version: string }>();
      const saved = await call.inject({
        method: 'PUT',
        url: route,
        headers: withAuth(body.authId),
        payload: { name: 'Mai Linh', extra: {}, version: doc.version },
      });
      expect(saved.statusCode).toBe(200);
      const token = await clientOf(audit).mintToken(id);
      const entries = await readEntriesByTarget({ readUrl: audit.openUrl, token }, customer.id);
      expect(entries).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
