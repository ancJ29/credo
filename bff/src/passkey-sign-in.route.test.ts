import {
  type CStorageClient,
  optionsReplySchema,
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
