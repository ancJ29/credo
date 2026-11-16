import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import { type CStorageClient, recordKeys } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

let cs: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-move-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  cs = await startCStorage(binary);
});
afterAll(async () => {
  await cs.stop();
  await rm(dir, { recursive: true, force: true });
});

const MARKS = {
  copying: { form: 'copying', to: 'b2', markedAt: 1 },
  sweeping: { form: 'sweeping', box: 'b2', sweepAt: 1, closed: true },
} as const;

/** A service of its own holding the first demo copy's company, its line carrying `mark`, and the
 * terminal's commands run over it. `source` is the same service, handed as the copy-company's
 * source. Everything the commands could write is listed before and after by `everything`. */
async function moving(form: keyof typeof MARKS, code: string = allCopies()[0].code) {
  const tenant = await freshTenant(cs);
  const target = await freshTenant(cs);
  const first = { code, company: allCopies()[0].company };
  const made = await createClient(tenant.client, {
    code: first.code,
    name: first.company,
    madeAt: Date.now(),
  });
  if (made === 'taken') throw new Error('taken');
  const line = await tenant.client.getRecord(recordKeys.client(first.code));
  await tenant.client.putRecord(
    recordKeys.client(first.code),
    { ...(line!.data as object), move: MARKS[form] },
    line!.tag,
  );
  const env = {
    C_STORAGE_URL: tenant.connection.baseUrl,
    INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
    SERVICE_CODE: tenant.serviceCode,
    SERVICE_ACCESS_KEY: tenant.accessKey,
    FROM_C_STORAGE_URL: tenant.connection.baseUrl,
    FROM_INTERNAL_ACCESS_KEY: tenant.connection.internalAccessKey,
    FROM_SERVICE_CODE: tenant.serviceCode,
    FROM_SERVICE_ACCESS_KEY: tenant.accessKey,
  };
  const everything = async (store: CStorageClient) =>
    (
      await Promise.all(
        [recordKeys.clientPrefix, recordKeys.tenant(made.id).all].map((prefix) =>
          store.listRecords(prefix),
        ),
      )
    )
      .flatMap((page) => page.records)
      .map((record) => `${record.key}@${record.tag}`)
      .sort();
  async function run(argv: string[], stdin?: string, over: Record<string, string> = env) {
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(argv, over, {
      out: (text) => lines.out.push(text),
      show: () => undefined,
      err: (text) => lines.err.push(text),
      stdin: () => Promise.resolve(stdin ?? ''),
      now: () => Date.UTC(2026, 9, 30, 6, 0, 0),
    });
    return { status, ...lines };
  }
  /** The same commands over an empty target of their own, the moving company their source. */
  const toTarget = {
    ...env,
    C_STORAGE_URL: target.connection.baseUrl,
    INTERNAL_ACCESS_KEY: target.connection.internalAccessKey,
    SERVICE_CODE: target.serviceCode,
    SERVICE_ACCESS_KEY: target.accessKey,
  };
  return {
    code: first.code,
    store: tenant.client,
    target: target.client,
    run,
    everything,
    toTarget,
  };
}

describe.each(['copying', 'sweeping'] as const)(
  'The terminal refuses a company whose line carries a move (%s) by name, writing nothing',
  (form) => {
    it('case 2: root-password', async () => {
      const t = await moving(form);
      const before = await t.everything(t.store);
      const result = await t.run(['root-password', t.code], 'Invented-New1!\n');
      expect(result.status).toBe(2);
      expect(result.err).toEqual([
        `error: ${t.code}: it is moving to another box, stop or finish the move first`,
      ]);
      expect(await t.everything(t.store)).toEqual(before);
    });

    it('case 2: untenant, a terminal delete', async () => {
      const t = await moving(form, 'check-20261107t095959z');
      const before = await t.everything(t.store);
      const result = await t.run(['untenant', t.code]);
      expect(result.status).toBe(1);
      expect(result.err).toEqual([
        `error: the company ${t.code} is moving to another box: nothing was deleted, stop or finish the move first`,
      ]);
      expect(await t.everything(t.store)).toEqual(before);
    });

    it('case 2: seed', async () => {
      const t = await moving(form);
      const before = await t.everything(t.store);
      const result = await t.run(['seed']);
      expect(result.out).toContain(`${t.code}: it is moving to another box, left, nothing written`);
      expect(await t.everything(t.store)).toEqual(before);
    });

    it('case 2: copy-company and drill-record', async () => {
      const t = await moving(form);
      const before = await t.everything(t.store);
      expect(await t.run(['copy-company', t.code], undefined, t.toTarget)).toMatchObject({
        status: 2,
        err: [
          `error: the source's line for ${t.code} is moving to another box: nothing was written`,
        ],
      });
      expect(await t.run(['drill-record', 'put', t.code])).toMatchObject({
        status: 2,
        err: [`error: ${t.code}'s line is moving to another box: nothing was written`],
      });
      expect(await t.everything(t.store)).toEqual(before);
      expect(await t.target.listRecords(recordKeys.clientPrefix)).toEqual({
        records: [],
        more: false,
      });
    });
  },
);
