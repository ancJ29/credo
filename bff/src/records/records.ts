import { CStorageError, type CStorageClient } from '@credo/shared';
import type { z } from 'zod';

/** The reads and writes every record route shares, over one storage client. Reader-held: a route
 * module is handed the whole client, so nothing but review stops a list written inline again.
 * `every` is the one place a list under a prefix is read: never short, each record parsed. */
export function recordTools(storage: CStorageClient) {
  /** A record read under its schema; one that does not parse is a fault naming its kind. */
  function parsed<T>(schema: z.ZodType<T>, kind: string, stored: { data: unknown }) {
    const result = schema.safeParse(stored.data);
    if (!result.success) throw new Error(`${kind} record does not parse`);
    return result.data;
  }

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
