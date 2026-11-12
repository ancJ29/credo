import { createHash } from 'node:crypto';
import { buildApp } from '@credo/bff';
import { joinByLink } from '@credo/bff/tests/join';
import { clientListReplySchema, type CStorageClient } from '@credo/shared';
import { DEMO_CLIENTS } from '@credo/shared/demo';
import { expect, it } from 'vitest';
import { seedDemo } from './generator';

/** c-storage in memory, enough for the BFF to run over: keys sorted, a tag a write. */
function memoryStorage(): CStorageClient {
  const records = new Map<string, unknown>();
  const tags = new Map<string, string>();
  let writes = 0;
  return {
    getRecord: (key) =>
      Promise.resolve(records.has(key) ? { data: records.get(key), tag: tags.get(key)! } : null),
    listRecords: (prefix) =>
      Promise.resolve({
        records: [...records]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, data]) => ({ key, data, tag: tags.get(key)! })),
        more: false,
      }),
    putRecord: (key, data, ifTag) => {
      if (ifTag === null ? records.has(key) : tags.get(key) !== ifTag) {
        return Promise.resolve('moved');
      }
      records.set(key, data);
      tags.set(key, createHash('sha256').update(String(writes++)).digest('hex'));
      return Promise.resolve('saved');
    },
    removeRecord: (key) => {
      records.delete(key);
      tags.delete(key);
      return Promise.resolve('removed');
    },
    health: () => Promise.resolve({ buildVersion: 'dev' }),
  };
}

it('The operator’s dashboard on a seeded stack lists the data set’s three as the fake does, until the walk makes a client, which then leads it', async () => {
  const storage = memoryStorage();
  const { invitedToken } = await seedDemo(storage);
  const origin = 'http://localhost:3181';
  const app = buildApp({
    storage,
    now: () => Date.now(),
    origin,
    serviceKey: 'a-key',
    logger: false,
  });
  const { session } = await joinByLink(app, invitedToken, origin, 'device-walk-seed');
  const headers = { 'x-auth-id': session.authId };
  const listed = async () =>
    clientListReplySchema
      .parse((await app.inject({ method: 'GET', url: '/api/operator/clients', headers })).json())
      .clients.map((client) => client.code);
  const fake = [...DEMO_CLIENTS].sort((a, b) => b.madeAt - a.madeAt).map((client) => client.code);

  expect(await listed()).toEqual(fake);

  const made = await app.inject({
    method: 'POST',
    url: '/api/operator/clients',
    headers,
    payload: { code: 'minh-phat', name: 'Minh Phát' },
  });

  expect(made.statusCode).toBe(201);
  expect(await listed()).toEqual(['minh-phat', ...fake]);
});
