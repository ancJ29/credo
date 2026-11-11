import {
  type CStorageClient,
  joinOptionsReplySchema,
  operatorMeReplySchema,
  passkeyListReplySchema,
  optionsReplySchema,
  recordKeys,
  sha256Hex,
  storedAccountSchema,
  storedLinkSchema,
  storedRosterSchema,
  storedSessionSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SoftwareAuthenticator } from '../../tests/authenticator';
import { type RunningCStorage, startCStorage } from '../../tests/c-storage';
import {
  inviteOperator,
  joinedOperator,
  joinWith,
  operatorRecords,
  post,
  session,
  signInWith,
  removeWith,
  touchFor,
} from '../../tests/operator';
import { bffOn, DAY_MS, DEVICE, ORIGIN, withAuth } from '../../tests/tenant';
import { createOperator, makeLink, readAccount, readRoster } from '../records/operators';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** A client that, when a test arms it, runs a hook once just before the next write to a key
 * holding `part`: a rival's write lands between the BFF's read and its write. */
const interrupting = (part: string) => {
  const state: { hook: null | (() => Promise<unknown>); skip: number } = { hook: null, skip: 0 };
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    putRecord: async (key, data, tag) => {
      const hook = state.hook;
      if (hook && key.includes(part)) {
        if (state.skip > 0) state.skip--;
        else {
          state.hook = null;
          await hook();
        }
      }
      return await client.putRecord(key, data, tag);
    },
  });
  /** `skip` writes to the key pass first: an add or a remove writes its touch before its change. */
  const before = (hook: () => Promise<unknown>, skip = 0) => {
    state.hook = hook;
    state.skip = skip;
  };
  return { wrap, before };
};

/** A client that counts the writes to the session records. */
const countingSessionWrites = () => {
  const writes = { count: 0 };
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    putRecord: async (key, data, tag) => {
      if (key.startsWith('operator.session.')) writes.count++;
      return await client.putRecord(key, data, tag);
    },
  });
  return { writes, wrap };
};

/** An account's record with something changed, so its tag moves: a rival's write. */
const nudged = async (client: CStorageClient, key: string, n: number) => {
  const held = storedAccountSchema.parse((await client.getRecord(key))!.data);
  return { ...held, spent: [...held.spent, { hash: `rival-${n}`, at: 0 }] };
};

/** A roster line for a rival, so the roster's tag moves. */
const rival = (n: number) => ({
  id: `3f2a91bc-0000-4000-8000-${String(n).padStart(12, '0')}`,
  name: `rival-${n}`,
  state: 'invited' as const,
  addedBy: null,
  addedAt: 0,
  joinedAt: null,
});

const me = (t: Awaited<ReturnType<typeof bffOn>>, authId: string, query = '') =>
  t.app.inject({ method: 'GET', url: `/api/operator/me${query}`, headers: withAuth(authId) });

const accountOf = async (t: Awaited<ReturnType<typeof bffOn>>, id: string) =>
  storedAccountSchema.parse((await readAccount(t.client, id))!.account);

describe('An operator signs in at /operator with a passkey alone', () => {
  it('opens a session for the operator the passkey names, and answers who it is', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const { sent } = await signInWith(t, op.authenticator);
    expect(sent.statusCode).toBe(200);
    const reply = session(sent);
    expect(reply.operator).toEqual({ id: op.id, name: 'operator' });
    const known = operatorMeReplySchema.parse((await me(t, reply.authId)).json());
    expect(known.operator).toEqual({ id: op.id, name: 'operator' });
    const stored = await t.client.getRecord(recordKeys.operatorSession(reply.authId.split('.')[0]));
    expect(storedSessionSchema.parse(stored?.data).user).toBe(op.id);
  });

  it('offers the options with a token, for any caller, and asks for the device’s user verification', async () => {
    const t = await bffOn(cs);
    const options = await post(t.app, '/api/operator/passkey/options');
    expect(options.statusCode).toBe(200);
    const reply = optionsReplySchema.parse(options.json());
    expect(reply.options).toMatchObject({ rpId: 'localhost', userVerification: 'required' });
    // Usernameless: the device offers whatever passkeys it holds for this address.
    expect(reply.options).not.toHaveProperty('allowCredentials');
  });

  it('needs a device id, and a body that is the answer', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    const response = op.authenticator.authenticate(reply.options);
    const noDevice = await t.app.inject({
      method: 'POST',
      url: '/api/operator/passkey/sign-in',
      payload: { token: reply.token, response },
    });
    expect(noDevice.statusCode).toBe(400);
    expect(
      (await post(t.app, '/api/operator/passkey/sign-in', { token: reply.token })).statusCode,
    ).toBe(400);
  });

  it('ends the session the device’s kept handle names, as a new sign-in replaces it', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    const sent = await post(
      t.app,
      '/api/operator/passkey/sign-in',
      { token: reply.token, response: op.authenticator.authenticate(reply.options) },
      op.authId,
    );
    expect(sent.statusCode).toBe(200);
    expect((await me(t, op.authId)).statusCode).toBe(401);
  });

  it('ends its session on sign-out, and a handle that names none ends nothing', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const out = await post(t.app, '/api/operator/sign-out', undefined, op.authId);
    expect(out.statusCode).toBe(204);
    expect(
      await t.client.getRecord(recordKeys.operatorSession(op.authId.split('.')[0])),
    ).toBeNull();
    expect((await post(t.app, '/api/operator/sign-out')).statusCode).toBe(204);
  });
});

