import {
  CREDO_COLOUR,
  resolvePermissions,
  type CStorageClient,
  CStorageError,
  configDocSchema,
  clientListReplySchema,
  createClientReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  recordKeys,
  sessionReplySchema,
  storedClientSchema,
  storedUserSchema,
} from '@credo/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import {
  bffOn,
  DAY_MS,
  DEVICE,
  OPERATOR,
  ROOT,
  scoped,
  seedOperator,
  seedTenant,
  signIn,
  withAuth,
} from '../tests/tenant';
import { createClient } from './clients';
import { verifyPassword } from './password';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Options = Parameters<typeof bffOn>[1];

/** The BFF with the operator's account seeded, as `pnpm stack` leaves it. */
async function withOperator(options: Options = {}) {
  const t = await bffOn(cs, options);
  await seedOperator(t.client);
  return t;
}

type App = Awaited<ReturnType<typeof bffOn>>['app'];

const operatorSignIn = (app: App, credentials: object = OPERATOR, device = DEVICE) =>
  app.inject({
    method: 'POST',
    url: '/api/operator/sign-in',
    headers: { 'x-device-id': device },
    payload: credentials,
  });

async function signedInOperator(options: Options = {}) {
  const t = await withOperator(options);
  const authId = operatorSessionReplySchema.parse((await operatorSignIn(t.app)).json()).authId;
  const make = async (payload: object, headers: Record<string, string> = withAuth(authId)) =>
    await t.app.inject({ method: 'POST', url: '/api/operator/clients', headers, payload });
  return { ...t, authId, make };
}

const acme = { code: 'acme', name: 'Acme Trading' };

describe('The operator signs in at /operator with a name and password of its own', () => {
  it('opens a session for the operator and answers who it is', async () => {
    const t = await withOperator();
    const signedIn = await operatorSignIn(t.app);
    expect(signedIn.statusCode).toBe(200);
    const session = operatorSessionReplySchema.parse(signedIn.json());
    expect(session.operator).toEqual({ name: 'operator' });
    const me = await t.app.inject({
      method: 'GET',
      url: '/api/operator/me',
      headers: withAuth(session.authId),
    });
    expect(operatorMeReplySchema.parse(me.json())).toEqual({ operator: { name: 'operator' } });
    expect(
      await t.client.getRecord(recordKeys.operatorSession(session.authId.split('.')[0])),
    ).not.toBeNull();
  });

  it('answers an unknown name and a wrong password with the same 401 and opens nothing', async () => {
    const t = await withOperator();
    const unknown = await operatorSignIn(t.app, { name: 'nobody', password: OPERATOR.password });
    const wrong = await operatorSignIn(t.app, { name: OPERATOR.name, password: 'not it' });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.body).toBe(wrong.body);
    expect(wrong.statusCode).toBe(401);
    expect((await t.client.listRecords('operator.session.')).records).toEqual([]);
  });

  it('refuses a sign-in with no device id, and a body that is not a name and password', async () => {
    const t = await withOperator();
    const noDevice = await t.app.inject({
      method: 'POST',
      url: '/api/operator/sign-in',
      payload: OPERATOR,
    });
    expect(noDevice.statusCode).toBe(400);
    expect((await operatorSignIn(t.app, { name: 'operator' })).statusCode).toBe(400);
  });

  it('is not opened by a client’s sign-in: a root’s name and password are no operator’s', async () => {
    const t = await withOperator();
    await seedTenant(t.client, 'acme');
    expect((await operatorSignIn(t.app, ROOT)).statusCode).toBe(401);
    expect(
      (await operatorSignIn(t.app, { name: ROOT.name, password: OPERATOR.password })).statusCode,
    ).toBe(401);
  });

  it('opens no client: its handle is no client’s, whatever code is sent', async () => {
    const t = await withOperator();
    await seedTenant(t.client, 'acme');
    const { authId } = operatorSessionReplySchema.parse((await operatorSignIn(t.app)).json());
    const acmeApp = scoped(t.app, 'acme');
    const me = await acmeApp.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: withAuth(authId),
    });
    expect(me.statusCode).toBe(401);
    const save = await acmeApp.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(authId),
      payload: { version: null, config: {} },
    });
    expect(save.statusCode).toBe(401);
  });

  it('ends its session on sign-out, and a handle that names none ends nothing', async () => {
    const t = await signedInOperator();
    const out = await t.app.inject({
      method: 'POST',
      url: '/api/operator/sign-out',
      headers: withAuth(t.authId),
    });
    expect(out.statusCode).toBe(204);
    expect(await t.client.getRecord(recordKeys.operatorSession(t.authId.split('.')[0]))).toBeNull();
    const again = await t.app.inject({ method: 'POST', url: '/api/operator/sign-out' });
    expect(again.statusCode).toBe(204);
  });
});

