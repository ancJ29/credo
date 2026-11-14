import { randomUUID } from 'node:crypto';
import {
  type CStorageClient,
  configDocSchema,
  createClientReplySchema,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freshTenant, type RunningCStorage, startCStorage } from '../tests/c-storage';
import { joinedOperator } from '../tests/operator';
import { bffOn, scoped, seedTenant, signIn, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

/** The back end over a home box and a second service standing for a second box, `b2`. */
async function twoBoxes(options: { logs?: string[]; held?: boolean } = {}) {
  const second = await freshTenant(cs);
  const t = await bffOn(cs, {
    ...(options.held === false ? {} : { boxes: { b2: second.client } }),
    ...(options.logs
      ? {
          logger: {
            level: 'error',
            stream: { write: (line: string) => options.logs?.push(line) },
          },
        }
      : {}),
  });
  return { ...t, second: second.client };
}

const keysOf = async (store: CStorageClient, prefix: string) =>
  (await store.listRecords(prefix)).records.map((record) => record.key);

describe('A company whose line names no box is served from the home box', () => {
  it('reads its settings from the home box when the line has no box, though another box is held', async () => {
    const t = await twoBoxes();
    const id = await seedTenant(t.client, 'oldco');
    await t.client.putRecord(recordKeys.tenant(id).config, {
      name: 'Old',
      logo: null,
      colour: '#2f7d6d',
      languages: ['vi'],
      defaultLanguage: 'vi',
    });
    const answer = await scoped(t.app, 'oldco').inject({ method: 'GET', url: '/api/config' });
    expect(answer.statusCode).toBe(200);
    expect(configDocSchema.parse(answer.json()).config.name).toBe('Old');
  });
});

describe('A company made on box two lives there, and only its line is on the home box', () => {
  it('writes the settings and the root on b2 and the line alone on home, then serves every call from b2', async () => {
    const t = await twoBoxes();
    const op = await joinedOperator(t);
    const made = await t.app.inject({
      method: 'POST',
      url: '/api/operator/clients',
      headers: withAuth(op.authId),
      payload: { code: 'pooled', name: 'Pooled Co', box: 'b2' },
    });
    expect(made.statusCode).toBe(201);
    const { password } = createClientReplySchema.parse(made.json());
    const line = await t.client.getRecord(recordKeys.client('pooled'));
    const index = storedClientSchema.parse(line?.data);
    expect(index.box).toBe('b2');
    const own = recordKeys.tenant(index.id).all;
    expect(await keysOf(t.second, own)).toEqual(
      expect.arrayContaining([recordKeys.tenant(index.id).config]),
    );
    expect(await keysOf(t.client, own)).toEqual([]);
    expect(await keysOf(t.second, recordKeys.clientPrefix)).toEqual([]);

    // Every call of it reaches b2, and home for the line alone.
    const homeReads: string[] = [];
    const watched = await bffOn(cs, {
      boxes: { b2: t.second },
      wrap: (client) => ({
        ...client,
        getRecord: (key) => {
          homeReads.push(key);
          return client.getRecord(key);
        },
        listRecords: (prefix, after) => {
          homeReads.push(prefix);
          return client.listRecords(prefix, after);
        },
      }),
    });
    await watched.client.putRecord(recordKeys.client('pooled'), index, null);
    const { response, body } = await signIn(scoped(watched.app, 'pooled'), {
      name: 'root',
      password,
    });
    expect(response.statusCode).toBe(200);
    const me = await scoped(watched.app, 'pooled').inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: withAuth(body.authId),
    });
    expect(me.statusCode).toBe(200);
    expect(homeReads.length).toBeGreaterThan(0);
    expect(homeReads.every((key) => key === recordKeys.client('pooled'))).toBe(true);
  });

  it('writes the home box when the form names it or names none, and the line names home', async () => {
    const t = await twoBoxes();
    const op = await joinedOperator(t);
    const make = (payload: object) =>
      t.app.inject({
        method: 'POST',
        url: '/api/operator/clients',
        headers: withAuth(op.authId),
        payload,
      });
    expect((await make({ code: 'none', name: 'None' })).statusCode).toBe(201);
    expect((await make({ code: 'named', name: 'Named', box: 'home' })).statusCode).toBe(201);
    for (const code of ['none', 'named']) {
      const index = storedClientSchema.parse(
        (await t.client.getRecord(recordKeys.client(code)))?.data,
      );
      expect(index.box).toBe('home');
      expect(await keysOf(t.client, recordKeys.tenant(index.id).all)).not.toEqual([]);
      expect(await keysOf(t.second, recordKeys.tenant(index.id).all)).toEqual([]);
    }
  });
});

describe('A line naming a box the back end was not handed answers 503, the log naming the box and no key', () => {
  it('answers 503 and logs the box', async () => {
    const logs: string[] = [];
    const t = await twoBoxes({ logs, held: false });
    await t.client.putRecord(
      recordKeys.client('lost'),
      { id: randomUUID(), name: 'Lost', box: 'b2' },
      null,
    );
    const answer = await scoped(t.app, 'lost').inject({ method: 'GET', url: '/api/config' });
    expect(answer.statusCode).toBe(503);
    expect(answer.json()).toEqual({ error: 'Service unavailable' });
    const logged = logs.join('');
    expect(logged).toContain('"box":"b2"');
    expect(logged).not.toContain(cs.internalAccessKey);
  });
});

describe('The form’s box absent adds on the home box; a box not held is a 400 naming the field', () => {
  it('refuses a box the back end does not hold, writing nothing', async () => {
    const t = await twoBoxes();
    const op = await joinedOperator(t);
    const before = await keysOf(t.client, recordKeys.clientPrefix);
    const answer = await t.app.inject({
      method: 'POST',
      url: '/api/operator/clients',
      headers: withAuth(op.authId),
      payload: { code: 'nowhere', name: 'Nowhere', box: 'zz' },
    });
    expect(answer.statusCode).toBe(400);
    expect(answer.json()).toEqual({ error: 'Bad request', details: 'box' });
    expect(await keysOf(t.client, recordKeys.clientPrefix)).toEqual(before);
  });
});