describe('An operator’s first passkey is made from a one-time link', () => {
  it('shows whose link it is and who made it, and the passkey signs them in and spends the link', async () => {
    const t = await bffOn(cs);
    const maker = await joinedOperator(t, 'maker');
    const { id, token } = await inviteOperator(t, 'newcomer', maker.id);
    const { opened, joined } = await joinWith(t, token);
    expect(opened.json()).toMatchObject({ name: 'newcomer', madeBy: 'maker' });
    expect(joined.statusCode).toBe(200);
    expect(session(joined).operator).toEqual({ id, name: 'newcomer' });
    const line = (await readRoster(t.client)).roster.operators.find((op) => op.id === id);
    expect(line).toMatchObject({ state: 'active', joinedAt: t.time.now() });
    expect((await accountOf(t, id)).passkeys).toHaveLength(1);
    expect((await accountOf(t, id)).linkHash).toBeNull();
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(404);
  });

  it('names no maker for a link the terminal made, or one whose maker is gone, and tells the two apart', async () => {
    const t = await bffOn(cs);
    const fromTerminal = await inviteOperator(t, 'first');
    const orphan = await inviteOperator(t, 'second', '3f2a91bc-0000-4000-8000-000000000999');
    const a = await post(t.app, '/api/operator/join/options', { link: fromTerminal.token });
    const b = await post(t.app, '/api/operator/join/options', { link: orphan.token });
    expect(a.json()).toMatchObject({ madeBy: null, madeByTerminal: true });
    expect(b.json()).toMatchObject({ madeBy: null, madeByTerminal: false });
  });

  it('refuses a passkey the library cannot verify, and keeps the link for another try', async () => {
    const t = await bffOn(cs);
    const { token } = await inviteOperator(t);
    const wrongPlace = await joinWith(t, token, new SoftwareAuthenticator(ORIGIN), {
      origin: 'https://elsewhere.example',
    });
    expect(wrongPlace.joined.statusCode).toBe(400);
    const notVerified = await joinWith(t, token, new SoftwareAuthenticator(ORIGIN), {
      verified: false,
    });
    expect(notVerified.joined.statusCode).toBe(400);
    expect((await joinWith(t, token)).joined.statusCode).toBe(200);
  });

  it('makes one passkey when two openings race, and the loser is told the link is gone', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t);
    const [a, b] = await Promise.all([joinWith(t, token), joinWith(t, token)]);
    expect([a.joined.statusCode, b.joined.statusCode].sort()).toEqual([200, 404]);
    expect((await accountOf(t, id)).passkeys).toHaveLength(1);
  });

  it('refuses a join whose challenge was minted for another link', async () => {
    const t = await bffOn(cs);
    const one = await inviteOperator(t, 'one');
    const two = await inviteOperator(t, 'two');
    const other = joinOptionsReplySchema.parse(
      (await post(t.app, '/api/operator/join/options', { link: two.token })).json(),
    );
    // The device answers the other link's challenge, so only the token's binding to its link refuses it.
    const sent = await post(t.app, '/api/operator/join', {
      link: one.token,
      token: other.token,
      response: new SoftwareAuthenticator(ORIGIN).register(other.options as never),
    });
    expect(sent.statusCode).toBe(400);
  });
});

describe('A link works once, within 24 hours, and only while it is the newest for that operator', () => {
  it('is dead after a day, and live a moment before', async () => {
    const t = await bffOn(cs);
    const { token } = await inviteOperator(t);
    t.time.advance(DAY_MS - 1);
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(200);
    t.time.advance(1);
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(404);
    expect((await joinWith(t, token)).joined.statusCode).toBe(404);
  });

  it('is replaced by a newer one, which alone works, and the old record is removed', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t);
    const newer = await makeLink(t.client, {
      operatorId: id,
      kind: 'join',
      madeBy: null,
      now: t.time.now(),
    });
    expect(newer).not.toBe(token);
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(404);
    expect((await post(t.app, '/api/operator/join/options', { link: newer })).statusCode).toBe(200);
    const old = recordKeys.operatorLink(await sha256Hex(token));
    expect(await t.client.getRecord(old)).toBeNull();
    expect((await t.client.listRecords('operator.link.')).records).toHaveLength(1);
    // Even if the old record came back, the account names the newer link alone.
    await t.client.putRecord(old, {
      operatorId: id,
      kind: 'join',
      madeBy: null,
      endsAt: t.time.now() + DAY_MS,
    });
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(404);
  });

  it('says nothing of a token that was never a link, or of one in the wrong form', async () => {
    const t = await bffOn(cs);
    const unknown = await post(t.app, '/api/operator/join/options', { link: 'A'.repeat(43) });
    expect(unknown.statusCode).toBe(404);
    expect((await post(t.app, '/api/operator/join/options', { link: 'short' })).statusCode).toBe(
      400,
    );
  });

  it('gives no link to an operator with no account', async () => {
    const t = await bffOn(cs);
    const none = await makeLink(t.client, {
      operatorId: '3f2a91bc-0000-4000-8000-000000000999',
      kind: 'join',
      madeBy: null,
      now: t.time.now(),
    });
    expect(none).toBeNull();
  });
});

describe('A link’s token is 32 random bytes, kept as its hash, one live link for an operator', () => {
  it('stores the hash and not the token, and names the operator and its maker in the record', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t, 'newcomer', null);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const hash = await sha256Hex(token);
    const link = storedLinkSchema.parse(
      (await t.client.getRecord(recordKeys.operatorLink(hash)))?.data,
    );
    expect(link).toMatchObject({
      operatorId: id,
      kind: 'join',
      madeBy: null,
      endsAt: t.time.now() + DAY_MS,
    });
    expect((await accountOf(t, id)).linkHash).toBe(hash);
    const records = JSON.stringify((await t.client.listRecords('operator.')).records);
    expect(records).not.toContain(token);
  });

  it('is read from the body alone: the same token in the query opens nothing', async () => {
    const t = await bffOn(cs);
    const { token } = await inviteOperator(t);
    const sent = await t.app.inject({
      method: 'POST',
      url: `/api/operator/join/options?link=${token}`,
      headers: { 'x-device-id': DEVICE },
    });
    expect(sent.statusCode).toBe(400);
  });
});

