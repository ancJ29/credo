import {
  type CStorageClient,
  optionsReplySchema,
  ownPasskeyListReplySchema,
  ownPasskeyRemovedReplySchema,
  signInRoutes,
  storedOwnPasskeysSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SoftwareAuthenticator } from '../tests/authenticator';
import { recordingActivity } from '../tests/audit';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { staffTenant } from '../tests/staff';
import { DEVICE, ORIGIN, OTHER_DEVICE, signIn, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Tenant = Awaited<ReturnType<typeof staffTenant>>;

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const headers = (authId: string, agent?: string) => ({
  'x-device-id': DEVICE,
  ...(authId ? withAuth(authId) : {}),
  ...(agent ? { 'user-agent': agent } : {}),
});
const post = (t: Tenant, url: string, authId: string, payload?: unknown, agent?: string) =>
  t.app.inject({
    method: 'POST',
    url,
    headers: headers(authId, agent),
    payload: payload as object,
  });
const list = (t: Tenant, authId: string) =>
  t.app.inject({ method: 'GET', url: signInRoutes.ownPasskeys, headers: headers(authId) });
const remove = (t: Tenant, authId: string, id: string) =>
  t.app.inject({ method: 'DELETE', url: signInRoutes.ownPasskey(id), headers: headers(authId) });
const who = (t: Tenant, authId: string) =>
  t.app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) });

/** The add as a browser does it, naming its own `agent`; answers the status. */
async function add(
  t: Tenant,
  authId: string,
  authenticator = new SoftwareAuthenticator(ORIGIN),
  agent?: string,
) {
  const asked = optionsReplySchema.parse(
    (await post(t, signInRoutes.ownPasskeyOptions, authId)).json(),
  );
  const body = { token: asked.token, response: authenticator.register(asked.options as never) };
  return (await post(t, signInRoutes.ownPasskeyAdd, authId, body, agent)).statusCode;
}

/** The sign-in by a passkey, nothing typed; answers the status. */
async function signInBy(t: Tenant, authenticator: SoftwareAuthenticator) {
  const asked = optionsReplySchema.parse((await post(t, signInRoutes.passkeyOptions, '')).json());
  const body = { token: asked.token, response: authenticator.authenticate(asked.options) };
  return (await post(t, signInRoutes.passkeySignIn, '', body)).statusCode;
}

const heldBy = async (t: Tenant, handle: string) => {
  const found = await t.client.getRecord(t.keys.passkeys(handle));
  return found ? storedOwnPasskeysSchema.parse(found.data) : null;
};

/** A person holding two passkeys, an iPhone's and a PC's, with the second session of another device. */
async function holding(t: Tenant, code = 'EMP-1') {
  const person = await t.staff(code, {}, { name: 'Lan Anh' });
  const phone = new SoftwareAuthenticator(ORIGIN);
  const pc = new SoftwareAuthenticator(ORIGIN);
  expect(await add(t, person.authId, phone, IPHONE)).toBe(201);
  expect(await add(t, person.authId, pc, WINDOWS)).toBe(201);
  return { person, phone, pc };
}

describe('1: a person’s list shows each passkey’s device, day added and day last used, and nothing of its key', () => {
  it('lists the two with their devices, and the use of one moves its day', async () => {
    const t = await staffTenant(cs);
    const { person, phone, pc } = await holding(t);
    t.time.advance(60_000);
    expect(await signInBy(t, phone)).toBe(200);

    const reply = await list(t, person.authId);

    expect(reply.statusCode).toBe(200);
    const listed = ownPasskeyListReplySchema.parse(reply.json()).passkeys;
    expect(listed).toEqual([
      {
        id: phone.id,
        device: 'iPhone · Safari',
        addedAt: expect.any(Number) as number,
        lastUsedAt: t.time.now(),
      },
      {
        id: pc.id,
        device: 'Windows · Chrome',
        addedAt: expect.any(Number) as number,
        lastUsedAt: null,
      },
    ]);
    expect(reply.body).not.toContain('publicKey');
    expect(reply.body).not.toContain('counter');
  });

  it('lists none for a person with none, the root’s own for the root, and 401 with no session', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    await add(t, t.root, authenticator);

    expect(ownPasskeyListReplySchema.parse((await list(t, person.authId)).json())).toEqual({
      passkeys: [],
    });
    expect(
      ownPasskeyListReplySchema.parse((await list(t, t.root)).json()).passkeys.map((one) => one.id),
    ).toEqual([authenticator.id]);
    expect((await remove(t, person.authId, 'nothing-here')).statusCode).toBe(404);
    expect((await list(t, '')).statusCode).toBe(401);
    expect((await remove(t, '', 'x')).statusCode).toBe(401);
  });
});

