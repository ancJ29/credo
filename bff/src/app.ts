import {
  AUTH_HEADER,
  type ConfigDoc,
  type CStorageClient,
  deviceIdSchema,
  DEVICE_HEADER,
  type MeReply,
  normaliseSignInName,
  recordKeys,
  ROUTES,
  saveConfigRequestSchema,
  type SessionReply,
  signInRequestSchema,
  storedUserSchema,
  tenantConfigSchema,
} from '@credo/shared';
import Fastify, { type FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { HttpError, replyFor } from './errors';
import { verifyAgainstNobody, verifyPassword } from './password';
import { createSessions } from './sessions';

export type AppDeps = {
  /** The one service this BFF is, which is the tenant: nothing on the wire names a client. */
  storage: CStorageClient;
  now: () => number;
  logger: boolean;
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
  const sessions = createSessions({ storage, now });

  app.setErrorHandler((error, request, reply) => {
    const { status, body } = replyFor(error);
    if (status >= 500) request.log.error({ err: error }, 'request failed');
    return reply.status(status).send(body);
  });

  async function readUser(name: string) {
    const found = await storage.getRecord(recordKeys.user(name));
    const parsed = found ? storedUserSchema.safeParse(found.data) : null;
    return parsed?.success ? parsed.data : null;
  }

  /** The user, if the name is known and the password is theirs. An unknown name still spends a
   * check, so it takes as long as a wrong password. */
  async function checkedUser(name: string, password: string) {
    const user = await readUser(name);
    if (!user) return await verifyAgainstNobody(password);
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  }

  /** Who the handle names. Only a handle that names no live session, or a user no longer there,
   * is a 401; a store that cannot answer throws, and answers 503. */
  async function signedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const session = typeof handle === 'string' ? await sessions.resolve(handle) : null;
    const user = session ? await readUser(session.user) : null;
    if (!session || !user) throw unauthorized();
    return { name: session.user, root: user.root };
  }

  async function readConfig(): Promise<ConfigDoc | null> {
    const found = await storage.getRecord(recordKeys.config);
    // A config that does not parse throws: the boot stops with a 500, never on another's defaults.
    return found ? { config: tenantConfigSchema.parse(found.data), version: found.tag } : null;
  }

  app.get(ROUTES.config, async () => {
    const doc = await readConfig();
    if (!doc) throw new HttpError(404, 'Not set up');
    return doc;
  });

  app.put(ROUTES.config, async (request, reply) => {
    const who = await signedIn(request);
    if (!who.root) throw new HttpError(403, 'Forbidden');
    const body = parse(saveConfigRequestSchema, request.body);
    const result = await storage.putRecord(recordKeys.config, body.config, body.version);
    if (result === 'moved') {
      return reply.status(409).send({ error: 'Conflict', current: await readConfig() });
    }
    return await readConfig();
  });

  app.post(ROUTES.signIn, async (request): Promise<SessionReply> => {
    const device = deviceIdSchema.safeParse(request.headers[DEVICE_HEADER]);
    if (!device.success) throw new HttpError(400, 'Bad request', { details: DEVICE_HEADER });
    const body = parse(signInRequestSchema, request.body);
    const name = normaliseSignInName(body.name);
    const user = await checkedUser(name, body.password);
    // One answer for an unknown name and a wrong password: which part was wrong is not said.
    if (!user) throw new HttpError(401, 'Wrong name or password');
    const { authId, expiresAt } = await sessions.issue(device.data, name);
    return { authId, expiresAt, user: { name, root: user.root } };
  });

  app.post(ROUTES.signOut, async (request, reply) => {
    const handle = request.headers[AUTH_HEADER];
    if (typeof handle === 'string') await sessions.end(handle);
    return reply.status(204).send();
  });

  app.get(ROUTES.me, async (request): Promise<MeReply> => ({ user: await signedIn(request) }));

  return app;
}