describe('An operator may hold several passkeys, add one and remove one, never the last', () => {
  async function two(wrap?: (client: CStorageClient) => CStorageClient) {
    const t = await bffOn(cs, wrap ? { wrap } : {});
    const op = await joinedOperator(t);
    const second = new SoftwareAuthenticator(ORIGIN);
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    t.time.advance(MINUTE);
    const added = await post(
      t.app,
      '/api/operator/passkeys',
      {
        token: options.token,
        response: second.register(options.options as never),
        confirm: await touchFor(t, op.authId, op.authenticator, 'add'),
      },
      op.authId,
    );
    return { t, op, second, options, added };
  }

  it('lists when each was added and last used, and never a key', async () => {
    const { t, op, second, added } = await two();
    expect(added.statusCode).toBe(201);
    const list = passkeyListReplySchema.parse(
      (
        await t.app.inject({
          method: 'GET',
          url: '/api/operator/passkeys',
          headers: withAuth(op.authId),
        })
      ).json(),
    );
    expect(list.passkeys.map((p) => p.id)).toEqual([op.authenticator.id, second.id]);
    expect(list.passkeys[1]).toEqual({ id: second.id, addedAt: t.time.now(), lastUsedAt: null });
    expect(JSON.stringify(list)).not.toContain('publicKey');
    await signInWith(t, second);
    const after = await accountOf(t, op.id);
    expect(after.passkeys[1]?.lastUsedAt).toBe(t.time.now());
  });

  it('excludes the passkeys held from the options for another', async () => {
    const { options, op } = await two();
    expect(options.options).toMatchObject({ excludeCredentials: [{ id: op.authenticator.id }] });
  });

  it('refuses the same passkey twice', async () => {
    const { t, op, second } = await two();
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    const again = await post(
      t.app,
      '/api/operator/passkeys',
      {
        token: options.token,
        response: second.register(options.options as never),
        confirm: await touchFor(t, op.authId, op.authenticator, 'add'),
      },
      op.authId,
    );
    expect(again.statusCode).toBe(400);
  });

  it('refuses a challenge minted for another operator, or for a sign-in', async () => {
    const { t, op } = await two();
    const other = await joinedOperator(t, 'other');
    const theirs = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, other.authId)).json(),
    );
    const signIn = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    const third = new SoftwareAuthenticator(ORIGIN);
    const asked = { challenge: signIn.options.challenge, user: theirs.options.user as never };
    for (const [token, options] of [
      [theirs.token, theirs.options],
      [signIn.token, asked],
    ] as const) {
      const sent = await post(
        t.app,
        '/api/operator/passkeys',
        {
          token,
          response: third.register(options as never),
          confirm: await touchFor(t, op.authId, op.authenticator, 'add'),
        },
        op.authId,
      );
      expect(sent.statusCode).toBe(400);
    }
  });

  it('removes one and answers those left; the last is a 409 and stays', async () => {
    const { t, op, second } = await two();
    const removed = await removeWith(t, op.authId, op.authenticator, second.id);
    expect(removed.statusCode).toBe(200);
    expect(passkeyListReplySchema.parse(removed.json()).passkeys.map((p) => p.id)).toEqual([
      op.authenticator.id,
    ]);
    const last = await removeWith(t, op.authId, op.authenticator, op.authenticator.id);
    expect(last.statusCode).toBe(409);
    expect((await accountOf(t, op.id)).passkeys).toHaveLength(1);
    const unknown = await removeWith(t, op.authId, op.authenticator, 'unknown');
    expect(unknown.statusCode).toBe(404);
  });

  it('does not let a stolen session add the thief’s passkey or remove the owner’s: a fresh touch is asked for', async () => {
    const { t, op, second } = await two();
    const thief = new SoftwareAuthenticator(ORIGIN);
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    const add = await post(
      t.app,
      '/api/operator/passkeys',
      { token: options.token, response: thief.register(options.options as never) },
      op.authId,
    );
    const remove = await t.app.inject({
      method: 'DELETE',
      url: `/api/operator/passkeys/${op.authenticator.id}`,
      headers: withAuth(op.authId),
    });
    expect([add.statusCode, remove.statusCode]).toEqual([400, 400]);
    expect((await accountOf(t, op.id)).passkeys.map((p) => p.id)).toEqual([
      op.authenticator.id,
      second.id,
    ]);
  });

  it('asks for the touch with the operator’s own passkeys and user verification, for an act it names', async () => {
    const { t, op, second } = await two();
    const sent = await post(
      t.app,
      '/api/operator/passkeys/confirm-options',
      { act: 'remove' },
      op.authId,
    );
    expect(sent.statusCode).toBe(200);
    expect(optionsReplySchema.parse(sent.json()).options).toMatchObject({
      rpId: 'localhost',
      userVerification: 'required',
      allowCredentials: [{ id: op.authenticator.id }, { id: second.id }],
    });
    for (const body of [{}, { act: 'rename' }, { act: 'add', more: 1 }]) {
      expect(
        (await post(t.app, '/api/operator/passkeys/confirm-options', body, op.authId)).statusCode,
      ).toBe(400);
    }
  });

  it('refuses a touch that is the wrong act’s, a thief’s, unverified, for another origin or replayed, and changes nothing', async () => {
    const { t, op, second } = await two();
    const thief = new SoftwareAuthenticator(ORIGIN);
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    const addWith = async (confirm: Awaited<ReturnType<typeof touchFor>>) =>
      (
        await post(
          t.app,
          '/api/operator/passkeys',
          { token: options.token, response: thief.register(options.options as never), confirm },
          op.authId,
        )
      ).statusCode;
    const owner = op.authenticator;
    const wrongAct = await touchFor(t, op.authId, owner, 'remove');
    expect(await addWith(wrongAct)).toBe(403);
    expect(await addWith(await touchFor(t, op.authId, thief, 'add'))).toBe(403);
    expect(await addWith(await touchFor(t, op.authId, owner, 'add', { verified: false }))).toBe(
      403,
    );
    expect(
      await addWith(
        await touchFor(t, op.authId, owner, 'add', { origin: 'https://elsewhere.example' }),
      ),
    ).toBe(403);
    const once = await touchFor(t, op.authId, owner, 'add');
    expect(await addWith(once)).toBe(201);
    expect(await addWith(once)).toBe(403);
    // A removal, too, refuses a touch for the add, and the other operator's passkey.
    const other = await joinedOperator(t, 'other');
    const mine = await touchFor(t, op.authId, owner, 'add');
    const foreign = await touchFor(t, op.authId, other.authenticator, 'remove');
    for (const confirm of [mine, foreign]) {
      const sent = await t.app.inject({
        method: 'DELETE',
        url: `/api/operator/passkeys/${second.id}`,
        headers: withAuth(op.authId),
        payload: { confirm },
      });
      expect(sent.statusCode).toBe(403);
    }
    expect((await accountOf(t, op.id)).passkeys.map((p) => p.id)).toEqual([
      owner.id,
      second.id,
      thief.id,
    ]);
  });

  it('refuses a touch replayed from a synced passkey, whose counter says nothing, and adds nothing', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const once = await touchFor(t, op.authId, op.authenticator, 'add', { counter: 0 });
    // Each try asks for fresh add options and a new passkey, so only the touch can be refused.
    const addWith = async () => {
      const options = optionsReplySchema.parse(
        (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
      );
      return (
        await post(
          t.app,
          '/api/operator/passkeys',
          {
            token: options.token,
            response: new SoftwareAuthenticator(ORIGIN).register(options.options as never),
            confirm: once,
          },
          op.authId,
        )
      ).statusCode;
    };
    expect(await addWith()).toBe(201);
    expect(await addWith()).toBe(403);
    expect((await accountOf(t, op.id)).passkeys).toHaveLength(2);
  });

  it('are an operator’s own: no handle, no list, no add, no remove', async () => {
    const t = await bffOn(cs);
    const calls = [
      t.app.inject({ method: 'GET', url: '/api/operator/passkeys' }),
      post(t.app, '/api/operator/passkeys/options'),
      post(t.app, '/api/operator/passkeys', {}),
      post(t.app, '/api/operator/passkeys/confirm-options', { act: 'add' }),
      t.app.inject({ method: 'DELETE', url: '/api/operator/passkeys/x' }),
    ];
    expect((await Promise.all(calls)).map((r) => r.statusCode)).toEqual([401, 401, 401, 401, 401]);
  });

  it('writes again after the account moved under an add, and keeps both changes', async () => {
    const race = interrupting('operator.account.');
    const t = await bffOn(cs, { wrap: race.wrap });
    const op = await joinedOperator(t);
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    const key = recordKeys.operatorAccount(op.id);
    // The touch's write goes first; the rival lands between the add's read and its write.
    race.before(async () => {
      await t.client.putRecord(key, await nudged(t.client, key, 1));
    }, 1);
    const added = await post(
      t.app,
      '/api/operator/passkeys',
      {
        token: options.token,
        response: new SoftwareAuthenticator(ORIGIN).register(options.options as never),
        confirm: await touchFor(t, op.authId, op.authenticator, 'add'),
      },
      op.authId,
    );
    expect(added.statusCode).toBe(201);
    const after = await accountOf(t, op.id);
    expect(after.passkeys).toHaveLength(2);
    expect(after.spent.map((spent) => spent.hash)).toContain('rival-1');
    expect(after.spent).toHaveLength(2);
  });

  it('keeps one passkey when two removes of the last two race, the loser told it is the last', async () => {
    const race = interrupting('operator.account.');
    const { t, op, second } = await two(race.wrap);
    const remove = (id: string) => removeWith(t, op.authId, op.authenticator, id);
    let rival = 0;
    // The first remove is interrupted between its read and its write (after its touch's write) by
    // the other's whole remove.
    race.before(async () => void (rival = (await remove(second.id)).statusCode), 1);
    const first = await remove(op.authenticator.id);
    expect([first.statusCode, rival].sort()).toEqual([200, 409]);
    expect((await accountOf(t, op.id)).passkeys).toHaveLength(1);
  });
});

