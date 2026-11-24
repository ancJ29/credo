import { randomUUID } from 'node:crypto';
import {
  type CStorageClient,
  optionsReplySchema,
  ROUTES,
  signInRoutes,
  storedOwnPasskeysSchema,
  type StoredPasskey,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { z } from 'zod';
import { SoftwareAuthenticator } from '../tests/authenticator';
import { recordingActivity } from '../tests/audit';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { staffTenant } from '../tests/staff';
import { DEVICE, ORIGIN, withAuth } from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Tenant = Awaited<ReturnType<typeof staffTenant>>;

const MINUTE = 60 * 1000;
/** A ridge-like address: the operators open `operator.<domain>`, a company `<code>.<domain>`. */
const RIDGE_OPERATORS = 'https://operator.example.test';
const RIDGE_COMPANY = 'https://acme-co.example.test';

const send = (t: Tenant, url: string, authId: string, payload?: unknown) =>
  t.app.inject({
    method: 'POST',
    url,
    headers: { 'x-device-id': DEVICE, ...(authId ? withAuth(authId) : {}) },
    payload: payload as object,
  });

/** What an options answer says of the relying party, the person and the passkeys not to be made again. */
const optionsFacts = z.looseObject({
  rp: z.looseObject({ id: z.string() }),
  user: z.looseObject({ id: z.string(), name: z.string() }),
  excludeCredentials: z.array(z.looseObject({ id: z.string() })).default([]),
});

async function optionsFor(t: Tenant, authId: string) {
  const reply = await send(t, signInRoutes.ownPasskeyOptions, authId);
  expect(reply.statusCode).toBe(200);
  const { options, token } = optionsReplySchema.parse(reply.json());
  return { options, token, facts: optionsFacts.parse(options) };
}

/** The add as a browser does it: the options, then the passkey `authenticator` makes for them. */
async function addWith(
  t: Tenant,
  authId: string,
  authenticator = new SoftwareAuthenticator(ORIGIN),
  claim: Parameters<SoftwareAuthenticator['register']>[1] = {},
) {
  const asked = await optionsFor(t, authId);
  const body = {
    token: asked.token,
    response: authenticator.register(asked.options as never, claim),
  };
  return { added: await send(t, signInRoutes.ownPasskeyAdd, authId, body), asked, body };
}

const heldBy = async (t: Tenant, handle: string) => {
  const found = await t.client.getRecord(t.keys.passkeys(handle));
  return found ? storedOwnPasskeysSchema.parse(found.data) : null;
};

const decoded = (base64url: string) => Buffer.from(base64url, 'base64url').toString();

describe('A company’s person adds a passkey, checked against the company’s own address', () => {
  it('adds one for a person signed in within ten minutes, kept under their own id, and a second beside it', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1', {}, { name: 'Lan Anh' });
    const first = new SoftwareAuthenticator(ORIGIN);

    const { added, asked } = await addWith(t, person.authId, first);

    expect(added.statusCode).toBe(201);
    expect(decoded(asked.facts.user.id)).toBe(person.employee.id);
    expect(asked.facts.user.name).toBe('Lan Anh');
    expect(asked.facts.rp.id).toBe('localhost');
    const held = await heldBy(t, person.employee.id);
    expect(held?.passkeys.map((passkey) => passkey.id)).toEqual([first.id]);
    expect(held?.spent).toEqual([]);
    const second = new SoftwareAuthenticator(ORIGIN);
    expect((await addWith(t, person.authId, second)).added.statusCode).toBe(201);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((passkey) => passkey.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('keeps the root’s passkey under the company’s own id', async () => {
    const t = await staffTenant(cs);
    const authenticator = new SoftwareAuthenticator(ORIGIN);

    const { added, asked } = await addWith(t, t.root, authenticator);

    expect(added.statusCode).toBe(201);
    expect(decoded(asked.facts.user.id)).toBe(t.id);
    expect((await heldBy(t, t.id))?.passkeys.map((passkey) => passkey.id)).toEqual([
      authenticator.id,
    ]);
  });

  it('answers a call with no session, or a stranger’s, 401, on both routes', async () => {
    const t = await staffTenant(cs);

    for (const url of [signInRoutes.ownPasskeyOptions, signInRoutes.ownPasskeyAdd]) {
      expect((await send(t, url, '')).statusCode).toBe(401);
      expect((await send(t, url, 'nobody.nothing')).statusCode).toBe(401);
    }
  });

  it('takes a session issued ten minutes ago and refuses one older, 403, writing no passkey', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const late = await t.staff('EMP-2');

    t.time.advance(10 * MINUTE);
    const onTime = await addWith(t, person.authId);
    t.time.advance(1);
    const tooLate = await addWith(t, late.authId);

    expect(onTime.added.statusCode).toBe(201);
    expect(tooLate.added.statusCode).toBe(403);
    expect(await heldBy(t, late.employee.id)).toBeNull();
  });

  it('answers 404 on both routes where passkeys are switched off, the root’s too, and writes nothing', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const asked = await optionsFor(t, person.authId);
    const body = {
      token: asked.token,
      response: new SoftwareAuthenticator(ORIGIN).register(asked.options as never),
    };
    expect((await send(t, signInRoutes.ownPasskeyOptions, t.root)).statusCode).toBe(200);
    await t.setup({ fields: { passkey: false } });

    for (const authId of [person.authId, t.root]) {
      expect((await send(t, signInRoutes.ownPasskeyOptions, authId)).statusCode).toBe(404);
    }
    const reply = await send(t, signInRoutes.ownPasskeyAdd, person.authId, body);

    expect(reply.statusCode).toBe(404);
    expect(await heldBy(t, person.employee.id)).toBeNull();
  });

  it('does not add a passkey already held, 400, and asks the device to leave it out of the next options', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    const { body } = await addWith(t, person.authId, authenticator);

    const again = await send(t, signInRoutes.ownPasskeyAdd, person.authId, body);
    const next = await optionsFor(t, person.authId);

    expect(again.statusCode).toBe(400);
    expect((await heldBy(t, person.employee.id))?.passkeys).toHaveLength(1);
    expect(next.facts.excludeCredentials.map((held) => held.id)).toEqual([authenticator.id]);
  });

  it('checks a ceremony against the company’s own address, and refuses one made at the operators’', async () => {
    const t = await staffTenant(cs, { origin: RIDGE_OPERATORS });
    const person = await t.staff('EMP-1');
    const operators = new SoftwareAuthenticator(RIDGE_OPERATORS);
    const company = new SoftwareAuthenticator(RIDGE_COMPANY);

    const asOperators = await addWith(t, person.authId, operators);
    const wrongOrigin = await addWith(t, person.authId, company, { origin: RIDGE_OPERATORS });
    const own = await addWith(t, person.authId, company);

    expect(own.asked.facts.rp.id).toBe('acme-co.example.test');
    expect(asOperators.added.statusCode).toBe(400);
    expect(wrongOrigin.added.statusCode).toBe(400);
    expect(own.added.statusCode).toBe(201);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((passkey) => passkey.id)).toEqual([
      company.id,
    ]);
  });

  it('writes the add in the company’s activity as the person’s, naming no key, and a refused one as refused', async () => {
    const recorded = recordingActivity();
    const t = await staffTenant(cs, { activity: recorded.client });
    const person = await t.staff('EMP-1');
    const before = recorded.entries.length;

    await addWith(t, person.authId);
    const added = recorded.entries.slice(before);
    const refused = await addWith(t, person.authId, undefined, { origin: 'https://other.test' });

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      action: 'employee.passkey',
      actorId: `employee.${person.employee.id}`,
      clientId: t.id,
      memo: { outcome: 'saved' },
    });
    expect(JSON.stringify(added[0])).not.toContain('publicKey');
    expect(refused.added.statusCode).toBe(400);
    expect(recorded.entries.slice(before + 1)).toHaveLength(1);
    expect(recorded.entries.at(-1)).toMatchObject({ memo: { outcome: 'refused' } });
  });

  it('opens a token only for the person and the purpose it was made for', async () => {
    const t = await staffTenant(cs);
    const [lan, mai] = [await t.staff('EMP-1'), await t.staff('EMP-2')];
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    const lans = await optionsFor(t, lan.authId);
    const response = authenticator.register(lans.options as never);

    const asMai = await send(t, signInRoutes.ownPasskeyAdd, mai.authId, {
      token: lans.token,
      response,
    });
    const operators = await t.app.inject({
      method: 'POST',
      url: '/api/operator/passkey/options',
    });
    const forged = await send(t, signInRoutes.ownPasskeyAdd, lan.authId, {
      token: optionsReplySchema.parse(operators.json()).token,
      response,
    });
    const noBody = await send(t, signInRoutes.ownPasskeyAdd, lan.authId, { response });

    expect([asMai.statusCode, forged.statusCode, noBody.statusCode]).toEqual([400, 400, 400]);
    expect(await heldBy(t, lan.employee.id)).toBeNull();
    expect(await heldBy(t, mai.employee.id)).toBeNull();
  });
});

