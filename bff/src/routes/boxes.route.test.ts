import { randomUUID } from 'node:crypto';
import { boxesReplySchema, type CStorageClient, recordKeys } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { freshTenant, type RunningCStorage, startCStorage } from '../../tests/c-storage';
import { joinedOperator } from '../../tests/operator';
import { bffOn, withAuth } from '../../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

/** The back end over a home box and a second box `b2`, with an operator signed in. */
async function setup(second?: (real: CStorageClient) => CStorageClient) {
  const real = (await freshTenant(cs)).client;
  const t = await bffOn(cs, { boxes: { b2: second ? second(real) : real } });
  const op = await joinedOperator(t);
  const boxes = () =>
    t.app.inject({ method: 'GET', url: '/api/operator/boxes', headers: withAuth(op.authId) });
  const make = (code: string, box?: string) =>
    t.app.inject({
      method: 'POST',
      url: '/api/operator/clients',
      headers: withAuth(op.authId),
      payload: { code, name: code, ...(box ? { box } : {}) },
    });
  return { ...t, op, boxes, make };
}

describe('The boxes route', () => {
  it('8: names each box, the home box first, with its companies and its free disk', async () => {
    const t = await setup();
    expect((await t.make('onhome')).statusCode).toBe(201);
    expect((await t.make('onsecond', 'b2')).statusCode).toBe(201);
    expect((await t.make('another', 'b2')).statusCode).toBe(201);

    const answer = await t.boxes();

    expect(answer.statusCode).toBe(200);
    expect(answer.headers['cache-control']).toBe('no-store');
    const { boxes } = boxesReplySchema.parse(answer.json());
    expect(boxes.map((box) => [box.name, box.companies])).toEqual([
      ['home', 1],
      ['b2', 2],
    ]);
    for (const box of boxes) expect(box.freeBytes).toBeGreaterThan(0);
  });

  it('8: A box that does not answer is shown with no disk, and the others still are', async () => {
    const t = await setup((real) => ({
      ...real,
      status: () => Promise.reject(new Error('down')),
    }));

    const { boxes } = boxesReplySchema.parse((await t.boxes()).json());

    expect(boxes[0]).toMatchObject({ name: 'home' });
    expect(boxes[0]?.freeBytes).toBeGreaterThan(0);
    expect(boxes[1]).toEqual({ name: 'b2', companies: 0, freeBytes: null });
  });

  it('8: With no box added the list is the home box alone, and a company with no box line counts there', async () => {
    const t = await bffOn(cs);
    const op = await joinedOperator(t);
    await t.client.putRecord(recordKeys.client('legacy'), { id: randomUUID(), name: 'Legacy' });
    const answer = await t.app.inject({
      method: 'GET',
      url: '/api/operator/boxes',
      headers: withAuth(op.authId),
    });

    const { boxes } = boxesReplySchema.parse(answer.json());
    expect(boxes.map((box) => [box.name, box.companies])).toEqual([['home', 1]]);
  });

  it('8: Nobody signed in as an operator is refused, and no box is read', async () => {
    const t = await setup();

    const bare = await t.app.inject({ method: 'GET', url: '/api/operator/boxes' });
    const client = await t.app.inject({
      method: 'GET',
      url: '/api/operator/boxes',
      headers: withAuth('not.an.operator'),
    });

    expect(bare.statusCode).toBe(401);
    expect(client.statusCode).toBe(401);
  });
});