describe('An operator who lost every passkey uses a new-passkey link, which replaces them all', () => {
  it('replaces the passkeys, signs them in, and ends every session they held', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const elsewhere = session((await signInWith(t, op.authenticator, {}, 'device-bbbb-0002')).sent);
    const token = await makeLink(t.client, {
      operatorId: op.id,
      kind: 'replace',
      madeBy: null,
      now: t.time.now(),
    });
    const fresh = new SoftwareAuthenticator(ORIGIN);
    const { joined } = await joinWith(t, token!, fresh);
    expect(joined.statusCode).toBe(200);
    const account = await accountOf(t, op.id);
    expect(account.passkeys.map((p) => p.id)).toEqual([fresh.id]);
    expect((await me(t, op.authId)).statusCode).toBe(401);
    expect((await me(t, elsewhere.authId)).statusCode).toBe(401);
    expect((await me(t, session(joined).authId)).statusCode).toBe(200);
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(401);
    expect((await signInWith(t, fresh)).sent.statusCode).toBe(200);
  });
});

describe('A sign-in ends an hour after the last use, or 12 hours after the passkey', () => {
  it('lasts 59 minutes unused, and is gone at the hour', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    t.time.advance(HOUR - 1);
    expect((await me(t, op.authId, '?renew=0')).statusCode).toBe(200);
    t.time.advance(1);
    expect((await me(t, op.authId)).statusCode).toBe(401);
  });

  it('is kept by working, and the passkey itself does not expire', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    for (let i = 0; i < 5; i++) {
      t.time.advance(50 * MINUTE);
      expect((await me(t, op.authId)).statusCode).toBe(200);
    }
    t.time.advance(DAY_MS * 400);
    expect((await me(t, op.authId)).statusCode).toBe(401);
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(200);
  });

  it('ends 12 hours after the passkey whatever the work, and no later', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const issued = t.time.now();
    while (t.time.now() < issued + 12 * HOUR - 50 * MINUTE) {
      t.time.advance(50 * MINUTE);
      expect((await me(t, op.authId)).statusCode).toBe(200);
    }
    t.time.advance(issued + 12 * HOUR - t.time.now() - 1);
    expect((await me(t, op.authId)).statusCode).toBe(200);
    t.time.advance(1);
    expect((await me(t, op.authId)).statusCode).toBe(401);
    const stored = storedSessionSchema.parse(
      (await t.client.getRecord(recordKeys.operatorSession(op.authId.split('.')[0])))?.data,
    );
    expect(stored.expiresAt).toBe(issued + 12 * HOUR);
  });

  it('moves the end at most once in 5 minutes, writing only then', async () => {
    const { writes, wrap } = countingSessionWrites();
    const t = await bffOn(cs, { wrap });
    const op = await joinedOperator(t);
    const afterIssue = writes.count;
    t.time.advance(5 * MINUTE);
    await me(t, op.authId);
    t.time.advance(MINUTE);
    await me(t, op.authId);
    await me(t, op.authId);
    expect(writes.count - afterIssue).toBe(1);
    t.time.advance(5 * MINUTE + 1);
    await me(t, op.authId);
    expect(writes.count - afterIssue).toBe(2);
  });

  it('holds its issue and its end, and a read marked as no use renews nothing', async () => {
    const { writes, wrap } = countingSessionWrites();
    const t = await bffOn(cs, { wrap });
    const op = await joinedOperator(t);
    const issued = t.time.now();
    const before = writes.count;
    t.time.advance(30 * MINUTE);
    expect((await me(t, op.authId, '?renew=0')).statusCode).toBe(200);
    expect(writes.count).toBe(before);
    const stored = storedSessionSchema.parse(
      (await t.client.getRecord(recordKeys.operatorSession(op.authId.split('.')[0])))?.data,
    );
    expect(stored).toMatchObject({ issuedAt: issued, expiresAt: issued + HOUR });
    expect((await me(t, op.authId)).statusCode).toBe(200);
    expect(writes.count).toBe(before + 1);
  });

  it('is a 401 at the next call once the operator’s line leaves the roster', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const { roster, tag } = await readRoster(t.client);
    await t.client.putRecord(
      recordKeys.operatorRoster,
      { operators: roster.operators.filter((o) => o.id !== op.id) },
      tag,
    );
    expect((await me(t, op.authId)).statusCode).toBe(401);
  });
});

