import { randomBytes } from 'node:crypto';
import {
  CStorageError,
  type CStorageClient,
  deviceIdSchema,
  recordKeys,
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

/** A handle is `<device id>.<secret>`: the device id locates the record, and the 32 random bytes
 * of the secret are the proof. */
function parseHandle(authId: string) {
  const [device, secret, ...rest] = authId.split('.');
  if (!secret || rest.length > 0 || !deviceIdSchema.safeParse(device).success) return null;
  return { device, secret };
}

const sameHash = (a: string, b: string) => constantTimeEqual(Buffer.from(a), Buffer.from(b));

export function createSessions({ storage, now }: { storage: CStorageClient; now: () => number }) {
  /** A record that does not parse is no session: the next sign-in on that device replaces it. */
  async function read(device: string) {
    const found = await storage.getRecord(recordKeys.session(device));
    const parsed = found ? storedSessionSchema.safeParse(found.data) : null;
    return found && parsed?.success ? { session: parsed.data, tag: found.tag } : null;
  }

  return {
    /** Signing in again on a device replaces its session, whatever it held: the old handle stops
     * resolving. The one deliberate blind write; every other write names the tag it read. */
    async issue(device: string, user: string) {
      const secret = randomBytes(32).toString('base64url');
      const session: StoredSession = {
        secretHash: await sha256Hex(secret),
        user,
        expiresAt: now() + SESSION_MS,
      };
      await storage.putRecord(recordKeys.session(device), session);
      return { authId: `${device}.${secret}`, expiresAt: session.expiresAt };
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
        const found = await read(handle.device);
        if (!found || !sameHash(found.session.secretHash, secretHash)) return null;
        if (found.session.expiresAt <= now()) return null;
        latest = found.session;
        if (found.session.expiresAt - now() > RENEW_WINDOW_MS) return latest;
        const renewed = { ...found.session, expiresAt: now() + SESSION_MS };
        const saved = await storage.putRecord(
          recordKeys.session(handle.device),
          renewed,
          found.tag,
        );
        if (saved === 'saved') return renewed;
      }
      return latest;
    },

    /** Ends the session this handle names, on its device only. A handle that names none, or was
     * replaced by a later sign-in, ends nothing. */
    async end(authId: string) {
      const handle = parseHandle(authId);
      if (!handle) return;
      const secretHash = await sha256Hex(handle.secret);
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const found = await read(handle.device);
        if (!found || !sameHash(found.session.secretHash, secretHash)) return;
        const removed = await storage.removeRecord(recordKeys.session(handle.device), found.tag);
        if (removed === 'removed') return;
      }
      throw new CStorageError(412, 'the session moved on every attempt to end it');
    },
  };
}
