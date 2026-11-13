import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import {
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HISTORY_DAYS, applyCopy } from './demo/apply';
import { addDays } from './demo/days';
import { readLedger } from './demo/ledger';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

/** Every first password the product's create minted in this file, to look for them in the output. */
const minted = vi.hoisted(() => [] as string[]);
vi.mock('@credo/bff/password', async (importOriginal) => {
  const real = await importOriginal<typeof import('@credo/bff/password')>();
  return {
    ...real,
    newPassword: () => {
      const password = real.newPassword();
      minted.push(password);
      return password;
    },
  };
});

/** Set, every fill on this Mac's store is refused, as a fill that cannot go on reports itself. */
const refuseFills = vi.hoisted(() => ({ on: false }));
vi.mock('./demo/apply', async (importOriginal) => {
  const real = await importOriginal<typeof import('./demo/apply')>();
  return {
    ...real,
    applyCopy: (...args: Parameters<typeof real.applyCopy>) =>
      refuseFills.on
        ? Promise.resolve({
            code: args[1].code,
            status: 'refused' as const,
            filled: false,
            days: [],
            remaining: 0,
            skipped: [],
            note: 'another run holds it, left',
          })
        : real.applyCopy(...args),
  };
});

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-remake-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const copies = allCopies();
const PARTNERS = [...new Set(copies.map((copy) => copy.partner))];
/** Invented, one for each partner, and obeying the password rule. */
const PASSWORDS: Record<string, string> = {
  p1: 'Invented-One1!',
  p2: 'Invented-Two2@',
  p3: 'Invented-Three3$',
};
const typed = (passwords: Record<string, string> = PASSWORDS) =>
  PARTNERS.map((partner) => `${partner} ${passwords[partner]}\n`).join('');
/** The morning of the 30th at 06:00 in Vietnam: yesterday is the 29th. */
const MORNING = Date.UTC(2026, 9, 29, 23, 0, 0);
const TODAY = '2026-10-30';
const DEVICE = 'device-test-0001';

/** A service of its own, and the command run as ops/ runs it: the connection in the environment,
 * the passwords on the standard input. */
async function ridge() {
  const tenant = await freshTenant(cs);
  const storage = tenant.client;
  const env = {
    C_STORAGE_URL: tenant.connection.baseUrl,
    INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
    SERVICE_CODE: tenant.serviceCode,
    SERVICE_ACCESS_KEY: tenant.accessKey,
  };
  async function run(
    argv: string[],
    stdin: string | null = typed(),
    fetch?: typeof globalThis.fetch,
    clock = true,
    more: Record<string, string> = {},
  ) {
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(
      argv,
      { ...env, ...more },
      {
        out: (line) => lines.out.push(line),
        show: () => {
          throw new Error('remake shows nothing on the terminal');
        },
        err: (line) => lines.err.push(line),
        fetch,
        now: clock ? () => MORNING : undefined,
        stdin: stdin === null ? undefined : () => Promise.resolve(stdin),
      },
    );
    return { status, ...lines };
  }
  return { storage, run };
}

const indexOf = async (storage: CStorageClient, code: string) => {
  const held = await storage.getRecord(recordKeys.client(code));
  return held ? storedClientSchema.parse(held.data) : null;
};

/** The product's sign-in, as the root's browser calls it. */
async function signInStatus(storage: CStorageClient, code: string, password: string) {
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
    headers: { [CLIENT_HEADER]: code, [DEVICE_HEADER]: DEVICE },
    payload: { name: ROOT_NAME, password },
  });
  return reply.statusCode;
}

const recordCount = async (storage: CStorageClient, tenantId: string) => {
  const listed = await storage.listRecords(recordKeys.tenant(tenantId).all);
  return { count: listed.records.length, more: listed.more };
};

const YESTERDAY = '2026-10-29';

/** Pads a company past one press of a deletion (200 records), so one call to deleteClient is not
 * enough. */
async function pad(storage: CStorageClient, tenantId: string) {
  for (let at = 0; at < 250; at += 1) {
    await storage.putRecord(`${recordKeys.tenant(tenantId).all}pad-${at}`, { at }, null);
  }
}