describe('Each ceremony is checked against APP_ORIGIN, with user verification', () => {
  it('refuses a sign-in signed for another origin, or without user verification, and says no more', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const elsewhere = await signInWith(t, op.authenticator, {
      origin: 'https://elsewhere.example',
    });
    const unverified = await signInWith(t, op.authenticator, { verified: false });
    expect(elsewhere.sent.statusCode).toBe(401);
    expect(unverified.sent.statusCode).toBe(401);
    expect(elsewhere.sent.body).toBe(unverified.sent.body);
  });

  it('does not read the request’s host: the same sign-in through another host still works', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (
        await t.app.inject({
          method: 'POST',
          url: '/api/operator/passkey/options',
          headers: { host: 'evil.example' },
        })
      ).json(),
    );
    expect(reply.options).toMatchObject({ rpId: 'localhost' });
    const sent = await t.app.inject({
      method: 'POST',
      url: '/api/operator/passkey/sign-in',
      headers: { 'x-device-id': DEVICE, host: 'evil.example' },
      payload: { token: reply.token, response: op.authenticator.authenticate(reply.options) },
    });
    expect(sent.statusCode).toBe(200);
  });

  it('finds the operator by the user handle the answer carries, never by a name', async () => {
    const t = await bffOn(cs);
    const first = await joinedOperator(t, 'first');
    const second = await joinedOperator(t, 'second');
    const { sent } = await signInWith(t, second.authenticator);
    expect(session(sent).operator.id).toBe(second.id);
    // The first operator's passkey under the second's handle opens nothing.
    const swapped = await signInWith(t, first.authenticator, {
      userHandle: second.authenticator.userHandle,
    });
    expect(swapped.sent.statusCode).toBe(401);
  });
});

describe('A challenge is signed, bound to its purpose and good for 5 minutes, and no options call writes', () => {
  it('writes nothing on the sign-in, join or add options, however many times it is asked', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const { token } = await inviteOperator(t, 'waiting');
    const before = await operatorRecords(t);
    for (let i = 0; i < 3; i++) {
      await post(t.app, '/api/operator/passkey/options');
      await post(t.app, '/api/operator/join/options', { link: token });
      await post(t.app, '/api/operator/passkeys/options', undefined, op.authId);
    }
    expect(await operatorRecords(t)).toEqual(before);
  });

  it('opens a sign-in for 5 minutes and no longer', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    t.time.advance(5 * MINUTE - 1);
    const early = await post(t.app, '/api/operator/passkey/sign-in', {
      token: reply.token,
      response: op.authenticator.authenticate(reply.options),
    });
    expect(early.statusCode).toBe(200);
    const late = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    t.time.advance(5 * MINUTE);
    const dead = await post(t.app, '/api/operator/passkey/sign-in', {
      token: late.token,
      response: op.authenticator.authenticate(late.options),
    });
    expect(dead.statusCode).toBe(401);
  });

  it('does not open for a token that was changed, signed by another key, or made for another purpose', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    const [body, signature] = reply.token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        challenge: reply.options.challenge,
        purpose: 'sign-in',
        subject: '',
        endsAt: 9e15,
      }),
    ).toString('base64url');
    const other = await bffOn(cs);
    const foreign = optionsReplySchema.parse(
      (await post(other.app, '/api/operator/passkey/options')).json(),
    );
    const answer = op.authenticator.authenticate(reply.options);
    const tokens = [
      `${forged}.${signature}`,
      `${body}.AAAA`,
      foreign.token,
      'nodot',
      `${body}.${signature}.x`,
      '',
    ];
    for (const token of tokens) {
      const sent = await post(t.app, '/api/operator/passkey/sign-in', {
        token: token || 'x',
        response: answer,
      });
      expect(sent.statusCode, token).toBe(401);
    }
    // A join's token is no sign-in's.
    const { token: link } = await inviteOperator(t, 'waiting');
    const joinOptions = joinOptionsReplySchema.parse(
      (await post(t.app, '/api/operator/join/options', { link })).json(),
    );
    const asSignIn = await post(t.app, '/api/operator/passkey/sign-in', {
      token: joinOptions.token,
      response: answer,
    });
    expect(asSignIn.statusCode).toBe(401);
  });
});

