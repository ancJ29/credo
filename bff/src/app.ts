import { randomUUID } from 'node:crypto';
import {
  type ActivityClient,
  AUTH_HEADER,
  changeOwnPasswordRequestSchema,
  CLIENT_HEADER,
  clientCodeSchema,
  clientLinkPath,
  type ClientListReply,
  type ServicesReply,
  type ConfigDoc,
  createClientRequestSchema,
  type CreateClientReply,
  type CStorageClient,
  deviceIdSchema,
  DEVICE_HEADER,
  layersOf,
  type MeReplyBody,
  type PermissionId,
  normaliseSignInName,
  recordKeys,
  resolvePermissions,
  ROUTES,
  saveConfigRequestSchema,
  sha256Hex,
  type SessionReplyBody,
  signInQrRequestSchema,
  signInRequestSchema,
  signInRoutes,
  staffConfig,
  storedClientSchema,
  type StoredUser,
  tenantConfigSchema,
  type UserView,
} from '@credo/shared';
import Fastify, { type FastifyRequest, type RouteOptions } from 'fastify';
import { createClient, listClients, ROOT_NAME } from './records/clients';
import { type TenantStorage, tenantStorage } from './records/records';
import { HttpError, parse, replyFor } from './errors';
import { type Declared, declare, exempt, operatorOf, personOf } from './audit';
import { constantTimeEqual } from './calling/constant-time';
import { hashPassword, verifyAgainstNobody, verifyPassword } from './calling/password';
import { createSessions } from './calling/sessions';
import {
  namesPerson,
  readEmailClaim,
  readEmployee,
  readQr,
  readSetup,
  type ReadEmployee,
  readSignIn,
} from './records/staff-records';
import { registerOperatorAuth } from './routes/operator-auth';
import { registerListRoutes } from './routes/lists';
import { registerOrderRoutes } from './routes/orders';
import { registerReconciliationRoutes } from './routes/reconciliations';
import { registerOperatorTeamRoutes } from './routes/operator-team';
import { registerDeleteClientRoutes } from './routes/clients-delete';
import { registerRootPasswordRoutes } from './routes/root-password';
import { registerStaffRoutes } from './routes/staff';

declare module 'fastify' {
  interface FastifyRequest {
    /** The minted id of the tenant a client's call names, set before the route runs. */
    tenantId: string;
    /** The storage client of that tenant alone, set beside `tenantId`: it refuses any key that is
     * not the tenant's own. */
    storage: TenantStorage;
    /** The entries the route declares for its change; the hook sends them before the reply. */
    audit: Declared[] | null;
  }
}

type SetupRead = Awaited<ReturnType<typeof readSetup>>;

export type AppDeps = {
  /** The one c-storage service this BFF is. Every tenant's records sit in it under its id. */
  storage: CStorageClient;
  /** The audit service, or none where it is not configured: the change is saved and the lost entry
   * logged, never refused. */
  activity?: ActivityClient | null;
  now: () => number;
  /** The address the operator opens (`APP_ORIGIN`): passkeys are checked against it, never the
   * request's host. */
  origin: string;
  /** The BFF's own service key, which the operator's challenges are signed under. */
  serviceKey: string;
  /** On or off, or on into a stream a test reads. */
  logger: boolean | { level?: string; stream: { write: (line: string) => void } };
  /** The commit this BFF was built from, `dev` unstamped. */
  build?: string;
  /** Told of every route as Fastify registers it: the route-list test reads the list from here. */
  onRoute?: (route: RouteOptions) => void;
};

const unauthorized = () => new HttpError(401, 'Unauthorized');

