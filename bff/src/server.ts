import { createCStorageClient } from '@credo/shared';
import { buildApp } from './app';
import { readEnv } from './env';

/** The BFF as a process runs it: the environment to the app, the app to a listener. The Lambda
 * entry waits for a signed client (open item 5). */
export async function startBff(
  env: Record<string, string | undefined>,
  { now = Date.now, logger = true } = {},
) {
  const config = readEnv(env);
  const storage = createCStorageClient({
    baseUrl: config.C_STORAGE_URL,
    internalAccessKey: config.INTERNAL_ACCESS_KEY,
    serviceCode: config.SERVICE_CODE,
    accessKey: config.SERVICE_ACCESS_KEY,
  });
  const app = buildApp({ storage, now, logger });
  await app.listen({ port: config.PORT, host: config.HOST });
  return app;
}
