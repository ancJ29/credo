import {
  addOperatorReplySchema,
  CStorageError,
  type CStorageClient,
  operatorLinkReplySchema,
  operatorListReplySchema,
  operatorRoutes,
  recordKeys,
  sha256Hex,
  storedAccountSchema,
  storedLinkSchema,
  storedRosterSchema,
  tokenOfFragment,
} from '@credo/shared';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SoftwareAuthenticator } from '../tests/authenticator';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import {
  inviteOperator,
  joinedOperator,
  joinWith,
  operatorRecords,
  session,
  signInWith,
  touchFor,
} from '../tests/operator';
import { bffOn, ORIGIN, withAuth } from '../tests/tenant';
import { createOperator } from './operators';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const LIST = '/api/operator/operators';
type Options = Parameters<typeof bffOn>[1];

/** An operator signed in, and the two calls: the list, and an add with a fresh touch made for this
 * act unless the test gives its own. */
async function setup(options: Options = {}) {
  const t = await bffOn(cs, options);
  const op = await joinedOperator(t);
  const list = async (authId = op.authId) =>
    await t.app.inject({ method: 'GET', url: LIST, headers: withAuth(authId) });
  const add = async (
    name: string,
    { confirm, authId = op.authId }: { confirm?: unknown; authId?: string } = {},
  ) =>
    await t.app.inject({
      method: 'POST',
      url: LIST,
      headers: withAuth(authId),
      payload: {
        name,
        confirm: confirm ?? (await touchFor(t, authId, op.authenticator, 'add-operator')),
      },
    });
  const link = async (
    id: string,
    { confirm, authId = op.authId }: { confirm?: unknown; authId?: string } = {},
  ) =>
    await t.app.inject({
      method: 'POST',
      url: operatorRoutes.link(id),
      headers: withAuth(authId),
      payload: {
        confirm: confirm ?? (await touchFor(t, authId, op.authenticator, 'operator-link')),
      },
    });
  const remove = async (
    id: string,
    {
      confirm,
      authId = op.authId,
      by = op.authenticator,
    }: { confirm?: unknown; authId?: string; by?: SoftwareAuthenticator } = {},
  ) =>
    await t.app.inject({
      method: 'DELETE',
      url: operatorRoutes.one(id),
      headers: withAuth(authId),
      payload: { confirm: confirm ?? (await touchFor(t, authId, by, 'delete-operator')) },
    });
  const roster = async () =>
    storedRosterSchema.parse((await t.client.getRecord(recordKeys.operatorRoster))!.data);
  const account = async (id: string) =>
    storedAccountSchema.parse((await t.client.getRecord(recordKeys.operatorAccount(id)))!.data);
  return { ...t, op, list, add, link, remove, roster, account };
}

describe('The operators are listed: every one, as the operator is shown them', () => {
  it('shows each operator’s name, state, adder by name and when, passkeys and last sign-in, the reader marked, the one added last first', async () => {
    const t = await setup();
    t.time.advance(60_000);
    const invited = await inviteOperator(t, 'Lan Anh', t.op.id);
    t.time.advance(60_000);
    const terminal = await inviteOperator(t, 'Kho');

    const answer = await t.list();
    expect(answer.statusCode).toBe(200);
    const { operators } = operatorListReplySchema.parse(answer.json());
    expect(operators.map((one) => one.name)).toEqual(['Kho', 'Lan Anh', 'operator']);
    expect(operators.find((one) => one.id === invited.id)).toMatchObject({
      state: 'invited',
      addedBy: 'operator',
      addedByTerminal: false,
      passkeys: 0,
      signedInAt: null,
      you: false,
    });
    expect(operators.find((one) => one.id === terminal.id)).toMatchObject({
      addedBy: null,
      addedByTerminal: true,
    });
    expect(operators.find((one) => one.id === t.op.id)).toMatchObject({
      state: 'active',
      passkeys: 1,
      you: true,
    });
    expect(operators.filter((one) => one.you)).toHaveLength(1);
    expect(answer.headers['cache-control']).toBe('no-store');
  });

  it('shows no adder once that operator is deleted, and the terminal’s differently', async () => {
    const t = await setup();
    const gone = await joinedOperator(t, 'Gone');
    const made = await inviteOperator(t, 'Orphan', gone.id);
    const roster = await t.roster();
    await t.client.putRecord(
      recordKeys.operatorRoster,
      { operators: roster.operators.filter((one) => one.id !== gone.id) },
      (await t.client.getRecord(recordKeys.operatorRoster))!.tag,
    );

    const { operators } = operatorListReplySchema.parse((await t.list()).json());
    expect(operators.find((one) => one.id === made.id)).toMatchObject({
      addedBy: null,
      addedByTerminal: false,
    });
  });

  it('shows a roster line whose account is missing as no passkeys and no sign-in, not as a fault', async () => {
    const t = await setup();
    const found = (await t.client.getRecord(recordKeys.operatorRoster))!;
    const roster = storedRosterSchema.parse(found.data);
    const lone = {
      ...roster.operators[0],
      id: randomUUID(),
      name: 'Lone',
      state: 'invited' as const,
    };
    await t.client.putRecord(
      recordKeys.operatorRoster,
      { operators: [...roster.operators, lone] },
      found.tag,
    );

    const { operators } = operatorListReplySchema.parse((await t.list()).json());
    expect(operators.find((one) => one.id === lone.id)).toMatchObject({
      passkeys: 0,
      signedInAt: null,
    });
  });

  it('reads the operators’ own records alone: no client’s key is read', async () => {
    const t = await setup();
    const read: string[] = [];
    const watched = await setup({
      wrap: (client) => ({
        ...client,
        getRecord: async (key, ...rest) => {
          read.push(key);
          return await client.getRecord(key, ...rest);
        },
      }),
    });
    read.length = 0;
    await watched.list();
    await t.list();

    expect(read.length).toBeGreaterThan(0);
    expect(read.every((key) => key.startsWith('operator.'))).toBe(true);
  });
});