describe('The add meets a rival write to the same record, and a record that is not one', () => {
  const rivalPasskey: StoredPasskey = {
    id: 'rival-passkey',
    publicKey: 'AA',
    counter: 0,
    transports: [],
    addedAt: 0,
    lastUsedAt: null,
  };
  /** A client that, `times` writes to a person's passkeys running, lets a rival write first. */
  const rivalled = () => {
    const state = { times: 0, written: 0 };
    const wrap = (client: CStorageClient): CStorageClient => ({
      ...client,
      putRecord: async (key, data, tag) => {
        if (state.times > 0 && key.includes('.passkeys.')) {
          state.times--;
          const current = await client.getRecord(key);
          await client.putRecord(
            key,
            { passkeys: [{ ...rivalPasskey, counter: state.written++ }], spent: [] },
            current?.tag ?? null,
          );
        }
        return await client.putRecord(key, data, tag);
      },
    });
    return { state, wrap };
  };

  it('reads again and adds beside the rival’s passkey', async () => {
    const rival = rivalled();
    const t = await staffTenant(cs, { wrap: rival.wrap });
    const person = await t.staff('EMP-1');
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    rival.state.times = 1;

    const { added } = await addWith(t, person.authId, authenticator);

    expect(added.statusCode).toBe(201);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((passkey) => passkey.id)).toEqual([
      'rival-passkey',
      authenticator.id,
    ]);
  });

  it('answers 503 when the record moved on every try, and keeps the rival’s alone', async () => {
    const rival = rivalled();
    const t = await staffTenant(cs, { wrap: rival.wrap });
    const person = await t.staff('EMP-1');
    rival.state.times = 3;

    const { added } = await addWith(t, person.authId);

    expect(added.statusCode).toBe(503);
    expect((await heldBy(t, person.employee.id))?.passkeys.map((passkey) => passkey.id)).toEqual([
      'rival-passkey',
    ]);
  });

  it('answers 500 for a record that does not parse, and never overwrites it', async () => {
    const t = await staffTenant(cs);
    const person = await t.staff('EMP-1');
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    const asked = await optionsFor(t, person.authId);
    await t.client.putRecord(t.keys.passkeys(person.employee.id), { not: 'a record' }, null);

    const added = await send(t, signInRoutes.ownPasskeyAdd, person.authId, {
      token: asked.token,
      response: authenticator.register(asked.options as never),
    });
    const options = await send(t, signInRoutes.ownPasskeyOptions, person.authId);

    expect([added.statusCode, options.statusCode]).toEqual([500, 500]);
    expect((await t.client.getRecord(t.keys.passkeys(person.employee.id)))?.data).toEqual({
      not: 'a record',
    });
  });
});