describe('An operator route without the operator’s session is a 401, and a client’s session is not one', () => {
  it('refuses me, make-a-client and the list with no handle, a made-up one, and a client root’s', async () => {
    const t = await withOperator();
    await seedTenant(t.client, 'other-co');
    const root = await signIn(scoped(t.app, 'other-co'));
    const handles = [undefined, `${DEVICE}.made-up`, root.body.authId];
    for (const handle of handles) {
      const headers = handle ? withAuth(handle) : {};
      const me = await t.app.inject({ method: 'GET', url: '/api/operator/me', headers });
      const make = await t.app.inject({
        method: 'POST',
        url: '/api/operator/clients',
        headers,
        payload: acme,
      });
      const list = await t.app.inject({ method: 'GET', url: '/api/operator/clients', headers });
      expect([me.statusCode, make.statusCode, list.statusCode]).toEqual([401, 401, 401]);
      expect(list.body).not.toContain('other-co');
    }
    expect(await t.client.getRecord(recordKeys.client(acme.code))).toBeNull();
  });
});

describe('The operator makes a client from a code and the company’s name, and is shown its link, root and password once', () => {
  it('answers the link’s path, the root’s name and a first password that signs the root in', async () => {
    const t = await signedInOperator();
    const made = await t.make({ code: 'acme', name: '  Acme Trading ' });
    expect(made.statusCode).toBe(201);
    const reply = createClientReplySchema.parse(made.json());
    expect(reply.link).toBe('/login?client-code=acme');
    expect(reply.rootName).toBe('root');
    expect(reply.password.length).toBeGreaterThanOrEqual(16);

    const signedIn = await signIn(scoped(t.app, 'acme'), {
      name: reply.rootName,
      password: reply.password,
    });
    expect(signedIn.response.statusCode).toBe(200);
    expect(sessionReplySchema.parse(signedIn.body).user).toEqual({
      name: 'root',
      root: true,
      permissions: resolvePermissions([], true),
    });
    const index = storedClientSchema.parse((await t.client.getRecord('client.acme'))?.data);
    expect(index.name).toBe('Acme Trading');
  });

  it('gives each client a first password of its own', async () => {
    const t = await signedInOperator();
    const one = createClientReplySchema.parse((await t.make(acme)).json());
    const two = createClientReplySchema.parse((await t.make({ ...acme, code: 'beta' })).json());
    expect(one.password).not.toBe(two.password);
  });

  it('refuses a code or name that is not the exact form, and writes nothing', async () => {
    const t = await signedInOperator();
    const bodies = [
      { code: 'Acme', name: 'A' },
      { code: 'ab', name: 'A' },
      { code: 'acme', name: '  ' },
      { code: 'acme' },
      { code: 'acme', name: 'A', extra: 1 },
    ];
    for (const body of bodies) expect((await t.make(body)).statusCode).toBe(400);
    expect(await t.client.getRecord(recordKeys.client('acme'))).toBeNull();
  });
});

describe('A code already taken is refused, and the client that holds it is unchanged', () => {
  it('answers 409 and leaves the index, the settings and the root’s password as they were', async () => {
    const t = await signedInOperator();
    const first = createClientReplySchema.parse((await t.make(acme)).json());
    const indexBefore = await t.client.getRecord(recordKeys.client('acme'));
    const id = storedClientSchema.parse(indexBefore?.data).id;
    const keys = recordKeys.tenant(id);
    const configBefore = await t.client.getRecord(keys.config);
    const rootBefore = await t.client.getRecord(keys.user('root'));

    const again = await t.make({ code: 'acme', name: 'Someone Else' });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'That code is taken' });

    expect(await t.client.getRecord(recordKeys.client('acme'))).toEqual(indexBefore);
    expect(await t.client.getRecord(keys.config)).toEqual(configBefore);
    expect(await t.client.getRecord(keys.user('root'))).toEqual(rootBefore);
    const stillIn = await signIn(scoped(t.app, 'acme'), { name: 'root', password: first.password });
    expect(stillIn.response.statusCode).toBe(200);
  });
});

