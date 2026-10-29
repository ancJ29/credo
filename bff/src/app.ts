import {
  AUTH_HEADER,
  CLIENT_HEADER,
  clientCodeSchema,
  type ConfigDoc,
  createClientRequestSchema,
  type CreateClientReply,
  type CStorageClient,
  deviceIdSchema,
  DEVICE_HEADER,
  type MeReplyBody,
  type PermissionId,
  normaliseSignInName,
  type OperatorMeReply,
  type OperatorSessionReply,
  recordKeys,
  resolvePermissions,
  ROUTES,
  saveConfigRequestSchema,
  type SessionReplyBody,
  signInRequestSchema,
  storedClientSchema,
  storedOperatorSchema,
  type StoredUser,
  tenantConfigSchema,
  type UserView,
} from '@credo/shared';
import Fastify, { type FastifyRequest } from 'fastify';
import { createClient, ROOT_NAME } from './clients';
import { HttpError, parse, replyFor } from './errors';
import { verifyAgainstNobody, verifyPassword } from './password';
import { createSessions } from './sessions';
import { layersOf, namesBack, readEmployee, readSetup, readSignIn } from './staff-records';
import { registerStaffRoutes } from './staff';

declare module 'fastify' {
  interface FastifyRequest {
    /** The minted id of the tenant a client's call names, set before the route runs. */
    tenantId: string;
  }
}

export type AppDeps = {
  /** The one c-storage service this BFF is. Every tenant's records sit in it under its id. */
  storage: CStorageClient;
  now: () => number;
  /** On or off, or on into a stream a test reads. */
  logger: boolean | { stream: { write: (line: string) => void } };
};

const unauthorized = () => new HttpError(401, 'Unauthorized');

