import { randomUUID } from 'node:crypto';
import {
  type CStorageClient,
  createClientReplySchema,
  deleteClientReplySchema,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freshTenant, type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { joinedOperator, touchFor } from '../../tests/operator';
import { deleteClient } from '../records/clients';
import { bffOn, scoped, seedSettings, seedTenant, signIn, withAuth } from '../../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

/** The back end over a home box and a second box `b2`, whose writes and removals are logged, with
 * an operator signed in. */
async function setup(options: { held?: boolean } = {}) {
  const second = (await freshTenant(cs)).client;
  const writes: string[] = [];
  const logged: CStorageClient = {
    ...second,
    putRecord: (key, data, tag) => (writes.push(`put ${key}`), second.putRecord(key, data, tag)),
    removeRecord: (key, tag) => (writes.push(`remove ${key}`), second.removeRecord(key, tag)),
  };
  const t = await bffOn(cs, options.held === false ? {} : { boxes: { b2: logged } });
  const op = await joinedOperator(t);
  const asOperator = (method: 'POST' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: withAuth(op.authId), payload });
  /** A company made through the form on `b2`, as the operator makes one. */
  const onB2 = async (code: string) => {
    const made = await asOperator('POST', '/api/operator/clients', { code, name: code, box: 'b2' });
    const { password } = createClientReplySchema.parse(made.json());
    const line = await t.client.getRecord(recordKeys.client(code));
    return { password, id: storedClientSchema.parse(line?.data).id };
  };
  const press = async (code: string) =>
    asOperator('DELETE', `/api/operator/clients/${code}`, {
      confirm: await touchFor(t, op.authId, op.authenticator, 'delete-client'),
    });
  const setPassword = async (code: string, password: string) =>
    asOperator('POST', `/api/operator/clients/${code}/root-password`, {
      password,
      confirm: await touchFor(t, op.authId, op.authenticator, 'root-password'),
    });
  return { ...t, second, writes, op, onB2, press, setPassword };
}

const recordsOf = async (store: CStorageClient, id: string) =>
  (await store.listRecords(recordKeys.tenant(id).all)).records.map((record) => record.key);

describe('A delete and a root password act on the company’s own box', () => {
  it('sweeps the records of a company on b2 there, removes its line on the home box, and answers none left', async () => {
    const t = await setup();
    const { id } = await t.onB2('sweepme');
    expect((await recordsOf(t.second, id)).length).toBeGreaterThan(0);
    const answer = await t.press('sweepme');
    expect(answer.statusCode).toBe(200);
    expect(deleteClientReplySchema.parse(answer.json()).left).toBe(0);
    expect(await recordsOf(t.second, id)).toEqual([]);
    expect(await t.client.getRecord(recordKeys.client('sweepme'))).toBeNull();
  });

  it('resumes a deletion on b2 from the deletion record, which names the box', async () => {
    const t = await setup();
    const { id } = await t.onB2('resumeme');
    for (let n = 0; n < 205; n++) {
      await t.second.putRecord(
        recordKeys.tenant(id).employee(`e${String(n).padStart(4, '0')}`),
        {},
      );
    }
    const first = deleteClientReplySchema.parse((await t.press('resumeme')).json());
    expect(first.left).toBeGreaterThan(0);
    const rest = await t.app.inject({
      method: 'DELETE',
      url: '/api/operator/clients/resumeme',
      headers: withAuth(t.op.authId),
    });
    expect(deleteClientReplySchema.parse(rest.json()).left).toBe(0);
    expect(await recordsOf(t.second, id)).toEqual([]);
  });

  it('sets the root’s password on b2, where the root is, and the company signs in with it', async () => {
    const t = await setup();
    const { id } = await t.onB2('rootb2');
    const before = t.writes.length;
    const answer = await t.setPassword('rootb2', 'New-Pass-1!x');
    expect(answer.statusCode).toBe(200);
    expect(t.writes.slice(before).some((write) => write.includes(`tenant.${id}.`))).toBe(true);
    const { response } = await signIn(scoped(t.app, 'rootb2'), {
      name: 'root',
      password: 'New-Pass-1!x',
    });
    expect(response.statusCode).toBe(200);
  });

  it('answers 503 to a delete and a root password of a company whose box is not held, writing nothing', async () => {
    const t = await setup({ held: false });
    await t.client.putRecord(
      recordKeys.client('lost'),
      { id: randomUUID(), name: 'Lost', box: 'b2' },
      null,
    );
    expect((await t.press('lost')).statusCode).toBe(503);
    expect((await t.setPassword('lost', 'New-Pass-1!x')).statusCode).toBe(503);
    expect(await t.client.getRecord(recordKeys.client('lost'))).not.toBeNull();
  });
});