describe('A new client starts with its name, credo’s colour, no logo and both languages, and its root changes them', () => {
  it('serves the starting settings to its link and lets its root save a change over them', async () => {
    const t = await signedInOperator();
    const reply = createClientReplySchema.parse((await t.make(acme)).json());
    const app = scoped(t.app, 'acme');

    const read = await app.inject({ method: 'GET', url: '/api/config' });
    const doc = configDocSchema.parse(read.json());
    expect(doc.config).toEqual({
      name: 'Acme Trading',
      logo: null,
      colour: CREDO_COLOUR,
      languages: ['vi', 'en'],
      defaultLanguage: 'vi',
    });

    const { body } = await signIn(app, { name: 'root', password: reply.password });
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(body.authId),
      payload: { version: doc.version, config: { ...doc.config, colour: '#112233' } },
    });
    expect(saved.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: '/api/config' });
    expect(configDocSchema.parse(after.json()).config.colour).toBe('#112233');
  });
});

/** Every write and read the BFF makes, in order, and optional hooks to fail or race on one. */
function watched(
  client: CStorageClient,
  hooks: { beforePut?: (key: string) => Promise<void> } = {},
) {
  const calls: { op: 'get' | 'put'; key: string; ifTag?: string | null }[] = [];
  const wrapped: CStorageClient = {
    ...client,
    async getRecord(key) {
      calls.push({ op: 'get', key });
      return await client.getRecord(key);
    },
    async putRecord(key, data, ifTag) {
      calls.push({ op: 'put', key, ifTag });
      await hooks.beforePut?.(key);
      return await client.putRecord(key, data, ifTag);
    },
  };
  return { calls, wrapped };
}

describe('Create writes the tenant’s records before the code’s index, each If-None-Match: *', () => {
  it('writes the settings, then the root, then the index, each only where nothing exists', async () => {
    let calls: ReturnType<typeof watched>['calls'] = [];
    const t = await signedInOperator({
      wrap: (client) => {
        const w = watched(client);
        calls = w.calls;
        return w.wrapped;
      },
    });
    calls.length = 0;
    expect((await t.make(acme)).statusCode).toBe(201);
    const puts = calls.filter((call) => call.op === 'put');
    expect(puts.map((call) => call.key.replace(/tenant\.[^.]+\./, 'tenant.<id>.'))).toEqual([
      'tenant.<id>.config',
      'tenant.<id>.user.root',
      'client.acme',
    ]);
    expect(puts.map((call) => call.ifTag)).toEqual([null, null, null]);
  });

  it('answers 409 when the code was taken in between, and the rival’s index stands', async () => {
    const rival = { id: randomUUID(), name: 'Rival' };
    const t = await signedInOperator({
      wrap: (client) =>
        watched(client, {
          beforePut: async (key) => {
            if (key === 'client.acme') await client.putRecord(key, rival, null);
          },
        }).wrapped,
    });
    const made = await t.make(acme);
    expect(made.statusCode).toBe(409);
    expect((await t.client.getRecord(recordKeys.client('acme')))?.data).toEqual(rival);
  });

  it('leaves the code free when a write before the index fails, and a retry makes the client', async () => {
    let failing = true;
    const t = await signedInOperator({
      wrap: (client) =>
        watched(client, {
          beforePut: (key) => {
            if (failing && key.endsWith('.user.root')) {
              return Promise.reject(new CStorageError(null, 'c-storage did not answer'));
            }
            return Promise.resolve();
          },
        }).wrapped,
    });
    expect((await t.make(acme)).statusCode).toBe(503);
    expect(await t.client.getRecord(recordKeys.client('acme'))).toBeNull();
    failing = false;
    expect((await t.make(acme)).statusCode).toBe(201);
  });

  it('answers 503 and writes no index when a record already sat under the fresh id', async () => {
    const t = await signedInOperator({
      wrap: (client) => ({
        ...client,
        putRecord: (key, data, ifTag) =>
          Promise.resolve(key.endsWith('.config') ? 'moved' : client.putRecord(key, data, ifTag)),
      }),
    });
    expect((await t.make(acme)).statusCode).toBe(503);
    expect(await t.client.getRecord(recordKeys.client('acme'))).toBeNull();
  });

  it('writes nothing at all for a code that is taken', async () => {
    let calls: ReturnType<typeof watched>['calls'] = [];
    const t = await signedInOperator({
      wrap: (client) => {
        const w = watched(client);
        calls = w.calls;
        return w.wrapped;
      },
    });
    await t.make(acme);
    calls.length = 0;
    expect((await t.make(acme)).statusCode).toBe(409);
    expect(calls.filter((call) => call.op === 'put')).toEqual([]);
  });
});

