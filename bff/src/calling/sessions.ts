import { randomBytes, randomUUID } from 'node:crypto';
import {
  ATTEMPTS,
  CStorageError,
  deviceIdSchema,
  sha256Hex,
  type StoredSession,
  storedSessionSchema,
} from '@credo/shared';
import type { RecordStore } from '../records/records';
import { constantTimeEqual } from './constant-time';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MS = 7 * DAY_MS;
/** A session in its last three days is renewed on use. The four-day gap bounds the write rate:
 * at the full lifetime every request would write. */
const RENEW_WINDOW_MS = 3 * DAY_MS;
/** The operator's sessions: an hour from the last use, renewed at most once in five minutes, and
 * never past 12 hours from the issue. */
export const OPERATOR_SESSION = {
  idleMs: 60 * 60 * 1000,
  capMs: 12 * 60 * 60 * 1000,
  gapMs: 5 * 60 * 1000,
};
export type Sliding = typeof OPERATOR_SESSION;

/** A handle is `<session id>.<secret>`: the minted id locates the record, and the 32 random bytes
 * of the secret are the proof. */
function parseHandle(authId: string) {
  const [id, secret, ...rest] = authId.split('.');
  if (!secret || rest.length > 0 || !deviceIdSchema.safeParse(id).success) return null;
  return { id, secret };
}

const sameHash = (a: string, b: string) => constantTimeEqual(Buffer.from(a), Buffer.from(b));

/** The sessions of one realm, under the keys `keyOf` builds from a session id: a tenant's, or the
 * operator's. A handle minted in one realm names no record in another, so it resolves to nothing
 * there. */
export function createSessions({
  storage,
  now,
  keyOf,
  sliding,
}: {
  storage: RecordStore;
  now: () => number;
  keyOf: (sessionId: string) => string;
  /** Present for a realm whose session ends after a time unused and at a cap from its issue;
   * without it a session lasts a week and is renewed in its last three days. */
  sliding?: Sliding;
}) {
  /** Where the end of `session` moves on a use now, or null when it stays. */
  function renewedEnd(session: StoredSession): number | null {
    if (!sliding) {
      return session.expiresAt - now() > RENEW_WINDOW_MS ? null : now() + SESSION_MS;
    }
    const lastRenewal = session.expiresAt - sliding.idleMs;
    if (now() - lastRenewal <= sliding.gapMs) return null;
    const end = Math.min(now() + sliding.idleMs, session.issuedAt + sliding.capMs);
    return end > session.expiresAt ? end : null;
  }

  /** A record that does not parse is no session: it stops resolving, and is left for the sweep nothing calls yet. */
  async function read(id: string) {
    const found = await storage.getRecord(keyOf(id));
    const parsed = found ? storedSessionSchema.safeParse(found.data) : null;
    return found && parsed?.success ? { session: parsed.data, tag: found.tag } : null;
  }

  return {
    /** A new session under a fresh id, which no other session holds: naming a device replaces
     * nothing. The write names no record, so a record found under the fresh id is a fault of the
     * store. */
    async issue(device: string, user: string, generation: string) {
      const id = randomUUID();
      const issuedAt = now();
      const secret = randomBytes(32).toString('base64url');
      const session: StoredSession = {
        secretHash: await sha256Hex(secret),
        user,
        expiresAt: sliding ? issuedAt + sliding.idleMs : issuedAt + SESSION_MS,
        device,
        generation,
        issuedAt,
      };
      if ((await storage.putRecord(keyOf(id), session, null)) === 'moved') {
        throw new CStorageError(412, 'a record already sat under a fresh session id');
      }
      return { authId: `${id}.${secret}`, expiresAt: session.expiresAt };
    },

    /** The session a handle names, or null. A session in its last three days is renewed with the
     * tag it was read at; a renewal on a moved session re-reads, and after a few tries the
     * session is answered as it was, still valid, renewed by the next request. */
    async resolve(authId: string, { renew = true } = {}): Promise<StoredSession | null> {
      const handle = parseHandle(authId);
      if (!handle) return null;
      const secretHash = await sha256Hex(handle.secret);
      let latest: StoredSession | null = null;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const found = await read(handle.id);
        if (!found || !sameHash(found.session.secretHash, secretHash)) return null;
        if (found.session.expiresAt <= now()) return null;
        latest = found.session;
        const end = renew ? renewedEnd(found.session) : null;
        if (end === null) return latest;
        const renewed = { ...found.session, expiresAt: end };
        const saved = await storage.putRecord(keyOf(handle.id), renewed, found.tag);
        if (saved === 'saved') return renewed;
      }
      return latest;
    },

    /** Ends the session this handle names, and no other. A handle that names none, or one a
     * sign-in already ended, ends nothing. */
    async end(authId: string) {
      const handle = parseHandle(authId);
      if (!handle) return;
      const secretHash = await sha256Hex(handle.secret);
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const found = await read(handle.id);
        if (!found || !sameHash(found.session.secretHash, secretHash)) return;
        const removed = await storage.removeRecord(keyOf(handle.id), found.tag);
        if (removed === 'removed') return;
      }
      throw new CStorageError(412, 'the session moved on every attempt to end it');
    },
  };
}
