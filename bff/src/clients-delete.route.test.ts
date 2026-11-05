import {
  type CStorageClient,
  CStorageError,
  deleteClientReplySchema,
  recordKeys,
  storedClientDeletionSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { joinedOperator, touchFor } from '../tests/operator';
import { bffOn, CODE, scoped, seedTenant, signIn, withAuth } from '../tests/tenant';
import { DELETE_BOUND } from './clients';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Options = Parameters<typeof bffOn>[1];

/** What the wrapped store was asked, in order: the reads, the writes and the removals by key. */
type Calls = { read: string[]; wrote: string[]; removed: string[] };

/** An operator signed in, a client with a root, and a way to press Delete with a fresh touch made
 * for this act. `calls` is what the BFF asked of the store. */
async function setup(options: Options = {}, wrapMore?: (client: CStorageClient) => CStorageClient) {
  const calls: Calls = { read: [], wrote: [], removed: [] };
  /** The operator's own session and touch records move with every call; only the client's count. */
  const note = (list: string[], key: string) => {
    if (!key.startsWith('operator.')) list.push(key);
  };
  const wrap = (client: CStorageClient): CStorageClient => {
    const logged: CStorageClient = {
      ...client,
      getRecord: (key) => (calls.read.push(key), client.getRecord(key)),
      listRecords: (prefix) => (calls.read.push(prefix), client.listRecords(prefix)),
      putRecord: (key, data, tag) => (note(calls.wrote, key), client.putRecord(key, data, tag)),
      removeRecord: (key, tag) => (note(calls.removed, key), client.removeRecord(key, tag)),
    };
    return wrapMore ? wrapMore(logged) : logged;
  };
  const t = await bffOn(cs, { ...options, wrap });
  const op = await joinedOperator(t);
  const id = await seedTenant(t.client, CODE);
  const keys = recordKeys.tenant(id);
  const asRoot = scoped(t.app, CODE);
  const touch = () => touchFor(t, op.authId, op.authenticator, 'delete-client');
  const press = async ({
    code = CODE,
    headers = withAuth(op.authId),
    payload,
  }: { code?: string; headers?: Record<string, string>; payload?: object } = {}) =>
    await t.app.inject({
      method: 'DELETE',
      url: `/api/operator/clients/${code}`,
      headers,
      payload: payload === undefined ? { confirm: await touch() } : payload,
    });
  /** A press with no body at all: what a resume needs. */
  const resume = (code = CODE) =>
    t.app.inject({
      method: 'DELETE',
      url: `/api/operator/clients/${code}`,
      headers: withAuth(op.authId),
    });
  const tenantRecords = async () =>
    (await t.client.listRecords(keys.all)).records.map((r) => `${r.key}@${r.tag}`).sort();
  const index = async () => await t.client.getRecord(recordKeys.client(CODE));
  const deletion = async () => await t.client.getRecord(recordKeys.clientDeletion(CODE));
  /** `n` more records of the client, so a sweep needs several presses. */
  const fill = async (n: number) => {
    for (let from = 0; from < n; from += 50) {
      await Promise.all(
        Array.from({ length: Math.min(50, n - from) }, (_, i) =>
          t.client.putRecord(keys.employee(`e${String(from + i).padStart(5, '0')}`), { n: 1 }),
        ),
      );
    }
  };
  return {
    ...t,
    op,
    id,
    keys,
    asRoot,
    touch,
    press,
    resume,
    tenantRecords,
    index,
    deletion,
    fill,
    calls,
  };
}

const left = (answer: { json: () => unknown }) => deleteClientReplySchema.parse(answer.json()).left;

describe(
  'An operator deletes a client whole, with a fresh touch of their own passkey',
  { timeout: 30_000 },
  () => {
    it('case 6: removes the index and every record under the prefix, the seed’s ledger included; the answer says none are left', async () => {
      const t = await setup();
      await t.client.putRecord(t.keys.seed, { seeded: true });
      await t.client.putRecord(t.keys.employee('one'), { n: 1 });
      await t.client.putRecord(t.keys.config, { name: 'Acme' });
      const answer = await t.press();

      expect(answer.statusCode).toBe(200);
      expect(left(answer)).toBe(0);
      expect(await t.index()).toBeNull();
      expect(await t.tenantRecords()).toEqual([]);
      expect(await t.deletion()).toBeNull();
    });

    it('case 4: writes the deletion record, then removes the index, before any record of the tenant', async () => {
      const t = await setup();
      await t.client.putRecord(t.keys.employee('one'), { n: 1 });
      t.calls.wrote.length = 0;
      t.calls.removed.length = 0;
      await t.press();

      expect(t.calls.wrote).toEqual([recordKeys.clientDeletion(CODE)]);
      expect(t.calls.removed[0]).toBe(recordKeys.client(CODE));
      expect(t.calls.removed.slice(1, -1).every((key) => key.startsWith(t.keys.all))).toBe(true);
      expect(t.calls.removed.at(-1)).toBe(recordKeys.clientDeletion(CODE));
    });

    it('keeps who began it and when in the deletion record, until the last record is gone', async () => {
      const t = await setup();
      await t.fill(DELETE_BOUND + 5);
      t.time.advance(1000);
      await t.press();

      const record = storedClientDeletionSchema.parse((await t.deletion())!.data);
      expect(record).toEqual({ id: t.id, name: 'Acme', by: t.op.id, startedAt: t.time.now() });
    });

    it('case 5: a person signed in before the deletion is refused at their next call, by the client’s 404, and cannot sign in again', async () => {
      const t = await setup();
      const { body } = await signIn(t.asRoot);
      const mine = () =>
        t.asRoot.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(body.authId) });
      expect((await mine()).statusCode).toBe(200);
      await t.press();

      expect((await mine()).statusCode).toBe(404);
      expect((await signIn(t.asRoot)).response.statusCode).toBe(404);
    });

    it('case 5, mid-sweep: the client is out of the list and dark after the first press, though records are left', async () => {
      const t = await setup();
      const { body } = await signIn(t.asRoot);
      await t.fill(DELETE_BOUND * 2);
      const answer = await t.press();

      expect(left(answer)).toBeGreaterThan(0);
      const mine = await t.asRoot.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: withAuth(body.authId),
      });
      expect(mine.statusCode).toBe(404);
      const listed = await t.app.inject({
        method: 'GET',
        url: '/api/operator/clients',
        headers: withAuth(t.op.authId),
      });
      expect(
        listed.json<{ clients: { code: string }[] }>().clients.map((c) => c.code),
      ).not.toContain(CODE);
    });

    it('case 7 and 8: a tenant too large for one sweep answers how many are left, a press removes at most the bound, and the next finish it; the deletion record goes with the last', async () => {
      const t = await setup();
      await t.fill(DELETE_BOUND * 2 + 30);
      const total = (await t.tenantRecords()).length;

      const first = left(await t.press());
      expect(first).toBeGreaterThan(0);
      expect(first).toBeGreaterThanOrEqual(total - DELETE_BOUND);
      expect(await t.deletion()).not.toBeNull();
      const second = left(await t.resume());
      expect(second).toBeGreaterThan(0);
      expect(second).toBeLessThan(first);
      expect(await t.deletion()).not.toBeNull();
      expect(left(await t.resume())).toBe(0);
      expect(await t.tenantRecords()).toEqual([]);
      expect(await t.deletion()).toBeNull();
    });

    it('case 9: a press after the index is gone resumes from the deletion record on the session alone, no touch; with none, it is a 404', async () => {
      const t = await setup();
      await t.fill(DELETE_BOUND + 10);
      await t.press();

      expect(await t.index()).toBeNull();
      const stranger = await t.resume('nobody-here');
      expect(stranger.statusCode).toBe(404);
      const resumed = await t.resume();
      expect(resumed.statusCode).toBe(200);
      expect(left(resumed)).toBe(0);
      expect((await t.resume()).statusCode).toBe(404);
    });

    it('case 9: a sweep the store failed midway is finished by the next press', async () => {
      let fail = true;
      const t = await setup({}, (client) => ({
        ...client,
        removeRecord: async (key, tag) => {
          if (fail && key.includes('.employee.e00010')) {
            fail = false;
            throw new CStorageError(500, 'down');
          }
          return await client.removeRecord(key, tag);
        },
      }));
      await t.fill(40);
      const stopped = await t.press();

      expect(stopped.statusCode).toBe(503);
      expect(await t.index()).toBeNull();
      expect(await t.deletion()).not.toBeNull();
      const finished = await t.resume();
      expect(finished.statusCode).toBe(200);
      expect(left(finished)).toBe(0);
      expect(await t.tenantRecords()).toEqual([]);
      expect(await t.deletion()).toBeNull();
    });

    it('case 10: the code is free afterwards: a new client of the same code is made', async () => {
      const t = await setup();
      await t.press();
      const made = await t.app.inject({
        method: 'POST',
        url: '/api/operator/clients',
        headers: withAuth(t.op.authId),
        payload: { code: CODE, name: 'Again' },
      });

      expect(made.statusCode).toBe(201);
    });

    it('reaches one client only: another client’s index and records are as they were', async () => {
      const t = await setup();
      const other = await seedTenant(t.client, 'other-co');
      const before = (await t.client.listRecords(recordKeys.tenant(other).all)).records.length;
      await t.press();

      expect(await t.client.getRecord(recordKeys.client('other-co'))).not.toBeNull();
      expect((await t.client.listRecords(recordKeys.tenant(other).all)).records).toHaveLength(
        before,
      );
    });
  },
);