describe('2: a passkey added is named by the browser that added it; one stored before reads none', () => {
  it('names the device from the User-Agent, and none where the header names none', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    expect(await add(t, person.authId, new SoftwareAuthenticator(ORIGIN), 'curl/8.4.0')).toBe(201);
    expect(await add(t, person.authId, new SoftwareAuthenticator(ORIGIN), WINDOWS)).toBe(201);

    const held = await heldBy(t, person.employee.id);

    expect(held?.passkeys.map((one) => one.device)).toEqual([null, 'Windows · Chrome']);
  });

  it('reads a passkey stored with no device as "none named"', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    await t.client.putRecord(
      t.keys.passkeys(person.employee.id),
      {
        passkeys: [
          { id: 'old', publicKey: 'AA', counter: 0, transports: [], addedAt: 5, lastUsedAt: null },
        ],
        spent: [],
      },
      null,
    );

    const listed = ownPasskeyListReplySchema.parse((await list(t, person.authId)).json());

    expect(listed.passkeys).toEqual([{ id: 'old', device: null, addedAt: 5, lastUsedAt: null }]);
  });
});

describe('3 and 4: a removal ends the passkey’s sign-in and the person’s other sessions', () => {
  it('refuses the removed passkey with the one 401, and the other still signs in', async () => {
    const t = await staffTenant(cs);
    const { person, phone, pc } = await holding(t);

    const removed = await remove(t, person.authId, pc.id);

    expect(removed.statusCode).toBe(200);
    expect(await signInBy(t, pc)).toBe(401);
    expect(await signInBy(t, phone)).toBe(200);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((one) => one.id)).toEqual([
      phone.id,
    ]);
  });

  it('answers the passkeys left and a new session for the removing device, and ends every other', async () => {
    const t = await staffTenant(cs);
    const { person, phone, pc } = await holding(t);
    const elsewhere = (
      await signIn(t.app, { name: 'EMP-1', password: person.password as string }, OTHER_DEVICE)
    ).body.authId;
    expect((await who(t, elsewhere)).statusCode).toBe(200);

    const removed = await remove(t, person.authId, phone.id);

    const answer = ownPasskeyRemovedReplySchema.parse(removed.json());
    expect(answer.passkeys.map((one) => one.id)).toEqual([pc.id]);
    expect(answer.session.user).toMatchObject({ name: 'Lan Anh', root: false });
    expect((await who(t, answer.session.authId)).statusCode).toBe(200);
    expect((await who(t, person.authId)).statusCode).toBe(401);
    expect((await who(t, elsewhere)).statusCode).toBe(401);
  });

  it('does the same for the root’s own passkey, the root signed in again by the new session', async () => {
    const t = await staffTenant(cs);
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    await add(t, t.root, authenticator);

    const removed = await remove(t, t.root, authenticator.id);

    const answer = ownPasskeyRemovedReplySchema.parse(removed.json());
    expect(answer.passkeys).toEqual([]);
    expect((await who(t, answer.session.authId)).json()).toMatchObject({ user: { root: true } });
    expect((await who(t, t.root)).statusCode).toBe(401);
  });
});

describe('5: the last passkey is removed like any other, and the password still signs in', () => {
  it('leaves none held, the passkey refused and the password signing in', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const only = new SoftwareAuthenticator(ORIGIN);
    await add(t, person.authId, only);

    const removed = await remove(t, person.authId, only.id);

    expect(removed.statusCode).toBe(200);
    expect((await heldBy(t, person.employee.id))?.passkeys).toEqual([]);
    expect(await signInBy(t, only)).toBe(401);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: person.password as string })).response
        .statusCode,
    ).toBe(200);
  });
});

