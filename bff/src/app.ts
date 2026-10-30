import { randomUUID } from 'node:crypto';
import {
  AUTH_HEADER,
  changeOwnPasswordRequestSchema,
  CLIENT_HEADER,
  clientCodeSchema,
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
  type OperatorMeReply,
  type OperatorSessionReply,
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
  storedOperatorSchema,
  type StoredUser,
  tenantConfigSchema,
  type UserView,
} from '@credo/shared';
import Fastify, { type FastifyRequest } from 'fastify';
import { createClient, ROOT_NAME } from './clients';
import { HttpError, parse, replyFor } from './errors';
import { constantTimeEqual } from './constant-time';
import { hashPassword, verifyAgainstNobody, verifyPassword } from './password';
import { createSessions } from './sessions';
import {
  namesPerson,
  readEmailClaim,
  readEmployee,
  readQr,
  readSetup,
  type ReadEmployee,
  readSignIn,
} from './staff-records';
import { registerStaffRoutes } from './staff';

declare module 'fastify' {
  interface FastifyRequest {
    /** The minted id of the tenant a client's call names, set before the route runs. */
    tenantId: string;
  }
}

type SetupRead = Awaited<ReturnType<typeof readSetup>>;

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
   * next step; one that cannot be read throws and answers 503, never a partial set. The setup read
   * for them is handed on, so a route does not read it again: a staff call reads five records. */
  async function viewOf(
    tenantId: string,
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
          ? await readEmployee(storage, tenantId, user.employeeId)
          : null;
    if (!person || person.employee.archived || !namesPerson(name, person.employee)) return null;
    const read = handed.setup ?? (await readSetup(storage, tenantId));
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

  async function readOperator(name: string) {
    const found = await storage.getRecord(recordKeys.operatorUser(name));
    const parsed = found ? storedOperatorSchema.safeParse(found.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  /** Who the handle names in this tenant. A handle that names no live session, a sign-in record
   * no longer there or given a password since the session was issued (its generation no longer
   * equal to the record's), or a person who left, is a 401; a store that cannot answer throws, and answers 503. */
  async function signedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session =
      typeof handle === 'string' ? await sessionsOf(request.tenantId).resolve(handle) : null;
    const found = session ? await readSignIn(storage, request.tenantId, session.user) : null;
    if (!session || !found || session.generation !== found.user.generation) throw unauthorized();
    const view = await viewOf(request.tenantId, session.user, found.user);
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
    mustCan(await signedIn(request), 'settings.canEdit');
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

  /** The sign-in record a typed name opens: the code's own, or, for an email, the record of the code
   * of the person the email names. An email names no one unless that person's record holds it and
   * the company has the email sign-in on (the setup is read first and handed on). No mail is ever
   * sent to it, so it proves nothing but that the root gave it. */
  async function accountOf(tenantId: string, typed: string) {
    if (!typed.includes('@')) {
      return { name: typed, found: await readSignIn(storage, tenantId, typed), handed: {} };
    }
    const setup = await readSetup(storage, tenantId);
    const none = { name: typed, found: null, handed: { setup } };
    if (!staffConfig(setup.setup).fields.email) return none;
    const claim = await readEmailClaim(storage, tenantId, typed);
    const person = claim ? await readEmployee(storage, tenantId, claim.claim.employeeId) : null;
    if (!person || person.employee.email !== typed) return none;
    const name = normaliseSignInName(person.employee.code);
    return { name, found: await readSignIn(storage, tenantId, name), handed: { setup, person } };
  }

  app.post(ROUTES.signIn, forClient, async (request): Promise<SessionReplyBody> => {
    const device = deviceOf(request);
    const body = parse(signInRequestSchema, request.body);
    const typed = normaliseSignInName(body.name);
    const { name, found, handed } = await accountOf(request.tenantId, typed);
    // A person the root has not given a password yet has no sign-in to check against.
    const account = found?.user.passwordHash
      ? { ...found.user, passwordHash: found.user.passwordHash }
      : null;
    const user = await checked(account, body.password);
    // One answer for an unknown name, a wrong password and a person who left: which part was
    // wrong is not said.
    const view = user ? await viewOf(request.tenantId, name, user, handed) : null;
    if (!user || !view) throw new HttpError(401, 'Wrong name or password');
    const sessions = sessionsOf(request.tenantId);
    await endKept(request, sessions);
    const { authId, expiresAt } = await sessions.issue(device, name, user.generation);
    return { authId, expiresAt, user: userViewOf(view) };
  });

  /** A phone opening a QR code's link. Every refusal is the same 401, which says only that the code
   * is not good: a wrong secret, one used before or past its time, a company that turned the QR
   * sign-in off, a person who left. The record is removed over the tag it was read at before the
   * session is issued, so two phones opening one code sign in one. */
  app.post(signInRoutes.qr, forClient, async (request): Promise<SessionReplyBody> => {
    const device = deviceOf(request);
    const body = parse(signInQrRequestSchema, request.body);
    const { tenantId } = request;
    const held = await readQr(storage, tenantId, body.id);
    const opened = held ? await sha256Hex(body.secret) : '';
    const person = held ? await readEmployee(storage, tenantId, body.id) : null;
    if (
      !held ||
      !person ||
      held.qr.expiresAt <= now() ||
      !constantTimeEqual(Buffer.from(held.qr.hash), Buffer.from(opened))
    ) {
      throw unauthorized();
    }
    // The person and the setup are read once and handed on to the view.
    const setup = await readSetup(storage, tenantId);
    if (!staffConfig(setup.setup).fields.qr) throw unauthorized();
    const name = normaliseSignInName(person.employee.code);
    const found = await readSignIn(storage, tenantId, name);
    const view = found ? await viewOf(tenantId, name, found.user, { person, setup }) : null;
    if (!found || !view) throw unauthorized();
    if (
      (await storage.removeRecord(recordKeys.tenant(tenantId).signInQr(body.id), held.tag)) ===
      'moved'
    ) {
      throw unauthorized();
    }
    const sessions = sessionsOf(tenantId);
    await endKept(request, sessions);
    const { authId, expiresAt } = await sessions.issue(device, name, found.user.generation);
    return { authId, expiresAt, user: userViewOf(view) };
  });

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
  app.put(signInRoutes.password, forClient, async (request): Promise<SessionReplyBody> => {
    const who = await signedIn(request);
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
    if ((await storage.putRecord(key, changed, who.signIn.tag)) === 'moved') throw unauthorized();
    const sessions = sessionsOf(request.tenantId);
    await endKept(request, sessions);
    const issued = await sessions.issue(device, who.signInName, changed.generation);
    return { ...issued, user: userViewOf(who) };
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
    const { authId, expiresAt } = await operatorSessions.issue(device, name, '');
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
