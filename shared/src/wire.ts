import { z } from 'zod';
import { tenantConfigSchema } from './config';
import { permissionLayerSchema } from './permissions';
import { clientCodeSchema } from './records';

export const ROUTES = {
  config: '/api/config',
  signIn: '/api/auth/sign-in',
  signOut: '/api/auth/sign-out',
  me: '/api/auth/me',
  operatorSignOut: '/api/operator/sign-out',
  operatorMe: '/api/operator/me',
  operatorPasskeyOptions: '/api/operator/passkey/options',
  operatorPasskeySignIn: '/api/operator/passkey/sign-in',
  operatorJoinOptions: '/api/operator/join/options',
  operatorJoin: '/api/operator/join',
  operatorPasskeys: '/api/operator/passkeys',
  operatorClients: '/api/operator/clients',
  operatorOperators: '/api/operator/operators',
  operatorServices: '/api/operator/services',
  staffSetup: '/api/staff-setup',
  employees: '/api/employees',
  customers: '/api/customers',
  products: '/api/products',
  orders: '/api/orders',
  deliveries: '/api/deliveries',
  drivers: '/api/drivers',
  reconciliations: '/api/reconciliations',
  myDeliveries: '/api/my-deliveries',
} as const;

/** A list's import, under its own route: the root's, up to a call's rows. */
export const listImportRoute = (list: 'customers' | 'products') => `${ROUTES[list]}/import`;

/** A person's own routes, under `ROUTES.employees`. */
export const employeeRoutes = {
  one: (id: string) => `${ROUTES.employees}/${id}`,
  archive: (id: string) => `${ROUTES.employees}/${id}/archive`,
  password: (id: string) => `${ROUTES.employees}/${id}/password`,
  code: (id: string) => `${ROUTES.employees}/${id}/code`,
  photo: (id: string) => `${ROUTES.employees}/${id}/photo`,
};

/** An order's own routes, under `ROUTES.orders`: a day's records are found by their day and id. */
export const orderRoutes = {
  list: (from: string, to: string) => `${ROUTES.orders}?from=${from}&to=${to}`,
  one: (day: string, id: string) => `${ROUTES.orders}/${day}/${id}`,
  confirm: (day: string, id: string) => `${ROUTES.orders}/${day}/${id}/confirm`,
  send: (day: string, id: string) => `${ROUTES.orders}/${day}/${id}/send`,
  cancel: (day: string, id: string) => `${ROUTES.orders}/${day}/${id}/cancel`,
};

/** A delivery request's own routes, under `ROUTES.deliveries`. */
export const deliveryRoutes = {
  list: (day: string) => `${ROUTES.deliveries}?day=${day}`,
  one: (day: string, id: string) => `${ROUTES.deliveries}/${day}/${id}`,
  cancel: (day: string, id: string) => `${ROUTES.deliveries}/${day}/${id}/cancel`,
  deliver: (day: string, id: string) => `${ROUTES.deliveries}/${day}/${id}/deliver`,
  photo: (day: string, id: string) => `${ROUTES.deliveries}/${day}/${id}/photo`,
  /** The driver's own requests of a day. */
  mine: (day: string) => `${ROUTES.myDeliveries}?day=${day}`,
};

