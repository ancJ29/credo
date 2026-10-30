import { createHash, randomUUID } from 'node:crypto';
import {
  type CStorageClient,
  parseQr,
  QR_MINUTES,
  storedSignInEmailSchema,
  storedSignInQrSchema,
  storedUserSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { personCalls, staffTenant } from '../tests/staff';
import { DEVICE, OTHER_DEVICE, seedEmployee, signIn, withAuth } from '../tests/tenant';
import { ADD_MAX_MS } from './staff';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const { added, doc, me } = personCalls;
type Tenant = Awaited<ReturnType<typeof staffTenant>>;

const MINUTE = 60_000;
const NEW_PASSWORD = 'New-password-2@';

/** A person added by the root, with the version and the password the add answered. */
async function person(t: Tenant, over: object = {}) {
  const reply = await added(t.rootCall, over);
  return {
    id: reply.employee.employee.id,
    code: reply.employee.employee.code,
    version: reply.employee.version,
    password: reply.password as string,
  };
}

const setEmail = (t: Tenant, id: string, version: string, email: string | null) =>
  t.rootCall.send('PUT', `/api/employees/${id}/email`, { version, email });

/** An email set on a person who is there, 200; answers the version it is at now. */
async function withEmail(t: Tenant, who: { id: string; version: string }, email: string) {
  const reply = await setEmail(t, who.id, who.version, email);
  expect(reply.statusCode).toBe(200);
  return reply.json<{ version: string }>().version;
}

const issue = (t: Tenant, id: string, call = t.rootCall) =>
  call.send('POST', `/api/employees/${id}/qr`);

async function issued(t: Tenant, id: string) {
  const reply = await issue(t, id);
  expect(reply.statusCode).toBe(200);
  const body = reply.json<{ link: string; expiresAt: number }>();
  const parsed = parseQr(new URL(body.link, 'http://x').searchParams.get('qr'));
  return { ...body, secret: parsed!.secret };
}

const openQr = (
  t: Tenant,
  id: string,
  secret: string,
  headers: Record<string, string> = { 'x-device-id': DEVICE },
) =>
  t.app.inject({ method: 'POST', url: '/api/auth/sign-in-qr', headers, payload: { id, secret } });

const ownPassword = (
  t: Tenant,
  authId: string,
  payload: object,
  headers: Record<string, string> = { 'x-device-id': DEVICE },
) =>
  t.app.inject({
    method: 'PUT',
    url: '/api/auth/password',
    headers: { ...withAuth(authId), ...headers },
    payload,
  });

const status = async (t: Tenant, name: string, password: string, device = DEVICE) =>
  (await signIn(t.app, { name, password }, device)).response.statusCode;

/** A client whose writes to the keys `hook` names first run `hook`, once it is armed. */
function interfering(hook: {
  current: ((key: string, client: CStorageClient) => Promise<void>) | null;
}) {
  return (client: CStorageClient): CStorageClient => ({
    ...client,
    async putRecord(key, data, ifTag) {
      if (hook.current) await hook.current(key, client);
      return await client.putRecord(key, data, ifTag);
    },
  });
}

describe('C: An email names the person by id in its own record', () => {
  it('C: An email set by the root names the person by id in its own record, and the person signs in with it or with their code', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0004', name: 'Lan' });

    const reply = await setEmail(t, lan.id, lan.version, ' Lan@Minh-Phat.Example ');

    expect(reply.statusCode).toBe(200);
    expect((await doc(t.rootCall, lan.id)).employee.email).toBe('lan@minh-phat.example');
    const record = await t.client.getRecord(t.keys.signInEmail('lan@minh-phat.example'));
    expect(storedSignInEmailSchema.parse(record?.data)).toEqual({
      employeeId: lan.id,
      at: t.time.now(),
    });
    const byEmail = await signIn(t.app, { name: 'LAN@minh-phat.example ', password: lan.password });
    expect(byEmail.response.statusCode).toBe(200);
    expect((await me(t, byEmail.body.authId)).json<{ user: { name: string } }>().user.name).toBe(
      'Lan',
    );
    expect(await status(t, 'emp-0004', lan.password)).toBe(200);
  });

  it('C: A second person’s same email, in any case, is a 409 with no current, and the first keeps it', async () => {
    const t = await staffTenant(cs);
    const first = await person(t, { code: 'EMP-0001' });
    const second = await person(t, { code: 'EMP-0002' });
    await withEmail(t, first, 'same@x.example');
    // Past the longest an add runs: a held email is refused for being held, not for being young.
    t.time.advance(ADD_MAX_MS + 1);

    const refused = await setEmail(t, second.id, second.version, 'SAME@x.example');

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).not.toHaveProperty('current');
    expect((await doc(t.rootCall, second.id)).employee.email).toBeUndefined();
    const held = await t.client.getRecord(t.keys.signInEmail('same@x.example'));
    expect(storedSignInEmailSchema.parse(held?.data).employeeId).toBe(first.id);
    expect(await status(t, 'same@x.example', first.password)).toBe(200);
  });

  it('C: Changing the email removes the old record, so the old one signs no one in and is free again', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const other = await person(t, { code: 'EMP-0002' });
    const version = await withEmail(t, lan, 'old@x.example');

    const changed = await setEmail(t, lan.id, version, 'new@x.example');

    expect(changed.statusCode).toBe(200);
    expect(await t.client.getRecord(t.keys.signInEmail('old@x.example'))).toBeNull();
    expect(await t.client.getRecord(t.keys.signInEmail('new@x.example'))).not.toBeNull();
    expect(await status(t, 'old@x.example', lan.password)).toBe(401);
    expect(await status(t, 'new@x.example', lan.password)).toBe(200);
    expect((await setEmail(t, other.id, other.version, 'old@x.example')).statusCode).toBe(200);
  });

  it('C: A change back to the old email, made while the first change frees it, keeps the record of the email the person holds', async () => {
    let between: (() => Promise<unknown>) | null = null;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async removeRecord(key, ifTag) {
          if (between && key === xKey) {
            const run = between;
            between = null;
            await run();
          }
          return await client.removeRecord(key, ifTag);
        },
      }),
    });
    const xKey = t.keys.signInEmail('x@x.example');
    const lan = await person(t, { code: 'EMP-0001' });
    const other = await person(t, { code: 'EMP-0002' });
    const version = await withEmail(t, lan, 'x@x.example');
    between = async () => {
      // The person already holds y; x is a claim older than a minute, so a change back takes it.
      t.time.advance(ADD_MAX_MS + 1);
      const now = (await doc(t.rootCall, lan.id)).version;
      expect((await setEmail(t, lan.id, now, 'x@x.example')).statusCode).toBe(200);
    };

    const changed = await setEmail(t, lan.id, version, 'y@x.example');

    expect(changed.statusCode).toBe(200);
    expect((await doc(t.rootCall, lan.id)).employee.email).toBe('x@x.example');
    const held = await t.client.getRecord(xKey);
    expect(held).not.toBeNull();
    expect(storedSignInEmailSchema.parse(held?.data).employeeId).toBe(lan.id);
    expect(await status(t, 'x@x.example', lan.password)).toBe(200);
    expect((await setEmail(t, other.id, other.version, 'x@x.example')).statusCode).toBe(409);
    expect(await t.client.getRecord(t.keys.signInEmail('y@x.example'))).toBeNull();
  });

  it('C: Taking the email back removes its record, and the email signs no one in', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const version = await withEmail(t, lan, 'lan@x.example');

    const reply = await setEmail(t, lan.id, version, null);

    expect(reply.statusCode).toBe(200);
    expect((await doc(t.rootCall, lan.id)).employee.email).toBeUndefined();
    expect(await t.client.getRecord(t.keys.signInEmail('lan@x.example'))).toBeNull();
    expect(await status(t, 'lan@x.example', lan.password)).toBe(401);
  });

  it('C: The same email again, or none again, writes nothing and answers the person', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });

    const none = await setEmail(t, lan.id, lan.version, null);
    expect(none.json<{ version: string }>().version).toBe(lan.version);
    const version = await withEmail(t, lan, 'lan@x.example');
    const same = await setEmail(t, lan.id, version, 'LAN@x.example');

    expect(same.statusCode).toBe(200);
    expect(same.json<{ version: string }>().version).toBe(version);
  });

  it('C: A version that moved is a 409 carrying the person, and the email claimed for it is given back', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001', name: 'Lan' });
    await t.rootCall.send('PUT', `/api/employees/${lan.id}`, {
      version: lan.version,
      name: 'Lan Anh',
      extra: {},
    });

    const stale = await setEmail(t, lan.id, lan.version, 'lan@x.example');

    expect(stale.statusCode).toBe(409);
    expect(stale.json<{ current: { employee: { name: string } } }>().current.employee.name).toBe(
      'Lan Anh',
    );
    expect(await t.client.getRecord(t.keys.signInEmail('lan@x.example'))).toBeNull();
  });

  it('C: A person moved between the read and the write gives the claimed email back and answers 409 with the person', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await staffTenant(cs, { wrap: interfering(hook) });
    const lan = await person(t, { code: 'EMP-0001', name: 'Lan' });
    hook.current = async (key, client) => {
      if (!key.includes('.employee.')) return;
      hook.current = null;
      const found = await client.getRecord(key);
      await client.putRecord(key, { ...(found!.data as object), name: 'Moved' }, found!.tag);
    };

    const raced = await setEmail(t, lan.id, lan.version, 'lan@x.example');

    expect(raced.statusCode).toBe(409);
    expect(raced.json<{ current: { employee: { name: string } } }>().current.employee.name).toBe(
      'Moved',
    );
    expect(await t.client.getRecord(t.keys.signInEmail('lan@x.example'))).toBeNull();
  });

  it('C: A person moved between the read and the write while their email is taken back keeps it, and the answer is a 409 with the person', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await staffTenant(cs, { wrap: interfering(hook) });
    const lan = await person(t, { code: 'EMP-0001', name: 'Lan' });
    const version = await withEmail(t, lan, 'lan@x.example');
    hook.current = async (key, client) => {
      if (!key.includes('.employee.')) return;
      hook.current = null;
      const found = await client.getRecord(key);
      await client.putRecord(key, { ...(found!.data as object), name: 'Moved' }, found!.tag);
    };

    const raced = await setEmail(t, lan.id, version, null);

    expect(raced.statusCode).toBe(409);
    expect((await doc(t.rootCall, lan.id)).employee.email).toBe('lan@x.example');
    expect(await t.client.getRecord(t.keys.signInEmail('lan@x.example'))).not.toBeNull();
  });

  it('C: Only the root sets an email; a person who is not there is a 404; a body that is no email is a 400', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const everything = {
      'staff.canView': true,
      'staff.canCreate': true,
      'staff.canEdit': true,
      'staff.canDelete': true,
    };
    const office = await t.staff('OFFICE', { own: everything });

    const forbidden = await office.call.send('PUT', `/api/employees/${lan.id}/email`, {
      version: lan.version,
      email: 'lan@x.example',
    });
    const nobody = await setEmail(t, randomUUID(), lan.version, 'lan@x.example');
    const bad = await setEmail(t, lan.id, lan.version, 'not an email');

    expect([forbidden.statusCode, nobody.statusCode, bad.statusCode]).toEqual([403, 404, 400]);
    expect(await t.client.getRecord(t.keys.signInEmail('lan@x.example'))).toBeNull();
  });

  it('C: A wrong password, an unknown email and an email no one holds are the same 401 as a wrong code', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    await withEmail(t, lan, 'lan@x.example');

    const answers = await Promise.all([
      signIn(t.app, { name: 'lan@x.example', password: 'Wrong-pass-9!' }),
      signIn(t.app, { name: 'nobody@x.example', password: lan.password }),
      signIn(t.app, { name: 'emp-0001', password: 'Wrong-pass-9!' }),
    ]);

    expect(answers.map(({ response }) => response.statusCode)).toEqual([401, 401, 401]);
    expect(new Set(answers.map(({ response }) => response.body)).size).toBe(1);
  });

  it('C: A code change leaves the email signing the person in, with their new code', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001', name: 'Lan' });
    const version = await withEmail(t, lan, 'lan@x.example');
    const moved = await t.rootCall.send('PUT', `/api/employees/${lan.id}/code`, {
      version,
      code: 'BOSS',
    });
    expect(moved.statusCode).toBe(200);

    const byEmail = await signIn(t.app, { name: 'lan@x.example', password: lan.password });

    expect(byEmail.response.statusCode).toBe(200);
    expect((await me(t, byEmail.body.authId)).statusCode).toBe(200);
    expect(await status(t, 'emp-0001', lan.password)).toBe(401);
  });

  it('C: A person who left cannot sign in with their email, and keeps it taken', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const other = await person(t, { code: 'EMP-0002' });
    const version = await withEmail(t, lan, 'lan@x.example');
    await t.rootCall.send('POST', `/api/employees/${lan.id}/archive`, { version });
    t.time.advance(ADD_MAX_MS + 1);

    expect(await status(t, 'lan@x.example', lan.password)).toBe(401);
    expect((await setEmail(t, other.id, other.version, 'lan@x.example')).statusCode).toBe(409);
  });

  it('C: An email record whose person does not hold the email, or is not there, signs no one in', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    await t.client.putRecord(t.keys.signInEmail('lan@x.example'), {
      employeeId: lan.id,
      at: t.time.now(),
    });
    await t.client.putRecord(t.keys.signInEmail('ghost@x.example'), {
      employeeId: randomUUID(),
      at: t.time.now(),
    });

    expect(await status(t, 'lan@x.example', lan.password)).toBe(401);
    expect(await status(t, 'ghost@x.example', lan.password)).toBe(401);
  });

  it('C: A person whose sign-in record is not there is not signed in by their email', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const version = await withEmail(t, lan, 'lan@x.example');
    expect(version).toBeTruthy();
    const record = await t.client.getRecord(t.keys.user('emp-0001'));
    await t.client.removeRecord(t.keys.user('emp-0001'), record!.tag);

    expect(await status(t, 'lan@x.example', lan.password)).toBe(401);
  });

  it('C: A claim a failed set left answers 503 while younger than a minute, and is taken over after', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    await t.client.putRecord(t.keys.signInEmail('lan@x.example'), {
      employeeId: randomUUID(),
      at: t.time.now(),
    });

    t.time.advance(ADD_MAX_MS);
    const young = await setEmail(t, lan.id, lan.version, 'lan@x.example');
    t.time.advance(1);
    const old = await setEmail(t, lan.id, lan.version, 'lan@x.example');

    expect(young.statusCode).toBe(503);
    expect(old.statusCode).toBe(200);
    expect(await status(t, 'lan@x.example', lan.password)).toBe(200);
  });

  it('C: A claim that disappears between two tries is claimed on the next', async () => {
    let first = true;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (first && key.includes('.signin-email.')) {
            first = false;
            return 'moved';
          }
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });
    const lan = await person(t, { code: 'EMP-0001' });

    expect((await setEmail(t, lan.id, lan.version, 'lan@x.example')).statusCode).toBe(200);
  });

  it('C: The email record moves on every try to take a stale claim over: 503, and the email stays free', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await staffTenant(cs, { wrap: interfering(hook) });
    const lan = await person(t, { code: 'EMP-0001' });
    const key = t.keys.signInEmail('lan@x.example');
    await t.client.putRecord(key, { employeeId: randomUUID(), at: 0 });
    let moves = 0;
    hook.current = async (written, client) => {
      if (written !== key) return;
      const found = await client.getRecord(key);
      await client.putRecord(key, { employeeId: randomUUID(), at: ++moves }, found!.tag);
    };
    t.time.advance(ADD_MAX_MS * 10);

    const stuck = await setEmail(t, lan.id, lan.version, 'lan@x.example');

    expect(stuck.statusCode).toBe(503);
    expect((await doc(t.rootCall, lan.id)).employee.email).toBeUndefined();
  });

  it('C: An old email record that is gone or another person’s is left alone when the email changes', async () => {
    const t = await staffTenant(cs);
    const gone = await seedEmployee(t.client, t.id, { code: 'GONE', email: 'gone@x.example' });
    const taken = await seedEmployee(t.client, t.id, { code: 'TAKEN', email: 'taken@x.example' });
    const other = randomUUID();
    await t.client.putRecord(t.keys.signInEmail('taken@x.example'), {
      employeeId: other,
      at: t.time.now(),
    });
    const version = async (id: string) => (await doc(t.rootCall, id)).version;

    const a = await setEmail(t, gone.employee.id, await version(gone.employee.id), 'a@x.example');
    const b = await setEmail(t, taken.employee.id, await version(taken.employee.id), 'b@x.example');

    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const kept = await t.client.getRecord(t.keys.signInEmail('taken@x.example'));
    expect(storedSignInEmailSchema.parse(kept?.data).employeeId).toBe(other);
  });

  it('C: An email record that does not parse is a 500, never a person signed in', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    await t.client.putRecord(t.keys.signInEmail('lan@x.example'), { employeeId: 'x' });

    expect(await status(t, 'lan@x.example', lan.password)).toBe(500);
  });
});