describe('A root’s first password is random per client, stored only as its scrypt hash, and in no log line', () => {
  it('stores a hash that verifies the password, and the password nowhere', async () => {
    const t = await signedInOperator();
    const reply = createClientReplySchema.parse((await t.make(acme)).json());
    const id = storedClientSchema.parse((await t.client.getRecord('client.acme'))?.data).id;
    const keys = recordKeys.tenant(id);
    const user = storedUserSchema.parse((await t.client.getRecord(keys.user('root')))?.data);
    expect(user.root).toBe(true);
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword(reply.password, user.passwordHash as string)).toBe(true);
    for (const key of [keys.config, keys.user('root'), recordKeys.client('acme')]) {
      expect(JSON.stringify((await t.client.getRecord(key))?.data)).not.toContain(reply.password);
    }
  });

  it('is in no line the BFF logs while it makes the client, nor are the operator’s or the root’s', async () => {
    const lines: string[] = [];
    const t = await signedInOperator({
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    const reply = createClientReplySchema.parse((await t.make(acme)).json());
    await signIn(scoped(t.app, 'acme'), { name: 'root', password: reply.password });
    await signIn(scoped(t.app, 'acme'), { name: 'root', password: 'a wrong password' });
    // The search means something only if the log holds the calls it searches.
    expect(lines.filter((line) => line.includes('/api/operator/clients')).length).toBeGreaterThan(
      0,
    );
    const log = lines.join('\n');
    expect(log).not.toContain(reply.password);
    expect(log).not.toContain(OPERATOR.password);
    expect(log).not.toContain('a wrong password');
    expect(log).not.toContain('scrypt$');
  });
});

describe('The operator never reads or changes a client, never sees a root’s password again, and never signs in as one: no route does', () => {
  it('serves exactly these routes, and no other reaches a tenant’s settings, users or sessions', async () => {
    const t = await withOperator();
    await t.app.ready();
    const routes = t.app.printRoutes({ commonPrefix: false, includeHooks: false });
    expect(routes).toBe(
      `${[
        '├── /api/config (GET, HEAD, PUT)',
        '├── /api/auth/sign-in (POST)',
        '│   └── -qr (POST)',
        '├── /api/auth/sign-out (POST)',
        '├── /api/auth/password (PUT)',
        '├── /api/auth/me (GET, HEAD)',
        '├── /api/operator/sign-in (POST)',
        '├── /api/operator/sign-out (POST)',
        '├── /api/operator/me (GET, HEAD)',
        '├── /api/operator/clients (GET, HEAD, POST)',
        '├── /api/staff-setup (GET, HEAD, PUT)',
        '└── /api/employees (GET, HEAD, POST)',
        '    ├── /import (POST)',
        '    └── /:id (GET, HEAD, PUT)',
        '        ├── /archive (POST)',
        '        ├── /password (PUT)',
        '        ├── /photo (GET, HEAD, PUT)',
        '        ├── /code (PUT)',
        '        ├── /email (PUT)',
        '        └── /qr (POST)',
      ].join('\n')}\n`,
    );
  });
});

describe('The operator is shown every client on the stack, newest first, from the index alone', () => {
  const list = (t: Awaited<ReturnType<typeof signedInOperator>>) =>
    t.app.inject({ method: 'GET', url: '/api/operator/clients', headers: withAuth(t.authId) });

  it('lists each client’s code, name as made, made-on time and link path, newest first, those with no time after them by code', async () => {
    const t = await signedInOperator();
    await seedTenant(t.client, 'zeta-co');
    await seedTenant(t.client, 'alpha-co');
    await createClient(t.client, {
      code: 'older',
      name: 'Older',
      madeAt: Date.UTC(2026, 8, 1, 12),
    });
    expect((await t.make(acme)).statusCode).toBe(201);
    t.time.advance(DAY_MS);
    expect((await t.make({ code: 'newer', name: 'Newer' })).statusCode).toBe(201);

    const answer = await list(t);
    expect(answer.statusCode).toBe(200);
    const { clients } = clientListReplySchema.parse(answer.json());
    expect(clients.map((client) => client.code)).toEqual([
      'newer',
      'acme',
      'older',
      'alpha-co',
      'zeta-co',
    ]);
    expect(clients[0]).toEqual({
      code: 'newer',
      name: 'Newer',
      madeAt: Date.UTC(2026, 9, 29, 9),
      link: '/login?client-code=newer',
    });
    expect(clients.map((client) => client.madeAt)).toEqual([
      Date.UTC(2026, 9, 29, 9),
      Date.UTC(2026, 9, 28, 9),
      Date.UTC(2026, 8, 1, 12),
      null,
      null,
    ]);
  });

  it('The link’s path is the one the create answered, built by one function', async () => {
    const t = await signedInOperator();
    const made = createClientReplySchema.parse((await t.make(acme)).json());

    const { clients } = clientListReplySchema.parse((await list(t)).json());
    expect(clients.map((client) => client.link)).toEqual([made.link]);
  });

  it('Create writes the time of the BFF’s own clock into the index, and a time sent by the caller is refused', async () => {
    const t = await signedInOperator();
    expect((await t.make({ ...acme, madeAt: 5 })).statusCode).toBe(400);
    expect(await t.client.getRecord(recordKeys.client(acme.code))).toBeNull();

    expect((await t.make(acme)).statusCode).toBe(201);
    const index = storedClientSchema.parse((await t.client.getRecord('client.acme'))?.data);
    expect(index.madeAt).toBe(Date.UTC(2026, 9, 28, 9));
  });

  it('shows the name given when the client was made, though its root has renamed the company since', async () => {
    const t = await signedInOperator();
    const made = createClientReplySchema.parse((await t.make(acme)).json());
    const app = scoped(t.app, 'acme');
    const root = await signIn(app, { name: made.rootName, password: made.password });
    const doc = configDocSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/config',
          headers: withAuth(root.body.authId),
        })
      ).json(),
    );
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: withAuth(root.body.authId),
      payload: { config: { ...doc.config, name: 'Renamed Trading' }, version: doc.version },
    });
    expect(saved.statusCode).toBe(200);

    const { clients } = clientListReplySchema.parse((await list(t)).json());
    expect(clients.map((client) => client.name)).toEqual(['Acme Trading']);
  });

  it('A code already taken leaves the client that holds it as it was, in the list too', async () => {
    const t = await signedInOperator();
    await t.make(acme);
    t.time.advance(DAY_MS);
    expect((await t.make({ code: 'acme', name: 'Other Name' })).statusCode).toBe(409);

    const { clients } = clientListReplySchema.parse((await list(t)).json());
    expect(clients).toEqual([
      {
        code: 'acme',
        name: 'Acme Trading',
        madeAt: Date.UTC(2026, 9, 28, 9),
        link: '/login?client-code=acme',
      },
    ]);
  });

  it('reads no record of a client’s own: a list over one reads the prefix once and nothing else', async () => {
    let calls: ReturnType<typeof watched>['calls'] = [];
    const t = await signedInOperator({
      wrap: (client) => {
        const w = watched(client);
        calls = w.calls;
        return {
          ...w.wrapped,
          listRecords: (prefix) => {
            calls.push({ op: 'get', key: `list:${prefix}` });
            return client.listRecords(prefix);
          },
        };
      },
    });
    await t.make(acme);
    calls.length = 0;
    await list(t);

    const own = calls.filter((call) => !call.key.startsWith('operator.'));
    expect(own).toEqual([{ op: 'get', key: 'list:client.' }]);
  });

  it('answers 500, naming no key, when c-storage holds more than it returned, a record does not parse or a key holds no code', async () => {
    const broken = {
      more: { records: [], more: true },
      record: {
        records: [{ key: 'client.secret-co', data: { id: 'not an id' }, tag: 'x' }],
        more: false,
      },
      key: {
        records: [
          {
            key: 'client.NOT A CODE',
            data: { id: '3f2a91bc-0000-4000-8000-000000000001', name: 'X' },
            tag: 'x',
          },
        ],
        more: false,
      },
    };
    for (const [kind, reply] of Object.entries(broken)) {
      const t = await signedInOperator({
        wrap: (client) => ({ ...client, listRecords: () => Promise.resolve(reply) }),
      });
      const answer = await list(t);
      expect(answer.statusCode, kind).toBe(500);
      expect(answer.body, kind).not.toContain('secret-co');
      expect(answer.body, kind).not.toContain('NOT A CODE');
    }
  });

  it('logs each of those 500s by its kind, holding neither the key nor a value', async () => {
    const broken = {
      'the client list is longer than c-storage returns': { records: [], more: true },
      'a client index record does not parse': {
        records: [
          { key: 'client.secret-co', data: { id: 'not an id', name: 'Secret Name' }, tag: 'x' },
        ],
        more: false,
      },
      'a client index key holds no client code': {
        records: [
          {
            key: 'client.NOT A CODE',
            data: { id: '3f2a91bc-0000-4000-8000-000000000001', name: 'X' },
            tag: 'x',
          },
        ],
        more: false,
      },
    };
    for (const [kind, reply] of Object.entries(broken)) {
      const lines: string[] = [];
      const t = await signedInOperator({
        wrap: (client) => ({ ...client, listRecords: () => Promise.resolve(reply) }),
        logger: { stream: { write: (line: string) => void lines.push(line) } },
      });
      const answer = await list(t);
      const log = lines.join('\n');

      expect(answer.statusCode, kind).toBe(500);
      expect(log, kind).toContain(kind);
      for (const held of ['secret-co', 'Secret Name', 'NOT A CODE']) {
        expect(log, `${kind}: ${held}`).not.toContain(held);
      }
    }
  });

  it('answers 503 when c-storage does not answer, never a signed-out 401', async () => {
    const t = await signedInOperator({
      wrap: (client) => ({
        ...client,
        listRecords: () => Promise.reject(new CStorageError(null, 'c-storage did not answer')),
      }),
    });

    expect((await list(t)).statusCode).toBe(503);
  });
});

