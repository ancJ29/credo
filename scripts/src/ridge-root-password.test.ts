import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import {
  AUTH_HEADER,
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-root-password-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const copies = allCopies();
/** Invented, and obeying piece 2's rule; the old ones are the copies' first passwords. */
const NEW = 'Invented-New1!';
const OTHER = 'Invented-Other2@';
const MORNING = Date.UTC(2026, 9, 29, 23, 0, 0);
const DEVICE = 'device-test-0001';

type Tenant = Awaited<ReturnType<typeof freshTenant>>;
type Fetch = typeof fetch;

/** A service of its own, and the command run as ops/root-password.sh runs it: the connection in the
 * environment, the password on the standard input. `fetch` stands between the command and the
 * store, to make a write fail on a chosen record. */
async function ridge() {
  const tenant = await freshTenant(cs);
  const storage = tenant.client;
  const env = (t: Tenant = tenant) => ({
    C_STORAGE_URL: t.connection.baseUrl,
    INTERNAL_ACCESS_KEY: t.connection.internalAccessKey,
    SERVICE_CODE: t.serviceCode,
    SERVICE_ACCESS_KEY: t.accessKey,
  });
  async function run(
    argv: string[],
    options: {
      stdin?: string | null;
      fetch?: Fetch;
      now?: number;
      env?: Record<string, string>;
    } = {},
  ) {
    const lines = { out: [] as string[], err: [] as string[] };
    const stdin = options.stdin === undefined ? `${NEW}\n` : options.stdin;
    const status = await runRidge(argv, options.env ?? env(), {
      out: (line) => lines.out.push(line),
      show: () => {
        throw new Error('root-password shows nothing on the terminal');
      },
      err: (line) => lines.err.push(line),
      fetch: options.fetch,
      now: options.now === undefined ? undefined : () => options.now!,
      stdin: stdin === null ? undefined : () => Promise.resolve(stdin),
    });
    return { status, ...lines };
  }
  const make = async (index: number) => {
    const made = await createClient(storage, {
      code: copies[index].code,
      name: copies[index].company,
      madeAt: Date.now(),
    });
    if (made === 'taken') throw new Error('taken');
    return {
      code: copies[index].code,
      id: made.id,
      password: made.password,
      keys: recordKeys.tenant(made.id),
    };
  };
  return { tenant, storage, env, run, make };
}
type Copy = Awaited<ReturnType<Awaited<ReturnType<typeof ridge>>['make']>>;

/** The product's sign-in, as the root's browser calls it. */
async function signIn(storage: CStorageClient, copy: Copy, password: string) {
  const app = buildApp({
    storage,
    now: Date.now,
    origin: 'http://localhost',
    serviceKey: 'the test',
    logger: false,
  });
  const reply = await app.inject({
    method: 'POST',
    url: ROUTES.signIn,
    headers: { [CLIENT_HEADER]: copy.code, [DEVICE_HEADER]: DEVICE },
    payload: { name: ROOT_NAME, password },
  });
  const authId = reply.statusCode === 200 ? reply.json<{ authId: string }>().authId : '';
  const me = async (handle = authId) =>
    (
      await app.inject({
        method: 'GET',
        url: ROUTES.me,
        headers: { [CLIENT_HEADER]: copy.code, [DEVICE_HEADER]: DEVICE, [AUTH_HEADER]: handle },
      })
    ).statusCode;
  return { status: reply.statusCode, authId, me };
}
const status = async (storage: CStorageClient, copy: Copy, password: string) =>
  (await signIn(storage, copy, password)).status;

/** Every record of a client, key to data. */
async function recordsOf(storage: CStorageClient, copy: Copy) {
  const listed = await storage.listRecords(copy.keys.all);
  expect(listed.more).toBe(false);
  return new Map(listed.records.map(({ key, data }) => [key, data]));
}

/** A `fetch` that fails (503) the write of a chosen record; the rest goes through. */
function failingWrite(keyOf: (key: string) => boolean): Fetch {
  return (input, init) => {
    if (init?.method === 'POST' && typeof init.body === 'string') {
      const { key } = JSON.parse(init.body) as { key: string };
      if (keyOf(key)) return Promise.resolve(new Response('{}', { status: 503 }));
    }
    return fetch(input, init);
  };
}

describe('ridge_cli root-password', () => {
  it('row 1: it gives each named copy’s root the typed password, names each company first, and leaves a copy not named as it was', async () => {
    const { storage, run, make } = await ridge();
    const [one, two, three] = [await make(0), await make(1), await make(2)];

    const result = await run(['root-password', one.code, two.code]);

    expect(result.status).toBe(0);
    expect(result.err).toEqual([]);
    expect(result.out).toEqual([
      `${one.code}: ${copies[0].company}`,
      `${two.code}: ${copies[1].company}`,
      `${one.code}: set`,
      `${one.code}: signs in`,
      `${two.code}: set`,
      `${two.code}: signs in`,
    ]);
    for (const copy of [one, two]) {
      expect(await status(storage, copy, NEW), copy.code).toBe(200);
      expect(await status(storage, copy, copy.password), copy.code).toBe(401);
    }
    expect(await status(storage, three, three.password)).toBe(200);
    expect(await status(storage, three, NEW)).toBe(401);
  });

  it('row 1: a code typed in capitals, with spaces around it, names the same copy', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);

    const result = await run(['root-password', ` ${one.code.toUpperCase()} `]);

    expect(result.status).toBe(0);
    expect(await status(storage, one, NEW)).toBe(200);
  });

  it('row 2: a password that breaks the rule is refused, status 2, naming the rule and never the password, and nothing changed', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);
    const before = await recordsOf(storage, one);

    for (const bad of [
      'Short1!',
      'alllowercase1!',
      'ALLUPPERCASE1!',
      'NoDigits!!',
      'NoSymbol123a',
      ' Leading1!a',
      '',
    ]) {
      const result = await run(['root-password', one.code], { stdin: `${bad}\n` });
      expect(result.status, bad).toBe(2);
      expect(result.err.join('\n'), bad).toContain('the password breaks the rule');
      expect(result.err.join('\n') + result.out.join('\n'), bad).not.toContain(bad || '\u0000');
    }

    expect(await recordsOf(storage, one)).toEqual(before);
    expect(await status(storage, one, one.password)).toBe(200);
  });

  it('row 2: a run given no input at all is a password that breaks the rule', async () => {
    const { run, make } = await ridge();
    const one = await make(0);

    const result = await run(['root-password', one.code], { stdin: null });

    expect(result.status).toBe(2);
    expect(result.err.join('\n')).toContain('the password breaks the rule');
  });

  it('row 10: --check reads one line and needs no connection: the rule and each code, status 0, or status 2 naming why', async () => {
    const { run } = await ridge();
    const code = copies[0].code;
    const check = (argv: string[], stdin = `${NEW}\n`) =>
      run(['root-password', '--check', ...argv], { stdin, env: {} });

    const good = await check([code, copies[1].code]);
    expect(good.status).toBe(0);
    expect(good.out).toEqual(['checked: the password follows the rule, 2 demo copies named']);

    const broken = await check([code], 'weak\n');
    expect([broken.status, broken.err.join('\n')]).toEqual([
      2,
      expect.stringContaining('the password breaks the rule'),
    ]);
    const unknown = await check(['some-other-client']);
    expect([unknown.status, unknown.err]).toEqual([
      2,
      ['error: some-other-client is not one of the demo copies'],
    ]);
    const twice = await check([code, ` ${code.toUpperCase()}`]);
    expect([twice.status, twice.err]).toEqual([2, [`error: ${code} is named twice`]]);
    const none = await check([]);
    expect([none.status, none.err.join('\n')]).toEqual([
      2,
      expect.stringContaining('no code named'),
    ]);
    expect((await run(['root-password', '--check', code], { env: {}, stdin: null })).status).toBe(
      2,
    );
  });

  it('row 6: a code outside the six demo copies is refused, status 2, and a copy named beside it keeps its password', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);
    const client = await createClient(storage, { code: 'a-real-client', name: 'Real', madeAt: 1 });
    if (client === 'taken') throw new Error('taken');
    const before = await recordsOf(storage, one);

    const result = await run(['root-password', one.code, 'a-real-client']);

    expect(result.status).toBe(2);
    expect(result.err).toEqual(['error: a-real-client is not one of the demo copies']);
    expect(result.out).toEqual([]);
    expect(await recordsOf(storage, one)).toEqual(before);
    expect(await status(storage, one, one.password)).toBe(200);
    const theirs = storedClientSchema.parse(
      (await storage.getRecord(recordKeys.client('a-real-client')))!.data,
    );
    const root = await storage.getRecord(recordKeys.tenant(theirs.id).user(ROOT_NAME));
    expect((root!.data as { passwordHash: string }).passwordHash).not.toBe('');
  });

  it('row 4: every session of that root ends: one issued before is a 401 at ROUTES.me, the old password a 401, the new one a 200', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);
    const before = await signIn(storage, one, one.password);
    const another = await signIn(storage, one, one.password);
    expect(await before.me()).toBe(200);
    expect(await another.me()).toBe(200);

    expect((await run(['root-password', one.code])).status).toBe(0);

    expect(await before.me()).toBe(401);
    expect(await another.me()).toBe(401);
    expect(await status(storage, one, one.password)).toBe(401);
    const after = await signIn(storage, one, NEW);
    expect(after.status).toBe(200);
    expect(await after.me()).toBe(200);
  });

  it('row 5: nothing else of the copy changes: its records differ in the root’s sign-in alone, the read-back’s session gone, and the seed’s next morning goes on', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);
    const filled = await run(['seed'], { now: MORNING });
    expect(filled.status).toBe(0);
    const before = await recordsOf(storage, one);

    const result = await run(['root-password', one.code], { now: MORNING });

    expect(result.status).toBe(0);
    const after = await recordsOf(storage, one);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      (key) => JSON.stringify(before.get(key)) !== JSON.stringify(after.get(key)),
    );
    expect(changed).toEqual([one.keys.user(ROOT_NAME)]);
    expect([...after.keys()].filter((key) => key.startsWith(one.keys.session('')))).toEqual(
      [...before.keys()].filter((key) => key.startsWith(one.keys.session(''))),
    );
    const next = await run(['seed'], { now: MORNING + 24 * 3_600_000 });
    expect(next.status).toBe(0);
    expect(next.out.at(-1)).toBe(
      'seed: 6 copies mapped, 0 up to date, 5 not on this service, 3 days applied',
    );
  });

  it('row 11: every code is read before the first write: a code with no client, an index or a root that is wrong, is status 2 and nothing is written', async () => {
    const { storage, run, make } = await ridge();
    const [one, two, three, four] = [await make(0), await make(1), await make(2), await make(3)];
    await storage.putRecord(
      recordKeys.client(two.code),
      { nonsense: true },
      (await storage.getRecord(recordKeys.client(two.code)))!.tag,
    );
    const rootTag = (await storage.getRecord(three.keys.user(ROOT_NAME)))!.tag;
    await storage.putRecord(three.keys.user(ROOT_NAME), { nonsense: true }, rootTag);
    const fourRoot = await storage.getRecord(four.keys.user(ROOT_NAME));
    await storage.putRecord(
      four.keys.user(ROOT_NAME),
      { ...(fourRoot!.data as object), root: false },
      fourRoot!.tag,
    );
    const before = await recordsOf(storage, one);

    const cases: [string, string][] = [
      [copies[5].code, 'is not on this service'],
      [two.code, 'its index record does not parse'],
      [three.code, 'its root record is missing or is no root'],
      [four.code, 'its root record is missing or is no root'],
    ];
    for (const [code, why] of cases) {
      const result = await run(['root-password', one.code, code]);
      expect(result.status, code).toBe(2);
      expect(result.err.join('\n'), code).toContain(why);
      expect(result.out, code).toEqual([]);
      expect(await recordsOf(storage, one), code).toEqual(before);
    }
    expect(await status(storage, one, one.password)).toBe(200);
  });

  it('row 7 and 11: a run that stops part-way names the roots it set and the roots it did not reach, which keep their password; the same run again ends in the same state', async () => {
    const { storage, run, make } = await ridge();
    const [one, two, three] = [await make(0), await make(1), await make(2)];
    const argv = ['root-password', one.code, two.code, three.code];

    const stopped = await run(argv, {
      fetch: failingWrite((key) => key === two.keys.user(ROOT_NAME)),
    });

    expect(stopped.status).toBe(1);
    expect(stopped.err).toHaveLength(1);
    expect(stopped.err[0]).toMatch(
      new RegExp(
        `^error: ${two.code}: .+; set: ${one.code}; not set, password as it was: ${two.code}, ${three.code}$`,
      ),
    );
    expect(await status(storage, one, NEW)).toBe(200);
    expect(await status(storage, two, two.password)).toBe(200);
    expect(await status(storage, three, three.password)).toBe(200);

    const again = await run(argv);
    expect(again.status).toBe(0);
    for (const copy of [one, two, three])
      expect(await status(storage, copy, NEW), copy.code).toBe(200);
    const once = await run(argv);
    expect(once.status).toBe(0);
    for (const copy of [one, two, three])
      expect(await status(storage, copy, NEW), copy.code).toBe(200);
  });

  it('row 7: a first root whose write fails names none set, and a last root set but not read back names none left', async () => {
    const { storage, run, make } = await ridge();
    const [one, two] = [await make(0), await make(1)];

    const first = await run(['root-password', one.code, two.code], {
      fetch: failingWrite((key) => key === one.keys.user(ROOT_NAME)),
    });
    const last = await run(['root-password', two.code], {
      fetch: failingWrite((key) => key.startsWith(two.keys.session(''))),
    });

    expect(first.err).toHaveLength(1);
    expect(first.err[0]).toMatch(
      new RegExp(`; set: none; not set, password as it was: ${one.code}, ${two.code}$`),
    );
    expect(last.err).toHaveLength(1);
    expect(last.err[0]).toMatch(
      new RegExp(`; set: ${two.code}; not set, password as it was: none$`),
    );
    expect(await status(storage, one, one.password)).toBe(200);
  });

  it('row 7: a root that stops being a root between the read and the write is named, not written', async () => {
    const { storage, run, make } = await ridge();
    const [one, two] = [await make(0), await make(1)];
    const hashBefore = (await storage.getRecord(two.keys.user(ROOT_NAME)))!.data as {
      passwordHash: string;
    };
    let reads = 0;
    const flipped: Fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (
        init?.method === 'GET' &&
        url.includes(encodeURIComponent(two.keys.user(ROOT_NAME))) &&
        ++reads === 2
      ) {
        const found = await storage.getRecord(two.keys.user(ROOT_NAME));
        await storage.putRecord(
          two.keys.user(ROOT_NAME),
          { ...(found!.data as object), root: false },
          found!.tag,
        );
      }
      return fetch(input, init);
    };

    const result = await run(['root-password', one.code, two.code], { fetch: flipped });

    expect(result.status).toBe(1);
    expect(result.err).toEqual([
      `error: ${two.code}: its root record changed under this run; set: ${one.code}; not set, password as it was: ${two.code}`,
    ]);
    const kept = (await storage.getRecord(two.keys.user(ROOT_NAME)))!.data as {
      passwordHash: string;
    };
    expect(kept.passwordHash).toBe(hashBefore.passwordHash);
  });

  it('row 11: a root set that does not sign in when read back ends the run red, naming it among the roots set', async () => {
    const { storage, run, make } = await ridge();
    const [one, two] = [await make(0), await make(1)];

    const result = await run(['root-password', one.code, two.code], {
      fetch: failingWrite((key) => key.startsWith(one.keys.session(''))),
    });

    expect(result.status).toBe(1);
    expect(result.err).toEqual([
      `error: ${one.code}: set, but the sign-in read back answered 503; set: ${one.code}; not set, password as it was: ${two.code}`,
    ]);
    expect(await status(storage, two, two.password)).toBe(200);
  });

  it('row 13: the sign-in it reads back is ended: no session record is left', async () => {
    const { storage, run, make } = await ridge();
    const one = await make(0);

    expect((await run(['root-password', one.code])).status).toBe(0);

    const left = [...(await recordsOf(storage, one)).keys()].filter((key) =>
      key.startsWith(one.keys.session('')),
    );
    expect(left).toEqual([]);
  });

  it('row 14: no line it prints holds the password, the old one or a hash, a failed write’s included', async () => {
    const { storage, run, make } = await ridge();
    const [one, two] = [await make(0), await make(1)];
    const hashes = () =>
      [one, two].map(async (copy) => {
        const found = await storage.getRecord(copy.keys.user(ROOT_NAME));
        return (found!.data as { passwordHash: string }).passwordHash;
      });

    const ok = await run(['root-password', one.code], { stdin: `${OTHER}\n` });
    const failed = await run(['root-password', two.code], {
      stdin: `${NEW}\n`,
      fetch: failingWrite((key) => key === two.keys.user(ROOT_NAME)),
    });

    const printed = [...ok.out, ...ok.err, ...failed.out, ...failed.err].join('\n');
    expect(printed).not.toContain(OTHER);
    expect(printed).not.toContain(NEW);
    expect(printed).not.toContain('scrypt$');
    expect(printed).not.toContain(one.password);
    for (const hash of await Promise.all(hashes())) expect(printed).not.toContain(hash);
    expect(failed.status).toBe(1);
  });
});
