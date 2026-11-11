import {
  type CStorageClient,
  CStorageError,
  optionsReplySchema,
  passwordIsValid,
  recordKeys,
  rootPasswordReplySchema,
  storedUserSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SoftwareAuthenticator } from '../../tests/authenticator';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { joinedOperator, post, touchFor } from '../../tests/operator';
import {
  bffOn,
  CODE,
  ORIGIN,
  ROOT,
  scoped,
  seedTenant,
  signIn,
  withAuth,
} from '../../tests/tenant';
import { verifyPassword } from '../calling/password';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Options = Parameters<typeof bffOn>[1];
const TYPED = 'Mat-khau-moi-1!';

/** An operator signed in, a client with a root whose password the test knows, and a way to set the
 * root's password with a fresh touch made for that act. */
async function setup(options: Options = {}) {
  const t = await bffOn(cs, options);
  const op = await joinedOperator(t);
  const id = await seedTenant(t.client, CODE);
  const keys = recordKeys.tenant(id);
  const asRoot = scoped(t.app, CODE);
  const route = (code = CODE) => `/api/operator/clients/${code}/root-password`;
  /** The touch the act needs, by default one of the operator's own passkeys made for this act. */
  const touch = () => touchFor(t, op.authId, op.authenticator, 'root-password');
  const set = async (
    password: string | null,
    { code = CODE, headers = withAuth(op.authId), confirm }: Record<string, unknown> = {},
  ) =>
    await t.app.inject({
      method: 'POST',
      url: route(code as string),
      headers: headers as Record<string, string>,
      payload: { password, confirm: confirm ?? (await touch()) },
    });
  const root = async () => {
    const found = await t.client.getRecord(keys.user('root'));
    return { user: storedUserSchema.parse(found!.data), tag: found!.tag };
  };
  /** Every record of the client, with its tag: what a setting may and may not touch. */
  const tenantRecords = async () =>
    (await t.client.listRecords(`tenant.${id}.`)).records.map((r) => `${r.key}@${r.tag}`).sort();
  return { ...t, op, id, keys, asRoot, route, touch, set, root, tenantRecords };
}

/** A client whose write to the root's record, the first `times`, is the one given. */
const failingRootWrite = (times: number, fail: () => Promise<unknown>) => {
  const state = { left: times };
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    putRecord: async (key, data, tag) => {
      if (key.endsWith('.user.root') && state.left > 0) {
        state.left--;
        await fail();
      }
      return await client.putRecord(key, data, tag);
    },
  });
  return wrap;
};

describe('An operator sets a client’s root password anew, with a fresh touch of their own passkey', () => {
  it('sets a typed password: the answer says none was made, and the root signs in with it and no longer with the old one', async () => {
    const t = await setup();
    const answer = await t.set(TYPED);

    expect(answer.statusCode).toBe(200);
    expect(rootPasswordReplySchema.parse(answer.json())).toEqual({ made: null });
    expect(JSON.stringify(answer.json())).not.toContain(TYPED);
    expect((await signIn(t.asRoot, { name: 'root', password: TYPED })).response.statusCode).toBe(
      200,
    );
    expect((await signIn(t.asRoot, ROOT)).response.statusCode).toBe(401);
  });

  it('with none typed, makes one that passes the typed rule, answers it once, and the root signs in with it', async () => {
    const t = await setup();
    const answer = await t.set(null);

    expect(answer.statusCode).toBe(200);
    const { made } = rootPasswordReplySchema.parse(answer.json());
    expect(made).not.toBeNull();
    expect(passwordIsValid(made!)).toBe(true);
    expect((await signIn(t.asRoot, { name: 'root', password: made! })).response.statusCode).toBe(
      200,
    );
    expect((await signIn(t.asRoot, ROOT)).response.statusCode).toBe(401);
  });

  it('hashes a word in its composed form, so one typed composed and decomposed signs in', async () => {
    const t = await setup();
    const composed = 'Mật-khẩu-mới-1!'.normalize('NFC');
    await t.set(composed.normalize('NFD'));

    expect((await signIn(t.asRoot, { name: 'root', password: composed })).response.statusCode).toBe(
      200,
    );
  });

  it('writes the root’s sign-in record alone: its other fields kept, a new hash, a new generation, when it changed, and no word of who set it', async () => {
    const t = await setup();
    const before = await t.root();
    const others = await t.tenantRecords();
    t.time.advance(60 * 1000);
    await t.set(TYPED);

    const after = await t.root();
    expect(Object.keys(after.user).sort()).toEqual(Object.keys(before.user).sort());
    expect(after.user.root).toBe(true);
    expect(after.user.employeeId).toBeNull();
    expect(after.user.passwordHash).not.toBe(before.user.passwordHash);
    expect(await verifyPassword(TYPED, after.user.passwordHash!)).toBe(true);
    expect(after.user.passwordAt).toBe(t.time.now());
    expect(after.user.generation).not.toBe(before.user.generation);
    expect(after.user.generation).not.toBe('');
    expect(JSON.stringify(after.user)).not.toContain(t.op.id);
    const changed = (await t.tenantRecords()).filter((record) => !others.includes(record));
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain('.user.root@');
  });

  it('ends the root’s sessions by their generation: the old one is refused at its next call', async () => {
    const t = await setup();
    const { body } = await signIn(t.asRoot);
    const mine = () =>
      t.asRoot.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(body.authId) });
    expect((await mine()).statusCode).toBe(200);
    const answer = await t.set(null);

    expect(answer.statusCode).toBe(200);
    expect((await mine()).statusCode).toBe(401);
  });

  it('keeps the root’s session records (no sweep runs yet) and renews the operator’s session as any use does', async () => {
    const t = await setup();
    const { body } = await signIn(t.asRoot);
    const sessionKey = recordKeys.tenant(t.id).session(body.authId.split('.')[0]);
    const operatorKey = recordKeys.operatorSession(t.op.authId.split('.')[0]);
    const issued = (await t.client.getRecord(operatorKey))!.tag;
    t.time.advance(30 * 60 * 1000);
    await t.set(TYPED);

    expect(await t.client.getRecord(sessionKey)).not.toBeNull();
    expect((await t.client.getRecord(operatorKey))!.tag).not.toBe(issued);
  });

  it('the operator reads nothing of the client: the answer holds the made password or none, and the client’s other records are as they were', async () => {
    const t = await setup();
    const before = await t.tenantRecords();
    const answer = await t.set(null);

    expect(Object.keys(answer.json<object>())).toEqual(['made']);
    const after = await t.tenantRecords();
    expect(after.filter((record) => !before.includes(record))).toHaveLength(1);
    expect(after).toHaveLength(before.length);
  });
});