/** A driver's day closed, under `ROUTES.reconciliations`: the day's closed ones are listed by day. */
export const reconciliationRoutes = {
  list: (day: string) => `${ROUTES.reconciliations}?day=${day}`,
  close: (day: string, driverId: string) => `${ROUTES.reconciliations}/${day}/${driverId}/close`,
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

/** `id` is the operator's minted id, which names whose passkey answered; an answer that predates it
 * reads as empty. */
export const operatorViewSchema = z.strictObject({ id: z.string().default(''), name: z.string() });

export const operatorSessionReplySchema = z.strictObject({
  authId: z.string(),
  expiresAt: z.number(),
  operator: operatorViewSchema,
});
export type OperatorSessionReply = z.infer<typeof operatorSessionReplySchema>;
/** What the BFF sends: the id is the reader's to default. */
export type OperatorSessionReplyBody = z.input<typeof operatorSessionReplySchema>;

export const operatorMeReplySchema = z.strictObject({ operator: operatorViewSchema });
export type OperatorMeReply = z.infer<typeof operatorMeReplySchema>;
export type OperatorMeReplyBody = z.input<typeof operatorMeReplySchema>;

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

/** A colleague's own routes, under `ROUTES.operatorOperators`. */
export const operatorRoutes = {
  one: (id: string) => `${ROUTES.operatorOperators}/${id}`,
  link: (id: string) => `${ROUTES.operatorOperators}/${id}/link`,
};

/** The route that sets a client's root password anew, by the client's code. */
export const rootPasswordRoute = (code: string) =>
  `${ROUTES.operatorClients}/${code}/root-password`;

/** What setting a root's password answers: the password the app made, shown once, or null when the
 * operator typed one, which is never sent back. */
export const rootPasswordReplySchema = z.strictObject({ made: z.string().nullable() });
export type RootPasswordReply = z.infer<typeof rootPasswordReplySchema>;

/** What a read of the operator's says in its query when it must not count as use: the status
 * page's timed read each minute, so a tab left in view does not hold a sign-in open. */
export const NO_RENEW_QUERY = 'renew=0';

/** What the services status call answers: the BFF's build, and c-storage's build with how long the
 * BFF's read of its `/health` took, in milliseconds. It exists only when c-storage answered; with
 * c-storage silent the BFF answers its own 503 (`bffErrorSchema`). */
export const servicesReplySchema = z.strictObject({
  build: z.string().min(1),
  storage: z.strictObject({ build: z.string().min(1), ms: z.number().int().nonnegative() }),
});
export type ServicesReply = z.infer<typeof servicesReplySchema>;

/** The shape of every answer the BFF itself gives to a failure, `{ error }` and what the route
 * adds. Anything else that fails came from the edge or from nowhere, and is the BFF not answering. */
export const bffErrorSchema = z.object({ error: z.string() });

/** One operator's own passkeys, under `ROUTES.operatorPasskeys`. */
export const passkeyRoutes = {
  /** Asks for the options a new passkey is made with. */
  options: `${ROUTES.operatorPasskeys}/options`,
  /** Asks for the options of the touch an add or a remove needs, in the same act. */
  confirmOptions: `${ROUTES.operatorPasskeys}/confirm-options`,
  one: (id: string) => `${ROUTES.operatorPasskeys}/${id}`,
};

/** A join link's token: 32 random bytes in base64url. It travels in the address's fragment and a
 * request's body, never a path or a query, so no page request or log carries it. */
export const joinTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** The page a join link opens. */
export const JOIN_PATH = '/operator/join';

/** The link's path and fragment, `/operator/join#<token>`: the one function that builds it. */
export const joinLinkPath = (token: string) => `${JOIN_PATH}#${token}`;

/** The token in an address's fragment, or null when it holds none in the token's form. */
export function tokenOfFragment(hash: string) {
  const parsed = joinTokenSchema.safeParse(hash.replace(/^#/, ''));
  return parsed.success ? parsed.data : null;
}

/** The options a ceremony starts from, as `@simplewebauthn/server` makes them and the browser's
 * library takes them: only the challenge is read here, so a newer library's options still parse. */
export const ceremonyOptionsSchema = z.looseObject({ challenge: z.string().min(1) });
export type CeremonyOptions = z.infer<typeof ceremonyOptionsSchema>;

/** What the device answers a ceremony with, in the library's JSON form. The BFF's library checks
 * the rest; this is the shape that is worth refusing before it is read. */
const credentialSchema = z.looseObject({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  response: z.looseObject({}),
  clientExtensionResults: z.looseObject({}),
});
export const registrationResponseSchema = credentialSchema;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
export const authenticationResponseSchema = credentialSchema;
export type AuthenticationResponse = z.infer<typeof authenticationResponseSchema>;

/** The challenge is signed, not stored: the options come with the token that binds it, and the
 * answer sends the token back. */
const challengeToken = z.string().min(1);

export const optionsReplySchema = z.strictObject({
  options: ceremonyOptionsSchema,
  token: challengeToken,
});
export type OptionsReply = z.infer<typeof optionsReplySchema>;

export const passkeySignInRequestSchema = z.strictObject({
  token: challengeToken,
  response: authenticationResponseSchema,
});
export type PasskeySignInRequest = z.infer<typeof passkeySignInRequestSchema>;

export const joinOptionsRequestSchema = z.strictObject({ link: joinTokenSchema });

/** Opening a link names whose it is and who made it. `madeBy` is none when the link came from the
 * terminal or its maker has been deleted, and `madeByTerminal` tells the two apart; an older BFF
 * says nothing of it, which reads as false (the maker deleted, as it was said then). */
export const joinOptionsReplySchema = optionsReplySchema.extend({
  name: z.string(),
  madeBy: z.string().nullable(),
  madeByTerminal: z.boolean().default(false),
});
export type JoinOptionsReply = z.infer<typeof joinOptionsReplySchema>;

export const joinRequestSchema = z.strictObject({
  link: joinTokenSchema,
  token: challengeToken,
  response: registrationResponseSchema,
});
export type JoinRequest = z.infer<typeof joinRequestSchema>;

/** What a touch is asked for: an add or a remove of one's own passkeys, or a client's root password
 * set anew, or a new operator added, a colleague's new link made, or a colleague deleted. A session
 * alone does none of them, so a stolen session cannot put the thief's passkey in, take the owner's
 * out, take a client's root, let in a stranger, take a colleague's place or empty the roster. */
export const confirmActSchema = z.enum([
  'add',
  'remove',
  'root-password',
  'add-operator',
  'operator-link',
  'delete-operator',
]);
export type ConfirmAct = z.infer<typeof confirmActSchema>;
export const confirmOptionsRequestSchema = z.strictObject({ act: confirmActSchema });

/** The fresh touch: a sign-in answer from one of the operator's own passkeys, to a challenge made
 * for this act. */
export const confirmationSchema = z.strictObject({
  token: challengeToken,
  response: authenticationResponseSchema,
});
export type Confirmation = z.infer<typeof confirmationSchema>;

/** A passkey added to the operator's own, beside the ones held, with the touch that allows it. */
export const passkeyAddRequestSchema = z.strictObject({
  token: challengeToken,
  response: registrationResponseSchema,
  confirm: confirmationSchema,
});
export type PasskeyAddRequest = z.infer<typeof passkeyAddRequestSchema>;

/** A passkey removed, with the touch that allows it. */
export const passkeyRemoveRequestSchema = z.strictObject({ confirm: confirmationSchema });
export type PasskeyRemoveRequest = z.infer<typeof passkeyRemoveRequestSchema>;

/** A passkey as its owner is shown it: when it was added and last used, and no secret. */
export const passkeyItemSchema = z.strictObject({
  id: z.string(),
  addedAt: z.number(),
  lastUsedAt: z.number().nullable(),
});
export type PasskeyItem = z.infer<typeof passkeyItemSchema>;

export const passkeyListReplySchema = z.strictObject({ passkeys: z.array(passkeyItemSchema) });
export type PasskeyListReply = z.infer<typeof passkeyListReplySchema>;

/** One operator as the roster page shows them: invited until the first passkey is made, then
 * active. `addedBy` is the name of who added them, null with `addedByTerminal` false once that
 * operator is deleted, and null with it true for the one the command line made. `signedInAt` is
 * the last sign-in or join, null for none; `you` marks the one reading. */
export const operatorItemSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  state: z.enum(['invited', 'active']),
  addedBy: z.string().nullable(),
  addedByTerminal: z.boolean(),
  addedAt: z.number(),
  passkeys: z.number().int().nonnegative(),
  signedInAt: z.number().nullable(),
  you: z.boolean(),
});
export type OperatorItem = z.infer<typeof operatorItemSchema>;

export const operatorListReplySchema = z.strictObject({ operators: z.array(operatorItemSchema) });
export type OperatorListReply = z.infer<typeof operatorListReplySchema>;

/** The longest name an operator is given. */
export const OPERATOR_NAME_MAX = 60;

/** An operator's name as typed: trimmed, stored in Unicode form NFC (a Vietnamese accent typed
 * precomposed or combining is one name), 1 to 60 characters. */
export const operatorNameSchema = z.string().trim().normalize('NFC').min(1).max(OPERATOR_NAME_MAX);

const comparable = (name: string) => name.trim().normalize('NFC').toLowerCase();

/** Whether two names are one name: compared trimmed, in form NFC and without case. */
export const sameOperatorName = (a: string, b: string) => comparable(a) === comparable(b);

/** The roster's order: the one added last first, the same time by name. */
export const addedNewestFirst = (a: OperatorItem, b: OperatorItem) =>
  b.addedAt - a.addedAt || a.name.localeCompare(b.name);

/** A new operator: a name, with the touch that allows it. */
export const addOperatorRequestSchema = z.strictObject({
  name: operatorNameSchema,
  confirm: confirmationSchema,
});
export type AddOperatorRequest = z.infer<typeof addOperatorRequestSchema>;

/** What adding an operator answers, once: their id and the join link's path and fragment. */
export const addOperatorReplySchema = z.strictObject({ id: z.uuid(), link: z.string() });
export type AddOperatorReply = z.infer<typeof addOperatorReplySchema>;

/** A new link for a colleague, with the touch that allows it. */
export const operatorLinkRequestSchema = z.strictObject({ confirm: confirmationSchema });
export type OperatorLinkRequest = z.infer<typeof operatorLinkRequestSchema>;

/** What a new link answers, once: its path and fragment, as an add's. */
export const operatorLinkReplySchema = z.strictObject({ link: z.string() });
export type OperatorLinkReply = z.infer<typeof operatorLinkReplySchema>;

/** A colleague deleted, with the touch that allows it. */
export const deleteOperatorRequestSchema = z.strictObject({ confirm: confirmationSchema });
export type DeleteOperatorRequest = z.infer<typeof deleteOperatorRequestSchema>;
