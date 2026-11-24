import {
  ATTEMPTS,
  CStorageError,
  recordKeys,
  type StoredOwnPasskeys,
  storedOwnPasskeysSchema,
  type StoredPasskey,
} from '@credo/shared';
import { CHALLENGE_MS } from '../calling/challenge';
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

/** What a spend reads of the passkeys a person holds: the passkey the answer names, and whether the
 * challenge was answered before. */
export type SpendCheck = (passkey: StoredPasskey) => Promise<number | null>;

/** A passkey's answer to a challenge, taken once: the passkey the answer names is found, `check`
 * (the library's verdict, the counter it moves on to) is asked, and the counter, the last use and
 * the challenge's spend are written in one write over the tag read. A moved tag reads again, so a
 * replay that lost the race finds its challenge spent; {@link ATTEMPTS} times at most. Returns
 * `refused` for no record, no such passkey, a challenge already spent or an answer the library
 * refuses, and says no more. */
export async function spendOwnPasskey(
  storage: RecordStore,
  tenantId: string,
  handle: string,
  passkeyId: string,
  spentHash: string,
  now: () => number,
  check: SpendCheck,
): Promise<'spent' | 'refused'> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const held = await readOwnPasskeys(storage, tenantId, handle);
    const passkey = held?.record.passkeys.find((candidate) => candidate.id === passkeyId);
    if (!held || !passkey) return 'refused';
    if (held.record.spent.some((spent) => spent.hash === spentHash)) return 'refused';
    const counter = await check(passkey);
    if (counter === null) return 'refused';
    const next: StoredOwnPasskeys = {
      passkeys: held.record.passkeys.map((candidate) =>
        candidate === passkey ? { ...candidate, counter, lastUsedAt: now() } : candidate,
      ),
      spent: [
        ...held.record.spent.filter((spent) => spent.at > now() - CHALLENGE_MS),
        { hash: spentHash, at: now() },
      ],
    };
    const key = recordKeys.tenant(tenantId).passkeys(handle);
    if ((await storage.putRecord(key, next, held.tag)) === 'saved') return 'spent';
  }
  throw new CStorageError(412, 'a person’s passkeys moved on every attempt to sign in');
}
