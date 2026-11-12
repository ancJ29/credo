import { createHmac, hkdfSync } from 'node:crypto';
import {
  ATTEMPTS,
  CStorageError,
  recordKeys,
  storedSignInWaitSchema,
  waitAfter,
} from '@credo/shared';
import { parsed, type TenantStorage } from './records';

/** The key a wait's name is hashed under, derived from the BFF's own service key with a purpose
 * of its own, so it is not the key the operator's challenges are signed under. c-storage keeps the
 * service key only as a SHA-256, so a copy of the store's data holds neither it nor this. */
export const waitKeyFrom = (serviceKey: string) =>
  Buffer.from(hkdfSync('sha256', serviceKey, '', 'credo sign-in wait', 32));

/** A sign-in name's wait. The key holds the name's HMAC-SHA-256 under {@link waitKeyFrom}'s key,
 * never the name. A name nobody holds is often a password typed into the wrong box, and a bare
 * hash of one is reversed by a dictionary run; this one is not, by whoever holds the store's data
 * without the BFF's service key. It does not hide the name from the BFF itself, nor from whoever
 * holds that key as well (the box's root-only environment file). */
const keyOf = (storage: TenantStorage, waitKey: Buffer, name: string) =>
  recordKeys
    .tenant(storage.tenantId)
    .signInWait(createHmac('sha256', waitKey).update(name).digest('hex'));

/** What a try starts as: refused for `waitSeconds` more, unread; or counted as the name's `wrong`th
 * wrong try in a row, to be cleared if its password is right. */
export type Counted = { refused: number } | { wrong: number };

/**
 * Counts a try before its password is checked, so a burst sent at once cannot all be checked
 * before any count lands. A wait still running refuses the try and writes nothing, so it does not
 * lengthen it. Otherwise the count is written over the record's tag (none for a first try), read
 * again on a moved one, {@link ATTEMPTS} times, then a 503 with no password checked. The wait the
 * count starts begins now.
 */
export async function countTry(
  storage: TenantStorage,
  waitKey: Buffer,
  name: string,
  now: () => number,
): Promise<Counted> {
  const key = keyOf(storage, waitKey, name);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const found = await storage.getRecord(key);
    const held = found ? parsed(storedSignInWaitSchema, 'a sign-in wait', found) : null;
    const at = now();
    if (held && held.until > at) return { refused: Math.ceil((held.until - at) / 1000) };
    const wrong = (held?.wrong ?? 0) + 1;
    const next = { wrong, until: at + waitAfter(wrong) * 1000 };
    if ((await storage.putRecord(key, next, found?.tag ?? null)) === 'saved') return { wrong };
  }
  throw new CStorageError(412, 'the sign-in wait record moved on every attempt to write it');
}

/** A right password: the name's count is removed, whatever its tag. */
export async function clearWait(
  storage: TenantStorage,
  waitKey: Buffer,
  name: string,
): Promise<void> {
  await storage.removeRecord(keyOf(storage, waitKey, name));
}