describe('An operator adds one by a name, with a fresh touch of their own passkey', () => {
  it('makes them invited, added by this operator now, with a join link in the answer that opens on their name', async () => {
    const t = await setup();
    t.time.advance(60_000);
    const answer = await t.add('Thu Hà');

    expect(answer.statusCode).toBe(201);
    const made = addOperatorReplySchema.parse(answer.json());
    const token = tokenOfFragment(new URL(made.link, ORIGIN).hash);
    expect(token).not.toBeNull();
    expect((await t.roster()).operators.find((one) => one.id === made.id)).toEqual({
      id: made.id,
      name: 'Thu Hà',
      state: 'invited',
      addedBy: t.op.id,
      addedAt: t.time.now(),
      joinedAt: null,
    });
    const opened = await t.app.inject({
      method: 'POST',
      url: '/api/operator/join/options',
      payload: { link: token },
      headers: { 'x-device-id': 'device-new' },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toMatchObject({ name: 'Thu Hà', madeBy: 'operator' });
    const listed = operatorListReplySchema.parse((await t.list()).json()).operators;
    expect(listed.find((one) => one.id === made.id)).toMatchObject({
      name: 'Thu Hà',
      state: 'invited',
      addedBy: 'operator',
      passkeys: 0,
    });
  });

  it('lets the colleague join by that link, active, who then reads in the list with one passkey', async () => {
    const t = await setup();
    const made = addOperatorReplySchema.parse((await t.add('Thu Hà')).json());
    const { joined } = await joinWith(
      t,
      tokenOfFragment(new URL(made.link, ORIGIN).hash)!,
      new SoftwareAuthenticator(ORIGIN),
    );

    expect(joined.statusCode).toBe(200);
    const one = operatorListReplySchema
      .parse((await t.list()).json())
      .operators.find((line) => line.id === made.id);
    expect(one).toMatchObject({ state: 'active', passkeys: 1 });
  });

  it('refuses a name already there, trimmed and without case, with a 409, and writes nothing', async () => {
    const t = await setup();
    await t.add('Thu Hà');
    const before = await operatorRecords(t);

    for (const name of ['Thu Hà', 'thu hà', '  THU HÀ  ', 'OPERATOR']) {
      const answer = await t.add(name);
      expect(answer.statusCode).toBe(409);
    }
    expect((await operatorRecords(t)).length).toBe(before.length);
    expect((await t.roster()).operators).toHaveLength(2);
  });
});

describe('The last sign-in moves at a sign-in or a join, never at a touch', () => {
  it('is set by the join, moved by a sign-in, and left by the touch an add needs, where the passkey’s last use moves', async () => {
    const t = await setup();
    const joinedAt = t.time.now();
    expect((await t.account(t.op.id)).signedInAt).toBe(joinedAt);

    t.time.advance(3_600_000);
    const signedAt = t.time.now();
    const again = session((await signInWith(t, t.op.authenticator)).sent).authId;
    expect((await t.account(t.op.id)).signedInAt).toBe(signedAt);

    t.time.advance(60_000);
    const added = await t.add('Thu Hà', { authId: again });
    expect(added.statusCode).toBe(201);
    const after = await t.account(t.op.id);
    expect(after.signedInAt).toBe(signedAt);
    expect(after.passkeys[0].lastUsedAt).toBe(t.time.now());
    const mine = operatorListReplySchema
      .parse((await t.list(again)).json())
      .operators.find((one) => one.you);
    expect(mine!.signedInAt).toBe(signedAt);
  });

  it('reads “none” for an account written before the field existed', async () => {
    const t = await setup();
    const found = await t.client.getRecord(recordKeys.operatorAccount(t.op.id));
    const { signedInAt: _gone, ...older } = storedAccountSchema.parse(found!.data);
    await t.client.putRecord(recordKeys.operatorAccount(t.op.id), older, found!.tag);

    const mine = operatorListReplySchema
      .parse((await t.list()).json())
      .operators.find((one) => one.you);
    expect(mine!.signedInAt).toBeNull();
  });
});

describe('Listing and adding need the operator’s session, a name of 1 to 60 characters and the touch for this act', () => {
  it('is a 401 with no sign-in or a wrong handle, on both routes, and nothing is written', async () => {
    const t = await setup();
    const before = await operatorRecords(t);
    const confirm = await touchFor(t, t.op.authId, t.op.authenticator, 'add-operator');

    for (const headers of [{}, withAuth('not-a-handle')]) {
      expect((await t.app.inject({ method: 'GET', url: LIST, headers })).statusCode).toBe(401);
      const posted = await t.app.inject({
        method: 'POST',
        url: LIST,
        headers,
        payload: { name: 'Thu Hà', confirm },
      });
      expect(posted.statusCode).toBe(401);
    }
    expect((await operatorRecords(t)).length).toBe(before.length);
  });

  it('is a 400 for no name, a blank one, one of 61 characters, a body with more, or no touch in it', async () => {
    const t = await setup();
    const send = (payload: object) =>
      t.app.inject({ method: 'POST', url: LIST, headers: withAuth(t.op.authId), payload });
    const touch = () => touchFor(t, t.op.authId, t.op.authenticator, 'add-operator');

    expect((await send({ confirm: await touch() })).statusCode).toBe(400);
    expect((await t.add('   ')).statusCode).toBe(400);
    expect((await t.add('x'.repeat(61))).statusCode).toBe(400);
    expect((await send({ name: 'Thu Hà' })).statusCode).toBe(400);
    expect((await send({ name: 'Thu Hà', confirm: await touch(), more: 1 })).statusCode).toBe(400);
    expect((await t.add('x'.repeat(60))).statusCode).toBe(201);
    expect((await t.roster()).operators).toHaveLength(2);
  });

  it('is a 403 without a touch made for this act, by this operator, once, and nothing is written', async () => {
    const t = await setup();
    const stranger = await joinedOperator(t, 'stranger');
    const before = await operatorRecords(t);

    const forAdd = await touchFor(t, t.op.authId, t.op.authenticator, 'add');
    expect((await t.add('Thu Hà', { confirm: forAdd })).statusCode).toBe(403);
    const strangers = await touchFor(t, stranger.authId, stranger.authenticator, 'add-operator');
    expect((await t.add('Thu Hà', { confirm: strangers })).statusCode).toBe(403);
    const forgery = await touchFor(t, t.op.authId, t.op.authenticator, 'add-operator', {
      tamper: true,
    });
    expect((await t.add('Thu Hà', { confirm: forgery })).statusCode).toBe(403);
    const once = await touchFor(t, t.op.authId, t.op.authenticator, 'add-operator');
    expect((await t.add('Thu Hà', { confirm: once })).statusCode).toBe(201);
    expect((await t.add('Other', { confirm: once })).statusCode).toBe(403);
    expect((await t.roster()).operators.map((one) => one.name)).toEqual([
      'operator',
      'stranger',
      'Thu Hà',
    ]);
    expect((await operatorRecords(t)).length).toBeGreaterThan(before.length);
  });
});

describe('The join link is in the add’s answer alone', () => {
  it('is in no log line: the add’s, a refused one’s, or the list’s', async () => {
    const lines: string[] = [];
    const t = await setup({
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    const made = addOperatorReplySchema.parse((await t.add('Thu Hà')).json());
    await t.add('thu hà');
    await t.list();
    const token = tokenOfFragment(new URL(made.link, ORIGIN).hash)!;

    expect(lines.filter((line) => line.includes('/api/operator/operators')).length).toBeGreaterThan(
      0,
    );
    expect(lines.join('\n')).not.toContain(token);
    expect(lines.join('\n')).not.toContain('/operator/join#');
  });
});

const tokenOf = (answer: { json: () => unknown }) =>
  tokenOfFragment(new URL(operatorLinkReplySchema.parse(answer.json()).link, ORIGIN).hash)!;

describe('A new link for a colleague, after a touch of the reader’s own passkey', () => {
  it('reaches one listed invited whose first link was lost (item 65): a join link, shown once, that opens on their name', async () => {
    const t = await setup();
    const invited = await inviteOperator(t, 'Lan Anh', t.op.id);
    t.time.advance(60_000);

    const answer = await t.link(invited.id);

    expect(answer.statusCode).toBe(201);
    const token = tokenOf(answer);
    const stored = storedLinkSchema.parse(
      (await t.client.getRecord(recordKeys.operatorLink(await sha256Hex(token))))!.data,
    );
    expect(stored).toEqual({
      operatorId: invited.id,
      kind: 'join',
      madeBy: t.op.id,
      endsAt: t.time.now() + 24 * 60 * 60 * 1000,
    });
    const opened = await t.app.inject({
      method: 'POST',
      url: '/api/operator/join/options',
      payload: { link: token },
      headers: { 'x-device-id': 'device-new' },
    });
    expect(opened.json()).toMatchObject({ name: 'Lan Anh', madeBy: 'operator' });
    const lost = await t.app.inject({
      method: 'POST',
      url: '/api/operator/join/options',
      payload: { link: invited.token },
      headers: { 'x-device-id': 'device-new' },
    });
    expect(lost.statusCode).toBe(404);
  });

  it('makes a replace link for an active colleague that takes nothing when made, and replaces their passkeys and ends their sessions at its use', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const before = await t.account(lan.id);

    const token = tokenOf(await t.link(lan.id));

    const made = await t.account(lan.id);
    expect(made.passkeys).toEqual(before.passkeys);
    expect(made.generation).toBe(before.generation);
    expect((await signInWith(t, lan.authenticator)).sent.statusCode).toBe(200);
    expect(
      (await t.app.inject({ method: 'GET', url: LIST, headers: withAuth(lan.authId) })).statusCode,
    ).toBe(200);

    const fresh = new SoftwareAuthenticator(ORIGIN);
    const { joined } = await joinWith(t, token, fresh);
    expect(joined.statusCode).toBe(200);
    expect((await t.account(lan.id)).passkeys).toHaveLength(1);
    expect((await t.account(lan.id)).generation).toBe(before.generation + 1);
    expect(
      (await t.app.inject({ method: 'GET', url: LIST, headers: withAuth(lan.authId) })).statusCode,
    ).toBe(401);
    expect((await signInWith(t, lan.authenticator)).sent.statusCode).toBe(401);
    expect((await signInWith(t, fresh)).sent.statusCode).toBe(200);
  });

  it('lets the newest link win: the earlier one is gone', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const first = tokenOf(await t.link(lan.id));
    const second = tokenOf(await t.link(lan.id));

    const opened = (link: string) =>
      t.app.inject({
        method: 'POST',
        url: '/api/operator/join/options',
        payload: { link },
        headers: { 'x-device-id': 'device-new' },
      });
    expect((await opened(first)).statusCode).toBe(404);
    expect((await opened(second)).statusCode).toBe(200);
  });

  it('is a 401 with no sign-in, a 400 for a body with more or no touch, a 404 for no such operator, and writes nothing', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const before = await operatorRecords(t);
    const confirm = await touchFor(t, t.op.authId, t.op.authenticator, 'operator-link');
    const send = (
      id: string,
      payload: object,
      headers: Record<string, string> = withAuth(t.op.authId),
    ) => t.app.inject({ method: 'POST', url: operatorRoutes.link(id), headers, payload });

    for (const headers of [{}, withAuth('not-a-handle')])
      expect((await send(lan.id, { confirm }, headers)).statusCode).toBe(401);
    expect((await send(lan.id, {})).statusCode).toBe(400);
    expect((await send(lan.id, { confirm, more: 1 })).statusCode).toBe(400);
    expect((await operatorRecords(t)).join()).toBe(before.join());
    expect((await t.link(randomUUID())).statusCode).toBe(404);
  });

  it('is a 403 on oneself, on a touch made for another act, a forged one, or one used before, and writes no link', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const links = async () => (await t.client.listRecords('operator.link.')).records.length;
    const before = await links();

    expect((await t.link(t.op.id)).statusCode).toBe(403);
    const other = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator');
    expect((await t.link(lan.id, { confirm: other })).statusCode).toBe(403);
    const forgery = await touchFor(t, t.op.authId, t.op.authenticator, 'operator-link', {
      tamper: true,
    });
    expect((await t.link(lan.id, { confirm: forgery })).statusCode).toBe(403);
    expect(await links()).toBe(before);
    const once = await touchFor(t, t.op.authId, t.op.authenticator, 'operator-link');
    expect((await t.link(lan.id, { confirm: once })).statusCode).toBe(201);
    expect((await t.link(lan.id, { confirm: once })).statusCode).toBe(403);
  });

  it('is in no log line, a refused one’s included', async () => {
    const lines: string[] = [];
    const t = await setup({
      logger: { stream: { write: (line: string) => void lines.push(line) } },
    });
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const token = tokenOf(await t.link(lan.id));
    await t.link(t.op.id);

    expect(lines.filter((line) => line.includes('/link')).length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(token);
    expect(lines.join('\n')).not.toContain('/operator/join#');
  });
});

/** A client that, when armed, runs a hook once just before the next write to a key holding `part`. */
const interrupting = (part: string) => {
  const state: { hook: null | (() => Promise<unknown>); always: boolean } = {
    hook: null,
    always: false,
  };
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    putRecord: async (key, data, tag) => {
      const hook = state.hook;
      if (hook && key.includes(part)) {
        if (!state.always) state.hook = null;
        await hook();
      }
      return await client.putRecord(key, data, tag);
    },
  });
  return { wrap, before: (hook: () => Promise<unknown>) => (state.hook = hook), state };
};

