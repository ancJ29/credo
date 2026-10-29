import { z } from 'zod';

/** What the BFF's one c-storage service holds, and under which keys. A client is a tenant: its
 * records sit under its minted id, and its code reaches the id through one index record. This is
 * the layout's one home, so no other file builds a key. */
export const recordKeys = {
  /** The index: a client's code to its id. Written last, when the client is made. */
  client: (code: string) => `client.${code}`,
  operatorUser: (name: string) => `operator.user.${name}`,
  operatorSession: (sessionId: string) => `operator.session.${sessionId}`,
  /** Every record of one tenant, by its minted id. */
  tenant: (id: string) => ({
    config: `tenant.${id}.config`,
    user: (name: string) => `tenant.${id}.user.${name}`,
    /** By the session's minted id; the device it was issued to is beside it in the record. */
    session: (sessionId: string) => `tenant.${id}.session.${sessionId}`,
    /** A person, by their minted id. */
    employee: (employeeId: string) => `tenant.${id}.employee.${employeeId}`,
    /** What the staff list reads: every person's key starts with it. */
    employeePrefix: `tenant.${id}.employee.`,
    staffSetup: `tenant.${id}.staff-setup`,
    /** The last number given under each numbering prefix: its own record, so an add raises it
     * without moving the setup the root is editing. */
    staffNumbering: `tenant.${id}.staff-numbering`,
    /** A person's photo, by the person's minted id: its own record, so a photo moves nothing of the
     * person's. Its key does not start with `employeePrefix`, so the staff list never reads it. */
    employeePhoto: (employeeId: string) => `tenant.${id}.employee-photo.${employeeId}`,
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

/** An email, a second sign-in name, kept as `normaliseSignInName` keeps a name. */
export const emailSchema = z.string().transform(normaliseSignInName).pipe(z.email().max(200));

/** The UI mints a device id once and keeps it; it names the session record, so it holds no dot,
 * which splits it from the secret in the handle. */
export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

/** A sign-in record, keyed by the sign-in name: the root's, or a person's code. */
export const storedUserSchema = z.strictObject({
  /** `scrypt$N$r$p$salt$hash`, see the BFF's `password.ts`; null until the root gives one. */
  passwordHash: z.string().nullable(),
  /** The tenant's first user: it may do everything and has no employee row. */
  root: z.boolean(),
  /** The person this sign-in belongs to: null for the root. A sign-in is live only while that
   * person's record names it back. */
  employeeId: z.uuid().nullable().default(null),
  /** When the record was claimed or its password last changed: the age of a claim, which a failed
   * add's takeover waits for. Never compared with a session. */
  passwordAt: z.number().default(0),
  /** A random value minted at every claim and every password: a session holds a copy, and is
   * refused once it differs. No clock is in it, so a freed code claimed again never matches an
   * old session; `''` for a record that predates it. */
  generation: z.string().default(''),
});
export type StoredUser = z.infer<typeof storedUserSchema>;

export const storedSessionSchema = z.strictObject({
  /** SHA-256 hex of the handle's secret; the secret itself is never stored. */
  secretHash: z.string(),
  /** The user record's name, normalised. */
  user: z.string(),
  expiresAt: z.number(),
  /** The device it was issued to. */
  device: z.string(),
  /** The sign-in record's `generation` when this session was issued, equal to the record's while no
   * claim or password has come since. The operator's, which has no such record, is `''`. */
  generation: z.string(),
});
export type StoredSession = z.infer<typeof storedSessionSchema>;