describe('A sign-in spends its challenge in the operator’s record, so the same answer again is a 401', () => {
  it('refuses a replayed answer, and the first session stands', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const { reply, response } = await signInWith(t, op.authenticator);
    const again = await post(t.app, '/api/operator/passkey/sign-in', {
      token: reply.token,
      response,
    });
    expect(again.statusCode).toBe(401);
    expect((await accountOf(t, op.id)).spent).toHaveLength(1);
  });

  it('refuses a replayed answer from a synced passkey too, whose counter says nothing', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const { reply, response } = await signInWith(t, op.authenticator, { counter: 0 });
    const again = await post(t.app, '/api/operator/passkey/sign-in', {
      token: reply.token,
      response,
    });
    expect(again.statusCode).toBe(401);
  });

  it('refuses the first answer replayed after a synced passkey signed in again within 5 minutes', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const first = await signInWith(t, op.authenticator, { counter: 0 });
    t.time.advance(MINUTE);
    expect((await signInWith(t, op.authenticator, { counter: 0 })).sent.statusCode).toBe(200);
    const replay = await post(t.app, '/api/operator/passkey/sign-in', {
      token: first.reply.token,
      response: first.response,
    });
    expect(replay.statusCode).toBe(401);
    expect((await accountOf(t, op.id)).spent).toHaveLength(2);
  });

  it('refuses the replay that raced the first, on the tag it wrote with', async () => {
    const race = interrupting('operator.account.');
    const t = await bffOn(cs, { wrap: race.wrap });
    const op = await joinedOperator(t);
    const reply = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkey/options')).json(),
    );
    const body = { token: reply.token, response: op.authenticator.authenticate(reply.options) };
    let second = 0;
    // The first call is the one interrupted: the replay lands between its read and its write.
    race.before(async () => {
      second = (await post(t.app, '/api/operator/passkey/sign-in', body)).statusCode;
    });
    const first = await post(t.app, '/api/operator/passkey/sign-in', body);
    expect([first.statusCode, second]).toEqual([401, 200]);
    expect((await accountOf(t, op.id)).spent).toHaveLength(1);
  });

  it('forgets a challenge after 5 minutes, since its token is dead by then', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    await signInWith(t, op.authenticator);
    t.time.advance(5 * MINUTE + 1);
    await signInWith(t, op.authenticator);
    expect((await accountOf(t, op.id)).spent).toHaveLength(1);
  });

  it('gives up with a 503 when the operator’s record moves on every try', async () => {
    let armed = false;
    let nudges = 0;
    const t = await bffOn(cs, {
      wrap: (client) => ({
        ...client,
        putRecord: async (key, data, tag) => {
          if (armed && key.startsWith('operator.account.')) {
            await client.putRecord(key, await nudged(client, key, ++nudges));
          }
          return await client.putRecord(key, data, tag);
        },
      }),
    });
    const op = await joinedOperator(t);
    armed = true;
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(503);
  });
});

describe('An unknown handle, an operator not active, an unknown credential, a bad signature or a dead challenge is one 401', () => {
  it('answers every one alike, with nothing that says which', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const waiting = await inviteOperator(t, 'waiting');
    const stranger = new SoftwareAuthenticator(ORIGIN);
    stranger.userHandle = Buffer.from(op.id).toString('base64url');
    const notAnId = new SoftwareAuthenticator(ORIGIN);
    const bodies = [
      (
        await signInWith(t, op.authenticator, {
          userHandle: Buffer.from(waiting.id).toString('base64url'),
        })
      ).sent,
      (
        await signInWith(t, op.authenticator, {
          userHandle: Buffer.from('3f2a91bc-0000-4000-8000-000000000999').toString('base64url'),
        })
      ).sent,
      (await signInWith(t, op.authenticator, { userHandle: null })).sent,
      (await signInWith(t, stranger)).sent,
      (await signInWith(t, op.authenticator, { tamper: true })).sent,
      (await signInWith(t, notAnId, { userHandle: 'not-a-handle' })).sent,
    ];
    expect(bodies.map((b) => b.statusCode)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(new Set(bodies.map((b) => b.body)).size).toBe(1);
    expect((await accountOf(t, op.id)).spent).toEqual([]);
  });
});

describe('A user handle that is not a string is the same one 401', () => {
  it('answers 401, not a 500, for a handle that is a number, an object, null or a list', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    const known = (await signInWith(t, op.authenticator, { userHandle: null })).sent;
    for (const handle of [7, { id: 'x' }, null, ['x']]) {
      const reply = optionsReplySchema.parse(
        (await post(t.app, '/api/operator/passkey/options')).json(),
      );
      const answer = op.authenticator.authenticate(reply.options);
      const sent = await post(t.app, '/api/operator/passkey/sign-in', {
        token: reply.token,
        response: { ...answer, response: { ...answer.response, userHandle: handle } },
      });
      expect(sent.statusCode, JSON.stringify(handle)).toBe(401);
      expect(sent.body).toBe(known.body);
    }
  });
});

describe('Each ceremony is held to this address as its relying party', () => {
  it('refuses a join whose passkey was made for another relying party', async () => {
    const t = await bffOn(cs);
    const { token } = await inviteOperator(t);
    const elsewhere = new SoftwareAuthenticator(ORIGIN, 'elsewhere.example');
    expect((await joinWith(t, token, elsewhere)).joined.statusCode).toBe(400);
    expect((await joinWith(t, token)).joined.statusCode).toBe(200);
  });

  it('refuses a sign-in whose passkey signed for another relying party', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    op.authenticator.rpId = 'elsewhere.example';
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(401);
    op.authenticator.rpId = 'localhost';
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(200);
  });
});

