import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import { type CStorageClient, recordKeys, storedClientSchema } from '@credo/shared';
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