describe('C: A QR code is 32 random bytes kept as their hash, in one record per person', () => {
  const qrTenant = async (options: Parameters<typeof staffTenant>[1] = {}) => {
    const t = await staffTenant(cs, options);
    await t.setup({ fields: { qr: true } });
    return t;
  };

  it('C: A QR code is 32 random bytes kept as their hash, in one record per person, and the secret is in the link alone', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });

    const first = await issued(t, bao.id);
    const second = await issued(t, bao.id);

    expect(Buffer.from(first.secret, 'base64url')).toHaveLength(32);
    expect(first.secret).not.toBe(second.secret);
    expect(first.link).toBe(`/login?client-code=${t.code}&qr=${bao.id}.${first.secret}`);
    expect(first.expiresAt).toBe(t.time.now() + QR_MINUTES * MINUTE);
    const stored = await t.client.getRecord(t.keys.signInQr(bao.id));
    expect(storedSignInQrSchema.parse(stored?.data)).toEqual({
      hash: createHash('sha256').update(second.secret).digest('hex'),
      expiresAt: second.expiresAt,
    });
    expect(JSON.stringify(stored)).not.toContain(second.secret);
    expect((await t.client.listRecords(t.keys.signInQr(''))).records).toHaveLength(1);
  });

  it('C: A new QR code cancels the last: the last one signs no one in', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });
    const last = await issued(t, bao.id);
    const fresh = await issued(t, bao.id);

    expect((await openQr(t, bao.id, last.secret)).statusCode).toBe(401);
    expect((await openQr(t, bao.id, fresh.secret)).statusCode).toBe(200);
  });

  it('C: A QR code opened signs the person in on their own first page, and ends the session the device held', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004', name: 'Bao' });
    const code = await issued(t, bao.id);
    const held = (await signIn(t.app, { name: 'emp-0004', password: bao.password })).body.authId;

    const opened = await openQr(t, bao.id, code.secret, {
      'x-device-id': DEVICE,
      ...withAuth(held),
    });

    expect(opened.statusCode).toBe(200);
    const session = opened.json<{ authId: string; user: { name: string; root: boolean } }>();
    expect(session.user).toMatchObject({ name: 'Bao', root: false });
    expect((await me(t, session.authId)).statusCode).toBe(200);
    expect((await me(t, held)).statusCode).toBe(401);
  });

  it('C: Spending a QR code removes the record with its tag, so two openings sign in once', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });
    const code = await issued(t, bao.id);

    const both = await Promise.all([
      openQr(t, bao.id, code.secret),
      openQr(t, bao.id, code.secret, { 'x-device-id': OTHER_DEVICE }),
    ]);

    expect(both.map((reply) => reply.statusCode).sort()).toEqual([200, 401]);
    expect(await t.client.getRecord(t.keys.signInQr(bao.id))).toBeNull();
    expect((await openQr(t, bao.id, code.secret)).statusCode).toBe(401);
  });

  it('C: A QR code spent by another phone between the check and the removal is refused, whatever else was right', async () => {
    const hook: { armed: boolean } = { armed: false };
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async removeRecord(key, ifTag) {
          if (hook.armed && key.includes('.signin-qr.')) {
            hook.armed = false;
            // The other phone's removal, over the tag it read: the record is gone for this one.
            await client.removeRecord(key, ifTag);
          }
          return await client.removeRecord(key, ifTag);
        },
      }),
    });
    await t.setup({ fields: { qr: true } });
    const bao = await person(t, { code: 'EMP-0004' });
    const code = await issued(t, bao.id);
    hook.armed = true;

    const late = await openQr(t, bao.id, code.secret);

    expect(late.statusCode).toBe(401);
    expect(late.json()).not.toHaveProperty('authId');
  });

  it('C: A QR code opened after its 15 minutes is refused, the last moment before it signs in', async () => {
    const t = await qrTenant();
    const early = await person(t, { code: 'EMP-0001' });
    const late = await person(t, { code: 'EMP-0002' });
    const a = await issued(t, early.id);
    const b = await issued(t, late.id);

    t.time.advance(QR_MINUTES * MINUTE - 1);
    const before = await openQr(t, early.id, a.secret);
    t.time.advance(1);
    const after = await openQr(t, late.id, b.secret);

    expect([before.statusCode, after.statusCode]).toEqual([200, 401]);
  });

  it('C: A wrong secret is refused and spends nothing', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });
    const code = await issued(t, bao.id);
    const wrong = `${code.secret.slice(0, -1)}${code.secret.endsWith('A') ? 'B' : 'A'}`;

    expect((await openQr(t, bao.id, wrong)).statusCode).toBe(401);
    expect((await openQr(t, bao.id, code.secret)).statusCode).toBe(200);
  });

  it('C: The QR code is issued by the root alone, and only while the company has the QR sign-in on', async () => {
    const t = await staffTenant(cs);
    const bao = await person(t, { code: 'EMP-0004' });
    const off = await issue(t, bao.id);
    await t.setup({ fields: { qr: true } });
    const everything = {
      'staff.canView': true,
      'staff.canCreate': true,
      'staff.canEdit': true,
      'staff.canDelete': true,
    };
    const office = await t.staff('OFFICE', { own: everything });
    const notRoot = await issue(t, bao.id, office.call);
    const nobody = await issue(t, randomUUID());

    expect([off.statusCode, notRoot.statusCode, nobody.statusCode]).toEqual([403, 403, 404]);
    expect(await t.client.getRecord(t.keys.signInQr(bao.id))).toBeNull();
  });

  it('C: A company that turns the QR sign-in off refuses the codes it issued, and they stay unspent', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });
    const code = await issued(t, bao.id);
    await t.setup({ fields: { qr: false } });

    expect((await openQr(t, bao.id, code.secret)).statusCode).toBe(401);
    expect(await t.client.getRecord(t.keys.signInQr(bao.id))).not.toBeNull();
  });

  it('C: A person who left, or whose sign-in record is not theirs, is refused and the code stays unspent', async () => {
    const t = await qrTenant();
    const left = await person(t, { code: 'EMP-0001' });
    const orphan = await person(t, { code: 'EMP-0002' });
    const gone = await issued(t, left.id);
    const lost = await issued(t, orphan.id);
    await t.rootCall.send('POST', `/api/employees/${left.id}/archive`, { version: left.version });
    const record = await t.client.getRecord(t.keys.user('emp-0002'));
    await t.client.removeRecord(t.keys.user('emp-0002'), record!.tag);

    expect((await openQr(t, left.id, gone.secret)).statusCode).toBe(401);
    expect((await openQr(t, orphan.id, lost.secret)).statusCode).toBe(401);
    expect(await t.client.getRecord(t.keys.signInQr(left.id))).not.toBeNull();
    expect(await t.client.getRecord(t.keys.signInQr(orphan.id))).not.toBeNull();
  });

  it('C: A person with no password yet is signed in by a QR code all the same', async () => {
    const t = await qrTenant();
    const fresh = await seedEmployee(t.client, t.id, { code: 'NEW-1', password: null });
    const code = await issued(t, fresh.employee.id);

    expect((await openQr(t, fresh.employee.id, code.secret)).statusCode).toBe(200);
  });

  it('C: A code for no one, a body that is not a code, and a call with no device are refused', async () => {
    const t = await qrTenant();
    const stranger = randomUUID();
    await t.client.putRecord(t.keys.signInQr(stranger), {
      hash: createHash('sha256').update('x'.repeat(43)).digest('hex'),
      expiresAt: t.time.now() + MINUTE,
    });

    const none = await openQr(t, stranger, 'x'.repeat(43));
    const unknown = await openQr(t, randomUUID(), 'x'.repeat(43));
    const bad = await openQr(t, 'not-an-id', 'x');
    const noDevice = await openQr(t, stranger, 'x'.repeat(43), {});

    expect([none, unknown, bad, noDevice].map((reply) => reply.statusCode)).toEqual([
      401, 401, 400, 400,
    ]);
  });

  it('C: A QR record that does not parse is a 500, never a person signed in', async () => {
    const t = await qrTenant();
    const bao = await person(t, { code: 'EMP-0004' });
    await t.client.putRecord(t.keys.signInQr(bao.id), { hash: 'x' });

    expect((await openQr(t, bao.id, 'x'.repeat(43))).statusCode).toBe(500);
  });

  it('C: A new QR code is tried again when the last moves in between, and is a 503 when it moves on every try', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await qrTenant({ wrap: interfering(hook) });
    const bao = await person(t, { code: 'EMP-0004' });
    const key = t.keys.signInQr(bao.id);
    await issued(t, bao.id);
    let moves = 0;
    const bump = async (written: string, client: CStorageClient) => {
      if (written !== key) return;
      const found = await client.getRecord(key);
      await client.putRecord(key, { ...(found!.data as object), expiresAt: ++moves }, found!.tag);
    };
    hook.current = async (written, client) => {
      hook.current = null;
      await bump(written, client);
    };

    const retried = await issue(t, bao.id);
    hook.current = bump;
    const stuck = await issue(t, bao.id);

    expect([retried.statusCode, stuck.statusCode]).toEqual([200, 503]);
  });
});