describe('A colleague deleted, after a touch of the reader’s own passkey', () => {
  it('takes the roster line, the account, their live link and the links they made, each by its tag, and frees the name', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const made = await createOperator(t.client, {
      name: 'Bao',
      addedBy: lan.id,
      now: t.time.now(),
    });
    if (made === 'taken') throw new Error('taken');
    const mine = await inviteOperator(t, 'Kho', t.op.id);
    const kept = (await operatorRecords(t)).length;
    expect(kept).toBeGreaterThan(0);
    const lanLink = tokenOf(await t.link(lan.id));

    const answer = await t.remove(lan.id);

    expect(answer.statusCode).toBe(204);
    expect(answer.body).toBe('');
    expect((await t.roster()).operators.map((one) => one.name).sort()).toEqual([
      'Bao',
      'Kho',
      'operator',
    ]);
    expect(await t.client.getRecord(recordKeys.operatorAccount(lan.id))).toBeNull();
    expect(await t.client.getRecord(recordKeys.operatorLink(await sha256Hex(lanLink)))).toBeNull();
    expect(
      await t.client.getRecord(recordKeys.operatorLink(await sha256Hex(made.token))),
    ).toBeNull();
    const surviving = (await t.client.listRecords('operator.link.')).records.length;
    expect(surviving).toBe(1);
    expect((await t.account(mine.id)).linkHash).toBe(await sha256Hex(mine.token));
    const listed = operatorListReplySchema.parse((await t.list()).json()).operators;
    expect(listed.find((one) => one.id === made.id)).toMatchObject({
      addedBy: null,
      addedByTerminal: false,
    });
    expect((await t.add('LAN ANH')).statusCode).toBe(201);
  });

  it('signs the deleted one out at their next request, and they cannot sign in again', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    expect(
      (await t.app.inject({ method: 'GET', url: LIST, headers: withAuth(lan.authId) })).statusCode,
    ).toBe(200);

    expect((await t.remove(lan.id)).statusCode).toBe(204);

    expect(
      (await t.app.inject({ method: 'GET', url: LIST, headers: withAuth(lan.authId) })).statusCode,
    ).toBe(401);
    expect((await signInWith(t, lan.authenticator)).sent.statusCode).toBe(401);
  });

  it('deletes one still invited, with their link, and a link made for them is then a 404', async () => {
    const t = await setup();
    const invited = await inviteOperator(t, 'Lan Anh', t.op.id);

    expect((await t.remove(invited.id)).statusCode).toBe(204);

    expect(await t.client.getRecord(recordKeys.operatorAccount(invited.id))).toBeNull();
    expect((await t.client.listRecords('operator.link.')).records).toHaveLength(0);
    expect((await t.link(invited.id)).statusCode).toBe(404);
    expect((await t.remove(invited.id)).statusCode).toBe(404);
  });

  it('is a 401 with no sign-in, a 400 for a body with more, a 403 on oneself or on another act’s touch, and writes nothing', async () => {
    const t = await setup();
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const before = await operatorRecords(t);
    const confirm = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator');
    const send = (payload: object, headers: Record<string, string> = withAuth(t.op.authId)) =>
      t.app.inject({ method: 'DELETE', url: operatorRoutes.one(lan.id), headers, payload });

    for (const headers of [{}, withAuth('not-a-handle')])
      expect((await send({ confirm }, headers)).statusCode).toBe(401);
    expect((await send({ confirm, more: 1 })).statusCode).toBe(400);
    expect((await t.remove(t.op.id)).statusCode).toBe(403);
    const forLink = await touchFor(t, t.op.authId, t.op.authenticator, 'operator-link');
    expect((await t.remove(lan.id, { confirm: forLink })).statusCode).toBe(403);
    const forgery = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator', {
      tamper: true,
    });
    expect((await t.remove(lan.id, { confirm: forgery })).statusCode).toBe(403);
    expect((await t.roster()).operators).toHaveLength(2);
    expect((await operatorRecords(t)).length).toBe(before.length);
    expect((await send({ confirm })).statusCode).toBe(204);
  });

  it('leaves one of two deleting each other, the other a 401, and deletes nothing more', async () => {
    const race = interrupting('operator.roster');
    const t = await setup({ wrap: race.wrap });
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const mine = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator');
    const theirs = await touchFor(t, lan.authId, lan.authenticator, 'delete-operator');
    race.before(async () => {
      expect((await t.remove(t.op.id, { confirm: theirs, authId: lan.authId })).statusCode).toBe(
        204,
      );
    });

    const lost = await t.remove(lan.id, { confirm: mine });

    expect(lost.statusCode).toBe(401);
    expect((await t.roster()).operators.map((one) => one.name)).toEqual(['Lan Anh']);
    expect(await t.client.getRecord(recordKeys.operatorAccount(t.op.id))).toBeNull();
    expect(await t.client.getRecord(recordKeys.operatorAccount(lan.id))).not.toBeNull();
  });

  it('is a 404 for a target deleted by a rival between the read and the write, and writes no second roster', async () => {
    const race = interrupting('operator.roster');
    const t = await setup({ wrap: race.wrap });
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const third = await joinedOperator(t, 'Kho', t.op.id);
    const mine = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator');
    const theirs = await touchFor(t, third.authId, third.authenticator, 'delete-operator');
    race.before(async () => {
      expect((await t.remove(lan.id, { confirm: theirs, authId: third.authId })).statusCode).toBe(
        204,
      );
    });

    const lost = await t.remove(lan.id, { confirm: mine });

    expect(lost.statusCode).toBe(404);
    expect((await t.roster()).operators.map((one) => one.name).sort()).toEqual(['Kho', 'operator']);
  });

  it('surfaces a genuine conflict: a roster that moves on every try is a 5xx, never a bypass of its tag', async () => {
    const race = interrupting('operator.roster');
    const t = await setup({ wrap: race.wrap });
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const mine = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-operator');
    race.state.always = true;
    let rivals = 0;
    race.before(async () => {
      const found = (await t.client.getRecord(recordKeys.operatorRoster))!;
      rivals++;
      const { operators } = storedRosterSchema.parse(found.data);
      await t.client.putRecord(
        recordKeys.operatorRoster,
        { operators: [...operators].reverse() },
        found.tag,
      );
    });

    const lost = await t.remove(lan.id, { confirm: mine });

    expect(lost.statusCode).toBeGreaterThanOrEqual(500);
    expect(rivals).toBe(3);
    expect((await t.roster()).operators).toHaveLength(2);
  });

  it('recovers when a record it removes moved under it, and surfaces one that moves every time', async () => {
    const lanRival = { moved: 0 };
    const t = await setup({
      wrap: (client) => ({
        ...client,
        removeRecord: async (key, tag) => {
          if (key.startsWith('operator.account.') && lanRival.moved > 0) {
            lanRival.moved--;
            const found = (await client.getRecord(key))!;
            const account = storedAccountSchema.parse(found.data);
            await client.putRecord(key, { ...account, signedInAt: lanRival.moved }, found.tag);
          }
          return await client.removeRecord(key, tag);
        },
      }),
    });
    const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
    const kho = await joinedOperator(t, 'Kho', t.op.id);

    lanRival.moved = 1;
    expect((await t.remove(lan.id)).statusCode).toBe(204);
    expect(await t.client.getRecord(recordKeys.operatorAccount(lan.id))).toBeNull();

    lanRival.moved = 99;
    expect((await t.remove(kho.id)).statusCode).toBeGreaterThanOrEqual(500);
  });
});

