import { configDocSchema, recordKeys, sessionReplySchema, storedClientSchema } from '@credo/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import {
  bffOn,
  DEVICE,
  ROOT,
  scoped,
  seedTenant,
  seedUser,
  type TenantApp,
  signIn,
  withAuth,
} from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const company = (name: string) => ({
  name,
  logo: null,
  colour: '#2f7d6d',
  languages: ['vi'],
  defaultLanguage: 'vi',
});

/** Two tenants in one service, each with a root named `root` and a password of its own. */
async function twoTenants() {
  const t = await bffOn(cs);
  const ids = {
    alpha: await seedTenant(t.client, 'alpha'),
    beta: await seedTenant(t.client, 'beta'),
  };
  await seedUser(t.client, ids.beta, { name: 'root', password: 'beta root password', root: true });
  return { ...t, ids, alpha: scoped(t.app, 'alpha'), beta: scoped(t.app, 'beta') };
}

const callsOf = (app: TenantApp, authId = `${DEVICE}.some-secret`) => [
  app.inject({ method: 'GET', url: '/api/config' }),
  app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) }),
  app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: withAuth(authId) }),
  app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    headers: { 'x-device-id': DEVICE },
    payload: ROOT,
  }),
  app.inject({
    method: 'PUT',
    url: '/api/config',
    headers: withAuth(authId),
    payload: { version: null, config: company('X') },
  }),
];

describe('Every client route needs x-client-code: missing or malformed is a 400, unknown a 404, before any session is read', () => {
  it('answers 400 to a call with no code, and to a code that is not the exact form', async () => {
    const t = await bffOn(cs);
    await seedTenant(t.client, 'acme');
    for (const code of [undefined, 'Acme', 'ac', ' acme', 'acme-', 'a_me', 'x'.repeat(33), '']) {
      const raw = { inject: t.app.inject.bind(t.app) };
      const app = code === undefined ? raw : scoped(t.app, code);
      for (const answer of await Promise.all(callsOf(app))) {
        expect(answer.statusCode, String(code)).toBe(400);
        expect(answer.json()).toEqual({ error: 'Bad request', details: 'x-client-code' });
      }
    }
  });

  it('answers 404 to a code no client holds, and reads no session to say so', async () => {
    const reads: string[] = [];
    const t = await bffOn(cs, {
      wrap: (client) => ({
        ...client,
        getRecord: (key) => {
          reads.push(key);
          return client.getRecord(key);
        },
      }),
    });
    await seedTenant(t.client, 'acme');
    for (const answer of await Promise.all(callsOf(scoped(t.app, 'unknown-co')))) {
      expect(answer.statusCode).toBe(404);
      expect(answer.json()).toEqual({ error: 'Unknown client' });
    }
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((key) => key === 'client.unknown-co')).toBe(true);
  });

  it('serves the call of the client the code names, and no other', async () => {
    const t = await twoTenants();
    await t.client.putRecord(recordKeys.tenant(t.ids.alpha).config, company('Alpha'));
    await t.client.putRecord(recordKeys.tenant(t.ids.beta).config, company('Beta'));
    const name = async (app: ReturnType<typeof scoped>) =>
      configDocSchema.parse((await app.inject({ method: 'GET', url: '/api/config' })).json()).config
        .name;
    expect([await name(t.alpha), await name(t.beta)]).toEqual(['Alpha', 'Beta']);
  });

  it('fails a call whose index record is not a client with a 500 and says nothing of it', async () => {
    const t = await bffOn(cs);
    await t.client.putRecord(recordKeys.client('broken'), { id: 'not an id' });
    const answer = await scoped(t.app, 'broken').inject({ method: 'GET', url: '/api/config' });
    expect(answer.statusCode).toBe(500);
    expect(answer.json()).toEqual({ error: 'Internal error' });
  });
});

describe('A handle minted under one client names no session under another: 401', () => {
  it('refuses alpha’s handle under beta’s code, on the device that signed in', async () => {
    const t = await twoTenants();
    const { body } = await signIn(t.alpha);
    expect(sessionReplySchema.parse(body).user.name).toBe('root');
    const own = await t.alpha.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: withAuth(body.authId),
    });
    expect(own.statusCode).toBe(200);
    const other = await t.beta.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: withAuth(body.authId),
    });
    expect(other.statusCode).toBe(401);
    expect(
      await t.client.getRecord(recordKeys.tenant(t.ids.beta).session(body.authId.split('.')[0])),
    ).toBeNull();
  });
});

describe('One client’s root cannot sign in to, read or change another client, though both are named root', () => {
  it('refuses a root’s password under another client’s code', async () => {
    const t = await twoTenants();
    const alphaPassword = await signIn(t.beta, ROOT);
    const betaPassword = await signIn(t.alpha, { name: 'root', password: 'beta root password' });
    expect(alphaPassword.response.statusCode).toBe(401);
    expect(betaPassword.response.statusCode).toBe(401);
    expect(
      (await signIn(t.beta, { name: 'root', password: 'beta root password' })).response.statusCode,
    ).toBe(200);
  });

  it('lets alpha’s root change alpha’s settings and not beta’s, which stay as they were', async () => {
    const t = await twoTenants();
    const betaKey = recordKeys.tenant(t.ids.beta).config;
    await t.client.putRecord(betaKey, company('Beta'));
    const before = await t.client.getRecord(betaKey);
    const { body } = await signIn(t.alpha);
    const save = (app: ReturnType<typeof scoped>) =>
      app.inject({
        method: 'PUT',
        url: '/api/config',
        headers: withAuth(body.authId),
        payload: { version: before?.tag, config: company('Taken over') },
      });
    expect((await save(t.beta)).statusCode).toBe(401);
    expect(await t.client.getRecord(betaKey)).toEqual(before);
    expect((await save(t.alpha)).statusCode).toBe(409);
  });

  it('keeps a client’s id out of every answer', async () => {
    const t = await twoTenants();
    const index = storedClientSchema.parse((await t.client.getRecord('client.alpha'))?.data);
    const answers = await Promise.all(callsOf(t.alpha));
    for (const answer of answers) expect(answer.body).not.toContain(index.id);
    expect(randomUUID()).not.toBe(index.id);
  });
});
