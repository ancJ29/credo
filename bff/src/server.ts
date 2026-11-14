import { createHash } from 'node:crypto';
import { createActivityClient, createCStorageClient } from '@credo/shared';
import { buildApp } from './app';
import { BUILD } from './build';
import { constantTimeEqual } from './calling/constant-time';
import { type BffEnv, readEnv } from './env';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** The BFF's app on its c-storage: the one build a listener and a Lambda share. */
export function buildBff(
  config: BffEnv,
  { now = Date.now, logger = true }: { now?: () => number; logger?: boolean } = {},
) {
  const storage = createCStorageClient({
    baseUrl: config.C_STORAGE_URL,
    internalAccessKey: config.INTERNAL_ACCESS_KEY,
    serviceCode: config.SERVICE_CODE,
    accessKey: config.SERVICE_ACCESS_KEY,
  });
  const boxes = Object.fromEntries(
    Object.entries(config.STORAGE_BOXES ?? {}).map(([name, box]) => [
      name,
      createCStorageClient({
        baseUrl: box.url,
        internalAccessKey: box.internalKey,
        serviceCode: config.SERVICE_CODE,
        accessKey: box.serviceKey,
      }),
    ]),
  );
  const activity =
    config.AUDIT_URL === undefined
      ? null
      : // The environment is read with the pair together, so a URL has its key.
        createActivityClient({ baseUrl: config.AUDIT_URL, key: config.AUDIT_KEY as string });
  const app = buildApp({
    storage,
    boxes,
    activity,
    now,
    origin: config.APP_ORIGIN,
    serviceKey: config.SERVICE_ACCESS_KEY,
    logger,
    build: BUILD,
  });
  // The first hook, on every route and on the not-found handler: a call the front door did not
  // pass on is refused before a company is looked up. Digests are compared, so the keys' lengths
  // and bytes are not told by timing, and nothing of the call is logged by this hook.
  const doorKeys = config.FRONT_DOOR_KEYS.split(',').map(digest);
  app.addHook('onRequest', async (request, reply) => {
    const sent = request.headers['x-front-door-key'];
    const sentDigest = digest(typeof sent === 'string' ? sent : '');
    // Every key is compared, so the time does not tell which one matched.
    const matches = doorKeys.map((key) => constantTimeEqual(key, sentDigest));
    if (!matches.includes(true)) return reply.code(403).send({ error: 'Forbidden' });
    return undefined;
  });
  return app;
}

/** The BFF as a process runs it: the environment to the app, the app to a listener. The Lambda
 * entry, `lambda.ts`, takes the same app to API Gateway instead. */
export async function startBff(
  env: Record<string, string | undefined>,
  options: { now?: () => number; logger?: boolean } = {},
) {
  const config = readEnv(env);
  const app = buildBff(config, options);
  await app.listen({ port: config.PORT, host: config.HOST });
  return app;
}
