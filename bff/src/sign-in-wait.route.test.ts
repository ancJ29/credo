import { normaliseSignInName, sha256Hex, waitReplySchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { buildApp } from './app';
import { personCalls, staffTenant } from '../tests/staff';
import {
  CODE,
  DEVICE,
  ORIGIN,
  ROOT,
  scoped,
  signIn,
  tenantWithRoot,
  withAuth,
} from '../tests/tenant';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

type Tenant = Awaited<ReturnType<typeof tenantWithRoot>>;

const WRONG = 'not the password';
const SECOND = 1000;
const NEW = 'New-password-2@';

/** One try at the sign-in: the status and the body it answered. */
async function tried(t: Pick<Tenant, 'app'>, name: string, password: string) {
  const { response } = await signIn(t.app, { name, password });
  return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
}

/** `count` wrong tries in a row on one name, in the order they answered. */
async function wrongTries(t: Pick<Tenant, 'app'>, name: string, count: number) {
  const answers = [];
  for (let i = 0; i < count; i++) answers.push(await tried(t, name, WRONG));
  return answers;
}

/** One's own password changed, from the device the session was issued to. */
const ownPassword = (t: Pick<Tenant, 'app'>, authId: string, payload: object) =>
  t.app.inject({
    method: 'PUT',
    url: '/api/auth/password',
    headers: { ...withAuth(authId), 'x-device-id': DEVICE },
    payload,
  });

const waitOf = (seconds: number) => ({
  status: 429,
  body: { error: 'Wait', waitSeconds: seconds },
});

describe('C: Wrong passwords make a name wait, through the real back end', () => {
  it('C: Five wrong passwords in a row make nobody wait, and the sixth try is still checked', async () => {
    const t = await tenantWithRoot(cs);

    const answers = await wrongTries(t, ROOT.name, 5);

    for (const answer of answers) {
      expect(answer).toEqual({ status: 401, body: { error: 'Wrong name or password' } });
    }
    expect((await tried(t, ROOT.name, ROOT.password)).status).toBe(200);
  });

  it('C: The sixth wrong password answers a wait of 30 seconds in the shape the screen reads, and a try within it is refused with the seconds left, its right password unread', async () => {
    const t = await tenantWithRoot(cs);
    await wrongTries(t, ROOT.name, 5);

    const sixth = await tried(t, ROOT.name, WRONG);
    t.time.advance(10 * SECOND);
    const during = await tried(t, ROOT.name, ROOT.password);

    expect(sixth).toEqual(waitOf(30));
    expect(waitReplySchema.safeParse(sixth.body).success).toBe(true);
    expect(during).toEqual(waitOf(20));
  });

  it('C: Each wrong try after a wait doubles it: a minute at the seventh', async () => {
    const t = await tenantWithRoot(cs);
    await wrongTries(t, ROOT.name, 6);
    t.time.advance(30 * SECOND);

    const seventh = await tried(t, ROOT.name, WRONG);

    expect(seventh).toEqual(waitOf(60));
  });

  it('C: A right password once no wait runs signs in and clears the count, so the next wrong try is the first of five free', async () => {
    const t = await tenantWithRoot(cs);
    await wrongTries(t, ROOT.name, 6);
    t.time.advance(30 * SECOND);
    expect((await tried(t, ROOT.name, ROOT.password)).status).toBe(200);

    const answers = await wrongTries(t, ROOT.name, 6);

    expect(answers.slice(0, 5).map((answer) => answer.status)).toEqual([401, 401, 401, 401, 401]);
    expect(answers[5]).toEqual(waitOf(30));
  });

  it('C: A name nobody holds is counted and waits with the same answers as a real one', async () => {
    const t = await tenantWithRoot(cs);

    const nobody = await wrongTries(t, 'nobody-here', 6);
    const real = await wrongTries(t, ROOT.name, 6);

    expect(nobody).toEqual(real);
    expect(nobody[5]).toEqual(waitOf(30));
  });

  it('C: A sign-in by email and one by the same person’s code count on one name', async () => {
    const t = await staffTenant(cs);
    await t.setup({ fields: { email: true } });
    const added = await personCalls.added(t.rootCall, { code: 'EMP-0001' });
    const lan = added.employee;
    const set = await t.rootCall.send('PUT', `/api/employees/${lan.employee.id}/email`, {
      version: lan.version,
      email: 'lan@x.example',
    });
    expect(set.statusCode).toBe(200);

    const byEmail = await wrongTries(t, 'lan@x.example', 3);
    const byCode = await wrongTries(t, 'EMP-0001', 3);

    expect(byEmail.map((answer) => answer.status)).toEqual([401, 401, 401]);
    expect(byCode.map((answer) => answer.status)).toEqual([401, 401, 429]);
    expect(byCode[2]).toEqual(waitOf(30));
  });

  it('C: A count whose record moved on every attempt answers 503 and checks no password', async () => {
    const t = await tenantWithRoot(cs, {
      wrap: (client) => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (key.includes('.signin-wait.')) return 'moved';
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });

    const answer = await tried(t, ROOT.name, ROOT.password);

    expect(answer).toEqual({ status: 503, body: { error: 'Service unavailable' } });
  });

  it('C: A try during a wait does not lengthen it', async () => {
    const t = await tenantWithRoot(cs);
    await wrongTries(t, ROOT.name, 6);
    t.time.advance(10 * SECOND);
    const during = await tried(t, ROOT.name, WRONG);
    t.time.advance(20 * SECOND);

    const after = await tried(t, ROOT.name, WRONG);

    expect(during).toEqual(waitOf(20));
    expect(after).toEqual(waitOf(60));
  });

  it('C: A wrong current password on one’s own password counts on the signed-in name, and during a wait it answers 429 unread', async () => {
    const t = await staffTenant(cs);
    const lan = await t.staff('EMP-0001');
    const name = normaliseSignInName('EMP-0001');
    const change = (current: string) => ownPassword(t, lan.authId, { current, password: NEW });

    const bySignIn = await wrongTries(t, name, 3);
    const byOwn = [];
    for (let i = 0; i < 3; i++) byOwn.push(await change(WRONG));
    t.time.advance(10 * SECOND);
    const rightDuring = await change(lan.password as string);
    t.time.advance(20 * SECOND);

    expect(bySignIn.map((answer) => answer.status)).toEqual([401, 401, 401]);
    expect(byOwn.map((answer) => answer.statusCode)).toEqual([403, 403, 429]);
    expect(byOwn[2]?.json()).toEqual({ error: 'Wait', waitSeconds: 30 });
    expect(rightDuring.statusCode).toBe(429);
    expect(rightDuring.json()).toEqual({ error: 'Wait', waitSeconds: 20 });
    expect((await tried(t, name, lan.password as string)).status).toBe(200);
  });

  it('C: A right current password clears the count the sign-in left', async () => {
    const t = await staffTenant(cs);
    const lan = await t.staff('EMP-0001');
    const name = normaliseSignInName('EMP-0001');
    await wrongTries(t, name, 3);
    const changed = await ownPassword(t, lan.authId, { current: lan.password, password: NEW });
    expect(changed.statusCode).toBe(200);
    const held = changed.json<{ authId: string }>().authId;

    const answers = [];
    for (let i = 0; i < 6; i++) {
      answers.push(await ownPassword(t, held, { current: WRONG, password: NEW }));
    }

    expect(answers.map((answer) => answer.statusCode)).toEqual([403, 403, 403, 403, 403, 429]);
  });

  it('C: Of ten tries sent at once on a name at four wrong, at most two have their password checked', async () => {
    let saved = 0;
    const t = await tenantWithRoot(cs, {
      wrap: (client) => ({
        ...client,
        async putRecord(key, data, ifTag) {
          const result = await client.putRecord(key, data, ifTag);
          if (key.includes('.signin-wait.') && result === 'saved') saved++;
          return result;
        },
      }),
    });
    await wrongTries(t, ROOT.name, 4);
    saved = 0;

    const answers = await Promise.all(Array.from({ length: 10 }, () => tried(t, ROOT.name, WRONG)));

    expect(saved).toBe(2);
    expect(answers.filter((answer) => answer.status === 401)).toHaveLength(1);
    expect(answers.filter((answer) => answer.status === 429)).toHaveLength(9);
  });

  it('C: A wait’s key is keyed by a secret the store lacks: not the name’s bare SHA-256, and another service key makes another key', async () => {
    const typed = 'a password typed in the name box';
    const waitKeys = async (t: Tenant) =>
      (await t.client.listRecords(`tenant.${t.id}.signin-wait.`)).records.map(({ key }) => key);
    const a = await tenantWithRoot(cs);
    const b = await tenantWithRoot(cs);

    await tried(a, typed, WRONG);
    await tried(b, typed, WRONG);

    const [keyA, keyB] = [await waitKeys(a), await waitKeys(b)];
    expect(keyA).toHaveLength(1);
    expect(keyA[0]).toMatch(/^tenant\.[^.]+\.signin-wait\.[0-9a-f]{64}$/);
    expect(keyA[0]).not.toBe(a.keys.signInWait(await sha256Hex(typed)));
    expect(keyB[0].split('.').pop()).not.toBe(keyA[0].split('.').pop());
  });

  it('C: A second back end over the same store refuses during the wait the first one started', async () => {
    const t = await tenantWithRoot(cs);
    const second = scoped(
      buildApp({
        storage: t.client,
        now: t.time.now,
        origin: ORIGIN,
        serviceKey: t.accessKey,
        logger: false,
      }),
      CODE,
    );
    await wrongTries(t, ROOT.name, 6);
    t.time.advance(10 * SECOND);

    const viaSecond = await tried({ app: second }, ROOT.name, ROOT.password);

    expect(viaSecond).toEqual(waitOf(20));
  });
});
