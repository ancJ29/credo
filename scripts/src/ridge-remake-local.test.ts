import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCStorage } from '@credo/bff/tests/build';
import { buildApp } from '@credo/bff';
import { ROOT_NAME } from '@credo/bff/clients';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import {
  CLIENT_HEADER,
  type CStorageClient,
  DEVICE_HEADER,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HISTORY_DAYS } from './demo/apply';
import { addDays } from './demo/days';
import { readLedger } from './demo/ledger';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

/** The target: a c-storage of the test's own. The remake starts the other, its local store. */
let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-remake-local-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const copies = allCopies();
/** Invented, one for each partner, and obeying the password rule. */
const TYPED = 'p1 Invented-One1!\np2 Invented-Two2@\np3 Invented-Three3$\n';
/** The morning of the 30th at 06:00 in Vietnam: yesterday is the 29th. */
const MORNING = Date.UTC(2026, 9, 29, 23, 0, 0);
const YESTERDAY = '2026-10-29';

/** The target's index of a copy, or null when the copy is not reachable there. */
const indexOf = async (storage: CStorageClient, code: string) => {
  const held = await storage.getRecord(recordKeys.client(code));
  return held ? storedClientSchema.parse(held.data) : null;
};

/** The product's sign-in on the target, as a root's browser calls it. */
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
    headers: { [CLIENT_HEADER]: code, [DEVICE_HEADER]: 'device-test-0001' },
    payload: { name: ROOT_NAME, password },
  });
  return reply.statusCode;
}

/** The numbers a copy's compare line gives, `before` or `after` the copy. */
function compared(out: string[], code: string, when: 'before' | 'after') {
  const found = out
    .map((line) =>
      new RegExp(
        `^${code} ${when}: the source holds (\\d+) records, (\\d+) differ on the target$`,
      ).exec(line),
    )
    .filter((match) => match !== null);
  expect(found, `${code} ${when}`).toHaveLength(1);
  return { records: Number(found[0][1]), differ: Number(found[0][2]) };
}

/** Every record under the prefix, page after page. */
async function countUnder(storage: CStorageClient, prefix: string) {
  let count = 0;
  let after: string | undefined;
  for (;;) {
    const page = await storage.listRecords(prefix, after);
    count += page.records.length;
    if (!page.more) return count;
    after = page.records.at(-1)!.key;
  }
}

describe('ridge_cli remake, filled on a store of this Mac’s own', () => {
  it('case 1: a remake fills every copy on the local store and leaves the target’s copy equal to it, the compare at zero', async () => {
    const tenant = await freshTenant(cs);
    const target = tenant.client;
    const out: string[] = [];
    const err: string[] = [];

    const status = await runRidge(
      ['remake'],
      {
        C_STORAGE_URL: tenant.connection.baseUrl,
        INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
        SERVICE_CODE: tenant.serviceCode,
        SERVICE_ACCESS_KEY: tenant.accessKey,
      },
      {
        out: (line) => out.push(line),
        show: () => {
          throw new Error('remake shows nothing on the terminal');
        },
        err: (line) => err.push(line),
        now: () => MORNING,
        stdin: () => Promise.resolve(TYPED),
      },
    );

    expect(err).toEqual([]);
    expect(status).toBe(0);
    for (const copy of copies) {
      const after = out
        .map((line) =>
          new RegExp(
            `^${copy.code} after: the source holds (\\d+) records, (\\d+) differ on the target$`,
          ).exec(line),
        )
        .filter((found) => found !== null);
      expect(after, copy.code).toHaveLength(1);
      const [, records, differ] = after[0];
      expect(differ, copy.code).toBe('0');
      const index = storedClientSchema.parse(
        (await target.getRecord(recordKeys.client(copy.code)))!.data,
      );
      expect(index.name, copy.code).toBe(copy.company);
      expect(await countUnder(target, recordKeys.tenant(index.id).all), copy.code).toBe(
        Number(records),
      );
      const { ledger } = (await readLedger(target, index.id))!;
      expect(ledger.filled, copy.code).toBe(true);
      expect(ledger.firstDay, copy.code).toBe(addDays(YESTERDAY, -(HISTORY_DAYS - 1)));
      expect(ledger.lastDay, copy.code).toBe(YESTERDAY);
    }
    expect(out).toContainEqual(
      expect.stringMatching(
        /^remake: this Mac's store built and the 6 copies filled on it, \d+\.\d minutes$/,
      ),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/^remake: the deletes \d+\.\d minutes, the copies \d+\.\d minutes$/),
    );
    expect(out.at(-1)).toMatch(
      /^remake: 6 copies deleted, filled on this Mac and copied whole, \d+\.\d minutes in all$/,
    );
  }, 600_000);
});

