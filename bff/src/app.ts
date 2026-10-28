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
  type MeReply,
  normaliseSignInName,
  type OperatorMeReply,
  type OperatorSessionReply,
  recordKeys,
  ROUTES,
  saveConfigRequestSchema,
  type SessionReply,
  signInRequestSchema,
  storedClientSchema,
  storedOperatorSchema,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import Fastify, { type FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { createClient, ROOT_NAME } from './clients';
import { HttpError, replyFor } from './errors';
import { verifyAgainstNobody, verifyPassword } from './password';
import { createSessions } from './sessions';

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

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');
  throw new HttpError(400, 'Bad request', { details });
}

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

  async function readUser(tenantId: string, name: string) {
    const found = await storage.getRecord(recordKeys.tenant(tenantId).user(name));
    const parsed = found ? storedUserSchema.safeParse(found.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  async function readOperator(name: string) {
    const found = await storage.getRecord(recordKeys.operatorUser(name));
    const parsed = found ? storedOperatorSchema.safeParse(found.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  /** Who the handle names in this tenant. Only a handle that names no live session, or a user no
   * longer there, is a 401; a store that cannot answer throws, and answers 503. */
  async function signedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session =
      typeof handle === 'string' ? await sessionsOf(request.tenantId).resolve(handle) : null;
    const user = session ? await readUser(request.tenantId, session.user) : null;
    if (!session || !user) throw unauthorized();
    return { name: session.user, root: user.root };
  }

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
    const who = await signedIn(request);
    if (!who.root) throw new HttpError(403, 'Forbidden');
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

  app.post(ROUTES.signIn, forClient, async (request): Promise<SessionReply> => {
    const device = deviceOf(request);
    const body = parse(signInRequestSchema, request.body);
    const name = normaliseSignInName(body.name);
    const user = await checked(await readUser(request.tenantId, name), body.password);
    // One answer for an unknown name and a wrong password: which part was wrong is not said.
    if (!user) throw new HttpError(401, 'Wrong name or password');
    const { authId, expiresAt } = await sessionsOf(request.tenantId).issue(device, name);
    return { authId, expiresAt, user: { name, root: user.root } };
  });

  app.post(ROUTES.signOut, forClient, async (request, reply) => {
    const handle = request.headers[AUTH_HEADER];
    if (typeof handle === 'string') await sessionsOf(request.tenantId).end(handle);
    return reply.status(204).send();
  });

  app.get(ROUTES.me, forClient, async (request): Promise<MeReply> => ({
    user: await signedIn(request),
  }));

  app.post(ROUTES.operatorSignIn, async (request): Promise<OperatorSessionReply> => {
    const device = deviceOf(request);
    const body = parse(signInRequestSchema, request.body);
    const name = normaliseSignInName(body.name);
    const operator = await checked(await readOperator(name), body.password);
    if (!operator) throw new HttpError(401, 'Wrong name or password');
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

  return app;
}
