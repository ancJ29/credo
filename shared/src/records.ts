import { z } from 'zod';

/** What the BFF's one c-storage service holds, and under which keys. The tenant is the
 * deployment, so no key carries a client code. */
export const recordKeys = {
  config: 'config',
  user: (name: string) => `user.${name}`,
  session: (deviceId: string) => `session.${deviceId}`,
} as const;

/** A sign-in name as a user record is keyed by it: the same name typed in any case or with
 * spaces around it is one user. */
export const normaliseSignInName = (raw: string) => raw.normalize('NFC').trim().toLowerCase();

/** The UI mints a device id once and keeps it; it names the session record, so it holds no dot,
 * which splits it from the secret in the handle. */
export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const storedUserSchema = z.strictObject({
  /** `scrypt$N$r$p$salt$hash`, see the BFF's `password.ts`. */
  passwordHash: z.string(),
  /** The tenant's first user: it may do everything and has no employee row. */
  root: z.boolean(),
});
export type StoredUser = z.infer<typeof storedUserSchema>;

export const storedSessionSchema = z.strictObject({
  /** SHA-256 hex of the handle's secret; the secret itself is never stored. */
  secretHash: z.string(),
  /** The user record's name, normalised. */
  user: z.string(),
  expiresAt: z.number(),
});
export type StoredSession = z.infer<typeof storedSessionSchema>;