describe('6: a person removes only their own', () => {
  it('answers 404 to another’s passkey id and to one held by none, and the passkey still signs in', async () => {
    const t = await staffTenant(cs);
    const { phone } = await holding(t);
    const mai = await t.staff('EMP-2');
    const hers = new SoftwareAuthenticator(ORIGIN);
    await add(t, mai.authId, hers);

    const theirs = await remove(t, mai.authId, phone.id);
    const nobody = await remove(t, mai.authId, 'nothing-here');

    expect([theirs.statusCode, nobody.statusCode]).toEqual([404, 404]);
    expect(await signInBy(t, phone)).toBe(200);
    expect((await heldBy(t, mai.employee.id))?.passkeys.map((one) => one.id)).toEqual([hers.id]);
    expect((await who(t, mai.authId)).statusCode).toBe(200);
  });
});

describe('10: where passkeys are off the list and the removal answer 404', () => {
  it('answers 404 to both, for a person and for the root, and removes nothing', async () => {
    const t = await staffTenant(cs);
    const { person, phone } = await holding(t);
    await t.setup({ fields: { passkey: false } });

    for (const authId of [person.authId, t.root]) {
      expect((await list(t, authId)).statusCode).toBe(404);
      expect((await remove(t, authId, phone.id)).statusCode).toBe(404);
    }

    expect((await heldBy(t, person.employee.id))?.passkeys).toHaveLength(2);
    expect((await who(t, person.authId)).statusCode).toBe(200);
  });
});

describe('11: the activity writes "passkey removed" for one’s own', () => {
  it('writes one entry, the person’s, naming no key, and a refused removal as refused', async () => {
    const recorded = recordingActivity();
    const t = await staffTenant(cs, { activity: recorded.client });
    const { person, pc } = await holding(t);
    const before = recorded.entries.length;

    await remove(t, person.authId, 'nothing-here');
    const refused = recorded.entries.slice(before);
    await remove(t, person.authId, pc.id);
    const saved = recorded.entries.slice(before + 1);

    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({
      action: 'employee.passkeyRemove',
      memo: { outcome: 'refused' },
    });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      action: 'employee.passkeyRemove',
      actorId: `employee.${person.employee.id}`,
      clientId: t.id,
      memo: { outcome: 'saved' },
    });
    expect(JSON.stringify(saved[0])).not.toContain('publicKey');
  });
});

describe('The removal meets a rival write to the same record, and a record that is not one', () => {
  /** A client that, `times` writes to a person's passkeys running, lets a rival add a passkey first. */
  const rivalled = () => {
    const state = { times: 0, written: 0 };
    const wrap = (client: CStorageClient): CStorageClient => ({
      ...client,
      putRecord: async (key, data, tag) => {
        if (state.times > 0 && key.includes('.passkeys.')) {
          state.times--;
          const current = await client.getRecord(key);
          const held = storedOwnPasskeysSchema.parse(current?.data);
          await client.putRecord(
            key,
            {
              ...held,
              passkeys: [
                ...held.passkeys,
                {
                  id: `rival-${state.written++}`,
                  publicKey: 'AA',
                  counter: 0,
                  transports: [],
                  addedAt: 0,
                  lastUsedAt: null,
                },
              ],
            },
            current?.tag ?? null,
          );
        }
        return await client.putRecord(key, data, tag);
      },
    });
    return { state, wrap };
  };

  it('reads again and removes the passkey beside the rival’s', async () => {
    const rival = rivalled();
    const t = await staffTenant(cs, { wrap: rival.wrap });
    const { person, phone, pc } = await holding(t);
    rival.state.times = 1;

    const removed = await remove(t, person.authId, phone.id);

    expect(removed.statusCode).toBe(200);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((one) => one.id)).toEqual([
      pc.id,
      'rival-0',
    ]);
  });

  it('answers 503 when the record moved on every try, and the passkey is still held, still signing in', async () => {
    const rival = rivalled();
    const t = await staffTenant(cs, { wrap: rival.wrap });
    const { person, phone } = await holding(t);
    rival.state.times = 3;

    const removed = await remove(t, person.authId, phone.id);

    expect(removed.statusCode).toBe(503);
    expect(await signInBy(t, phone)).toBe(200);
    expect((await who(t, person.authId)).statusCode).toBe(200);
  });

  it('answers 500 for a record that does not parse, and never overwrites it', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    await t.client.putRecord(t.keys.passkeys(person.employee.id), { not: 'a record' }, null);

    const listed = await list(t, person.authId);
    const removed = await remove(t, person.authId, 'x');

    expect([listed.statusCode, removed.statusCode]).toEqual([500, 500]);
    expect((await t.client.getRecord(t.keys.passkeys(person.employee.id)))?.data).toEqual({
      not: 'a record',
    });
  });
});