describe('Deleting a client needs the operator, the client’s code and the fresh touch, all checked before any write', () => {
  it('case 1: is a 401 with no sign-in, a wrong handle, or a client root’s handle, and nothing is written', async () => {
    const t = await setup();
    const root = await signIn(t.asRoot);
    const before = await t.tenantRecords();
    const payload = { confirm: await t.touch() };

    for (const headers of [{}, withAuth('not-a-handle'), withAuth(root.body.authId)]) {
      expect((await t.press({ headers, payload })).statusCode).toBe(401);
    }
    expect(await t.tenantRecords()).toEqual(before);
    expect(await t.index()).not.toBeNull();
    expect(t.calls.removed).toEqual([]);
  });

  it('case 1: a malformed code is a 400 and a code naming no client a 404, and no record of any tenant is read', async () => {
    const t = await setup();
    t.calls.read.length = 0;

    expect((await t.press({ code: 'Not A Code' })).statusCode).toBe(400);
    expect((await t.press({ code: 'nobody-here' })).statusCode).toBe(404);
    expect(t.calls.read.some((key) => key.startsWith('tenant.'))).toBe(false);
    expect(t.calls.wrote).toEqual([]);
    expect(t.calls.removed).toEqual([]);
  });

  it('case 3: a malformed body is a 400 before the touch is asked for: the touch is still good afterwards, and nothing is written', async () => {
    const t = await setup();
    const before = await t.tenantRecords();
    const confirm = await t.touch();

    expect((await t.press({ payload: {} })).statusCode).toBe(400);
    expect((await t.press({ payload: { confirm, more: 1 } })).statusCode).toBe(400);
    expect((await t.press({ payload: { confirm: 'x' } })).statusCode).toBe(400);
    expect(await t.tenantRecords()).toEqual(before);
    expect(await t.index()).not.toBeNull();
    expect(await t.deletion()).toBeNull();
    expect((await t.press({ payload: { confirm } })).statusCode).toBe(200);
  });

  it('case 2: a touch refused (403) changes nothing: the index and every record of the tenant are still there with their tags, and no deletion record was written', async () => {
    const t = await setup();
    await t.fill(5);
    const index = await t.index();
    const before = await t.tenantRecords();
    const stranger = await joinedOperator(t, 'stranger');
    t.calls.wrote.length = 0;
    t.calls.removed.length = 0;

    const forAdd = await touchFor(t, t.op.authId, t.op.authenticator, 'add');
    const theirs = await touchFor(t, stranger.authId, stranger.authenticator, 'delete-client');
    const forgery = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-client', {
      tamper: true,
    });
    const unverified = await touchFor(t, t.op.authId, t.op.authenticator, 'delete-client', {
      verified: false,
    });
    for (const confirm of [forAdd, theirs, forgery, unverified]) {
      expect((await t.press({ payload: { confirm } })).statusCode).toBe(403);
    }

    expect(await t.index()).toEqual(index);
    expect(await t.tenantRecords()).toEqual(before);
    expect(await t.deletion()).toBeNull();
    expect(t.calls.wrote).toEqual([]);
    expect(t.calls.removed).toEqual([]);
    const once = await t.touch();
    expect((await t.press({ payload: { confirm: once } })).statusCode).toBe(200);
    expect((await t.press({ payload: { confirm: once } })).statusCode).toBe(404);
  });
});
