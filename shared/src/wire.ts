import { z } from 'zod';
import { tenantConfigSchema } from './config';
import { permissionLayerSchema } from './permissions';
import { clientCodeSchema } from './records';

export const ROUTES = {
  config: '/api/config',
  signIn: '/api/auth/sign-in',
  signOut: '/api/auth/sign-out',
  me: '/api/auth/me',
  operatorSignIn: '/api/operator/sign-in',
  operatorSignOut: '/api/operator/sign-out',
  operatorMe: '/api/operator/me',
  operatorClients: '/api/operator/clients',
  staffSetup: '/api/staff-setup',
  employees: '/api/employees',
} as const;

/** A person's own routes, under `ROUTES.employees`. */
export const employeeRoutes = {
  one: (id: string) => `${ROUTES.employees}/${id}`,
  archive: (id: string) => `${ROUTES.employees}/${id}/archive`,
  password: (id: string) => `${ROUTES.employees}/${id}/password`,
};

/** The client's code, on every call of a client's: it scopes the call to a tenant and proves
 * nothing, as the handle does. The operator's routes never read it. */
export const CLIENT_HEADER = 'x-client-code';

/** The session handle, on every call after sign-in. */
export const AUTH_HEADER = 'x-auth-id';
/** The device id the UI minted, on sign-in. */
export const DEVICE_HEADER = 'x-device-id';

/** Text the BFF puts in a record key or hashes. A lone surrogate cannot be encoded into a URL, and
 * an unbounded one is a body-sized key, so both are refused here as a 400. */
const boundedText = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((text) => text.isWellFormed(), 'well-formed text');

export const signInRequestSchema = z.strictObject({
  name: boundedText(200),
  password: boundedText(1024),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const userViewSchema = z.strictObject({
  name: z.string(),
  root: z.boolean(),
  /** What the person may do, resolved by the BFF; none when the answer predates the field. */
  permissions: permissionLayerSchema.default({}),
});
export type UserView = z.infer<typeof userViewSchema>;

export const sessionReplySchema = z.strictObject({
  authId: z.string(),
  expiresAt: z.number(),
  user: userViewSchema,
});
export type SessionReply = z.infer<typeof sessionReplySchema>;
/** What the BFF sends: the permissions are the reader's to default. */
export type SessionReplyBody = z.input<typeof sessionReplySchema>;

export const meReplySchema = z.strictObject({ user: userViewSchema });
export type MeReply = z.infer<typeof meReplySchema>;
export type MeReplyBody = z.input<typeof meReplySchema>;

/** The settings with the version they were read at; a save sends it back. */
export const configDocSchema = z.strictObject({
  config: tenantConfigSchema,
  version: z.string(),
});
export type ConfigDoc = z.infer<typeof configDocSchema>;

/** c-storage's tag as it sends it back in `If-Match`: 64 lowercase hex digits. Anything else can
 * never match, so it is refused here as a 400 and not left to c-storage's. */
const TAG = /^[0-9a-f]{64}$/;
export const tagSchema = z.string().regex(TAG);

/** `version` is null only for the first save, when no settings exist yet. */
export const saveConfigRequestSchema = z.strictObject({
  config: tenantConfigSchema,
  version: tagSchema.nullable(),
});
export type SaveConfigRequest = z.infer<typeof saveConfigRequestSchema>;

export const errorReplySchema = z.strictObject({
  error: z.string(),
  details: z.string().optional(),
});

/** A save over newer settings: the newer ones, for the page to offer; none if they are gone. */
export const conflictReplySchema = z.strictObject({
  error: z.string(),
  current: configDocSchema.nullable(),
});
export type ConflictReply = z.infer<typeof conflictReplySchema>;

export const operatorViewSchema = z.strictObject({ name: z.string() });

export const operatorSessionReplySchema = z.strictObject({
  authId: z.string(),
  expiresAt: z.number(),
  operator: operatorViewSchema,
});
export type OperatorSessionReply = z.infer<typeof operatorSessionReplySchema>;

export const operatorMeReplySchema = z.strictObject({ operator: operatorViewSchema });
export type OperatorMeReply = z.infer<typeof operatorMeReplySchema>;

export const createClientRequestSchema = z.strictObject({
  code: clientCodeSchema,
  /** The company's name as made, which is also its first settings' name. */
  name: z.string().trim().min(1).max(200),
});
export type CreateClientRequest = z.infer<typeof createClientRequestSchema>;

/** What the operator is shown once: the link's path, the root's name and its first password. */
export const createClientReplySchema = z.strictObject({
  link: z.string(),
  rootName: z.string(),
  password: z.string(),
});
export type CreateClientReply = z.infer<typeof createClientReplySchema>;

/** The path a client signs in at, `…/login?client-code=<code>`: the one function that builds it,
 * for the create's answer and the list's alike. */
export const clientLinkPath = (code: string) => `/login?client-code=${code}`;

/** One client in the operator's list: its code, the name as made, when it was made (null for a
 * client made before the time was kept) and the path of its link. */
export const clientListItemSchema = z.strictObject({
  code: clientCodeSchema,
  name: z.string(),
  madeAt: z.number().nullable(),
  link: z.string(),
});
export type ClientListItem = z.infer<typeof clientListItemSchema>;

export const clientListReplySchema = z.strictObject({ clients: z.array(clientListItemSchema) });
export type ClientListReply = z.infer<typeof clientListReplySchema>;

/** The list's order: newest first, and the clients with no time after them, by code. */
export const newestFirst = (a: ClientListItem, b: ClientListItem) =>
  // A time is positive, so -1 stands for none and falls after every real one.
  (b.madeAt ?? -1) - (a.madeAt ?? -1) || a.code.localeCompare(b.code);
