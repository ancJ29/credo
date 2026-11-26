import { randomUUID } from 'node:crypto';
import {
  type CStorageClient,
  CLIENT_HEADER,
  recordKeys,
  SIGN_UP_WAITING,
  SIGN_UPS_WAITING_MAX,
  signUpReplySchema,
  signUpRoutes,
  storedSignUpSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { bffOn, seedTenant } from '../tests/tenant';
import { createClient } from './records/clients';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const OK = {
  code: 'phu-quy',
  name: 'Gạch Men Phú Quý',
  contactName: 'Nguyễn Văn An',
  contactPhone: '+84 901 234 567',
  password: 'Correct-horse-9!',
};

/** A BFF whose store counts the writes made to it, for the calls that must write nothing. */
async function counted() {
  const puts: string[] = [];
  const t = await bffOn(cs, {
    wrap: (client): CStorageClient => ({
      ...client,
      putRecord: async (key, data, tag) => {
        puts.push(key);
        return await client.putRecord(key, data, tag);
      },
      removeRecord: async (key, tag) => {
        puts.push(`remove ${key}`);
        return await client.removeRecord(key, tag);
      },
    }),
  });
  return { ...t, puts };
}
type T = Awaited<ReturnType<typeof counted>>;

/** The public send: no session and no company header, as anyone's call. */
const signUp = (t: T, payload: unknown = OK) =>
  t.app.inject({ method: 'POST', url: signUpRoutes.send, payload: payload as object });

const waitingRecord = async (t: T, code = OK.code) => {
  const found = await t.client.getRecord(recordKeys.signUp(code));
  return found ? storedSignUpSchema.parse(found.data) : null;
};

describe('1: a sign-up writes one waiting request and nothing of a company', () => {
  it('answers 201 with the address asked for, and keeps one record: no index line, settings or root', async () => {
    const t = await counted();
    t.time.advance(5);

    const reply = await signUp(t, { ...OK, name: '  Gạch Men Phú Quý ', contactPhone: ' 0901 ' });

    expect(reply.statusCode).toBe(201);
    expect(signUpReplySchema.parse(reply.json())).toEqual({ code: 'phu-quy' });
    expect(t.puts).toEqual([recordKeys.signUp('phu-quy')]);
    expect(await waitingRecord(t)).toMatchObject({
      name: 'Gạch Men Phú Quý',
      contactName: 'Nguyễn Văn An',
      contactPhone: '0901',
      sentAt: t.time.now(),
    });
    expect(await t.client.getRecord(recordKeys.client('phu-quy'))).toBeNull();
  });
});

describe('2: a waiting company’s address answers every company call 404 marked waiting', () => {
  it('marks the 404 of any company call at that address, which signs no one in, and leaves an unknown address unmarked', async () => {
    const t = await counted();
    await signUp(t);
    const at = (code: string) => ({ [CLIENT_HEADER]: code, 'x-device-id': 'device-aaaa-0001' });

    const config = await t.app.inject({
      method: 'GET',
      url: '/api/config',
      headers: at('phu-quy'),
    });
    const signedIn = await t.app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: at('phu-quy'),
      payload: { name: 'root', password: OK.password },
    });
    const unknown = await t.app.inject({
      method: 'GET',
      url: '/api/config',
      headers: at('nobody'),
    });

    expect([config.statusCode, signedIn.statusCode, unknown.statusCode]).toEqual([404, 404, 404]);
    expect(config.json()).toEqual({ error: 'Unknown client', details: SIGN_UP_WAITING });
    expect(signedIn.json()).toEqual({ error: 'Unknown client', details: SIGN_UP_WAITING });
    expect(unknown.json()).toEqual({ error: 'Unknown client' });
  });
});

describe('5: an address kept, taken, being deleted or already waiting is a 409 that writes nothing', () => {
  it('refuses each, and the first waiting request stands', async () => {
    const t = await counted();
    await seedTenant(t.client, 'taken-co');
    await t.client.putRecord(
      recordKeys.clientDeletion('going-co'),
      { id: randomUUID(), name: 'Going', by: randomUUID(), startedAt: 1 },
      null,
    );
    expect((await signUp(t)).statusCode).toBe(201);
    const first = await waitingRecord(t);
    t.puts.length = 0;

    for (const code of ['www', 'operator', 'taken-co', 'going-co', 'phu-quy']) {
      const reply = await signUp(t, { ...OK, code, name: 'Someone Else' });
      expect(reply.statusCode, code).toBe(409);
    }

    expect(t.puts).toEqual([]);
    expect(await waitingRecord(t)).toEqual(first);
    for (const code of ['www', 'operator', 'taken-co', 'going-co']) {
      expect(await waitingRecord(t, code), code).toBeNull();
    }
  });
});

describe('6: two sign-ups of one code at once leave one request', () => {
  it('answers 201 to one and 409 to the other, and keeps the winner’s name', async () => {
    const t = await counted();

    const both = await Promise.all([
      signUp(t, { ...OK, name: 'First' }),
      signUp(t, { ...OK, name: 'Second' }),
    ]);

    expect(both.map((reply) => reply.statusCode).sort()).toEqual([201, 409]);
    const kept = await waitingRecord(t);
    const winner = both[0]?.statusCode === 201 ? 'First' : 'Second';
    expect(kept?.name).toBe(winner);
  });
});

