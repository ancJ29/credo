import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@credo/bff/clients';
import { buildCStorage } from '@credo/bff/tests/build';
import { freshTenant, type RunningCStorage, startCStorage } from '@credo/bff/tests/c-storage';
import { recordKeys, type CStorageClient } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allCopies } from './demo/mapping';
import { runRidge } from './ridge';

let from: RunningCStorage;
let to: RunningCStorage;
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-ridge-copy-test-'));
  const binary = join(dir, 'c-storage');
  await buildCStorage(binary);
  from = await startCStorage(binary);
  to = await startCStorage(binary);
});
afterAll(async () => {
  await from.stop();
  await to.stop();
  await rm(dir, { recursive: true, force: true });
});

type Tenant = Awaited<ReturnType<typeof freshTenant>>;
type Fetch = typeof fetch;

const addressOf = (input: Parameters<Fetch>[0]) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** The connection as ops/company-restore.sh gives it: the target's four variables as they are, the
 * source's four under `FROM_`. */
const envOf = (source: Tenant, target: Tenant) => ({
  C_STORAGE_URL: target.connection.baseUrl,
  INTERNAL_ACCESS_KEY: target.connection.internalAccessKey,
  SERVICE_CODE: target.serviceCode,
  SERVICE_ACCESS_KEY: target.accessKey,
  FROM_C_STORAGE_URL: source.connection.baseUrl,
  FROM_INTERNAL_ACCESS_KEY: source.connection.internalAccessKey,
  FROM_SERVICE_CODE: source.serviceCode,
  FROM_SERVICE_ACCESS_KEY: source.accessKey,
});

/** Two stores, each with a service of its own, and the command run over them. `writes` lists every
 * POST and DELETE that reached the target, `fetch` standing between the command and both stores. */
async function pair() {
  const source = await freshTenant(from);
  const target = await freshTenant(to);
  const writes: string[] = [];
  const base: Fetch = (input, init) => {
    const method = init?.method ?? 'GET';
    if ((method === 'POST' || method === 'DELETE') && addressOf(input).startsWith(to.baseUrl))
      writes.push(`${method} ${addressOf(input)}`);
    return fetch(input, init);
  };
  async function run(
    argv: string[],
    options: { env?: Record<string, string>; fetch?: Fetch } = {},
  ) {
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(argv, options.env ?? envOf(source, target), {
      out: (line) => lines.out.push(line),
      show: () => {
        throw new Error('copy-company shows nothing on the terminal');
      },
      err: (line) => lines.err.push(line),
      fetch: options.fetch ?? base,
    });
    return { status, ...lines };
  }
  return { source, target, writes, run, base };
}

/** A company on the source made as the operator's create makes it, with `customers` customers. */
async function company(store: CStorageClient, code: string, customers: number) {
  const made = await createClient(store, { code, name: code, madeAt: Date.now() });
  if (made === 'taken') throw new Error('taken');
  const keys = recordKeys.tenant(made.id);
  const writes = Array.from({ length: customers }, (_, i) => {
    const n = String(i).padStart(4, '0');
    return () => store.putRecord(keys.customer(`c${n}`), { id: `c${n}`, name: `Khách ${n}` });
  });
  for (let at = 0; at < writes.length; at += 50)
    await Promise.all(writes.slice(at, at + 50).map((write) => write()));
  return { id: made.id, keys };
}

/** Every record of a company with its tag, in key order. */
async function held(store: CStorageClient, id: string) {
  const all: string[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.listRecords(recordKeys.tenant(id).all, after);
    all.push(...page.records.map((r) => `${r.key}@${r.tag}`));
    if (!page.more) return all;
    after = page.records[page.records.length - 1].key;
  }
}

