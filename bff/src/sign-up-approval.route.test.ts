import {
  type CStorageClient,
  clientLinkPath,
  recordKeys,
  signUpApprovedReplySchema,
  signUpListReplySchema,
  signUpRoutes,
  storedClientSchema,
  storedSignUpSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { recordingActivity } from '../tests/audit';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { joinedOperator } from '../tests/operator';
import { bffOn, scoped, seedTenant, signIn, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const ASKED = {
  code: 'phu-quy',
  name: 'Gạch Men Phú Quý',
  contactName: 'Nguyễn Văn An',
  contactPhone: '0901 234 567',
  password: 'Correct-horse-9!',
};

/** A BFF with an operator joined and signed in, whose store counts the writes to any company's
 * records and to the client index, for the answers that must write nothing of a company. */
async function operators() {
  const companyWrites: string[] = [];
  const activity = recordingActivity();
  const t = await bffOn(cs, {
    activity: activity.client,
    wrap: (client): CStorageClient => ({
      ...client,
      putRecord: async (key, data, tag) => {
        if (key.startsWith('tenant.') || key.startsWith('client.')) companyWrites.push(key);
        return await client.putRecord(key, data, tag);
      },
    }),
  });
  const op = await joinedOperator(t);
  const as = (authId: string) => ({
    list: () =>
      t.app.inject({
        method: 'GET',
        url: signUpRoutes.list,
        headers: authId ? withAuth(authId) : {},
      }),
    approve: (code: string) =>
      t.app.inject({
        method: 'POST',
        url: signUpRoutes.approve(code),
        headers: authId ? withAuth(authId) : {},
      }),
    refuse: (code: string) =>
      t.app.inject({
        method: 'DELETE',
        url: signUpRoutes.one(code),
        headers: authId ? withAuth(authId) : {},
      }),
  });
  const ask = (payload: object = ASKED) =>
    t.app.inject({ method: 'POST', url: signUpRoutes.send, payload });
  return { ...t, op, operator: as(op.authId), as, ask, companyWrites, activity };
}

describe('The operator lists the waiting requests, oldest first, with no password', () => {
  it('lists each with its code, name, contact and day sent, and nothing of its hash', async () => {
    const t = await operators();
    await t.ask({ ...ASKED, code: 'first-co', name: 'First' });
    t.time.advance(1000);
    await t.ask({ ...ASKED, code: 'second-co', name: 'Second' });
    // two sent in one instant keep the order of their codes
    t.time.advance(1000);
    await t.ask({ ...ASKED, code: 'b-co', name: 'B' });
    await t.ask({ ...ASKED, code: 'a-co', name: 'A' });

    const reply = await t.operator.list();

    expect(reply.statusCode).toBe(200);
    const listed = signUpListReplySchema.parse(reply.json()).signUps;
    expect(listed.map((one) => one.code)).toEqual(['first-co', 'second-co', 'a-co', 'b-co']);
    expect(listed[0]).toMatchObject({ name: 'First', contactName: ASKED.contactName });
    expect(reply.body).not.toContain('scrypt');
    expect(reply.body).not.toContain(ASKED.password);
  });
});

describe('3: an approval makes the company with the root’s chosen password, and the request is gone', () => {
  it('makes the index line, the settings and the root; the root signs in by the chosen password; no request is left', async () => {
    const t = await operators();
    await t.ask();
    const hash = storedSignUpSchema.parse(
      (await t.client.getRecord(recordKeys.signUp('phu-quy')))?.data,
    ).passwordHash;

    const approved = await t.operator.approve('phu-quy');

    expect(approved.statusCode).toBe(200);
    expect(signUpApprovedReplySchema.parse(approved.json())).toEqual({
      link: clientLinkPath('phu-quy'),
    });
    expect(approved.body).not.toContain(ASKED.password);
    expect(approved.body).not.toContain('scrypt');
    const line = storedClientSchema.parse(
      (await t.client.getRecord(recordKeys.client('phu-quy')))?.data,
    );
    expect(line.name).toBe(ASKED.name);
    const keys = recordKeys.tenant(line.id);
    expect(tenantConfigSchema.parse((await t.client.getRecord(keys.config))?.data).name).toBe(
      ASKED.name,
    );
    const root = (await t.client.getRecord(keys.user('root')))?.data as { passwordHash: string };
    expect(root.passwordHash).toBe(hash);
    const company = scoped(t.app, 'phu-quy');
    expect(
      (await signIn(company, { name: 'root', password: ASKED.password })).response.statusCode,
    ).toBe(200);
    expect(await t.client.getRecord(recordKeys.signUp('phu-quy'))).toBeNull();
  });
});

describe('4: a refusal removes the request and frees the address, and nothing of a company was written', () => {
  it('answers 204, leaves no request and no company, and the address may ask again', async () => {
    const t = await operators();
    await t.ask();
    t.companyWrites.length = 0;

    const refused = await t.operator.refuse('phu-quy');

    expect(refused.statusCode).toBe(204);
    expect(await t.client.getRecord(recordKeys.signUp('phu-quy'))).toBeNull();
    expect(await t.client.getRecord(recordKeys.client('phu-quy'))).toBeNull();
    expect(t.companyWrites).toEqual([]);
    expect((await t.ask()).statusCode).toBe(201);
    expect(
      (
        await t.app.inject({
          method: 'GET',
          url: '/api/config',
          headers: { 'x-client-code': 'nobody-here' },
        })
      ).json(),
    ).toEqual({ error: 'Unknown client' });
  });

  it('answers 404 to a code no request waits on, for a refusal and an approval alike, writing nothing', async () => {
    const t = await operators();

    expect((await t.operator.refuse('nobody')).statusCode).toBe(404);
    expect((await t.operator.approve('nobody')).statusCode).toBe(404);
    expect(t.companyWrites).toEqual([]);
  });
});

describe('10: only a signed-in operator lists, approves or refuses', () => {
  it('answers 401 with no session, and to a company’s root, and leaves the request as it was', async () => {
    const t = await operators();
    await t.ask();
    const before = await t.client.getRecord(recordKeys.signUp('phu-quy'));
    await seedTenant(t.client, 'acme');
    const root = (await signIn(scoped(t.app, 'acme'))).body.authId;

    for (const who of [t.as(''), t.as(root), t.as('nobody.nothing')]) {
      expect((await who.list()).statusCode).toBe(401);
      expect((await who.approve('phu-quy')).statusCode).toBe(401);
      expect((await who.refuse('phu-quy')).statusCode).toBe(401);
    }

    expect(await t.client.getRecord(recordKeys.signUp('phu-quy'))).toEqual(before);
    expect(await t.client.getRecord(recordKeys.client('phu-quy'))).toBeNull();
  });
});

describe('11: an approval of a code made meanwhile is a 409, and the request stays', () => {
  it('answers 409 and keeps the request for a refusal', async () => {
    const t = await operators();
    await t.ask();
    await t.client.putRecord(
      recordKeys.client('phu-quy'),
      { id: crypto.randomUUID(), name: 'Made first' },
      null,
    );
    const before = await t.client.getRecord(recordKeys.signUp('phu-quy'));

    const approved = await t.operator.approve('phu-quy');

    expect(approved.statusCode).toBe(409);
    expect(await t.client.getRecord(recordKeys.signUp('phu-quy'))).toEqual(before);
    expect((await t.operator.refuse('phu-quy')).statusCode).toBe(204);
  });
});

describe('13: the approval is written in the company’s activity as "client made"', () => {
  it('writes one client.create entry, the new company as target, naming no password', async () => {
    const t = await operators();
    await t.ask();
    const before = t.activity.entries.length;

    await t.operator.approve('phu-quy');

    const written = t.activity.entries.slice(before);
    const line = storedClientSchema.parse(
      (await t.client.getRecord(recordKeys.client('phu-quy')))?.data,
    );
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      action: 'client.create',
      targetId: line.id,
      clientId: line.id,
      memo: { outcome: 'saved' },
    });
    expect(JSON.stringify(written[0])).not.toContain(ASKED.password);
    expect(JSON.stringify(written[0])).not.toContain('scrypt');
  });
});
