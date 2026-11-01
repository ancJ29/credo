import { type CStorageClient, CStorageError, servicesReplySchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { joinedOperator } from '../tests/operator';
import { bffOn, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Options = Parameters<typeof bffOn>[1];

async function signedIn(options: Options = {}) {
  const t = await bffOn(cs, options);
  const op = await joinedOperator(t);
  const services = (query = '') =>
    t.app.inject({
      method: 'GET',
      url: `/api/operator/services${query}`,
      headers: withAuth(op.authId),
    });
  return { ...t, op, services };
}

/** The client with its `health` replaced, counting how often it is asked. */
function healthBy(health: CStorageClient['health']) {
  const asked = { count: 0 };
  const wrap = (client: CStorageClient): CStorageClient => ({
    ...client,
    health: () => {
      asked.count += 1;
      return health();
    },
  });
  return { asked, wrap };
}

describe('The Services status page shows the BFF, c-storage and their builds', () => {
  it('answers the BFF’s build and c-storage’s, with the milliseconds the read took', async () => {
    const t = await signedIn({ build: 'abc1234' });
    const answer = await t.services();
    expect(answer.statusCode).toBe(200);
    const reply = servicesReplySchema.parse(answer.json());
    expect(reply.build).toBe('abc1234');
    expect(reply.storage.build).toBe('dev');
    expect(Object.keys(answer.json<object>()).sort()).toEqual(['build', 'storage']);
  });

  it('says dev for a BFF nobody stamped', async () => {
    const t = await signedIn();
    expect(servicesReplySchema.parse((await t.services()).json()).build).toBe('dev');
  });

  it('times c-storage’s read, in whole milliseconds', async () => {
    const slow = healthBy(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { buildVersion: 'c0ffee1' };
    });
    const t = await signedIn({ wrap: slow.wrap });
    const reply = servicesReplySchema.parse((await t.services()).json());
    expect(reply.storage.build).toBe('c0ffee1');
    expect(reply.storage.ms).toBeGreaterThanOrEqual(35);
    expect(reply.storage.ms).toBeLessThan(2000);
  });
});

describe('The Services status needs an operator and is never kept', () => {
  it('is a 401 with no sign-in, and c-storage’s health is not asked', async () => {
    const probe = healthBy(() => Promise.resolve({ buildVersion: 'x' }));
    const t = await signedIn({ wrap: probe.wrap });
    const bare = await t.app.inject({ method: 'GET', url: '/api/operator/services' });
    expect(bare.statusCode).toBe(401);
    const wrong = await t.app.inject({
      method: 'GET',
      url: '/api/operator/services',
      headers: withAuth('not-a-handle'),
    });
    expect(wrong.statusCode).toBe(401);
    expect(probe.asked.count).toBe(0);
  });

  it('asks c-storage each time, and tells every cache not to keep the answer', async () => {
    const probe = healthBy(() => Promise.resolve({ buildVersion: 'x' }));
    const t = await signedIn({ wrap: probe.wrap });
    const first = await t.services();
    await t.services();
    expect(probe.asked.count).toBe(2);
    expect(first.headers['cache-control']).toBe('no-store');
  });

  it('keeps /api/health a 404 and the health body in this answer alone', async () => {
    const t = await signedIn();
    expect((await t.app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(404);
    const me = await t.app.inject({
      method: 'GET',
      url: '/api/operator/me',
      headers: withAuth(t.op.authId),
    });
    expect(JSON.stringify(me.json())).not.toContain('buildVersion');
  });
});

describe('When c-storage does not answer, the BFF says so by its own 503', () => {
  it('answers 503 in the BFF’s error shape when the health read fails', async () => {
    const down = healthBy(() => Promise.reject(new CStorageError(null, 'no answer')));
    const t = await signedIn({ wrap: down.wrap });
    const answer = await t.services();
    expect(answer.statusCode).toBe(503);
    expect(answer.json()).toEqual({ error: 'Service unavailable' });
  });

  it('answers 503 for a health that is not OK, and never a 401, which would sign the page out', async () => {
    const bad = healthBy(() => Promise.reject(new CStorageError(500, 'refused')));
    const t = await signedIn({ wrap: bad.wrap });
    expect((await t.services()).statusCode).toBe(503);
  });

  it('answers 503 on me and on services alike when the records cannot be read', async () => {
    let failing = false;
    const t = await signedIn({
      wrap: (client) => ({
        ...client,
        getRecord: (key) =>
          failing ? Promise.reject(new CStorageError(null, 'no answer')) : client.getRecord(key),
      }),
    });
    failing = true;
    const me = await t.app.inject({
      method: 'GET',
      url: '/api/operator/me',
      headers: withAuth(t.op.authId),
    });
    expect(me.statusCode).toBe(503);
    expect((await t.services()).statusCode).toBe(503);
  });
});