describe('Case 6: a delete whose box holds nothing of the company stops and removes nothing, the line included', () => {
  it('answers 409 and leaves the line, the home box’s records and the second box as they were', async () => {
    const t = await setup();
    const id = await seedTenant(t.client, 'wrongline');
    await seedSettings(t.client, id);
    const line = await t.client.getRecord(recordKeys.client('wrongline'));
    await t.client.putRecord(
      recordKeys.client('wrongline'),
      { id, name: 'Acme', box: 'b2' },
      line!.tag,
    );
    // The company's people try to sign in, and each try leaves a wait record on the box the line
    // names: so `b2` holds a record under the company's prefix, though not its settings.
    expect((await signIn(scoped(t.app, 'wrongline'))).response.statusCode).toBe(401);
    expect((await recordsOf(t.second, id)).length).toBe(1);
    const home = await recordsOf(t.client, id);
    t.writes.length = 0;
    const answer = await t.press('wrongline');
    expect(answer.statusCode).toBe(409);
    expect(await t.client.getRecord(recordKeys.client('wrongline'))).not.toBeNull();
    expect(await t.client.getRecord(recordKeys.clientDeletion('wrongline'))).toBeNull();
    expect(await recordsOf(t.client, id)).toEqual(home);
    expect(t.writes).toEqual([]);
  });
});

describe('Case 10: on a line naming the wrong box a signed-in call is refused and nothing is written there', () => {
  it('refuses a handle minted when the company was on home, writing nothing on b2, and a sign-in finds nobody', async () => {
    const t = await setup();
    const id = await seedTenant(t.client, 'moved');
    const app = scoped(t.app, 'moved');
    const { response, body } = await signIn(app);
    expect(response.statusCode).toBe(200);
    const line = await t.client.getRecord(recordKeys.client('moved'));
    await t.client.putRecord(
      recordKeys.client('moved'),
      { id, name: 'Acme', box: 'b2' },
      line!.tag,
    );
    t.writes.length = 0;

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: withAuth(body.authId),
    });
    expect(me.statusCode).toBe(401);
    expect(t.writes).toEqual([]);
    // A sign-in finds nobody there; the wait it leaves is the company's box's own record.
    expect((await signIn(app)).response.statusCode).toBe(401);
  });
});

describe('The terminal’s delete names no box: the store it is handed holds the company', () => {
  it('sweeps a home company through deleteClient with no box given', async () => {
    const t = await setup();
    const id = await seedTenant(t.client, 'terminal');
    await seedSettings(t.client, id);
    const held = await t.client.getRecord(recordKeys.client('terminal'));
    const done = await deleteClient(t.client, {
      code: 'terminal',
      index: { ...storedClientSchema.parse(held?.data), tag: held!.tag },
      by: randomUUID(),
      now: () => 1,
    });
    expect(done).toEqual({ left: 0 });
    expect(await recordsOf(t.client, id)).toEqual([]);
  });

  it('refuses a line naming b2 when it is handed no box, writing nothing, the line and the deletion record included', async () => {
    const t = await setup();
    const { id } = await t.onB2('terminalb2');
    const held = await t.client.getRecord(recordKeys.client('terminalb2'));
    const before = await recordsOf(t.second, id);
    expect(before.length).toBeGreaterThan(1);
    const calls: string[] = [];
    const logged: CStorageClient = {
      ...t.client,
      putRecord: (key, data, tag) => (calls.push(`put ${key}`), t.client.putRecord(key, data, tag)),
      removeRecord: (key, tag) => (calls.push(`remove ${key}`), t.client.removeRecord(key, tag)),
    };
    await expect(
      deleteClient(logged, {
        code: 'terminalb2',
        index: { ...storedClientSchema.parse(held?.data), tag: held!.tag },
        by: randomUUID(),
        now: () => 1,
      }),
    ).rejects.toThrow(/terminalb2.*b2/);
    expect(calls).toEqual([]);
    expect(await t.client.getRecord(recordKeys.client('terminalb2'))).not.toBeNull();
    expect(await recordsOf(t.second, id)).toEqual(before);
  });

  it('refuses a resumed deletion whose record names b2 when it is handed no box', async () => {
    const t = await setup();
    const { id } = await t.onB2('resumeb2');
    await t.client.putRecord(
      recordKeys.clientDeletion('resumeb2'),
      { id, name: 'resumeb2', by: randomUUID(), startedAt: 1, box: 'b2' },
      null,
    );
    await t.client.removeRecord(recordKeys.client('resumeb2'));
    await expect(
      deleteClient(t.client, { code: 'resumeb2', index: null, by: randomUUID(), now: () => 1 }),
    ).rejects.toThrow(/resumeb2.*b2/);
    expect(await t.client.getRecord(recordKeys.clientDeletion('resumeb2'))).not.toBeNull();
  });
});
