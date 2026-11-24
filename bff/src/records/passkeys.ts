import {
  ATTEMPTS,
  CStorageError,
  recordKeys,
  type StoredOwnPasskeys,
  storedOwnPasskeysSchema,
  type StoredPasskey,
} from '@credo/shared';
import type { RecordStore } from './records';

/** A company person's passkeys, one record an owner under the tenant: read with its tag, written
 * over that tag. A record that does not parse is a fault, a 500 that names its kind and never its
 * key, and is never written over. */

export type ReadOwnPasskeys = { record: StoredOwnPasskeys; tag: string };

export async function readOwnPasskeys(
  storage: RecordStore,
  tenantId: string,
  handle: string,
): Promise<ReadOwnPasskeys | null> {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).passkeys(handle));
  if (!found) return null;
  const parsed = storedOwnPasskeysSchema.safeParse(found.data);
  if (!parsed.success) throw new Error('a passkey record does not parse');
  return { record: parsed.data, tag: found.tag };
}

/** Adds `passkey` beside the ones held, over the tag read; a moved tag reads again, {@link ATTEMPTS}
 * times at most, and a passkey found held then is `duplicate`. The first add makes the record. */
export async function addOwnPasskey(
  storage: RecordStore,
  tenantId: string,
  handle: string,
  passkey: StoredPasskey,
): Promise<'added' | 'duplicate'> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const held = await readOwnPasskeys(storage, tenantId, handle);
    if (held?.record.passkeys.some((kept) => kept.id === passkey.id)) return 'duplicate';
    const next: StoredOwnPasskeys = {
      passkeys: [...(held?.record.passkeys ?? []), passkey],
      spent: held?.record.spent ?? [],
    };
    const key = recordKeys.tenant(tenantId).passkeys(handle);
    if ((await storage.putRecord(key, next, held?.tag ?? null)) === 'saved') return 'added';
  }
  throw new CStorageError(412, 'a person’s passkeys moved on every attempt to add one');
}
