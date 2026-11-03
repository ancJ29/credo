import { z } from 'zod';

/** What the BFF's one c-storage service holds, and under which keys. A client is a tenant: its
 * records sit under its minted id, and its code reaches the id through one index record. This is
 * the layout's one home, so no other file builds a key. */
const clientPrefix = 'client.';
export const recordKeys = {
  /** The index: a client's code to its id. Written last, when the client is made. */
  client: (code: string) => `${clientPrefix}${code}`,
  /** What the operator's list reads: every index key starts with it, and no other key does. */
  clientPrefix,
  /** Every operator in one record, under one tag: a name taken and "at least one operator" hold
   * under it. */
  operatorRoster: 'operator.roster',
  /** An operator's passkeys, their live link's hash and the challenges they spent. */
  operatorAccount: (id: string) => `operator.account.${id}`,
  /** A join or new-passkey link, by the SHA-256 hex of its token. */
  operatorLink: (tokenHash: string) => `operator.link.${tokenHash}`,
  operatorSession: (sessionId: string) => `operator.session.${sessionId}`,
  /** Every record of one tenant, by its minted id. */
  tenant: (id: string) => ({
    /** Every record of the tenant: the seed reads it to see that a client is new. */
    all: `tenant.${id}.`,
    config: `tenant.${id}.config`,
    user: (name: string) => `tenant.${id}.user.${name}`,
    /** By the session's minted id; the device it was issued to is beside it in the record. */
    session: (sessionId: string) => `tenant.${id}.session.${sessionId}`,
    /** A person, by their minted id. */
    employee: (employeeId: string) => `tenant.${id}.employee.${employeeId}`,
    /** What the staff list reads: every person's key starts with it. */
    employeePrefix: `tenant.${id}.employee.`,
    /** A customer and a product, each by its minted id: one record each, read by its prefix. */
    customer: (customerId: string) => `tenant.${id}.customer.${customerId}`,
    customerPrefix: `tenant.${id}.customer.`,
    product: (productId: string) => `tenant.${id}.product.${productId}`,
    productPrefix: `tenant.${id}.product.`,
    /** An order and a delivery request, each by its day and minted id: a list reads one day's prefix,
     * since c-storage answers at most 1,000 records a read. */
    order: (day: string, orderId: string) => `tenant.${id}.order.${day}.${orderId}`,
    orderDayPrefix: (day: string) => `tenant.${id}.order.${day}.`,
    delivery: (day: string, requestId: string) => `tenant.${id}.delivery.${day}.${requestId}`,
    deliveryDayPrefix: (day: string) => `tenant.${id}.delivery.${day}.`,
    /** A delivery's photo, its own record beside the request's. Its key does not start with
     * `deliveryDayPrefix`, so a day's list never reads a photo. */
    deliveryPhoto: (day: string, requestId: string) =>
      `tenant.${id}.delivery-photo.${day}.${requestId}`,
    /** A driver's closed day, by the day and the driver's minted id: written once, and a day's are one
     * prefix read. */
    reconciliation: (day: string, driverId: string) =>
      `tenant.${id}.reconciliation.${day}.${driverId}`,
    reconciliationDayPrefix: (day: string) => `tenant.${id}.reconciliation.${day}.`,
    /** The last number given to an order and to a request: its own record, raised over its tag. */
    documentNumbering: `tenant.${id}.document-numbering`,
    staffSetup: `tenant.${id}.staff-setup`,
    /** The demo seed's ledger for the tenant, the seed's alone: the BFF never reads it, and its key
     * starts with none of the prefixes the BFF lists. */
    seed: `tenant.${id}.seed`,
    /** The last number given under each numbering prefix: its own record, so an add raises it
     * without moving the setup the root is editing. */
    staffNumbering: `tenant.${id}.staff-numbering`,
    /** A person's photo, by the person's minted id: its own record, so a photo moves nothing of the
     * person's. Its key does not start with `employeePrefix`, so the staff list never reads it. */
    employeePhoto: (employeeId: string) => `tenant.${id}.employee-photo.${employeeId}`,
    /** An email, as `emailSchema` keeps it, names the person who holds it: one record a company. */
    signInEmail: (email: string) => `tenant.${id}.signin-email.${email}`,
    /** A person's one QR code, by their minted id: a new code replaces it, spending removes it. */
    signInQr: (employeeId: string) => `tenant.${id}.signin-qr.${employeeId}`,
  }),
} as const;

/** A client's code: 3 to 32 lowercase letters, digits and hyphens, a letter first and a letter
 * or digit last. The BFF takes this exact form alone. */
export const clientCodeSchema = z.string().regex(/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/);

/** A code as typed or linked, to the form the BFF takes: spaces around it go and capitals fall. */
export const normaliseClientCode = (raw: string) => raw.trim().toLowerCase();

/** The index record: the tenant's minted id, the name as made for the reader, and the time it was
 * made, in milliseconds since the epoch. An index written before the time was kept has none, and
 * reads as none; nothing rewrites it. */
export const storedClientSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  madeAt: z.number().optional(),
});
export type StoredClient = z.infer<typeof storedClientSchema>;

/** One operator in the roster: invited until the first passkey is made, then active. `addedBy` is
 * the id of the operator (or null for the terminal) who made them, which may name no one once that
 * operator is deleted. */
export const rosterOperatorSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  state: z.enum(['invited', 'active']),
  addedBy: z.string().nullable(),
  addedAt: z.number(),
  joinedAt: z.number().nullable(),
});
export type RosterOperator = z.infer<typeof rosterOperatorSchema>;

export const storedRosterSchema = z.strictObject({ operators: z.array(rosterOperatorSchema) });
export type StoredRoster = z.infer<typeof storedRosterSchema>;

/** One passkey of an operator: the credential's id and public key as base64url, the counter the
 * library checks, and when it was added and last used. */
export const storedPasskeySchema = z.strictObject({
  id: z.string(),
  publicKey: z.string(),
  counter: z.number(),
  transports: z.array(z.string()),
  addedAt: z.number(),
  lastUsedAt: z.number().nullable(),
});
export type StoredPasskey = z.infer<typeof storedPasskeySchema>;

/** An operator's account. `generation` moves when a new-passkey link replaces every passkey: the
 * sessions issued before it are refused. `spent` holds the challenges answered in the last five
 * minutes, so the same answer sent twice is refused. `signedInAt` is the last sign-in or join, written
 * by those two alone (never by a touch for an act, as a passkey's `lastUsedAt` is); an account
 * written before it reads null. */
export const storedAccountSchema = z.strictObject({
  passkeys: z.array(storedPasskeySchema),
  linkHash: z.string().nullable(),
  generation: z.number(),
  signedInAt: z.number().nullable().default(null),
  spent: z.array(z.strictObject({ hash: z.string(), at: z.number() })),
});
export type StoredAccount = z.infer<typeof storedAccountSchema>;

/** A link: whose it is, whether it makes a first passkey or replaces the ones held, who made it
 * (null for the terminal) and when it ends. */
export const storedLinkSchema = z.strictObject({
  operatorId: z.uuid(),
  kind: z.enum(['join', 'replace']),
  madeBy: z.string().nullable(),
  endsAt: z.number(),
});
export type StoredLink = z.infer<typeof storedLinkSchema>;

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
   * claim or password has come since. An operator's is its account's `generation`, as a string. */
  generation: z.string(),
  /** When the session was issued, which an operator's 12-hour cap counts from; a tenant's
   * session, which has no cap, reads 0. */
  issuedAt: z.number().default(0),
});
export type StoredSession = z.infer<typeof storedSessionSchema>;