describe('A person signs in by the passkey they added, nothing typed', () => {
  const asked = async (t: Tenant) => {
    const reply = await send(t, signInRoutes.passkeyOptions, '');
    expect(reply.statusCode).toBe(200);
    return optionsReplySchema.parse(reply.json());
  };
  /** The sign-in as a browser does it: options with no session, then `authenticator`'s answer. */
  async function signInWith(
    t: Tenant,
    authenticator: SoftwareAuthenticator,
    claim: Parameters<SoftwareAuthenticator['authenticate']>[1] = {},
  ) {
    const { options, token } = await asked(t);
    const body = { token, response: authenticator.authenticate(options, claim) };
    return { reply: await send(t, signInRoutes.passkeySignIn, '', body), body };
  }
  const who = async (t: Tenant, authId: string) =>
    await t.app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) });
  const sessionOf = (reply: { json: () => unknown }) =>
    z.object({ authId: z.string(), expiresAt: z.number() }).parse(reply.json());
  /** A person with a passkey added, signed in only for the add. */
  async function holding(t: Tenant, code = 'EMP-1') {
    const person = await t.staff(code, {}, { name: 'Lan Anh' });
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    expect((await addWith(t, person.authId, authenticator)).added.statusCode).toBe(201);
    return { person, authenticator };
  }

  it('signs a person in as themselves, moving the passkey’s counter and last use and spending the challenge', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    t.time.advance(MINUTE);

    const { reply } = await signInWith(t, authenticator);

    expect(reply.statusCode).toBe(200);
    const session = sessionOf(reply);
    expect(session.expiresAt).toBeGreaterThan(t.time.now());
    const view = await who(t, session.authId);
    expect(view.json()).toMatchObject({ user: { name: 'Lan Anh', root: false } });
    const held = await heldBy(t, person.employee.id);
    expect(held?.passkeys[0]).toMatchObject({ counter: 1, lastUsedAt: t.time.now() });
    expect(held?.spent).toHaveLength(1);
  });

  it('moves only the passkey that answered, and signs no one in whose sign-in record is gone', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const second = new SoftwareAuthenticator(ORIGIN);
    await addWith(t, person.authId, second);

    expect((await signInWith(t, second)).reply.statusCode).toBe(200);
    const held = await heldBy(t, person.employee.id);
    const found = await t.client.getRecord(t.keys.user('emp-1'));
    await t.client.removeRecord(t.keys.user('emp-1'), found?.tag ?? '');
    const gone = await signInWith(t, authenticator);

    expect(held?.passkeys.map((passkey) => passkey.counter)).toEqual([0, 1]);
    expect(gone.reply.statusCode).toBe(401);
  });

  it('signs the root in by their own passkey as the root', async () => {
    const t = await staffTenant(cs);
    const authenticator = new SoftwareAuthenticator(ORIGIN);
    await addWith(t, t.root, authenticator);

    const { reply } = await signInWith(t, authenticator);

    expect(reply.statusCode).toBe(200);
    expect((await who(t, sessionOf(reply).authId)).json()).toMatchObject({
      user: { root: true },
    });
  });

  it('ends the session the device kept, as a password’s sign-in does', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const { options, token } = await asked(t);

    const reply = await send(t, signInRoutes.passkeySignIn, person.authId, {
      token,
      response: authenticator.authenticate(options),
    });

    expect(reply.statusCode).toBe(200);
    expect((await who(t, person.authId)).statusCode).toBe(401);
    expect((await who(t, sessionOf(reply).authId)).statusCode).toBe(200);
  });

  it('answers 404 to the options where passkeys are off, and 401 to a passkey held, switched back on it signs in', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const before = await asked(t);
    await t.setup({ fields: { passkey: false } });

    const options = await send(t, signInRoutes.passkeyOptions, '');
    const refused = await send(t, signInRoutes.passkeySignIn, '', {
      token: before.token,
      response: authenticator.authenticate(before.options),
    });
    const spentBefore = (await heldBy(t, person.employee.id))?.spent;
    await t.setup({ fields: { passkey: true } });
    const again = await signInWith(t, authenticator);

    expect(options.statusCode).toBe(404);
    expect(refused.statusCode).toBe(401);
    expect(spentBefore).toEqual([]);
    expect(again.reply.statusCode).toBe(200);
  });

  it('refuses a person who has left, and signs them in again once back', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const read = await t.rootCall.get(`/api/employees/${person.employee.id}`);
    const off = await t.rootCall.send('POST', `/api/employees/${person.employee.id}/archive`, {
      version: read.json<{ version: string }>().version,
    });
    expect(off.statusCode).toBe(200);

    const gone = await signInWith(t, authenticator);
    const on = await t.rootCall.send('POST', `/api/employees/${person.employee.id}/restore`, {
      version: off.json<{ version: string }>().version,
    });
    const back = await signInWith(t, authenticator);

    expect(gone.reply.statusCode).toBe(401);
    expect(on.statusCode).toBe(200);
    expect(back.reply.statusCode).toBe(200);
    expect((await heldBy(t, person.employee.id))?.passkeys[0]?.counter).toBe(2);
  });

  it('refuses a person whose sign-in record no longer names them, and a handle that names no one', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const found = await t.client.getRecord(t.keys.user('emp-1'));
    await t.client.putRecord(
      t.keys.user('emp-1'),
      { ...(found?.data as object), employeeId: randomUUID() },
      found?.tag ?? null,
    );
    const stranger = new SoftwareAuthenticator(ORIGIN);
    await addWith(t, t.root, stranger);

    const named = await signInWith(t, authenticator);
    const nobody = await signInWith(t, stranger, { userHandle: randomUUID() });
    const notAHandle = await signInWith(t, stranger, { userHandle: 'not-a-uuid' });
    const none = await signInWith(t, stranger, { userHandle: null });

    expect([named, nobody, notAHandle, none].map(({ reply }) => reply.statusCode)).toEqual([
      401, 401, 401, 401,
    ]);
    expect((await heldBy(t, person.employee.id))?.passkeys[0]?.counter).toBe(0);
  });

  it('signs in no one at another company by a passkey or a token of this one', async () => {
    const mine = await staffTenant(cs, { code: 'acme-co' });
    const other = await staffTenant(cs, { code: 'other-co' });
    const { authenticator } = await holding(mine);
    const theirs = await holding(other, 'EMP-9');
    const fromMine = await asked(mine);

    const passkey = await signInWith(other, authenticator);
    const token = await send(other, signInRoutes.passkeySignIn, '', {
      token: fromMine.token,
      response: theirs.authenticator.authenticate(fromMine.options),
    });

    expect(passkey.reply.statusCode).toBe(401);
    expect(token.statusCode).toBe(401);
    expect((await signInWith(other, theirs.authenticator)).reply.statusCode).toBe(200);
  });

  it('signs in no company’s person by an operator’s passkey, nor an operator by a company’s', async () => {
    const t = await staffTenant(cs);
    const { authenticator } = await holding(t);
    const operatorOptions = optionsReplySchema.parse(
      (await t.app.inject({ method: 'POST', url: ROUTES.operatorPasskeyOptions })).json(),
    );
    const operator = new SoftwareAuthenticator(ORIGIN);
    const company = await asked(t);

    const operatorsAtCompany = await send(t, signInRoutes.passkeySignIn, '', {
      token: operatorOptions.token,
      response: operator.authenticate(operatorOptions.options, { userHandle: 'AA' }),
    });
    const companyAtOperators = await t.app.inject({
      method: 'POST',
      url: ROUTES.operatorPasskeySignIn,
      headers: { 'x-device-id': DEVICE },
      payload: {
        token: company.token,
        response: authenticator.authenticate(company.options),
      },
    });

    expect(operatorsAtCompany.statusCode).toBe(401);
    expect(companyAtOperators.statusCode).toBe(401);
  });

  it('signs in once by the same answer sent twice', async () => {
    const t = await staffTenant(cs);
    const { authenticator } = await holding(t);
    const { reply, body } = await signInWith(t, authenticator);

    const again = await send(t, signInRoutes.passkeySignIn, '', body);

    expect(reply.statusCode).toBe(200);
    expect(again.statusCode).toBe(401);
  });

  it('refuses an answer the library refuses, an unknown passkey and a token not for a sign-in, 401', async () => {
    const t = await staffTenant(cs);
    const { person, authenticator } = await holding(t);
    const cases = [
      await signInWith(t, authenticator, { tamper: true }),
      await signInWith(t, authenticator, { verified: false }),
      await signInWith(t, authenticator, { origin: RIDGE_OPERATORS }),
      await signInWith(t, new SoftwareAuthenticator(ORIGIN), {
        userHandle: authenticator.userHandle,
      }),
    ];
    const add = await optionsFor(t, person.authId);
    const wrongPurpose = await send(t, signInRoutes.passkeySignIn, '', {
      token: add.token,
      response: authenticator.authenticate(add.options),
    });
    const noDevice = await t.app.inject({
      method: 'POST',
      url: signInRoutes.passkeySignIn,
      payload: {},
    });

    expect(cases.map(({ reply }) => reply.statusCode)).toEqual([401, 401, 401, 401]);
    expect(wrongPurpose.statusCode).toBe(401);
    expect(noDevice.statusCode).toBe(400);
    expect((await heldBy(t, person.employee.id))?.passkeys[0]?.counter).toBe(0);
    expect((await signInWith(t, authenticator)).reply.statusCode).toBe(200);
  });

  it('answers 500 for a record that does not parse, and 503 when the record moved on every try', async () => {
    const racing = { times: 0 };
    const t = await staffTenant(cs, {
      wrap: (client) => ({
        ...client,
        putRecord: async (key, data, tag) => {
          if (racing.times > 0 && key.includes('.passkeys.')) {
            racing.times--;
            const current = await client.getRecord(key);
            await client.putRecord(
              key,
              { ...(current?.data as object), spent: [{ hash: `rival-${racing.times}`, at: 0 }] },
              current?.tag ?? null,
            );
          }
          return await client.putRecord(key, data, tag);
        },
      }),
    });
    const { person, authenticator } = await holding(t);
    racing.times = 3;
    const moved = await signInWith(t, authenticator);
    racing.times = 1;
    const recovered = await signInWith(t, authenticator);
    const current = await t.client.getRecord(t.keys.passkeys(person.employee.id));
    await t.client.putRecord(
      t.keys.passkeys(person.employee.id),
      { not: 'a record' },
      current?.tag ?? null,
    );
    const broken = await signInWith(t, authenticator);

    expect(moved.reply.statusCode).toBe(503);
    expect(recovered.reply.statusCode).toBe(200);
    expect(broken.reply.statusCode).toBe(500);
  });
});