describe('The counter is kept and checked as the library does; a synced passkey’s 0 passes', () => {
  it('keeps the counter a counting passkey reports, and refuses a counter that does not rise', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(200);
    expect((await signInWith(t, op.authenticator)).sent.statusCode).toBe(200);
    expect((await accountOf(t, op.id)).passkeys[0]?.counter).toBe(2);
    expect((await signInWith(t, op.authenticator, { counter: 2 })).sent.statusCode).toBe(401);
    expect((await signInWith(t, op.authenticator, { counter: 1 })).sent.statusCode).toBe(401);
    expect((await accountOf(t, op.id)).passkeys[0]?.counter).toBe(2);
  });

  it('lets a synced passkey sign in at 0, every time', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    for (let i = 0; i < 3; i++) {
      expect((await signInWith(t, op.authenticator, { counter: 0 })).sent.statusCode).toBe(200);
    }
    expect((await accountOf(t, op.id)).passkeys[0]?.counter).toBe(0);
  });
});

describe('The terminal makes the first operator and a link, the roster written last', () => {
  it('writes the account and the link where nothing sits, and the roster last, with its tag', async () => {
    const order: string[] = [];
    const t = await bffOn(cs);
    const wrapped: CStorageClient = {
      ...t.client,
      putRecord: async (key, data, tag) => {
        order.push(`${key.split('.').slice(0, 2).join('.')}:${tag === null ? 'new' : 'tag'}`);
        return await t.client.putRecord(key, data, tag);
      },
    };
    await inviteOperator(t, 'first', null, wrapped);
    expect(order).toEqual(['operator.account:new', 'operator.link:new', 'operator.roster:new']);
    await inviteOperator(t, 'second', null, wrapped);
    expect(order.slice(3)).toEqual([
      'operator.account:new',
      'operator.link:new',
      'operator.roster:tag',
    ]);
  });

  it('refuses a name that is taken, and the one holding it is unchanged', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t, 'first');
    await expect(inviteOperator(t, 'first')).rejects.toThrow('taken');
    const { roster } = await readRoster(t.client);
    expect(storedRosterSchema.parse(roster).operators.map((op) => op.id)).toEqual([id]);
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(200);
  });

  it('checks the name again when the roster moved under it, and a rival who took it wins', async () => {
    const t = await bffOn(cs);
    const race = interrupting('operator.roster');
    race.before(async () => {
      await createOperator(t.client, { name: 'first', addedBy: null, now: 1 });
    });
    const lost = await createOperator(race.wrap(t.client), {
      name: 'first',
      addedBy: null,
      now: 2,
    });
    expect(lost).toBe('taken');
    expect((await readRoster(t.client)).roster.operators).toHaveLength(1);
  });

  it('gives up with a 412 when the roster moves on every try', async () => {
    const t = await bffOn(cs);
    let rivals = 0;
    const moving: CStorageClient = {
      ...t.client,
      putRecord: async (key, data, tag) => {
        if (key === recordKeys.operatorRoster) {
          await t.client.putRecord(key, { operators: [rival(++rivals)] });
        }
        return await t.client.putRecord(key, data, tag);
      },
    };
    await expect(createOperator(moving, { name: 'first', addedBy: null, now: 1 })).rejects.toThrow(
      'moved on every attempt',
    );
  });
});

describe('A join with a link that is not live answers 404 whatever else it carries', () => {
  it('refuses an unknown link and a spent one, and signs no one in', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t);
    const first = await joinWith(t, token);
    const body = (link: string) => ({
      link,
      token: 'x',
      response: first.authenticator.register({ challenge: 'AAAA', user: { id: 'AAAA' } }),
    });
    expect((await post(t.app, '/api/operator/join', body('A'.repeat(43)))).statusCode).toBe(404);
    expect((await post(t.app, '/api/operator/join', body(token))).statusCode).toBe(404);
    expect((await accountOf(t, id)).passkeys).toHaveLength(1);
  });
});