describe('6: a rival that writes the code between the look-up and the write wins', () => {
  it('answers 409 to the loser, and the rival’s request stands', async () => {
    const rival = {
      name: 'Rival',
      contactName: 'R',
      contactPhone: '1',
      passwordHash: 'h',
      sentAt: 9,
    };
    let rivalled = false;
    const t = await bffOn(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        putRecord: async (key, data, tag) => {
          if (!rivalled && key === recordKeys.signUp(OK.code)) {
            rivalled = true;
            await client.putRecord(key, rival, null);
          }
          return await client.putRecord(key, data, tag);
        },
      }),
    });

    const reply = await t.app.inject({ method: 'POST', url: signUpRoutes.send, payload: OK });

    expect(reply.statusCode).toBe(409);
    const kept = await t.client.getRecord(recordKeys.signUp(OK.code));
    expect(storedSignUpSchema.parse(kept?.data).name).toBe('Rival');
  });
});

describe('7: with 20 requests waiting a sign-up is a 503 that writes nothing', () => {
  it('takes the twentieth and refuses the twenty-first, until one is gone', async () => {
    const t = await counted();
    const stored = { name: 'x', contactName: 'y', contactPhone: '0', passwordHash: 'h', sentAt: 1 };
    for (let index = 1; index < SIGN_UPS_WAITING_MAX; index += 1) {
      await t.client.putRecord(
        recordKeys.signUp(`co-${String(index).padStart(2, '0')}`),
        stored,
        null,
      );
    }
    expect((await signUp(t)).statusCode).toBe(201);
    t.puts.length = 0;

    const full = await signUp(t, { ...OK, code: 'one-more' });

    expect(full.statusCode).toBe(503);
    expect(t.puts).toEqual([]);
    expect(await waitingRecord(t, 'one-more')).toBeNull();
    const first = await t.client.getRecord(recordKeys.signUp('co-01'));
    await t.client.removeRecord(recordKeys.signUp('co-01'), first?.tag ?? '');
    expect((await signUp(t, { ...OK, code: 'one-more' })).statusCode).toBe(201);
  });
});

describe('8: a field past its bound, or a refused password, is a 400 that writes nothing', () => {
  const bad: [string, object][] = [
    ['a code no company may have', { code: 'Phu Quy' }],
    ['a code too short', { code: 'a' }],
    ['a name of spaces', { name: '   ' }],
    ['a name past 200', { name: 'x'.repeat(201) }],
    ['a contact name past 100', { contactName: 'x'.repeat(101) }],
    ['no contact name', { contactName: '' }],
    ['a phone past 20', { contactPhone: '0'.repeat(21) }],
    ['a phone with a letter', { contactPhone: '090a' }],
    ['a password the rule refuses', { password: 'weak' }],
    ['a password that is no string', { password: 12345678 }],
    ['one field more', { box: 'home' }],
  ];

  it.each(bad)('answers 400 to %s', async (_what, change) => {
    const t = await counted();

    const reply = await signUp(t, { ...OK, ...change });

    expect(reply.statusCode).toBe(400);
    expect(t.puts).toEqual([]);
  });

  it('answers 400 to no body and an array, and 415 to a body that is not JSON', async () => {
    const t = await counted();

    const none = await t.app.inject({ method: 'POST', url: signUpRoutes.send });
    expect(none.statusCode).toBe(400);
    // a body that is no JSON the server reads at all is the server's own 415
    expect((await signUp(t, 'text')).statusCode).toBe(415);
    const array = await t.app.inject({ method: 'POST', url: signUpRoutes.send, payload: [OK] });
    expect(array.statusCode).toBe(400);
    expect(t.puts).toEqual([]);
  });
});

describe('9: the request keeps the password as its hash alone', () => {
  it('stores a hash that is not the password, and no answer carries either', async () => {
    const t = await counted();

    const reply = await signUp(t);
    const found = await t.client.getRecord(recordKeys.signUp('phu-quy'));

    const kept = storedSignUpSchema.parse(found?.data);
    expect(kept.passwordHash).toMatch(/^scrypt/);
    expect(JSON.stringify(found?.data)).not.toContain(OK.password);
    expect(reply.body).not.toContain(OK.password);
    expect(reply.body).not.toContain('scrypt');
  });
});

describe('12: an operator’s own add refuses a code that is waiting', () => {
  it('answers taken and writes nothing of a company, the request standing', async () => {
    const t = await counted();
    await signUp(t);
    const before = await t.client.getRecord(recordKeys.signUp('phu-quy'));

    expect(await createClient(t.client, { code: 'phu-quy', name: 'Other', madeAt: 1 })).toBe(
      'taken',
    );

    expect(await t.client.getRecord(recordKeys.client('phu-quy'))).toBeNull();
    expect(await t.client.getRecord(recordKeys.signUp('phu-quy'))).toEqual(before);
  });
});
