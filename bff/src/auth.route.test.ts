import {
  type CStorageClient,
  createCStorageClient,
  meReplySchema,
  recordKeys,
  sessionReplySchema,
  sha256Hex,
  storedSessionSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freePort, type RunningCStorage, startCStorage } from '../tests/c-storage';
import {
  DAY_MS,
  DEVICE,
  OTHER_DEVICE,
  ROOT,
  seedUser,
  signIn,
  tenantWithRoot,
  withAuth,
} from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const me = (app: Awaited<ReturnType<typeof tenantWithRoot>>['app'], authId: string) =>
  app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) });

const sessionRecord = async (client: CStorageClient, device = DEVICE) => {
  const found = await client.getRecord(recordKeys.session(device));
  return { tag: found?.tag, session: storedSessionSchema.parse(found?.data) };
};

/** A client that, right after reading `key`, lets `move` change the record, `times` times: a
 * second writer landing between this one's read and its write, on the real server. */
function movesAfterRead(
  client: CStorageClient,
  key: string,
  times: number,
  move: () => Promise<unknown>,
): CStorageClient {
  let left = times;
  return {
    ...client,
    async getRecord(requested) {
      const found = await client.getRecord(requested);
      if (requested === key && left > 0) {
        left--;
        await move();
      }
      return found;
    },
  };
}

describe("The root is the tenant's first user, made with the tenant: it may do everything and needs no employee row", () => {
  it('a root user record alone signs in, is the root, and saves the settings', async () => {
    const { app, client } = await tenantWithRoot(cs);
    const { response, body } = await signIn(app);
    expect(response.statusCode).toBe(200);
    expect(sessionReplySchema.parse(body).user).toEqual({ name: 'root', root: true });

    const who = await me(app, body.authId);
    expect(meReplySchema.parse(who.json()).user).toEqual({ name: 'root', root: true });

    const saved = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(body.authId),
      payload: {
        version: null,
        config: {
          name: 'Công ty A',
          logo: null,
          colour: '#2f7d6d',
          languages: ['vi'],
          defaultLanguage: 'vi',
        },
      },
    });
    expect(saved.statusCode).toBe(200);
    expect((await client.getRecord(recordKeys.config))?.data).toMatchObject({ name: 'Công ty A' });
  });

  it('a user who is not the root may not save the settings', async () => {
    const { app, client } = await tenantWithRoot(cs);
    await seedUser(client, { name: 'clerk', password: 'clerk-password', root: false });
    const { body } = await signIn(app, { name: 'clerk', password: 'clerk-password' });
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(body.authId),
      payload: {
        version: null,
        config: {
          name: 'X',
          logo: null,
          colour: '#000000',
          languages: ['en'],
          defaultLanguage: 'en',
        },
      },
    });
    expect(saved.statusCode).toBe(403);
    expect(await client.getRecord(recordKeys.config)).toBeNull();
  });
});

describe('A wrong name or password gets one message that does not say which', () => {
  it('answers an unknown name and a wrong password with the same 401 and body', async () => {
    const { app } = await tenantWithRoot(cs);
    const unknownName = await signIn(app, { name: 'nobody', password: ROOT.password });
    const wrongPassword = await signIn(app, { name: ROOT.name, password: 'not it' });
    expect(unknownName.response.statusCode).toBe(401);
    expect(wrongPassword.response.statusCode).toBe(401);
    expect(unknownName.response.body).toBe(wrongPassword.response.body);
    expect(unknownName.body).toEqual({ error: 'Wrong name or password' });
  });

  it('opens no session on a refusal', async () => {
    const { app, client } = await tenantWithRoot(cs);
    await signIn(app, { name: ROOT.name, password: 'not it' });
    expect(await client.getRecord(recordKeys.session(DEVICE))).toBeNull();
  });

  it('takes the name in any case and with spaces around it as the same user', async () => {
    const { app } = await tenantWithRoot(cs);
    const { response } = await signIn(app, { name: '  ROOT ', password: ROOT.password });
    expect(response.statusCode).toBe(200);
  });

  it('refuses a sign-in with no device id or a body that is not a name and password', async () => {
    const { app } = await tenantWithRoot(cs);
    const noDevice = await app.inject({ method: 'POST', url: '/api/auth/sign-in', payload: ROOT });
    expect(noDevice.statusCode).toBe(400);
    const badBody = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'x-device-id': DEVICE },
      payload: { name: ROOT.name },
    });
    expect(badBody.statusCode).toBe(400);
    expect(badBody.json<{ details: string }>().details).toContain('password');
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'x-device-id': DEVICE, 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expect(malformed.statusCode).toBe(400);
  });
});

