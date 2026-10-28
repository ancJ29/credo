import { type TenantConfig } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from './api';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};
const doc = { config, version: 'v1' };

type Call = { path: string; init: RequestInit };

/** A fetch that answers each call in turn and records what was sent. */
function fake(...answers: (Response | Error)[]) {
  const calls: Call[] = [];
  const call: typeof fetch = (path, init) => {
    calls.push({ path: path instanceof Request ? path.url : path.toString(), init: init ?? {} });
    const answer = answers.shift() ?? new Response('{}', { status: 500 });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const api = createApi({
    deviceId: 'device-0001',
    clientCode: () => 'minh-phat',
    authId: () => 'device-0001.secret',
    operatorAuthId: () => 'device-0001.operator',
    fetch: call,
  });
  return { calls, api };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const headersOf = (call: Call | undefined) => new Headers(call?.init.headers);

describe('the API client', () => {
  it('A write carries its body as sent and no hash of it: the edge asks for none', async () => {
    const { calls, api } = fake(
      json({ authId: 'a.b', expiresAt: 1, user: { name: 'root', root: true } }),
      new Response(null, { status: 204 }),
      json(doc),
    );

    await api.signIn('root', 'pw');
    await api.signOut();
    await api.saveConfig(config, 'v1');

    expect(calls[0]?.init.body).toBe('{"name":"root","password":"pw"}');
    expect(calls[1]?.init.body).toBeNull();
    for (const call of calls) expect(headersOf(call).has('x-amz-content-sha256')).toBe(false);
  });

  it('Every call of a client’s carries its code, and a code is sent exactly as the device keeps it', async () => {
    const { calls, api } = fake(
      json(doc),
      json({ authId: 'a.b', expiresAt: 1, user: { name: 'root', root: true } }),
      new Response(null, { status: 204 }),
      json({ user: { name: 'root', root: true } }),
      json(doc),
    );

    await api.getConfig();
    await api.signIn('root', 'pw');
    await api.signOut();
    await api.me();
    await api.saveConfig(config, 'v1');

    expect(calls.map((call) => headersOf(call).get('x-client-code'))).toEqual(
      Array(5).fill('minh-phat'),
    );
  });

  it('sends no client code before the device has one', async () => {
    const call: typeof fetch = (_path, init) => {
      expect(new Headers(init?.headers).has('x-client-code')).toBe(false);
      return Promise.resolve(json(doc));
    };
    await createApi({
      deviceId: 'device-0001',
      clientCode: () => null,
      authId: () => null,
      operatorAuthId: () => null,
      fetch: call,
    }).getConfig();
  });

  it('The operator’s calls carry the operator’s handle and no client code, and a client’s carry its own handle', async () => {
    const { calls, api } = fake(
      json({ authId: 'a.b', expiresAt: 1, operator: { name: 'operator' } }),
      json({ operator: { name: 'operator' } }),
      json({ link: '/login?client-code=minh-phat', rootName: 'root', password: 'x' }, 201),
      new Response(null, { status: 204 }),
      json({ user: { name: 'root', root: true } }),
    );

    await api.operatorSignIn('operator', 'pw');
    await api.operatorMe();
    await api.makeClient('minh-phat', 'Minh Phát');
    await api.operatorSignOut();
    await api.me();

    expect(calls.map((call) => call.path)).toEqual([
      '/api/operator/sign-in',
      '/api/operator/me',
      '/api/operator/clients',
      '/api/operator/sign-out',
      '/api/auth/me',
    ]);
    for (const call of calls.slice(0, 4)) {
      expect(headersOf(call).has('x-client-code')).toBe(false);
    }
    expect(headersOf(calls[1]).get('x-auth-id')).toBe('device-0001.operator');
    expect(headersOf(calls[4]).get('x-auth-id')).toBe('device-0001.secret');
    expect(calls[2]?.init.body).toBe('{"code":"minh-phat","name":"Minh Phát"}');
  });

  it('A client made is returned whole, a code taken is a result and any other refusal an error', async () => {
    const made = { link: '/login?client-code=minh-phat', rootName: 'root', password: 'x' };
    const { api } = fake(
      json(made, 201),
      json({ error: 'That code is taken' }, 409),
      json({}, 400),
      json({ link: 1 }, 201),
      json({}, 401),
      json({}, 503),
      json({}, 401),
    );

    expect(await api.makeClient('minh-phat', 'A')).toEqual({ kind: 'made', client: made });
    expect(await api.makeClient('minh-phat', 'A')).toEqual({ kind: 'taken' });
    await expect(api.makeClient('x', 'A')).rejects.toMatchObject({ status: 400 });
    await expect(api.makeClient('minh-phat', 'A')).rejects.toMatchObject({ status: null });
    await expect(api.operatorMe()).rejects.toMatchObject({ status: 401 });
    await expect(api.operatorSignOut()).rejects.toMatchObject({ status: 503 });
    await expect(api.operatorSignIn('a', 'b')).rejects.toMatchObject({ status: 401 });
  });

  it('sends the device id and the session handle on every call', async () => {
    const { calls, api } = fake(json({ user: { name: 'root', root: true } }));

    await api.me();

    expect(calls[0]?.path).toBe('/api/auth/me');
    expect(headersOf(calls[0]).get('x-device-id')).toBe('device-0001');
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.secret');
  });

  it('sends no handle before sign-in', async () => {
    const call: typeof fetch = (_path, init) => {
      expect(new Headers(init?.headers).get('x-auth-id')).toBeNull();
      return Promise.resolve(json(doc));
    };
    await createApi({
      deviceId: 'device-0001',
      clientCode: () => 'minh-phat',
      authId: () => null,
      operatorAuthId: () => null,
      fetch: call,
    }).getConfig();
  });

  it('A config that does not parse stops the boot', async () => {
    const { api } = fake(json({ config: { ...config, colour: 'red' }, version: 'v1' }));

    await expect(api.getConfig()).rejects.toMatchObject({ status: null });
  });

  it('reads a refusal by its status, and a call with no answer or no JSON as null', async () => {
    const { api } = fake(
      json({}, 404),
      json({}, 401),
      json({}, 503),
      new Response(null, { status: 500 }),
      new TypeError('fetch failed'),
      new Response('not json', { status: 200 }),
    );

    await expect(api.getConfig()).rejects.toMatchObject({ status: 404 });
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ status: 401 });
    await expect(api.me()).rejects.toMatchObject({ status: 503 });
    await expect(api.signOut()).rejects.toMatchObject({ status: 500 });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ status: null });
  });

  it('A save over a newer one is a conflict, not an error', async () => {
    const { api } = fake(json({ error: 'Conflict', current: doc }, 409), json({}, 403));

    expect(await api.saveConfig(config, 'old')).toEqual({ kind: 'conflict' });
    await expect(api.saveConfig(config, 'old')).rejects.toMatchObject({ status: 403 });
  });

  it('returns the settings a save stored, with their new version', async () => {
    const { api } = fake(json({ config, version: 'v2' }));

    expect(await api.saveConfig(config, 'v1')).toEqual({
      kind: 'saved',
      doc: { config, version: 'v2' },
    });
  });
});
