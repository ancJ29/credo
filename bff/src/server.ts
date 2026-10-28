import { createCStorageClient } from '@credo/shared';
import { buildApp } from './app';
import { readEnv, type StorageEnv } from './env';

/** The BFF's app on its c-storage: the one build a listener and a Lambda share. */
export function buildBff(
  config: StorageEnv,
  { now = Date.now, logger = true }: { now?: () => number; logger?: boolean } = {},
) {
  const storage = createCStorageClient({
    baseUrl: config.C_STORAGE_URL,
    internalAccessKey: config.INTERNAL_ACCESS_KEY,
    serviceCode: config.SERVICE_CODE,
    accessKey: config.SERVICE_ACCESS_KEY,
  });
  return buildApp({ storage, now, logger });
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
