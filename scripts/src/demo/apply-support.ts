/** What the files that split `apply.test.ts` share: the c-storage and the readers over it. */
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
  CStorageError,
  type CStorageClient,
  DEVICE_HEADER,
  employeeSchema,
  recordKeys,
  ROUTES,
  storedClientSchema,
} from '@credo/shared';
import { afterAll, beforeAll } from 'vitest';
import { addDays } from './days';
import { allCopies, type MappedCopy } from './mapping';
import { ANCHOR, dayEvents, staffAsOf } from './staff';

let cs: RunningCStorage;
let dir: string;

/** One c-storage for the file that calls this, started before its tests and stopped after them. */
export function useCStorage() {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'credo-apply-test-'));
    const binary = join(dir, 'c-storage');
    await buildCStorage(binary);
    cs = await startCStorage(binary);
  });
  afterAll(async () => {
    await cs.stop();
    await rm(dir, { recursive: true, force: true });
  });
}

const copyOf = (code: string) => allCopies().find((copy) => copy.code === code)!;
export const A1 = copyOf('vat-lieu-quang-tin-dat-1');
export const A2 = copyOf('vat-lieu-quang-tin-dat-2');
export const B1 = copyOf('phan-phoi-loc-vuong-hai-1');

/** A service of its own on the real c-storage, so no test meets another's records. */
export const fresh = async () => (await freshTenant(cs)).client;
export const make = async (storage: CStorageClient, copy: MappedCopy) => {
  const made = await createClient(storage, {
    code: copy.code,
    name: copy.company,
    madeAt: Date.now(),
  });
  if (made === 'taken') throw new Error('taken');
  return made;
};
export const tenantOf = async (storage: CStorageClient, code: string) =>
  storedClientSchema.parse((await storage.getRecord(recordKeys.client(code)))!.data).id;
export const staffOf = async (storage: CStorageClient, code: string) => {
  const listed = await storage.listRecords(
    recordKeys.tenant(await tenantOf(storage, code)).employeePrefix,
  );
  return listed.records
    .map((record) => employeeSchema.parse(record.data))
    .sort((a, b) => (a.code < b.code ? -1 : 1));
};
/** Every record of a company, page after page: c-storage answers a prefix in pages, and one page
 * of a whole company is short once it holds more than a page. */
export const everything = async (storage: CStorageClient, code: string) => {
  const prefix = recordKeys.tenant(await tenantOf(storage, code)).all;
  const all: Awaited<ReturnType<CStorageClient['listRecords']>>['records'] = [];
  for (let more = true; more;) {
    const page = await storage.listRecords(prefix, all.at(-1)?.key);
    all.push(...page.records);
    more = page.more && page.records.length > 0;
  }
  return all;
};
export const standing = (copy: MappedCopy, today: string) =>
  staffAsOf(copy.client, copy.scenario, today)
    .map((p) => [p.code, p.name, p.archived])
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
export const read = (people: Awaited<ReturnType<typeof staffOf>>) =>
  people.map((p) => [p.code, p.name, p.archived]);

/** The first day from `from` on that has an event of this kind for the copy. */
export function firstEvent(copy: MappedCopy, kind: 'hire' | 'leave', from = addDays(ANCHOR, 12)) {
  for (let day = from; ; day = addDays(day, 1)) {
    const event = dayEvents(copy.client, copy.scenario, day).find((e) => e.kind === kind);
    if (event) return { day, event };
  }
}

/** The storage with a hook before a write or a read, for the test to move or break a record. */
export function hooked(
  storage: CStorageClient,
  hooks: {
    beforePut?: (key: string, data: unknown, ifTag?: string | null) => Promise<void>;
    beforeGet?: (key: string) => void;
  },
): CStorageClient {
  return {
    ...storage,
    getRecord: (key) => {
      hooks.beforeGet?.(key);
      return storage.getRecord(key);
    },
    putRecord: async (key, data, ifTag) => {
      await hooks.beforePut?.(key, data, ifTag);
      return await storage.putRecord(key, data, ifTag);
    },
  };
}
export const down = () => new CStorageError(null, 'c-storage did not answer');

/** The copy's root as its users would be: signed in through the BFF with the first password. */
export async function asRoot(storage: CStorageClient, code: string, password: string) {
  const app = buildApp({
    storage,
    now: () => Date.now(),
    origin: 'http://localhost',
    serviceKey: 'a-key',
    logger: false,
  });
  const headers = { [CLIENT_HEADER]: code, [DEVICE_HEADER]: 'device-users-0001' };
  const signed = await app.inject({
    method: 'POST',
    url: ROUTES.signIn,
    headers,
    payload: { name: ROOT_NAME, password },
  });
  const auth = { ...headers, [AUTH_HEADER]: signed.json<{ authId: string }>().authId };
  return (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, headers: auth, payload });
}

export const TODAY = '2026-10-29';
