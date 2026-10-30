import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import { type CStorageClient, recordKeys, storedClientSchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCopies } from './demo/mapping';
import { readLedger } from './demo/ledger';
import { runRidge } from './ridge';

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-seed-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

/** The morning of the 30th at 06:00 in Vietnam: the seed's yesterday is the 29th. */
const MORNING = Date.UTC(2026, 9, 29, 23, 0, 0);
const copies = allCopies();

/** A service of its own, run through the command as ops/seed.sh runs it: the connection in the
 * environment, the clock set. */
async function ridge(argv: string[], now = MORNING) {
  const tenant = await freshTenant(cs);
  return { storage: tenant.client, run: (args = argv, at = now) => runSeed(tenant, args, at) };
}
async function runSeed(
  tenant: Awaited<ReturnType<typeof freshTenant>>,
  argv: string[],
  now: number,
) {
  const lines = { out: [] as string[], shown: [] as string[], err: [] as string[] };
  const status = await runRidge(
    argv,
    {
      C_STORAGE_URL: tenant.connection.baseUrl,
      INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
      SERVICE_CODE: tenant.serviceCode,
      SERVICE_ACCESS_KEY: tenant.accessKey,
    },
    {
      out: (line) => lines.out.push(line),
      show: (line) => lines.shown.push(line),
      err: (line) => lines.err.push(line),
      now: () => now,
    },
  );
  return { status, ...lines, keys: [tenant.connection.internalAccessKey, tenant.accessKey] };
}
const make = async (storage: CStorageClient, index: number) => {
  const made = await createClient(storage, {
    code: copies[index].code,
    name: copies[index].company,
  });
  if (made === 'taken') throw new Error('taken');
  return made.password;
};
const clientsMade = async (storage: CStorageClient) =>
  (await Promise.all(copies.map((copy) => storage.getRecord(recordKeys.client(copy.code))))).filter(
    (found) => found !== null,
  ).length;

describe('ridge_cli seed', () => {
  it('row 7: on a service with no copy it makes no client, shows no password, and names each mapped code not found', async () => {
    const { storage, run } = await ridge(['seed']);

    const result = await run();

    expect(result.status).toBe(0);
    expect(await clientsMade(storage)).toBe(0);
    expect(result.shown).toEqual([]);
    for (const copy of copies)
      expect(result.out).toContain(`${copy.code}: not on this service, left`);
    expect(result.out.at(-1)).toBe(
      'seed: 6 copies mapped, 0 up to date, 6 not on this service, 0 days applied',
    );
    expect(result.err).toEqual([]);
  });

  it('row 7: it fills a copy the operator made, once, and a second run adds nothing; no key or password is printed', async () => {
    const { storage, run } = await ridge(['seed']);
    const password = await make(storage, 0);

    const first = await run();
    const second = await run();

    expect(first.status).toBe(0);
    expect(first.out.at(-1)).toBe(
      'seed: 6 copies mapped, 1 up to date, 5 not on this service, 7 days applied',
    );
    const id = storedClientSchema.parse(
      (await storage.getRecord(recordKeys.client(copies[0].code)))!.data,
    ).id;
    expect((await readLedger(storage, id))?.ledger).toMatchObject({
      filled: true,
      lastDay: '2026-10-29',
    });
    expect(second.out.at(-1)).toBe(
      'seed: 6 copies mapped, 1 up to date, 5 not on this service, 0 days applied',
    );
    const printed = [...first.out, ...first.err, ...second.out, ...second.err].join('\n');
    expect(printed).not.toContain(password);
    for (const key of first.keys) expect(printed).not.toContain(key);
  });

  it('row 7: a copy it must leave ends the run red after the others are done, naming its code', async () => {
    const { storage, run } = await ridge(['seed']);
    await make(storage, 0);
    await make(storage, 3);
    const id = storedClientSchema.parse(
      (await storage.getRecord(recordKeys.client(copies[0].code)))!.data,
    ).id;
    await storage.putRecord(recordKeys.tenant(id).employee('someone'), { name: 'Ai Đó' }, null);

    const result = await run();

    expect(result.status).toBe(1);
    expect(result.err).toEqual([`error: left as they were, see above: ${copies[0].code}`]);
    expect(result.out).toContain(`${copies[0].code}: holds more than a new client does, left`);
    expect(result.out.at(-1)).toBe(
      'seed: 6 copies mapped, 1 up to date, 4 not on this service, 7 days applied',
    );
  });

  it('row 7: a copy too many days behind ends the run red, naming its code, as a refused one does', async () => {
    const { storage, run } = await ridge(['seed']);
    await make(storage, 0);
    expect((await run()).status).toBe(0);

    const result = await run(['seed'], MORNING + 40 * 24 * 3_600_000);

    expect(result.status).toBe(1);
    expect(result.err).toEqual([`error: left as they were, see above: ${copies[0].code}`]);
    expect(result.out).toContain(`${copies[0].code}: 40 days behind, more than 30, left`);
  });
});