describe('No BFF answer carries c-storage’s /health body', () => {
  it('answers a path that is c-storage’s health, or names it, with the BFF’s own 404', async () => {
    const t = await signedInOperator();
    await seedTenant(t.client, 'acme');
    const app = scoped(t.app, 'acme');
    const answers = await Promise.all([
      app.inject({ method: 'GET', url: '/health' }),
      app.inject({ method: 'GET', url: '/api/health' }),
      app.inject({ method: 'GET', url: '/api/operator/health', headers: withAuth(t.authId) }),
      app.inject({ method: 'GET', url: '/api/config' }),
    ]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404, 404]);
    for (const answer of answers) {
      expect(answer.body).not.toContain('buildVersion');
      expect(answer.body).not.toContain('"OK"');
    }
  });
});

describe('The local stack makes its demo client by the same function, with settings of its own', () => {
  it('starts the client on the settings it is given over the starting ones', async () => {
    const t = await bffOn(cs);
    const made = await createClient(t.client, {
      code: 'demo',
      name: 'Minh Phát',
      madeAt: Date.UTC(2026, 8, 14, 12),
      settings: { colour: '#2f7d6d', languages: ['vi'] },
    });
    if (made === 'taken') throw new Error('the code was free');
    const doc = configDocSchema.parse(
      (await scoped(t.app, 'demo').inject({ method: 'GET', url: '/api/config' })).json(),
    );
    expect(doc.config).toMatchObject({ name: 'Minh Phát', colour: '#2f7d6d', languages: ['vi'] });
  });
});