describe('ridge_cli remake, stopped mid-copy and gone on with', () => {
  /** A run cut after this many writes on the target: the first copy whole (843 records and its
   * index), and the second about half. */
  const CUT = 1_250;
  const PASSWORDS: Record<string, string> = Object.fromEntries(
    TYPED.trim()
      .split('\n')
      .map((line) => line.split(' ') as [string, string]),
  );
  const state = {} as {
    target: CStorageClient;
    env: Record<string, string>;
    kept: string;
    stopped: { status: number; out: string[]; err: string[] };
  };
  async function run(argv: string[], stdin: string | null, fetch: typeof globalThis.fetch) {
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(argv, state.env, {
      out: (line) => lines.out.push(line),
      show: () => {
        throw new Error('remake shows nothing on the terminal');
      },
      err: (line) => lines.err.push(line),
      fetch,
      now: () => MORNING,
      stdin: stdin === null ? undefined : () => Promise.resolve(stdin),
    });
    return { status, ...lines };
  }
  beforeAll(async () => {
    const tenant = await freshTenant(cs);
    state.target = tenant.client;
    state.kept = join(dir, 'kept-store');
    state.env = {
      C_STORAGE_URL: tenant.connection.baseUrl,
      INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
      SERVICE_CODE: tenant.serviceCode,
      SERVICE_ACCESS_KEY: tenant.accessKey,
      REMAKE_STORE_DIR: state.kept,
    };
    let writes = 0;
    // The tunnel gone after CUT writes: every later call on the target fails as a dropped one does.
    const cut: typeof fetch = (input, init) => {
      if (init?.method === 'POST') writes += 1;
      return writes > CUT ? Promise.reject(new TypeError('fetch failed')) : fetch(input, init);
    };
    state.stopped = await run(['remake'], TYPED, cut);
  }, 600_000);

  it('case 2: the target’s index for a copy is written only once its compare reads zero, so a half-copied company is never reachable', async () => {
    const { target, stopped, kept } = state;
    const [first, second] = copies;

    expect(stopped.status).toBe(1);
    expect(stopped.err).toHaveLength(1);
    expect(stopped.err[0]).toMatch(new RegExp(`^error: ${second.code}: `));
    expect(stopped.out).toContain(`${second.code}: 200 written, 0 removed`);
    expect((await indexOf(target, first.code))?.name).toBe(first.company);
    expect(await indexOf(target, second.code)).toBeNull();
    expect(await signInStatus(target, second.code, PASSWORDS[second.partner])).not.toBe(200);
    expect(existsSync(join(kept, 'filled'))).toBe(true);
  });

  it('case 3: a remake stopped mid-copy, run again with --go-on, writes only what differs and ends equal', async () => {
    const { kept } = state;
    const [first, second] = copies;
    let writes = 0;
    const counting: typeof fetch = (input, init) => {
      if (init?.method === 'POST') writes += 1;
      return fetch(input, init);
    };

    const goOn = await run(['remake', '--go-on'], null, counting);

    expect(goOn.err).toEqual([]);
    expect(goOn.status).toBe(0);
    expect(goOn.out).toContain(`${first.code}: copied whole by the stopped run, not deleted`);
    expect(goOn.out).toContain(`${first.code}: 0 written, 0 removed`);
    const before = copies.map((copy) => compared(goOn.out, copy.code, 'before'));
    expect(before[0].differ).toBe(0);
    expect(before[1].differ).toBeGreaterThan(0);
    expect(before[1].differ).toBeLessThan(before[1].records);
    for (const copy of copies) expect(compared(goOn.out, copy.code, 'after').differ).toBe(0);
    // Each record that differed, and the index of each copy the stopped run had not finished.
    const differed = before.reduce((sum, one) => sum + one.differ, 0);
    expect(writes).toBe(differed + copies.length - 1);
    expect(goOn.out).not.toContain(`${second.code}: copied whole by the stopped run, not deleted`);
    expect(existsSync(kept)).toBe(false);
  }, 600_000);

  it('case 4: each copy’s root signs in on the target with its partner’s password after the remake', async () => {
    const { target } = state;

    for (const copy of copies) {
      for (const [partner, password] of Object.entries(PASSWORDS)) {
        expect(await signInStatus(target, copy.code, password), `${copy.code} ${partner}`).toBe(
          partner === copy.partner ? 200 : 401,
        );
      }
    }
  });
});
