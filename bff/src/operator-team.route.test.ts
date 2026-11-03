import {
  addOperatorReplySchema,
  operatorListReplySchema,
  recordKeys,
  storedAccountSchema,
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
  const roster = async () =>
    storedRosterSchema.parse((await t.client.getRecord(recordKeys.operatorRoster))!.data);
  const account = async (id: string) =>
    storedAccountSchema.parse((await t.client.getRecord(recordKeys.operatorAccount(id)))!.data);
  return { ...t, op, list, add, roster, account };
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
