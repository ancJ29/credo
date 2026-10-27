import { HASH_HEADER, sha256Hex, type TenantConfig } from '@credo/shared';
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
    authId: () => 'device-0001.secret',
    fetch: call,
  });
  return { calls, api };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const headersOf = (call: Call | undefined) => new Headers(call?.init.headers);

describe('the API client', () => {
  it('Every write carries its body’s SHA-256, and a read carries none', async () => {
    const { calls, api } = fake(
      json(doc),
      json({ authId: 'a.b', expiresAt: 1, user: { name: 'root', root: true } }),
      new Response(null, { status: 204 }),
      json(doc),
    );

    await api.getConfig();
    await api.signIn('root', 'pw');
    await api.signOut();
    await api.saveConfig(config, 'v1');

    expect(headersOf(calls[0]).get(HASH_HEADER)).toBeNull();
    expect(headersOf(calls[1]).get(HASH_HEADER)).toBe(
      await sha256Hex(JSON.stringify({ name: 'root', password: 'pw' })),
    );
    expect(calls[1]?.init.body).toBe('{"name":"root","password":"pw"}');
    expect(headersOf(calls[2]).get(HASH_HEADER)).toBe(await sha256Hex(''));
    expect(headersOf(calls[3]).get(HASH_HEADER)).toBe(
      await sha256Hex(JSON.stringify({ config, version: 'v1' })),
    );
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
    await createApi({ deviceId: 'device-0001', authId: () => null, fetch: call }).getConfig();
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
