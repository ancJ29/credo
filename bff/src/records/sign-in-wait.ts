import {
  ATTEMPTS,
  CStorageError,
  recordKeys,
  sha256Hex,
  storedSignInWaitSchema,
  waitAfter,
} from '@credo/shared';
import { parsed, type TenantStorage } from './records';

/** A sign-in name's wait. The key holds the name's SHA-256, never the name. */
const keyOf = async (storage: TenantStorage, name: string) =>
  recordKeys.tenant(storage.tenantId).signInWait(await sha256Hex(name));

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
  name: string,
  now: () => number,
): Promise<Counted> {
  const key = await keyOf(storage, name);
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
export async function clearWait(storage: TenantStorage, name: string): Promise<void> {
  await storage.removeRecord(await keyOf(storage, name));
}
