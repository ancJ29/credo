import { z } from 'zod';

/** What the BFF's one c-storage service holds, and under which keys. A client is a tenant: its
 * records sit under its minted id, and its code reaches the id through one index record. This is
 * the layout's one home, so no other file builds a key. */
export const recordKeys = {
  /** The index: a client's code to its id. Written last, when the client is made. */
  client: (code: string) => `client.${code}`,
  operatorUser: (name: string) => `operator.user.${name}`,
  operatorSession: (deviceId: string) => `operator.session.${deviceId}`,
  /** Every record of one tenant, by its minted id. */
  tenant: (id: string) => ({
    config: `tenant.${id}.config`,
    user: (name: string) => `tenant.${id}.user.${name}`,
    session: (deviceId: string) => `tenant.${id}.session.${deviceId}`,
  }),
} as const;

/** A client's code: 3 to 32 lowercase letters, digits and hyphens, a letter first and a letter
 * or digit last. The BFF takes this exact form alone. */
export const clientCodeSchema = z.string().regex(/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/);

/** A code as typed or linked, to the form the BFF takes: spaces around it go and capitals fall. */
export const normaliseClientCode = (raw: string) => raw.trim().toLowerCase();

/** The index record: the tenant's minted id, and the name as made, for the reader. */
export const storedClientSchema = z.strictObject({ id: z.uuid(), name: z.string() });
export type StoredClient = z.infer<typeof storedClientSchema>;

/** The operator's account. It belongs to no tenant, and its record has no `root` flag. */
export const storedOperatorSchema = z.strictObject({ passwordHash: z.string() });
export type StoredOperator = z.infer<typeof storedOperatorSchema>;

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