export function buildApp({ storage, now, logger }: AppDeps) {
  const app = Fastify({ logger });
  const operatorSessions = createSessions({ storage, now, keyOf: recordKeys.operatorSession });
  /** A tenant's sessions: its own records, so a handle minted under another id names none. */
  const sessionsOf = (tenantId: string) =>
    createSessions({ storage, now, keyOf: recordKeys.tenant(tenantId).session });
  app.decorateRequest('tenantId', '');

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
    request.tenantId = storedClientSchema.parse(found.data).id;
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
   * next step; one that cannot be read throws and answers 503, never a partial set. */
  async function viewOf(tenantId: string, name: string, user: StoredUser) {
    if (user.root) {
      return { name, root: true, permissions: resolvePermissions([], true), employeeId: null };
    }
    const person = user.employeeId ? await readEmployee(storage, tenantId, user.employeeId) : null;
    if (!person || person.employee.archived || !(await namesBack(storage, tenantId, name, user))) {
      return null;
    }
    const { setup } = await readSetup(storage, tenantId);
    return {
      name: person.employee.name,
      root: false,
      permissions: resolvePermissions(layersOf(setup, person.employee)),
      employeeId: person.employee.id,
    };
  }

  async function readOperator(name: string) {
    const found = await storage.getRecord(recordKeys.operatorUser(name));
    const parsed = found ? storedOperatorSchema.safeParse(found.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  /** Who the handle names in this tenant. A handle that names no live session, a sign-in record
   * no longer there or given a password since the session was issued, or a person who left, is a
   * 401; a store that cannot answer throws, and answers 503. */
  async function signedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session =
      typeof handle === 'string' ? await sessionsOf(request.tenantId).resolve(handle) : null;
    const found = session ? await readSignIn(storage, request.tenantId, session.user) : null;
    if (!session || !found || session.issuedAt < found.user.passwordAt) throw unauthorized();
    const view = await viewOf(request.tenantId, session.user, found.user);
    if (!view) throw unauthorized();
    return view;
  }

  /** The answer for a person's own view: no more than the app shows. */
  const userViewOf = ({
    name,
    root,
    permissions,
  }: Awaited<ReturnType<typeof signedIn>>): UserView => ({
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

  /** Who the handle names among the operators; a client's handle names no one here. */
  async function operatorSignedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session = typeof handle === 'string' ? await operatorSessions.resolve(handle) : null;
    const operator = session ? await readOperator(session.user) : null;
    if (!session || !operator) throw unauthorized();
    return { name: session.user };
  }

  async function readConfig(tenantId: string): Promise<ConfigDoc | null> {
    const found = await storage.getRecord(recordKeys.tenant(tenantId).config);
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
    const doc = await readConfig(request.tenantId);
    if (!doc) throw new HttpError(404, 'Not set up');
    return doc;
  });

  app.put(ROUTES.config, forClient, async (request, reply) => {
    mustBeRoot(await signedIn(request));
    const body = parse(saveConfigRequestSchema, request.body);
    const key = recordKeys.tenant(request.tenantId).config;
    const result = await storage.putRecord(key, body.config, body.version);
    if (result === 'moved') {
      return reply
        .status(409)
        .send({ error: 'Conflict', current: await readConfig(request.tenantId) });
    }
    return await readConfig(request.tenantId);
  });

  app.post(ROUTES.signIn, forClient, async (request): Promise<SessionReplyBody> => {
    const device = deviceOf(request);
    const body = parse(signInRequestSchema, request.body);
    const name = normaliseSignInName(body.name);
    const found = await readSignIn(storage, request.tenantId, name);
    // A person the root has not given a password yet has no sign-in to check against.
    const account = found?.user.passwordHash
      ? { ...found.user, passwordHash: found.user.passwordHash }
      : null;
    const user = await checked(account, body.password);
    // One answer for an unknown name, a wrong password and a person who left: which part was
    // wrong is not said.
    const view = user ? await viewOf(request.tenantId, name, user) : null;
    if (!view) throw new HttpError(401, 'Wrong name or password');
    const sessions = sessionsOf(request.tenantId);
    await endKept(request, sessions);
    const { authId, expiresAt } = await sessions.issue(device, name);
    return { authId, expiresAt, user: userViewOf(view) };
  });

  app.post(ROUTES.signOut, forClient, async (request, reply) => {
    const handle = request.headers[AUTH_HEADER];
    if (typeof handle === 'string') await sessionsOf(request.tenantId).end(handle);
    return reply.status(204).send();
  });

  app.get(ROUTES.me, forClient, async (request): Promise<MeReplyBody> => ({
    user: userViewOf(await signedIn(request)),
  }));

  app.post(ROUTES.operatorSignIn, async (request): Promise<OperatorSessionReply> => {
    const device = deviceOf(request);
    const body = parse(signInRequestSchema, request.body);
    const name = normaliseSignInName(body.name);
    const operator = await checked(await readOperator(name), body.password);
    if (!operator) throw new HttpError(401, 'Wrong name or password');
    await endKept(request, operatorSessions);
    const { authId, expiresAt } = await operatorSessions.issue(device, name);
    return { authId, expiresAt, operator: { name } };
  });

  app.post(ROUTES.operatorSignOut, async (request, reply) => {
    const handle = request.headers[AUTH_HEADER];
    if (typeof handle === 'string') await operatorSessions.end(handle);
    return reply.status(204).send();
  });

  app.get(ROUTES.operatorMe, async (request): Promise<OperatorMeReply> => ({
    operator: await operatorSignedIn(request),
  }));

  app.post(ROUTES.operatorClients, async (request, reply): Promise<CreateClientReply> => {
    await operatorSignedIn(request);
    const body = parse(createClientRequestSchema, request.body);
    const made = await createClient(storage, body);
    if (made === 'taken') throw new HttpError(409, 'That code is taken');
    return reply.status(201).send({
      link: `/login?client-code=${body.code}`,
      rootName: ROOT_NAME,
      password: made.password,
    });
  });

  registerStaffRoutes(app, { storage, now, forClient, signedIn, mustBeRoot, mustCan });

  return app;
}