describe("A session's secret is stored hashed, one session per device", () => {
  it('stores the hash of the secret and never the secret', async () => {
    const { app, client } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    const secret = body.authId.slice(body.authId.indexOf('.') + 1);
    const { session } = await sessionRecord(client);
    expect(session.secretHash).toBe(await sha256Hex(secret));
    expect(JSON.stringify(session)).not.toContain(secret);
    expect(session.user).toBe('root');
  });

  it('keeps one session per device: a new sign-in on it ends the old handle', async () => {
    const { app } = await tenantWithRoot(cs);
    const first = await signIn(app);
    const second = await signIn(app);
    expect(first.body.authId).not.toBe(second.body.authId);
    expect((await me(app, first.body.authId)).statusCode).toBe(401);
    expect((await me(app, second.body.authId)).statusCode).toBe(200);
  });

  it('keeps a session for each device', async () => {
    const { app } = await tenantWithRoot(cs);
    const phone = await signIn(app, ROOT, OTHER_DEVICE);
    const pc = await signIn(app, ROOT, DEVICE);
    expect((await me(app, phone.body.authId)).statusCode).toBe(200);
    expect((await me(app, pc.body.authId)).statusCode).toBe(200);
  });
});

describe('A session lasts a week; a reload keeps it; signing out ends it on that device', () => {
  it('runs a week from sign-in and not a moment longer', async () => {
    const { app, time } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    expect(body.expiresAt).toBe(time.now() + 7 * DAY_MS);
    time.advance(7 * DAY_MS - 1);
    expect((await me(app, body.authId)).statusCode).toBe(200);
    time.advance(2 * DAY_MS);
    expect((await me(app, body.authId)).statusCode).toBe(200);
  });

  it('ends at the week when nobody comes back to renew it', async () => {
    const { app, time } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    time.advance(7 * DAY_MS);
    expect((await me(app, body.authId)).statusCode).toBe(401);
  });

  it('keeps a session across reloads: the same handle answers again and again', async () => {
    const { app } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    for (let reload = 0; reload < 3; reload++) {
      expect((await me(app, body.authId)).statusCode).toBe(200);
    }
  });

  it('signs out on that device only', async () => {
    const { app, client } = await tenantWithRoot(cs);
    const phone = await signIn(app, ROOT, OTHER_DEVICE);
    const pc = await signIn(app, ROOT, DEVICE);
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: withAuth(pc.body.authId),
    });
    expect(out.statusCode).toBe(204);
    expect((await me(app, pc.body.authId)).statusCode).toBe(401);
    expect(await client.getRecord(recordKeys.session(DEVICE))).toBeNull();
    expect((await me(app, phone.body.authId)).statusCode).toBe(200);
  });

  it('answers a sign-out of no session, or of a handle a later sign-in replaced, with 204 and ends nothing', async () => {
    const { app } = await tenantWithRoot(cs);
    const old = await signIn(app);
    const current = await signIn(app);
    for (const headers of [{}, withAuth('not a handle'), withAuth(old.body.authId)]) {
      const out = await app.inject({ method: 'POST', url: '/api/auth/sign-out', headers });
      expect(out.statusCode).toBe(204);
    }
    expect((await me(app, current.body.authId)).statusCode).toBe(200);
  });

  it('refuses a handle that is missing, malformed, or has a wrong secret', async () => {
    const { app } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    const [device] = body.authId.split('.');
    const bare = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(bare.statusCode).toBe(401);
    for (const bad of [
      'nodot',
      `${device}.`,
      `${device}.x.y`,
      `${device}.wrong-secret`,
      'bad id.x',
    ]) {
      expect((await me(app, bad)).statusCode).toBe(401);
    }
  });

  it('refuses a session whose record cannot be read as a session, and a user no longer there', async () => {
    const { app, client } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    await client.putRecord(recordKeys.session(DEVICE), { nonsense: true });
    expect((await me(app, body.authId)).statusCode).toBe(401);

    const again = await signIn(app);
    await client.removeRecord(recordKeys.user('root'));
    expect((await me(app, again.body.authId)).statusCode).toBe(401);
  });

  it('renews a session in its last three days to a full week, keeping its handle and writing once', async () => {
    const { app, client, time } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    time.advance(5 * DAY_MS);
    expect((await me(app, body.authId)).statusCode).toBe(200);
    expect((await sessionRecord(client)).session.expiresAt).toBe(time.now() + 7 * DAY_MS);
    expect((await me(app, body.authId)).statusCode).toBe(200);
    time.advance(6 * DAY_MS);
    expect((await me(app, body.authId)).statusCode).toBe(200);
  });

  it('leaves a session with more than three days left unwritten', async () => {
    const { app, client, time } = await tenantWithRoot(cs);
    const { body } = await signIn(app);
    const before = await sessionRecord(client);
    time.advance(3 * DAY_MS);
    await me(app, body.authId);
    expect((await sessionRecord(client)).tag).toBe(before.tag);
  });
});

