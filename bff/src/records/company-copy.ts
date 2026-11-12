import { recordKeys } from '@credo/shared';
import { pagesOf, type TenantStorage } from './records';

/** How many writes of a copy run at once, as the deletion sweep's removals do. */
const COPY_AT_ONCE = 20;
/** The most changes one call of `copyCompany` makes, the deletion sweep's figure for one
 * back-end call. */
export const COPY_BOUND = 200;

type Entry = {
  key: string;
  /** What the source holds, or the target's own text where only the target holds the key. */
  data: unknown;
  /** The target's tag, or none where it holds no such record. */
  held: string | undefined;
  /** `copy` where the target lacks the record or holds other text, `remove` where only the target
   * holds it. */
  change: 'copy' | 'remove' | null;
};

/** Both companies' records in one key order, past `after`, each key once with what to do about it.
 * Reads pages of both, writes nothing. */
async function* walkBoth(from: TenantStorage, to: TenantStorage, after: string | undefined) {
  const prefix = recordKeys.tenant(from.tenantId).all;
  const source = pagesOf(from, prefix, after, 'company');
  const target = pagesOf(to, prefix, after, 'company');
  let a = await source.next();
  let b = await target.next();
  for (;;) {
    const s = a.done ? null : a.value;
    const t = b.done ? null : b.value;
    if (s && (!t || s.key <= t.key)) {
      const same = t !== null && s.key === t.key;
      a = await source.next();
      if (same) b = await target.next();
      yield {
        key: s.key,
        data: s.data,
        held: same ? t.tag : undefined,
        change: same && t.tag === s.tag ? null : 'copy',
      } satisfies Entry;
    } else if (t) {
      b = await target.next();
      yield { key: t.key, data: t.data, held: t.tag, change: 'remove' } satisfies Entry;
    } else {
      return;
    }
  }
}

/** The record's kind, its key past the company's prefix up to the next dot: a key may hold a
 * sign-in name, so a message never carries the key itself. */
const kindOf = (from: TenantStorage, key: string) =>
  key.slice(recordKeys.tenant(from.tenantId).all.length).split('.')[0];

/**
 * Copies one company's records from one box to another, making the target's equal the source's:
 * a record the target lacks or holds in other text is written, one only the target holds is
 * removed, each over the tag the walk read in the target (none for a missing one), so a record
 * that changed there since is never written over: the copy stops, naming its kind. Both are
 * company clients, so neither reaches another company's records, and the source is only read.
 * It makes at most `bound` changes from `after`, and answers the last key it passed as `after`
 * for the call that goes on, and `done` where nothing was left. On a pair already equal it
 * writes nothing.
 */
export async function copyCompany(
  from: TenantStorage,
  to: TenantStorage,
  { after, bound = COPY_BOUND }: { after?: string; bound?: number } = {},
) {
  const batch: Entry[] = [];
  let copied = 0;
  let removed = 0;
  let last = after;
  let done = true;

  const flush = async () => {
    await Promise.all(
      batch.map(async (entry) => {
        const outcome =
          entry.change === 'copy'
            ? await to.putRecord(entry.key, entry.data, entry.held ?? null)
            : await to.removeRecord(entry.key, entry.held);
        if (outcome === 'moved')
          throw new Error(
            `a ${kindOf(from, entry.key)} record changed in the target during the copy`,
          );
      }),
    );
    for (const entry of batch.splice(0)) {
      if (entry.change === 'copy') copied += 1;
      else removed += 1;
    }
  };

  for await (const entry of walkBoth(from, to, after)) {
    if (entry.change) {
      if (copied + removed + batch.length >= bound) {
        done = false;
        break;
      }
      batch.push(entry);
      if (batch.length === COPY_AT_ONCE) await flush();
    }
    last = entry.key;
  }
  await flush();
  return { copied, removed, after: last, done };
}

/** The same walk, writing nothing: how many records the source holds and how many keys differ,
 * a record missing, other, or held only by the target. A move switches a company's index only at
 * `differ` 0. */
export async function compareCompany(from: TenantStorage, to: TenantStorage) {
  let records = 0;
  let differ = 0;
  for await (const entry of walkBoth(from, to, undefined)) {
    if (entry.change !== 'remove') records += 1;
    if (entry.change) differ += 1;
  }
  return { records, differ };
}