describe('Setting a root’s password needs the operator, the client’s code and the fresh touch', () => {
  it('is a 401 with no sign-in, a wrong handle, or a client root’s handle, and nothing is written', async () => {
    const t = await setup();
    const root = await signIn(t.asRoot);
    const before = await t.root();
    const payload = { password: TYPED, confirm: await t.touch() };

    for (const headers of [{}, withAuth('not-a-handle'), withAuth(root.body.authId)]) {
      const answer = await t.app.inject({ method: 'POST', url: t.route(), headers, payload });
      expect(answer.statusCode).toBe(401);
    }
    expect((await t.root()).tag).toBe(before.tag);
  });

  it('is a 400 for a malformed code and a 404 for an unknown one, before anything of a client is read', async () => {
    const t = await setup();

    expect((await t.set(TYPED, { code: 'Not A Code' })).statusCode).toBe(400);
    expect((await t.set(TYPED, { code: 'nobody-here' })).statusCode).toBe(404);
  });

  it('is a 400 for a password that breaks the typed rule, a body with more, or no touch in it, and nothing is written', async () => {
    const t = await setup();
    const before = await t.root();
    const send = (payload: object) =>
      t.app.inject({ method: 'POST', url: t.route(), headers: withAuth(t.op.authId), payload });

    expect((await send({ password: 'weak', confirm: await t.touch() })).statusCode).toBe(400);
    expect((await send({ password: TYPED })).statusCode).toBe(400);
    expect((await send({ confirm: await t.touch() })).statusCode).toBe(400);
    expect((await send({ password: TYPED, confirm: await t.touch(), more: 1 })).statusCode).toBe(
      400,
    );
    expect((await t.root()).tag).toBe(before.tag);
  });

  it('is a 403 without a touch made for this act, by this operator, once, and nothing is written', async () => {
    const t = await setup();
    const before = await t.root();
    const stranger = await joinedOperator(t, 'stranger');

    const forAdd = await touchFor(t, t.op.authId, t.op.authenticator, 'add');
    expect((await t.set(TYPED, { confirm: forAdd })).statusCode).toBe(403);
    const strangers = await touchFor(t, stranger.authId, stranger.authenticator, 'root-password');
    expect((await t.set(TYPED, { confirm: strangers })).statusCode).toBe(403);
    const forgery = await touchFor(t, t.op.authId, t.op.authenticator, 'root-password', {
      tamper: true,
    });
    expect((await t.set(TYPED, { confirm: forgery })).statusCode).toBe(403);
    const unverified = await touchFor(t, t.op.authId, t.op.authenticator, 'root-password', {
      verified: false,
    });
    expect((await t.set(TYPED, { confirm: unverified })).statusCode).toBe(403);
    const other = new SoftwareAuthenticator(ORIGIN);
    const options = await post(
      t.app,
      '/api/operator/passkeys/confirm-options',
      {
        act: 'root-password',
      },
      t.op.authId,
    );
    const asked = optionsReplySchema.parse(options.json());
    const confirm = { token: asked.token, response: other.authenticate(asked.options) };
    expect((await t.set(TYPED, { confirm })).statusCode).toBe(403);
    expect((await t.root()).tag).toBe(before.tag);

    const once = await t.touch();
    expect((await t.set(TYPED, { confirm: once })).statusCode).toBe(200);
    expect((await t.set('Another-one-2@', { confirm: once })).statusCode).toBe(403);
    expect(await verifyPassword(TYPED, (await t.root()).user.passwordHash!)).toBe(true);
  });

  it('reaches one client only: another client’s root is as it was', async () => {
    const t = await setup();
    const other = await seedTenant(t.client, 'other-co');
    const before = (await t.client.getRecord(recordKeys.tenant(other).user('root')))!.tag;
    await t.set(TYPED);

    expect((await t.client.getRecord(recordKeys.tenant(other).user('root')))!.tag).toBe(before);
  });
});