describe('C: One’s own password', () => {
  it('C: One’s own password is changed with the current one given: the old no longer signs in, the new does, and the answer holds the session that replaces the held one', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001', name: 'Lan' });
    const held = (await signIn(t.app, { name: 'emp-0001', password: lan.password })).body.authId;
    const sessions = async () => (await t.client.listRecords(t.keys.session(''))).records.length;
    const before = await sessions();

    const changed = await ownPassword(t, held, { current: lan.password, password: NEW_PASSWORD });

    expect(changed.statusCode).toBe(200);
    // The held session's record is ended, not left behind: the new one takes its place.
    expect(await sessions()).toBe(before);
    const session = changed.json<{ authId: string; user: { name: string } }>();
    expect(session.user.name).toBe('Lan');
    expect((await me(t, session.authId)).statusCode).toBe(200);
    expect((await me(t, held)).statusCode).toBe(401);
    expect(await status(t, 'emp-0001', lan.password)).toBe(401);
    expect(await status(t, 'emp-0001', NEW_PASSWORD)).toBe(200);
  });

  it('C: The new password signs the person out on every other device', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const phone = (await signIn(t.app, { name: 'emp-0001', password: lan.password }, OTHER_DEVICE))
      .body.authId;
    const pc = (await signIn(t.app, { name: 'emp-0001', password: lan.password })).body.authId;

    await ownPassword(t, pc, { current: lan.password, password: NEW_PASSWORD });

    expect((await me(t, phone)).statusCode).toBe(401);
  });

  it('C: A wrong current password is a 403 and changes nothing', async () => {
    const t = await staffTenant(cs);
    const lan = await person(t, { code: 'EMP-0001' });
    const held = (await signIn(t.app, { name: 'emp-0001', password: lan.password })).body.authId;
    const before = await t.client.getRecord(t.keys.user('emp-0001'));

    const refused = await ownPassword(t, held, {
      current: 'Wrong-pass-9!',
      password: NEW_PASSWORD,
    });

    expect(refused.statusCode).toBe(403);
    expect(await t.client.getRecord(t.keys.user('emp-0001'))).toEqual(before);
    expect((await me(t, held)).statusCode).toBe(200);
  });

  it('C: The root changes their own password the same way', async () => {
    const t = await staffTenant(cs);

    const changed = await ownPassword(t, t.root, {
      current: t.ROOT.password,
      password: NEW_PASSWORD,
    });

    expect(changed.statusCode).toBe(200);
    expect(changed.json<{ user: { root: boolean } }>().user.root).toBe(true);
    expect(await status(t, 'root', t.ROOT.password)).toBe(401);
    expect(await status(t, 'root', NEW_PASSWORD)).toBe(200);
  });

  it('C: A new password that breaks the rule is a 400, a call signed in by no one a 401, and a call with no device a 400', async () => {
    const t = await staffTenant(cs);
    const body = { current: t.ROOT.password, password: NEW_PASSWORD };

    const weak = await ownPassword(t, t.root, { ...body, password: 'weak' });
    const nobody = await ownPassword(t, 'nope.nope', body);
    const noDevice = await ownPassword(t, t.root, body, {});

    expect([weak.statusCode, nobody.statusCode, noDevice.statusCode]).toEqual([400, 401, 400]);
    expect(await status(t, 'root', t.ROOT.password)).toBe(200);
  });

  it('C: A person signed in by a QR code with no password yet cannot give a current one: 403', async () => {
    const t = await staffTenant(cs);
    await t.setup({ fields: { qr: true } });
    const fresh = await seedEmployee(t.client, t.id, { code: 'NEW-1', password: null });
    const code = await issued(t, fresh.employee.id);
    const opened = await openQr(t, fresh.employee.id, code.secret);

    const refused = await ownPassword(t, opened.json<{ authId: string }>().authId, {
      current: 'anything',
      password: NEW_PASSWORD,
    });

    expect(refused.statusCode).toBe(403);
  });

  it('C: A password the root gave in between is met by reading the record again: the current one is checked against it', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await staffTenant(cs, { wrap: interfering(hook) });
    const lan = await person(t, { code: 'EMP-0001' });
    const held = (await signIn(t.app, { name: 'emp-0001', password: lan.password })).body.authId;
    const key = t.keys.user('emp-0001');
    const touch = async (written: string, client: CStorageClient) => {
      hook.current = null;
      if (written !== key) return;
      const found = await client.getRecord(key);
      const stored = storedUserSchema.parse(found?.data);
      await client.putRecord(key, { ...stored, passwordAt: 7 }, found!.tag);
    };

    hook.current = touch;
    const retried = await ownPassword(t, held, { current: lan.password, password: NEW_PASSWORD });
    expect(retried.statusCode).toBe(200);
    expect(await status(t, 'emp-0001', NEW_PASSWORD)).toBe(200);

    const given = (
      await t.rootCall.send('PUT', `/api/employees/${await idOf(t, 'EMP-0001')}/password`, {
        password: null,
      })
    ).json<{ password: string }>().password;
    const second = (await signIn(t.app, { name: 'emp-0001', password: given })).body.authId;
    hook.current = async (written, client) => {
      hook.current = null;
      if (written !== key) return;
      const found = await client.getRecord(key);
      const stored = storedUserSchema.parse(found?.data);
      await client.putRecord(
        key,
        { ...stored, passwordHash: stored.passwordHash + 'x' },
        found!.tag,
      );
    };
    const refused = await ownPassword(t, second, { current: given, password: 'Other-pass-3$' });
    expect(refused.statusCode).toBe(403);
  });

  it('C: A sign-in record that moves on every try answers 503, and one removed in between a 401', async () => {
    const hook: Parameters<typeof interfering>[0] = { current: null };
    const t = await staffTenant(cs, { wrap: interfering(hook) });
    const lan = await person(t, { code: 'EMP-0001' });
    const key = t.keys.user('emp-0001');
    const held = (await signIn(t.app, { name: 'emp-0001', password: lan.password })).body.authId;
    let moves = 0;
    hook.current = async (written, client) => {
      if (written !== key) return;
      const found = await client.getRecord(key);
      const stored = storedUserSchema.parse(found?.data);
      await client.putRecord(key, { ...stored, passwordAt: ++moves }, found!.tag);
    };

    const stuck = await ownPassword(t, held, { current: lan.password, password: NEW_PASSWORD });
    expect(stuck.statusCode).toBe(503);
    expect(moves).toBe(3);

    hook.current = async (written, client) => {
      hook.current = null;
      if (written !== key) return;
      const found = await client.getRecord(key);
      await client.removeRecord(key, found!.tag);
    };
    const removed = await ownPassword(t, held, { current: lan.password, password: NEW_PASSWORD });
    expect(removed.statusCode).toBe(401);
  });
});

async function idOf(t: Tenant, code: string) {
  const list = (await t.rootCall.get('/api/employees')).json<{
    employees: { id: string; code: string }[];
  }>();
  return list.employees.find((person) => person.code === code)!.id;
}