describe('A delete that fails partway (review M1)', () => {
  // Every point of one delete where a write can throw: each removal in turn, and the roster line.
  const points = ['remove 1', 'remove 2', 'remove 3', 'roster'] as const;
  it.each(points)(
    'leaves no link of the deleted one, or of theirs, that still joins, and a retry finishes or finds nothing: failing at %s',
    async (point) => {
      const failing = { on: false, removals: 0 };
      const t = await setup({
        wrap: (client) => ({
          ...client,
          removeRecord: async (key, tag) => {
            failing.removals++;
            if (failing.on && point === `remove ${failing.removals}`)
              throw new CStorageError(503, 'a removal failed');
            return await client.removeRecord(key, tag);
          },
          putRecord: async (key, data, tag) => {
            if (failing.on && point === 'roster' && key === recordKeys.operatorRoster)
              throw new CStorageError(503, 'the roster write failed');
            return await client.putRecord(key, data, tag);
          },
        }),
      });
      const lan = await joinedOperator(t, 'Lan Anh', t.op.id);
      const kho = await inviteOperator(t, 'Kho', lan.id);
      const lanLink = tokenOf(await t.link(lan.id));
      failing.removals = 0;
      failing.on = true;

      expect((await t.remove(lan.id)).statusCode).toBeGreaterThanOrEqual(500);
      failing.on = false;

      const left = async () =>
        (await t.client.listRecords('operator.link.')).records.map(({ data }) =>
          storedLinkSchema.parse(data),
        );
      const listed = (await t.roster()).operators.some((one) => one.id === lan.id);
      if (!listed)
        expect(
          (await left()).filter((one) => one.madeBy === lan.id || one.operatorId === lan.id),
        ).toEqual([]);
      const retried = (await t.remove(lan.id)).statusCode;
      expect([204, 404]).toContain(retried);
      expect(
        (await left()).filter((one) => one.madeBy === lan.id || one.operatorId === lan.id),
      ).toEqual([]);
      expect(
        await t.client.getRecord(recordKeys.operatorLink(await sha256Hex(lanLink))),
      ).toBeNull();
      expect(
        await t.client.getRecord(recordKeys.operatorLink(await sha256Hex(kho.token))),
      ).toBeNull();
    },
  );
});

describe('Two spellings of one name racing, and names in either Unicode form (items 66 and 67)', () => {
  it('takes the second spelling as taken when the roster moved under it (item 66)', async () => {
    const race = interrupting('operator.roster');
    const t = await setup({ wrap: race.wrap });
    race.before(async () => {
      await createOperator(t.client, { name: 'Thu Hà', addedBy: null, now: 1 });
    });

    const lost = await t.add('  THU HÀ ');

    expect(lost.statusCode).toBe(409);
    expect((await t.roster()).operators.map((one) => one.name)).toEqual(['operator', 'Thu Hà']);
  });

  it('takes a name typed with combining accents as the precomposed one, and stores it precomposed (item 67)', async () => {
    const t = await setup();
    expect((await t.add('Thu H\u00e0')).statusCode).toBe(201);

    expect((await t.add('thu ha\u0300')).statusCode).toBe(409);
    expect((await t.add('Bi\u0301ch')).statusCode).toBe(201);
    expect((await t.roster()).operators.map((one) => one.name)).toContain('B\u00edch');
  });
});
