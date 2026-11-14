import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freePort, freshTenant, startCStorage, type RunningCStorage } from '../tests/c-storage';
import { CODE, ORIGIN, ROOT, seedTenant } from '../tests/tenant';
import { createLambdaHandler } from './lambda';
import { startBff } from './server';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(() => cs.stop());

/** An HTTP API event, payload 2.0, as API Gateway sends it for the `$default` route. */
function httpApiEvent(call: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: call.path,
    rawQueryString: '',
    headers: call.headers ?? {},
    requestContext: {
      accountId: 'anonymous',
      apiId: 'api-id',
      domainName: 'api.example.invalid',
      http: {
        method: call.method,
        path: call.path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '28/Oct/2026:09:00:00 +0000',
      timeEpoch: 0,
    },
    body: call.body,
    isBase64Encoded: false,
  };
}

const DOOR = 'door-key-one';
const context = { callbackWaitsForEmptyEventLoop: false };

async function setUp() {
  const tenant = await freshTenant(cs);
  await seedTenant(tenant.client, CODE);
  const env = {
    C_STORAGE_URL: cs.baseUrl,
    INTERNAL_ACCESS_KEY: cs.internalAccessKey,
    SERVICE_CODE: tenant.serviceCode,
    SERVICE_ACCESS_KEY: tenant.accessKey,
    APP_ORIGIN: ORIGIN,
    FRONT_DOOR_KEYS: DOOR,
  };
  const port = await freePort();
  const door = { 'x-front-door-key': DOOR };
  const listener = await startBff({ ...env, PORT: String(port) }, { logger: false });
  const handler = createLambdaHandler(env, { logger: false });
  /** The same call to the listener and to the handler, as the one answer each gives. */
  async function both(call: Parameters<typeof httpApiEvent>[0]) {
    const heard = await fetch(`http://127.0.0.1:${port}${call.path}`, {
      method: call.method,
      headers: { ...door, ...call.headers },
      body: call.body,
    });
    const answered = await handler(
      httpApiEvent({ ...call, headers: { ...door, ...call.headers } }),
      context,
    );
    return {
      listener: { status: heard.status, body: await heard.text() },
      lambda: { status: answered.statusCode, body: answered.body },
      lambdaHeaders: answered.headers,
      listenerHeaders: heard.headers,
    };
  }
  return { both, close: () => listener.close(), handler, env, port };
}

describe('the Lambda entry', () => {
  it('answers an HTTP API event as the listener answers the same request', async () => {
    const { both, close } = await setUp();
    try {
      const unknown = await both({
        method: 'GET',
        path: '/api/config',
        headers: { 'x-client-code': 'no-such-co' },
      });
      expect(unknown.listener.status).toBe(404);
      expect(unknown.lambda).toEqual(unknown.listener);
      expect(unknown.lambdaHeaders['content-type']).toBe(
        unknown.listenerHeaders.get('content-type'),
      );

      const missing = await both({ method: 'GET', path: '/api/config' });
      expect(missing.listener.status).toBe(400);
      expect(missing.lambda).toEqual(missing.listener);

      const wrongMethod = await both({ method: 'DELETE', path: '/api/auth/sign-in' });
      expect(wrongMethod.lambda).toEqual(wrongMethod.listener);
    } finally {
      await close();
    }
  });

  it('carries a body, a header and a status through, as the listener does', async () => {
    const { both, close } = await setUp();
    try {
      const signIn = await both({
        method: 'POST',
        path: '/api/auth/sign-in',
        headers: {
          'content-type': 'application/json',
          'x-device-id': 'device-aaaa-0001',
          'x-client-code': CODE,
        },
        body: JSON.stringify(ROOT),
      });
      expect(signIn.listener.status).toBe(200);
      expect(signIn.lambda.status).toBe(200);
      expect(Object.keys(JSON.parse(signIn.lambda.body) as object)).toEqual(
        Object.keys(JSON.parse(signIn.listener.body) as object),
      );

      const refused = await both({
        method: 'POST',
        path: '/api/auth/sign-in',
        headers: {
          'content-type': 'application/json',
          'x-device-id': 'device-aaaa-0001',
          'x-client-code': CODE,
        },
        body: JSON.stringify({ ...ROOT, password: 'not the password' }),
      });
      expect(refused.listener.status).toBe(401);
      expect(refused.lambda).toEqual(refused.listener);
    } finally {
      await close();
    }
  });

  it('refuses an environment it cannot use, naming the variables and no value', () => {
    const secret = 'a-key-that-must-not-be-echoed';
    expect(() =>
      createLambdaHandler({ C_STORAGE_URL: 'not a url', INTERNAL_ACCESS_KEY: secret }),
    ).toThrowError(
      expect.objectContaining({
        message:
          'invalid environment: C_STORAGE_URL, SERVICE_CODE, SERVICE_ACCESS_KEY, APP_ORIGIN, FRONT_DOOR_KEYS',
      }) as Error,
    );
  });

  // Case 4: the Lambda refuses a call without the key, as the listener does.
  it('refuses a call without the front door’s key, as the listener does', async () => {
    const { both, close, handler } = await setUp();
    try {
      const bare = await both({
        method: 'GET',
        path: '/api/config',
        headers: { 'x-client-code': CODE, 'x-front-door-key': 'a-wrong-key' },
      });
      expect(bare.listener.status).toBe(403);
      expect(bare.lambda).toEqual(bare.listener);
      const none = await handler(
        httpApiEvent({ method: 'GET', path: '/api/config', headers: { 'x-client-code': CODE } }),
        context,
      );
      expect(none.statusCode).toBe(403);
    } finally {
      await close();
    }
  });

  // Case 5: a back end without FRONT_DOOR_KEYS does not start, and the error names the variable only.
  it('does not start without FRONT_DOOR_KEYS and never echoes a value', async () => {
    const { env, close } = await setUp();
    try {
      const without: Record<string, string> = { ...env };
      delete without.FRONT_DOOR_KEYS;
      expect(() => createLambdaHandler(without)).toThrowError(
        'invalid environment: FRONT_DOOR_KEYS',
      );
      expect(() => createLambdaHandler({ ...env, FRONT_DOOR_KEYS: 'a,b,c' })).toThrowError(
        'invalid environment: FRONT_DOOR_KEYS',
      );
      expect(() => createLambdaHandler({ ...env, FRONT_DOOR_KEYS: 'a,b,c' })).not.toThrowError(
        /a,b,c/,
      );
    } finally {
      await close();
    }
  });
});