describe('ridge copy-company', () => {
  it('copies one company, prints it before and after, and leaves a neighbour on the target as it was', async () => {
    const { source, target, writes, run } = await pair();
    const one = await company(source.client, 'copy-one', 420);
    // A company on the target whose id begins with the copied one's.
    const near = `${one.id}x`;
    await target.client.putRecord(recordKeys.tenant(near).customer('c0'), { id: 'c0' });
    const nearBefore = await held(target.client, near);

    const done = await run(['copy-company', 'copy-one']);
    expect(done.err).toEqual([]);
    expect(done.status).toBe(0);
    expect(done.out).toEqual([
      'copy-one before: the source holds 422 records, 422 differ on the target',
      'copy-one: 200 written, 0 removed',
      'copy-one: 200 written, 0 removed',
      'copy-one: 22 written, 0 removed',
      'copy-one after: the source holds 422 records, 0 differ on the target',
    ]);
    expect(await held(target.client, one.id)).toEqual(await held(source.client, one.id));
    expect(await held(target.client, near)).toEqual(nearBefore);

    // Run again, the target holds all of it and nothing is written.
    writes.length = 0;
    const again = await run(['copy-company', 'copy-one']);
    expect(again.status).toBe(0);
    expect(again.out).toEqual([
      'copy-one before: the source holds 422 records, 0 differ on the target',
      'copy-one: 0 written, 0 removed',
      'copy-one after: the source holds 422 records, 0 differ on the target',
    ]);
    expect(writes).toEqual([]);
  }, 120_000);

  it('takes the code as the product does, and refuses a target that names the code under another id', async () => {
    const { source, target, run } = await pair();
    const one = await company(source.client, 'copy-case', 3);
    // The target's index names the same company: the copy goes on, however the code was typed.
    const index = await source.client.getRecord(recordKeys.client('copy-case'));
    await target.client.putRecord(recordKeys.client('copy-case'), index!.data);
    const typed = await run(['copy-company', ' Copy-Case ']);
    expect(typed.err).toEqual([]);
    expect(typed.status).toBe(0);
    expect(typed.out.at(-1)).toBe(
      'copy-case after: the source holds 5 records, 0 differ on the target',
    );
    expect(await held(target.client, one.id)).toEqual(await held(source.client, one.id));

    // A target remade since: the code names another company there, and nothing is written.
    const remade = await pair();
    const two = await company(remade.source.client, 'copy-remade', 3);
    await company(remade.target.client, 'copy-remade', 2);
    const refused = await remade.run(['copy-company', 'copy-remade']);
    expect(refused).toEqual({
      status: 2,
      out: [],
      err: ['error: the target names copy-remade under another company id: nothing was written'],
    });
    expect(remade.writes).toEqual([]);
    expect(await held(remade.target.client, two.id)).toEqual([]);
  });

  it('refuses a code the source has no company for, before anything is written', async () => {
    const { writes, run } = await pair();
    const refused = await run(['copy-company', 'no-such']);
    expect(refused).toEqual({
      status: 2,
      out: [],
      err: ['error: the source holds no company with the code no-such'],
    });
    expect(writes).toEqual([]);
  });

  it('refuses a missing code, a bad one and a second argument, and the same service twice', async () => {
    const { source, target, writes, run } = await pair();
    for (const argv of [
      ['copy-company'],
      ['copy-company', 'Bad Code'],
      ['copy-company', 'a-b', 'c-d'],
    ]) {
      const refused = await run(argv);
      expect(refused.status).toBe(2);
      expect(refused.err[0]).toMatch(/^error: usage: register /);
    }
    const same = await run(['copy-company', 'a-b'], { env: envOf(target, target) });
    expect(same).toEqual({
      status: 2,
      out: [],
      err: ['error: the source and the target are the same service'],
    });
    const mixed = envOf(source, target);
    delete (mixed as Record<string, string>)['FROM_C_STORAGE_URL'];
    const lacking = await run(['copy-company', 'a-b'], { env: mixed });
    expect(lacking.status).toBe(1);
    expect(writes).toEqual([]);
  });

  it('ends red when the target still differs after the copy', async () => {
    const { source, base, run } = await pair();
    await company(source.client, 'copy-two', 3);
    // The target answers saved to one write and keeps nothing.
    let dropped = false;
    const dropping: Fetch = (input, init) => {
      if (init?.method === 'POST' && addressOf(input).startsWith(to.baseUrl) && !dropped) {
        dropped = true;
        return Promise.resolve(new Response('{}', { status: 201 }));
      }
      return base(input, init);
    };
    const red = await run(['copy-company', 'copy-two'], { fetch: dropping });
    expect(red.status).toBe(1);
    expect(red.err).toEqual(['error: copy-two: the target differs after the copy']);
    expect(red.out.at(-1)).toBe(
      'copy-two after: the source holds 5 records, 1 differ on the target',
    );
  });

  it('checks a demo copy without a connection, naming the neighbour the drill writes beside', async () => {
    const { run } = await pair();
    const [first, second] = allCopies();
    const none = {};
    const lines = { out: [] as string[], err: [] as string[] };
    const status = await runRidge(['copy-company', '--check', first.code], none, {
      out: (line) => lines.out.push(line),
      show: () => undefined,
      err: (line) => lines.err.push(line),
    });
    expect({ status, ...lines }).toEqual({
      status: 0,
      out: [`checked: ${first.code} is a demo copy, ${second.code} is its neighbour for the drill`],
      err: [],
    });
    const foreign = await run(['copy-company', '--check', 'some-real-client']);
    expect(foreign).toEqual({
      status: 2,
      out: [],
      err: ['error: some-real-client is not one of the demo copies'],
    });
    for (const argv of [
      ['copy-company', '--check'],
      ['copy-company', '--check', first.code, second.code],
    ]) {
      expect((await run(argv)).status).toBe(2);
    }
  });

  it('writes, finds and removes the drill record of a demo copy, and nothing of any other', async () => {
    const { target, run } = await pair();
    const [first] = allCopies();
    const made = await createClient(target.client, {
      code: first.code,
      name: first.company,
      madeAt: Date.now(),
    });
    if (made === 'taken') throw new Error('taken');
    // The drill's run reads and writes the target alone: the source variables are not asked for.
    const env = { ...envOf(target, target) };
    const drill = async (what: string, code = first.code) =>
      run(['drill-record', what, code], { env });
    expect((await drill('has')).out).toEqual(['no']);
    expect(await drill('put')).toMatchObject({ status: 0, out: [`put ${first.code}`] });
    expect((await drill('has')).out).toEqual(['yes']);
    expect(await held(target.client, made.id)).toContainEqual(
      expect.stringContaining(`${recordKeys.tenant(made.id).all}drill-restore@`),
    );
    expect(await drill('remove')).toMatchObject({ status: 0, out: [`remove ${first.code}`] });
    expect((await drill('has')).out).toEqual(['no']);
    expect(await drill('has', 'some-real-client')).toMatchObject({
      status: 2,
      err: ['error: some-real-client is not one of the demo copies'],
    });
    expect(await drill('has', allCopies()[1].code)).toMatchObject({
      status: 2,
      err: [`error: ${allCopies()[1].code} is not on this service`],
    });
    expect((await drill('sleep')).status).toBe(2);
    expect((await run(['drill-record', 'has'], { env })).status).toBe(2);
    expect((await run(['drill-record'], { env })).status).toBe(2);
    expect((await run(['drill-record', 'has', first.code, 'x'], { env })).status).toBe(2);
  });
});