describe('A setting that cannot be written changes nothing', () => {
  it('writes the root only while the record reads root: one that is not the root’s, or none, is a 500 and nothing is written', async () => {
    const notRoot = await setup();
    const held = (await notRoot.root()).user;
    await notRoot.client.putRecord(notRoot.keys.user('root'), { ...held, root: false });
    const before = await notRoot.root();

    expect((await notRoot.set(TYPED)).statusCode).toBe(500);
    expect((await notRoot.root()).tag).toBe(before.tag);

    const none = await setup();
    const found = await none.client.getRecord(none.keys.user('root'));
    await none.client.removeRecord(none.keys.user('root'), found!.tag);

    expect((await none.set(TYPED)).statusCode).toBe(500);
    expect(await none.client.getRecord(none.keys.user('root'))).toBeNull();
  });

  it('says 503 and leaves the old password when the store fails the write', async () => {
    const t = await setup({
      wrap: failingRootWrite(99, () => Promise.reject(new CStorageError(500, 'down'))),
    });
    const before = await t.root();
    const answer = await t.set(TYPED);

    expect(answer.statusCode).toBe(503);
    expect((await t.root()).tag).toBe(before.tag);
    expect((await signIn(t.asRoot)).response.statusCode).toBe(200);
  });

  it('re-reads when the root’s record moved under it, and the operator’s password wins', async () => {
    const held: { t: Awaited<ReturnType<typeof setup>> | null } = { t: null };
    let moved = 0;
    const t = await setup({
      wrap: failingRootWrite(2, async () => {
        moved++;
        await rival(held.t!, moved);
      }),
    });
    held.t = t;
    const answer = await t.set(TYPED);

    expect(moved).toBe(2);
    expect(answer.statusCode).toBe(200);
    expect((await signIn(t.asRoot, { name: 'root', password: TYPED })).response.statusCode).toBe(
      200,
    );
  });

  it('gives up with a 503 when the record moves on every one of the tries, and the password is as it was', async () => {
    const held: { t: Awaited<ReturnType<typeof setup>> | null } = { t: null };
    let moved = 0;
    const t = await setup({
      wrap: failingRootWrite(99, async () => {
        moved++;
        await rival(held.t!, moved);
      }),
    });
    held.t = t;
    const answer = await t.set(TYPED);

    expect(answer.statusCode).toBe(503);
    expect(moved).toBe(3);
    expect((await signIn(t.asRoot)).response.statusCode).toBe(200);
  });
});

describe('No log line holds a password or a hash, a failed setting’s included', () => {
  it('logs a method, a path and a status, never a body: the typed password, the made one, or a hash', async () => {
    const lines: string[] = [];
    const t = await setup({
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    const made = rootPasswordReplySchema.parse((await t.set(null)).json()).made!;
    await t.set(TYPED);
    // A failed one too: the store is down for the next write.
    const down = await setup({
      logger: { stream: { write: (line: string) => void lines.push(line) } },
      wrap: failingRootWrite(99, () => Promise.reject(new CStorageError(500, 'down'))),
    });
    expect((await down.set('Failed-one-3!')).statusCode).toBe(503);

    // The search means something only if the log holds the calls it searches.
    expect(lines.filter((line) => line.includes('/root-password')).length).toBeGreaterThan(0);
    const log = lines.join('\n');
    for (const secret of [made, TYPED, 'Failed-one-3!', 'scrypt$']) {
      expect(log).not.toContain(secret);
    }
  });
});

/** A rival's write to the root's record (the root changing its own password, say), so its tag
 * moves between the BFF's read and its write. */
async function rival(t: Awaited<ReturnType<typeof setup>>, n: number) {
  const found = await t.client.getRecord(t.keys.user('root'));
  const user = storedUserSchema.parse(found!.data);
  await t.client.putRecord(t.keys.user('root'), { ...user, passwordAt: n }, found!.tag);
}