describe('A record that moves or goes while a ceremony is written is read again, and the answer is never a half-made operator', () => {
  /** A client whose writes (and removals) to keys holding `part` first change the record, or
   * carry out `after` once the removal is done. */
  const meddling = (rules: {
    onPut?: (key: string, client: CStorageClient) => Promise<unknown>;
    beforeRemove?: (key: string, client: CStorageClient) => Promise<unknown>;
    afterRemove?: (key: string, client: CStorageClient) => Promise<unknown>;
  }) => {
    return (client: CStorageClient): CStorageClient => ({
      ...client,
      putRecord: async (key, data, tag) => {
        await rules.onPut?.(key, client);
        return await client.putRecord(key, data, tag);
      },
      removeRecord: async (key, tag) => {
        await rules.beforeRemove?.(key, client);
        const removed = await client.removeRecord(key, tag);
        await rules.afterRemove?.(key, client);
        return removed;
      },
    });
  };

  it('answers 404 for a link whose operator’s account is gone', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t);
    await t.client.removeRecord(
      recordKeys.operatorAccount(id),
      (await t.client.getRecord(recordKeys.operatorAccount(id)))!.tag,
    );
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(404);
  });

  it('answers 404 when a rival removes the link between its reading and its removal', async () => {
    // Forces the loser's order every time: it has read the link, and the winner removes it first.
    const t = await bffOn(cs, {
      wrap: meddling({
        beforeRemove: async (key, client) => {
          if (!key.startsWith('operator.link.')) return;
          await client.removeRecord(key, (await client.getRecord(key))!.tag);
        },
      }),
    });
    const { id, token } = await inviteOperator(t);
    expect((await joinWith(t, token)).joined.statusCode).toBe(404);
    expect((await accountOf(t, id)).passkeys).toHaveLength(0);
  });

  it('answers 404 when the account goes between the link’s removal and the passkey’s write', async () => {
    let id = '';
    const t = await bffOn(cs, {
      wrap: meddling({
        afterRemove: async (key, client) => {
          if (!key.startsWith('operator.link.')) return;
          const gone = recordKeys.operatorAccount(id);
          await client.removeRecord(gone, (await client.getRecord(gone))!.tag);
        },
      }),
    });
    const made = await inviteOperator(t);
    id = made.id;
    expect((await joinWith(t, made.token)).joined.statusCode).toBe(404);
  });

  it('answers 404 when the operator leaves the roster before the join is recorded', async () => {
    let id = '';
    const t = await bffOn(cs, {
      wrap: meddling({
        onPut: async (key, client) => {
          if (key !== recordKeys.operatorRoster) return;
          const { roster, tag } = await readRoster(client);
          await client.putRecord(
            key,
            { operators: roster.operators.filter((op) => op.id !== id) },
            tag,
          );
        },
      }),
    });
    const made = await inviteOperator(t);
    id = made.id;
    expect((await joinWith(t, made.token)).joined.statusCode).toBe(404);
  });

  it('answers 503 when the roster moves on every try of a join', async () => {
    let n = 0;
    const t = await bffOn(cs, {
      wrap: meddling({
        onPut: async (key, client) => {
          if (key !== recordKeys.operatorRoster) return;
          const { roster, tag } = await readRoster(client);
          await client.putRecord(key, { operators: [...roster.operators, rival(++n)] }, tag);
        },
      }),
    });
    const made = await inviteOperator(t);
    expect((await joinWith(t, made.token)).joined.statusCode).toBe(503);
  });

  it('signs no one in on the half-made state a 503 join leaves: invited, with a passkey', async () => {
    let n = 0;
    const t = await bffOn(cs, {
      wrap: meddling({
        onPut: async (key, client) => {
          if (key !== recordKeys.operatorRoster) return;
          const { roster, tag } = await readRoster(client);
          await client.putRecord(key, { operators: [...roster.operators, rival(++n)] }, tag);
        },
      }),
    });
    const made = await inviteOperator(t);
    const { joined, authenticator } = await joinWith(t, made.token);
    expect(joined.statusCode).toBe(503);
    expect((await accountOf(t, made.id)).passkeys).toHaveLength(1);
    expect(
      (await readRoster(t.client)).roster.operators.find((op) => op.id === made.id)?.state,
    ).toBe('invited');
    expect((await signInWith(t, authenticator)).sent.statusCode).toBe(401);
  });

  it('answers 503 when the account moves on every try of an add', async () => {
    let armed = false;
    let n = 0;
    let puts = 0;
    const t = await bffOn(cs, {
      wrap: meddling({
        onPut: async (key, client) => {
          // The touch's own write goes through; every try of the add's moves.
          if (armed && key.startsWith('operator.account.') && ++puts > 1) {
            await client.putRecord(key, await nudged(client, key, ++n));
          }
        },
      }),
    });
    const op = await joinedOperator(t);
    const options = optionsReplySchema.parse(
      (await post(t.app, '/api/operator/passkeys/options', undefined, op.authId)).json(),
    );
    const confirm = await touchFor(t, op.authId, op.authenticator, 'add');
    armed = true;
    const sent = await post(
      t.app,
      '/api/operator/passkeys',
      {
        token: options.token,
        response: new SoftwareAuthenticator(ORIGIN).register(options.options as never),
        confirm,
      },
      op.authId,
    );
    expect(sent.statusCode).toBe(503);
  });

  it('gives a link again after the account moved once, and leaves none unusable', async () => {
    const race = interrupting('operator.account.');
    const t = await bffOn(cs);
    const { id } = await inviteOperator(t);
    const key = recordKeys.operatorAccount(id);
    race.before(async () => void (await t.client.putRecord(key, await nudged(t.client, key, 1))));
    const token = await makeLink(race.wrap(t.client), {
      operatorId: id,
      kind: 'join',
      madeBy: null,
      now: t.time.now(),
    });
    expect((await post(t.app, '/api/operator/join/options', { link: token })).statusCode).toBe(200);
  });

  it('stops with a 412 when the account moves on every try of a new link', async () => {
    const t = await bffOn(cs);
    const { id } = await inviteOperator(t);
    const key = recordKeys.operatorAccount(id);
    let n = 0;
    const moving = meddling({
      onPut: async (k, client) =>
        void (k === key && (await client.putRecord(k, await nudged(client, k, ++n)))),
    })(t.client);
    await expect(
      makeLink(moving, { operatorId: id, kind: 'join', madeBy: null, now: t.time.now() }),
    ).rejects.toThrow('moved on every attempt');
  });

  it('leaves a link record that already went where it is, and still gives the new one', async () => {
    const t = await bffOn(cs);
    const { id, token } = await inviteOperator(t);
    const old = recordKeys.operatorLink(await sha256Hex(token));
    await t.client.removeRecord(old, (await t.client.getRecord(old))!.tag);
    const newer = await makeLink(t.client, {
      operatorId: id,
      kind: 'join',
      madeBy: null,
      now: t.time.now(),
    });
    expect((await post(t.app, '/api/operator/join/options', { link: newer })).statusCode).toBe(200);
  });

  it('keeps no transports when the device reports none, and refuses an attestation the library does not verify', async () => {
    const t = await bffOn(cs);
    const quiet = await inviteOperator(t, 'quiet');
    const forged = await inviteOperator(t, 'forged');
    expect(
      (await joinWith(t, forged.token, new SoftwareAuthenticator(ORIGIN), { forged: true })).joined
        .statusCode,
    ).toBe(400);
    expect(
      (await joinWith(t, quiet.token, new SoftwareAuthenticator(ORIGIN), { transports: null }))
        .joined.statusCode,
    ).toBe(200);
    expect((await accountOf(t, quiet.id)).passkeys[0]?.transports).toEqual([]);
  });
});
