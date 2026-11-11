import { CStorageError, type CStorageClient, recordKeys } from '@credo/shared';
import type { z } from 'zod';

/** The four record calls of a storage client: what the record helpers and the sessions need, and
 * what both the whole client and a company's client offer. */
export type RecordStore = Pick<
  CStorageClient,
  'getRecord' | 'listRecords' | 'putRecord' | 'removeRecord'
>;

/** A company's client: the record calls, each refusing a key outside the company, and the company's
 * id. The whole client has no `tenantId`, so handing it where this is typed is a type error. */
export type TenantStorage = RecordStore & { readonly tenantId: string };

/** The client for one company over a store: every key, and every list's prefix, must start with the
 * company's own prefix (its trailing dot included, so one id that begins another's cannot pass),
 * or the call is a fault of the back end thrown before anything is sent. The message names the
 * call and never the key, which may hold a sign-in name; it is a plain `Error`, so `replyFor`
 * answers 500, never the 503 a `CStorageError` would. */
export function tenantStorage(store: RecordStore, tenantId: string): TenantStorage {
  const own = recordKeys.tenant(tenantId).all;
  const within = (key: string, call: string) => {
    if (!key.startsWith(own)) throw new Error(`${call} outside the company's records`);
  };
  return {
    tenantId,
    getRecord(key) {
      within(key, 'GET a record');
      return store.getRecord(key);
    },
    listRecords(prefix) {
      within(prefix, 'GET a list');
      return store.listRecords(prefix);
    },
    putRecord(key, data, ifTag) {
      within(key, 'POST a record');
      return store.putRecord(key, data, ifTag);
    },
    removeRecord(key, ifTag) {
      within(key, 'DELETE a record');
      return store.removeRecord(key, ifTag);
    },
  };
}

/** A record read under its schema; one that does not parse is a fault naming its kind. */
export function parsed<T>(schema: z.ZodType<T>, kind: string, stored: { data: unknown }) {
  const result = schema.safeParse(stored.data);
  if (!result.success) throw new Error(`${kind} record does not parse`);
  return result.data;
}

/** The reads and writes every record route shares, over one record store. Reader-held: a route
 * module is handed a company's client and no whole one, but nothing but review stops a list written
 * inline again.
 * `every` is the one place a list under a prefix is read: never short, each record parsed. */
export function recordTools(storage: RecordStore) {
  /** Every record under a prefix, never short. */
  async function every<T>(prefix: string, schema: z.ZodType<T>, kind: string) {
    const listed = await storage.listRecords(prefix);
    if (listed.more) throw new Error(`the ${kind} list is longer than c-storage returns`);
    return listed.records.map((stored) => ({
      key: stored.key,
      record: parsed(schema, `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`, stored),
      tag: stored.tag,
    }));
  }

  /** One record written once under its fresh key. The write may have landed while its answer was
   * lost: the record is there, or the failure stands. */
  async function writeNew(key: string, record: unknown) {
    let written: 'saved' | 'moved';
    try {
      written = await storage.putRecord(key, record, null);
    } catch (error) {
      if (!(await storage.getRecord(key))) throw error;
      written = 'saved';
    }
    if (written === 'moved') throw new CStorageError(412, 'a record already sat under a fresh id');
  }

  return { parsed, every, writeNew };
}