export function buildApp({
  storage,
  activity = null,
  now,
  origin,
  serviceKey,
  logger,
  build = 'dev',
  onRoute,
}: AppDeps) {
  const app = Fastify({ logger });
  if (onRoute) app.addHook('onRoute', onRoute);
  /** A tenant's sessions: its own records, so a handle minted under another id names none. */
  const sessionsOf = (store: TenantStorage) =>
    createSessions({ storage: store, now, keyOf: recordKeys.tenant(store.tenantId).session });
  app.decorateRequest('tenantId', '');
  // Null until `resolveTenant` sets it; every route that reads it runs after that hook.
  app.decorateRequest('storage', null as unknown as TenantStorage);
  app.decorateRequest('audit', null);

  /** Sends the entry a route declared, before the reply and under the client's own bound. Whatever
   * goes wrong, the change stands: the entry is logged as lost, naming what it was and never a key. */
  app.addHook('onSend', async (request, reply, payload) => {
    const declared = request.audit;
    if (!declared?.length) {
      // A route that carries an action and answers well without declaring its entry has forgotten
      // `declare()`: the change stands, and the miss is logged where a test can fail on it. A route
      // that has nothing to name on purpose declares an empty list.
      if (!declared && request.routeOptions.config.audit && reply.statusCode < 400) {
        request.log.error(
          { action: request.routeOptions.config.audit, url: request.routeOptions.url },
          'audit route answered with no entry declared',
        );
      }
      return payload;
    }
    const lost = {
      action: declared[0]?.action,
      targetId: declared[0]?.targetId,
      entries: declared.length,
    };
    if (!activity) {
      request.log.warn(lost, 'audit entry lost: the log is not configured');
      return payload;
    }
    const timestamp = new Date(now()).toISOString();
    try {
      await activity.log(
        declared.map(({ clientId = request.tenantId, ...entry }) => ({
          ...entry,
          clientId,
          timestamp,
        })),
      );
    } catch (error) {
      request.log.warn({ ...lost, err: error }, 'audit entry lost');
    }
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const { status, body } = replyFor(error);
    if (status >= 500) request.log.error({ err: error }, 'request failed');
    return reply.status(status).send(body);
  });

  /** Runs first on every client route, before the body is read and before any session: the code
   * names the tenant or the call goes no further. It scopes and never authenticates. */
  async function resolveTenant(request: FastifyRequest) {
    const code = clientCodeSchema.safeParse(request.headers[CLIENT_HEADER]);
    if (!code.success) throw new HttpError(400, 'Bad request', { details: CLIENT_HEADER });
    const found = await storage.getRecord(recordKeys.client(code.data));
    if (!found) throw new HttpError(404, 'Unknown client');
    const { id } = storedClientSchema.parse(found.data);
    request.tenantId = id;
    request.storage = tenantStorage(storage, id);
  }
  const forClient = { onRequest: resolveTenant };

  /** The stored account if the password is theirs. An unknown account still spends a check, so it
   * takes as long as a wrong password. */
  async function checked<T extends { passwordHash: string }>(account: T | null, password: string) {
    if (!account) return await verifyAgainstNobody(password);
    return (await verifyPassword(password, account.passwordHash)) ? account : null;
  }

  /** Who a sign-in record names, as the app shows and checks them: the root, or a person who is
   * there, not archived and still holding this code, with what their layers allow. Anything less
   * is no one. The layers are read here, at every call, so the root's change holds at the person's
   * next step; one that cannot be read throws and answers 503, never a partial set. The setup read
   * for them is handed on, so a route does not read it again: a staff call reads five records. */
  async function viewOf(
    store: TenantStorage,
    name: string,
    user: StoredUser,
    handed: { person?: ReadEmployee | null; setup?: SetupRead } = {},
  ) {
    if (user.root) {
      return { name, root: true, permissions: resolvePermissions([], true), employeeId: null };
    }
    // A person already read is used only if the sign-in record names them; any other is read.
    const person =
      handed.person && handed.person.employee.id === user.employeeId
        ? handed.person
        : user.employeeId
          ? await readEmployee(store, store.tenantId, user.employeeId)
          : null;
    if (!person || person.employee.archived || !namesPerson(name, person.employee)) return null;
    const read = handed.setup ?? (await readSetup(store, store.tenantId));
    return {
      name: person.employee.name,
      root: false,
      permissions: resolvePermissions(
        layersOf(read.setup, {
          departmentId: person.employee.department?.id,
          positionId: person.employee.position?.id,
          own: person.employee.permissions,
        }),
      ),
      employeeId: person.employee.id,
      setup: read,
    };
  }

  /** Who the handle names in this tenant. A handle that names no live session, a sign-in record
   * no longer there or given a password since the session was issued (its generation no longer
   * equal to the record's), or a person who left, is a 401; a store that cannot answer throws, and answers 503. */
  async function signedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session =
      typeof handle === 'string' ? await sessionsOf(request.storage).resolve(handle) : null;
    const found = session
      ? await readSignIn(request.storage, request.tenantId, session.user)
      : null;
    if (!session || !found || session.generation !== found.user.generation) throw unauthorized();
    const view = await viewOf(request.storage, session.user, found.user);
    if (!view) throw unauthorized();
    return { ...view, signInName: session.user, signIn: found };
  }

  /** The answer for a person's own view: no more than the app shows. */
  const userViewOf = ({
    name,
    root,
    permissions,
  }: {
    name: string;
    root: boolean;
    permissions: Record<PermissionId, boolean>;
  }): UserView => ({
    name,
    root,
    permissions,
  });

  const forbidden = () => new HttpError(403, 'Forbidden');
  /** The checks every route makes, on the server: the UI's display is never the guard. */
  const mustBeRoot = (who: { root: boolean }) => {
    if (!who.root) throw forbidden();
  };
  const mustCan = (
    who: { root: boolean; permissions: Record<PermissionId, boolean> },
    id: PermissionId,
  ) => {
    if (!who.root && !who.permissions[id]) throw forbidden();
  };

  async function readConfig(store: TenantStorage): Promise<ConfigDoc | null> {
    const found = await store.getRecord(recordKeys.tenant(store.tenantId).config);
    // A config that does not parse throws: the boot stops with a 500, never on another's defaults.
    return found ? { config: tenantConfigSchema.parse(found.data), version: found.tag } : null;
  }

  /** A sign-in ends the session the device's kept handle still names, which the app sends on
   * every call. Only whoever holds the handle's secret ends it: naming a device ends nothing. */
  async function endKept(request: FastifyRequest, sessions: ReturnType<typeof createSessions>) {
    const kept = request.headers[AUTH_HEADER];
    if (typeof kept === 'string') await sessions.end(kept);
  }

  function deviceOf(request: FastifyRequest) {
    const device = deviceIdSchema.safeParse(request.headers[DEVICE_HEADER]);
    if (!device.success) throw new HttpError(400, 'Bad request', { details: DEVICE_HEADER });
    return device.data;
  }

  app.get(ROUTES.config, forClient, async (request) => {
    const doc = await readConfig(request.storage);
    if (!doc) throw new HttpError(404, 'Not set up');
    return doc;
  });

  app.put(
    ROUTES.config,
    { ...forClient, config: { audit: 'config.save' } },
    async (request, reply) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who), 'config');
      mustCan(who, 'settings.canEdit');
      const body = parse(saveConfigRequestSchema, request.body);
      const key = recordKeys.tenant(request.tenantId).config;
      const before = await readConfig(request.storage);
      const result = await request.storage.putRecord(key, body.config, body.version);
      if (result === 'moved') {
        return reply
          .status(409)
          .send({ error: 'Conflict', current: await readConfig(request.storage) });
      }
      entry.saved(before, body.config);
      return await readConfig(request.storage);
    },
  );

  /** The sign-in record a typed name opens: the code's own, or, for an email, the record of the code
   * of the person the email names. An email names no one unless that person's record holds it and
   * the company has the email sign-in on (the setup is read first and handed on). No mail is ever
   * sent to it, so it proves nothing but that the root gave it. */
  async function accountOf(store: TenantStorage, typed: string) {
    if (!typed.includes('@')) {
      return { name: typed, found: await readSignIn(store, store.tenantId, typed), handed: {} };
    }
    const setup = await readSetup(store, store.tenantId);
    const none = { name: typed, found: null, handed: { setup } };
    if (!staffConfig(setup.setup).fields.email) return none;
    const claim = await readEmailClaim(store, store.tenantId, typed);
    const person = claim ? await readEmployee(store, store.tenantId, claim.claim.employeeId) : null;
    if (!person || person.employee.email !== typed) return none;
    const name = normaliseSignInName(person.employee.code);
    return {
      name,
      found: await readSignIn(store, store.tenantId, name),
      handed: { setup, person },
    };
  }

  app.post(
    ROUTES.signIn,
    exempt('a sign-in changes no client’s data', forClient),
    async (request): Promise<SessionReplyBody> => {
      const device = deviceOf(request);
      const body = parse(signInRequestSchema, request.body);
      const typed = normaliseSignInName(body.name);
      const { name, found, handed } = await accountOf(request.storage, typed);
      // A person the root has not given a password yet has no sign-in to check against.
      const account = found?.user.passwordHash
        ? { ...found.user, passwordHash: found.user.passwordHash }
        : null;
      const user = await checked(account, body.password);
      // One answer for an unknown name, a wrong password and a person who left: which part was
      // wrong is not said.
      const view = user ? await viewOf(request.storage, name, user, handed) : null;
      if (!user || !view) throw new HttpError(401, 'Wrong name or password');
      const sessions = sessionsOf(request.storage);
      await endKept(request, sessions);
      const { authId, expiresAt } = await sessions.issue(device, name, user.generation);
      return { authId, expiresAt, user: userViewOf(view) };
    },
  );

  /** A phone opening a QR code's link. Every refusal is the same 401, which says only that the code
   * is not good: a wrong secret, one used before or past its time, a company that turned the QR
   * sign-in off, a person who left. The record is removed over the tag it was read at before the
   * session is issued, so two phones opening one code sign in one. */
  app.post(
    signInRoutes.qr,
    exempt('a sign-in changes no client’s data', forClient),
    async (request): Promise<SessionReplyBody> => {
      const device = deviceOf(request);
      const body = parse(signInQrRequestSchema, request.body);
      const { tenantId, storage: store } = request;
      const held = await readQr(store, store.tenantId, body.id);
      const opened = held ? await sha256Hex(body.secret) : '';
      const person = held ? await readEmployee(store, store.tenantId, body.id) : null;
      if (
        !held ||
        !person ||
        held.qr.expiresAt <= now() ||
        !constantTimeEqual(Buffer.from(held.qr.hash), Buffer.from(opened))
      ) {
        throw unauthorized();
      }
      // The person and the setup are read once and handed on to the view.
      const setup = await readSetup(store, store.tenantId);
      if (!staffConfig(setup.setup).fields.qr) throw unauthorized();
      const name = normaliseSignInName(person.employee.code);
      const found = await readSignIn(store, store.tenantId, name);
      const view = found ? await viewOf(store, name, found.user, { person, setup }) : null;
      // The record must name the person the code was made for: a code changed meanwhile may be Lan's old
      // one, now another's.
      if (!found || found.user.employeeId !== person.employee.id || !view) throw unauthorized();
      if (
        (await store.removeRecord(recordKeys.tenant(tenantId).signInQr(body.id), held.tag)) ===
        'moved'
      ) {
        throw unauthorized();
      }
      const sessions = sessionsOf(request.storage);
      await endKept(request, sessions);
      const { authId, expiresAt } = await sessions.issue(device, name, found.user.generation);
      return { authId, expiresAt, user: userViewOf(view) };
    },
  );

  /** Whether `password` is the one a sign-in record holds. A record with none (a person who has only
   * come in by a QR code) still spends the check, so it takes as long as a wrong one. */
  async function holdsPassword(user: StoredUser, password: string) {
    if (!user.passwordHash) {
      await verifyAgainstNobody(password);
      return false;
    }
    return await verifyPassword(password, user.passwordHash);
  }

  /** One's own password, the current one first. A new generation signs the person out of every other
   * device; this device gets the session that replaces the one it held. Every write of a sign-in
   * record mints a generation, so a record that moved since the session read it has ended the
   * session: a 401, never a check of the current password against what someone else wrote. */
  app.put(
    signInRoutes.password,
    { ...forClient, config: { audit: 'employee.password' } },
    async (request): Promise<SessionReplyBody> => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who));
      const device = deviceOf(request);
      const body = parse(changeOwnPasswordRequestSchema, request.body);
      if (!(await holdsPassword(who.signIn.user, body.current))) throw forbidden();
      const changed: StoredUser = {
        ...who.signIn.user,
        passwordHash: await hashPassword(body.password),
        passwordAt: now(),
        generation: randomUUID(),
      };
      const key = recordKeys.tenant(request.tenantId).user(who.signInName);
      if ((await request.storage.putRecord(key, changed, who.signIn.tag)) === 'moved')
        throw unauthorized();
      entry.saved(null, null);
      const sessions = sessionsOf(request.storage);
      await endKept(request, sessions);
      const issued = await sessions.issue(device, who.signInName, changed.generation);
      return { ...issued, user: userViewOf(who) };
    },
  );

  app.post(
    ROUTES.signOut,
    exempt('a sign-out changes no client’s data', forClient),
    async (request, reply) => {
      const handle = request.headers[AUTH_HEADER];
      if (typeof handle === 'string') await sessionsOf(request.storage).end(handle);
      return reply.status(204).send();
    },
  );

  app.get(ROUTES.me, forClient, async (request): Promise<MeReplyBody> => ({
    user: userViewOf(await signedIn(request)),
  }));

  const { operatorSignedIn, confirmed } = registerOperatorAuth(app, {
    storage,
    now,
    origin,
    serviceKey,
  });
  registerRootPasswordRoutes(app, { storage, now, operatorSignedIn, confirmed });
  registerDeleteClientRoutes(app, { storage, now, operatorSignedIn, confirmed });
  registerOperatorTeamRoutes(app, { storage, now, operatorSignedIn, confirmed });

  app.get(ROUTES.operatorClients, async (request): Promise<ClientListReply> => {
    await operatorSignedIn(request);
    return { clients: await listClients(storage) };
  });

  app.get(ROUTES.operatorServices, async (request, reply): Promise<ServicesReply> => {
    await operatorSignedIn(request);
    const began = performance.now();
    const { buildVersion } = await storage.health();
    const ms = Math.round(performance.now() - began);
    return reply
      .header('cache-control', 'no-store')
      .send({ build, storage: { build: buildVersion, ms } });
  });

  app.post(
    ROUTES.operatorClients,
    { config: { audit: 'client.create' } },
    async (request, reply): Promise<CreateClientReply> => {
      const operator = await operatorSignedIn(request);
      const body = parse(createClientRequestSchema, request.body);
      const made = await createClient(storage, { ...body, madeAt: now() });
      if (made === 'taken') throw new HttpError(409, 'That code is taken');
      // The client has no id until it is made, so a refusal before has no client to name.
      declare(request, operatorOf(operator), made.id, made.id).saved(null, {
        code: body.code,
        name: body.name,
      });
      return reply.status(201).send({
        link: clientLinkPath(body.code),
        rootName: ROOT_NAME,
        password: made.password,
      });
    },
  );

  registerStaffRoutes(app, { now, forClient, signedIn, mustBeRoot, mustCan });
  registerListRoutes(app, { now, forClient, signedIn, mustBeRoot, mustCan });
  registerOrderRoutes(app, { now, forClient, signedIn, mustBeRoot, mustCan });
  registerReconciliationRoutes(app, { now, forClient, signedIn, mustBeRoot, mustCan });

  return app;
}
