import { randomBytes, randomUUID } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  deviceIdSchema,
  sha256Hex,
  type StoredSession,
  storedSessionSchema,
} from '@credo/shared';
import { constantTimeEqual } from './constant-time';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MS = 7 * DAY_MS;
/** A session in its last three days is renewed on use. The four-day gap bounds the write rate:
 * at the full lifetime every request would write. */
const RENEW_WINDOW_MS = 3 * DAY_MS;
/** How often a write on a moved session is re-read and tried again before giving up. */
const ATTEMPTS = 3;

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
}: {
  storage: CStorageClient;
  now: () => number;
  keyOf: (sessionId: string) => string;
}) {
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
    async issue(device: string, user: string, passwordAt: number) {
      const id = randomUUID();
      const secret = randomBytes(32).toString('base64url');
      const session: StoredSession = {
        secretHash: await sha256Hex(secret),
        user,
        expiresAt: now() + SESSION_MS,
        device,
        passwordAt,
      };
      if ((await storage.putRecord(keyOf(id), session, null)) === 'moved') {
        throw new CStorageError(412, 'a record already sat under a fresh session id');
      }
      return { authId: `${id}.${secret}`, expiresAt: session.expiresAt };
    },

    /** The session a handle names, or null. A session in its last three days is renewed with the
     * tag it was read at; a renewal on a moved session re-reads, and after a few tries the
     * session is answered as it was, still valid, renewed by the next request. */
    async resolve(authId: string): Promise<StoredSession | null> {
      const handle = parseHandle(authId);
      if (!handle) return null;
      const secretHash = await sha256Hex(handle.secret);
      let latest: StoredSession | null = null;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const found = await read(handle.id);
        if (!found || !sameHash(found.session.secretHash, secretHash)) return null;
        if (found.session.expiresAt <= now()) return null;
        latest = found.session;
        if (found.session.expiresAt - now() > RENEW_WINDOW_MS) return latest;
        const renewed = { ...found.session, expiresAt: now() + SESSION_MS };
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