describe('Renewing a session writes with its tag, never blind', () => {
  const soonDue = async (
    wrap: (client: CStorageClient, move: () => Promise<unknown>) => CStorageClient,
  ) => {
    let move: () => Promise<unknown> = () => Promise.resolve();
    const tenant = await tenantWithRoot(cs, { wrap: (client) => wrap(client, () => move()) });
    const { body } = await signIn(tenant.app);
    tenant.time.advance(5 * DAY_MS);
    const was = await sessionRecord(tenant.client);
    return {
      ...tenant,
      authId: body.authId,
      was,
      onMove: (next: () => Promise<unknown>) => {
        move = next;
      },
    };
  };
  const key = recordKeys.session(DEVICE);

  it('does not overwrite a sign-in that landed between its read and its write', async () => {
    const t = await soonDue((client, move) => movesAfterRead(client, key, 1, move));
    const other = {
      ...t.was.session,
      secretHash: await sha256Hex('another sign-in'),
      expiresAt: t.time.now() + 7 * DAY_MS,
    };
    t.onMove(() => t.client.putRecord(key, other));
    expect((await me(t.app, t.authId)).statusCode).toBe(401);
    expect((await sessionRecord(t.client)).session).toEqual(other);
  });

  it('re-reads after a renewal that landed first and writes nothing over it', async () => {
    const t = await soonDue((client, move) => movesAfterRead(client, key, 1, move));
    const renewedElsewhere = { ...t.was.session, expiresAt: t.time.now() + 7 * DAY_MS + 1000 };
    t.onMove(() => t.client.putRecord(key, renewedElsewhere));
    expect((await me(t.app, t.authId)).statusCode).toBe(200);
    expect((await sessionRecord(t.client)).session).toEqual(renewedElsewhere);
  });

  it('gives up after a few moved reads, answers the session as it was and writes nothing blind', async () => {
    const t = await soonDue((client, move) => movesAfterRead(client, key, 3, move));
    let bumped = t.was.session.expiresAt;
    t.onMove(() => t.client.putRecord(key, { ...t.was.session, expiresAt: ++bumped }));
    expect((await me(t.app, t.authId)).statusCode).toBe(200);
    expect((await sessionRecord(t.client)).session.expiresAt).toBe(t.was.session.expiresAt + 3);
  });

  it('does not report a sign-out done while its session keeps moving', async () => {
    const t = await soonDue((client, move) => movesAfterRead(client, key, 3, move));
    let bumped = t.was.session.expiresAt;
    t.onMove(() => t.client.putRecord(key, { ...t.was.session, expiresAt: ++bumped }));
    const out = await t.app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: withAuth(t.authId),
    });
    expect(out.statusCode).toBe(503);
    expect(await t.client.getRecord(key)).not.toBeNull();
  });
});

describe('A session that cannot be read (c-storage down or erroring) answers 503, never 401', () => {
  const callsWithAHandle = (app: Awaited<ReturnType<typeof tenantWithRoot>>['app']) => [
    me(app, `${DEVICE}.some-secret`),
    app.inject({ method: 'GET', url: '/api/config' }),
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: { 'x-device-id': DEVICE },
      payload: ROOT,
    }),
    app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: withAuth(`${DEVICE}.some-secret`),
    }),
    app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(`${DEVICE}.some-secret`),
      payload: {
        version: null,
        config: {
          name: 'X',
          logo: null,
          colour: '#000000',
          languages: ['en'],
          defaultLanguage: 'en',
        },
      },
    }),
  ];

  const toServer = (overrides: { baseUrl?: string; accessKey?: string }) =>
    createCStorageClient({
      baseUrl: cs.baseUrl,
      internalAccessKey: cs.internalAccessKey,
      serviceCode: 'any',
      accessKey: 'any',
      ...overrides,
    });

  it('answers 503 while c-storage is down', async () => {
    const baseUrl = `http://127.0.0.1:${await freePort()}`;
    const t = await tenantWithRoot(cs, { wrap: () => toServer({ baseUrl }) });
    for (const response of await Promise.all(callsWithAHandle(t.app))) {
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: 'Service unavailable' });
    }
  });

  it('answers 503 while c-storage refuses the BFF, as with a wrong access key', async () => {
    const t = await tenantWithRoot(cs, { wrap: () => toServer({ accessKey: 'not the key' }) });
    for (const response of await Promise.all(callsWithAHandle(t.app))) {
      expect(response.statusCode).toBe(503);
    }
  });
});