describe('ridge_cli remake', () => {
  /** One remake, read by the rows that only read its result: a target holding the first copy used
   * (row 5), the second with a deletion stopped halfway (row 7), the other four not at all (row 6). */
  const shared = {} as {
    storage: CStorageClient;
    run: Awaited<ReturnType<typeof ridge>>['run'];
    used: { id: string; password: string };
    halfDeleted: string;
    result: { status: number; out: string[]; err: string[] };
  };
  beforeAll(async () => {
    const { storage, run } = await ridge();
    const [first, second] = copies;
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    expect((await applyCopy(storage, first, TODAY, undefined, 1)).status).toBe('ok');
    await pad(storage, made.id);
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
    expect((await recordCount(storage, made.id)).count).toBeGreaterThan(200);

    const half = await createClient(storage, {
      code: second.code,
      name: second.company,
      madeAt: 1,
    });
    if (half === 'taken') throw new Error('taken');
    await pad(storage, half.id);
    // the press that deleted the index and 200 records, and stopped
    const { deleteClient } = await import('@credo/bff/clients');
    const part = await deleteClient(storage, {
      code: second.code,
      index: {
        ...(await indexOf(storage, second.code))!,
        tag: (await storage.getRecord(recordKeys.client(second.code)))!.tag,
      },
      by: '00000000-0000-0000-0000-000000000000',
      now: () => 1,
    });
    expect(part).not.toEqual({ left: 0 });
    expect(await indexOf(storage, second.code)).toBeNull();

    const result = await run(['remake']);
    Object.assign(shared, {
      storage,
      run,
      used: { id: made.id, password: made.password },
      halfDeleted: half.id,
      result,
    });
  }, 600_000);

  it('row 5: a used copy is deleted to zero records, made again, signs in with its partner’s password and holds a new ledger filled to yesterday', async () => {
    const { storage, used, result } = shared;
    const first = copies[0];

    expect(result.status).toBe(0);
    expect(result.err).toEqual([]);
    const index = (await indexOf(storage, first.code))!;
    expect(index.id).not.toBe(used.id);
    expect(await recordCount(storage, used.id)).toEqual({ count: 0, more: false });
    expect(await storage.getRecord(recordKeys.clientDeletion(first.code))).toBeNull();
    expect(await signInStatus(storage, first.code, PASSWORDS[first.partner])).toBe(200);
    expect(await signInStatus(storage, first.code, used.password)).toBe(401);
    const ledger = (await readLedger(storage, index.id))!.ledger;
    expect(ledger.filled).toBe(true);
    expect(ledger.firstDay).toBe(addDays(YESTERDAY, -(HISTORY_DAYS - 1)));
    expect(ledger.lastDay).toBe(YESTERDAY);
    expect(result.out.at(-1)).toMatch(
      /^remake: 6 copies deleted, filled on this Mac and copied whole, \d+\.\d minutes in all$/,
    );
  });

  it('row 6: a copy not on the service is made and filled, the others too', async () => {
    const { storage } = shared;

    for (const copy of copies) {
      const index = (await indexOf(storage, copy.code))!;
      expect(index.name, copy.code).toBe(copy.company);
      const ledger = (await readLedger(storage, index.id))!.ledger;
      expect(ledger.filled, copy.code).toBe(true);
      expect(ledger.lastDay, copy.code).toBe(YESTERDAY);
    }
  });

  it('row 7: an unfinished earlier deletion is finished, then the copy is made', async () => {
    const { storage, halfDeleted } = shared;
    const second = copies[1];

    expect(await recordCount(storage, halfDeleted)).toEqual({ count: 0, more: false });
    expect((await indexOf(storage, second.code))!.id).not.toBe(halfDeleted);
    expect(await signInStatus(storage, second.code, PASSWORDS[second.partner])).toBe(200);
  });

  it('row 8: a partner’s password signs in to that partner’s copies and is refused at the others’', async () => {
    const { storage } = shared;

    for (const copy of copies) {
      for (const partner of PARTNERS) {
        const expected = partner === copy.partner ? 200 : 401;
        expect(
          await signInStatus(storage, copy.code, PASSWORDS[partner]),
          `${copy.code} ${partner}`,
        ).toBe(expected);
      }
    }
  });

  it('row 11: no line holds a typed password, a first password or a hash', async () => {
    const { storage, run, result } = shared;
    const first = copies[0];

    const checked = await run(['remake', '--check'], typed({ ...PASSWORDS, p2: 'Short1!' }));

    const printed = [...result.out, ...result.err, ...checked.out, ...checked.err].join('\n');
    expect(minted.length).toBeGreaterThan(copies.length);
    for (const secret of [...Object.values(PASSWORDS), ...minted, 'Short1!', 'scrypt$']) {
      expect(printed).not.toContain(secret);
    }
    const hash = (
      (await storage.getRecord(
        recordKeys.tenant((await indexOf(storage, first.code))!.id).user(ROOT_NAME),
      ))!.data as { passwordHash: string }
    ).passwordHash;
    expect(printed).not.toContain(hash);
    expect(result.status).toBe(0);
  });

  it('row 7: a deletion of another client under the code, still unfinished, stops the run red, naming the code, and deletes nothing more', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    await storage.putRecord(
      recordKeys.clientDeletion(first.code),
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Another',
        by: '00000000-0000-0000-0000-000000000000',
        startedAt: 1,
      },
      null,
    );
    const before = await recordCount(storage, made.id);

    const result = await run(['remake'], typed(), undefined, false);

    expect(result.status).toBe(1);
    expect(result.err.join('\n')).toContain(
      `error: ${first.code}: ${first.code}: nothing more was deleted`,
    );
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
  }, 600_000);

  it('row 7: a fill that stops on this Mac is refused, status 2, naming each copy, before any delete on the target', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    const before = await recordCount(storage, made.id);

    refuseFills.on = true;
    const result = await run(['remake']).finally(() => {
      refuseFills.on = false;
    });

    expect(result.status).toBe(2);
    expect(result.err).toEqual([
      `error: nothing was deleted on the target: ${copies.map((copy) => `${copy.code}: another run holds it, left`).join('; ')}`,
    ]);
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
  }, 600_000);

  it('row 9: no input at all, or a line with no space in it, is refused before anything is written', async () => {
    const { run } = await ridge();

    for (const argv of [['remake'], ['remake', '--check']]) {
      expect((await run(argv, null)).status).toBe(2);
      expect((await run(argv, 'p1\n')).status).toBe(2);
    }
  });

  // A rival on any other record of the copy meets the copy's own precondition, held by
  // bff/src/records/company-copy.test.ts's "stops on a record changed in the target after its walk".
  it('row 6: a rival that makes the copy’s index first stops that run red, naming the copy', async () => {
    const first = copies[0];
    const { storage, run } = await ridge();
    let done = false;
    const rival: typeof fetch = async (input, init) => {
      if (!done && init?.method === 'POST' && typeof init.body === 'string') {
        const { key } = JSON.parse(init.body) as { key: string };
        if (key === recordKeys.client(first.code)) {
          done = true;
          await storage.putRecord(key, { rival: true }, null);
        }
      }
      return fetch(input, init);
    };

    const result = await run(['remake'], typed(), rival);

    expect(result.status).toBe(1);
    expect(result.err.join('\n')).toContain(`error: ${first.code}: the service still holds it`);
  }, 600_000);

  it('row 9: a bad or missing password is status 2 before any delete, naming the partner and never the password', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    const before = await recordCount(storage, made.id);
    const cases: [string, string][] = [
      ['a password that breaks the rule', typed({ ...PASSWORDS, p2: 'Short1!' })],
      ['a partner missing', `p1 ${PASSWORDS['p1']}\np3 ${PASSWORDS['p3']}\n`],
      ['a partner twice', `${typed()}p1 ${PASSWORDS['p1']}\n`],
      ['a partner outside the mapping', `${typed()}p9 ${PASSWORDS['p1']}\n`],
      ['nothing', ''],
    ];
    for (const [name, stdin] of cases) {
      for (const argv of [['remake'], ['remake', '--check']]) {
        const result = await run(argv, stdin);
        expect(result.status, `${name} ${argv.join(' ')}`).toBe(2);
        expect(result.err.join('\n') + result.out.join('\n'), name).not.toContain('Short1!');
      }
    }
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
    const ok = await run(['remake', '--check']);
    expect(ok.status).toBe(0);
    expect(ok.out).toEqual(['checked: every partner has a password that follows the rule']);
  });

  it('case 5: a store on this Mac that does not start is refused, status 2, before any delete on the target', async () => {
    const { storage, run } = await ridge();
    const first = copies[0];
    const made = await createClient(storage, { code: first.code, name: first.company, madeAt: 1 });
    if (made === 'taken') throw new Error('taken');
    const before = await recordCount(storage, made.id);

    // A folder that cannot be made: a path under a file.
    const result = await run(['remake'], typed(), undefined, true, {
      REMAKE_STORE_DIR: join(dir, 'c-storage', 'store'),
    });

    expect(result.status).toBe(2);
    expect(result.err).toHaveLength(1);
    expect(result.err[0]).toMatch(
      /^error: nothing was deleted on the target, this Mac's store stopped first: /,
    );
    expect((await indexOf(storage, first.code))!.id).toBe(made.id);
    expect(await recordCount(storage, made.id)).toEqual(before);
    expect(await signInStatus(storage, first.code, made.password)).toBe(200);
  });

  it('case 3: --go-on with no store a stopped run filled whole is refused, status 2, asking no password', async () => {
    const { run } = await ridge();
    const empty = await mkdtemp(join(dir, 'no-fill-'));

    const kepts: Record<string, string>[] = [{}, { REMAKE_STORE_DIR: empty }];
    for (const kept of kepts) {
      const result = await run(['remake', '--go-on'], null, undefined, true, kept);
      expect(result.status, JSON.stringify(kept)).toBe(2);
      expect(result.err).toEqual([
        'error: remake --go-on: no store filled whole by a stopped run is kept: run ops/demo-remake.sh ridge whole',
      ]);
    }
  });
});
