import { waitReplySchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { personCalls, staffTenant } from '../tests/staff';
import { ROOT, signIn, tenantWithRoot } from '../tests/tenant';

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
});
