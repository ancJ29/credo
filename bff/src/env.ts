import { z } from 'zod';

/** What the BFF needs to reach c-storage, whether a listener or a Lambda runs it. */
const storageShape = {
  C_STORAGE_URL: z.url(),
  /** c-storage's `x-internal-access-key`, the stack's. */
  INTERNAL_ACCESS_KEY: z.string().min(1),
  /** The one service this BFF is, which is the tenant. */
  SERVICE_CODE: z.string().min(1),
  SERVICE_ACCESS_KEY: z.string().min(1),
};

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  HOST: z.string().min(1).default('127.0.0.1'),
  ...storageShape,
});

/** The variables the BFF reads, and so the only ones it is given. */
export const BFF_ENV_KEYS = Object.keys(envSchema.shape);

export type StorageEnv = z.infer<z.ZodObject<typeof storageShape>>;

function failure(error: z.ZodError): never {
  const names = [...new Set(error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`invalid environment: ${names.join(', ')}`);
}

/** The BFF's configuration from its environment. It never holds c-storage's super-admin key: that
 * key registers the service at stack start and is the stack's alone. An error names the variables
 * at fault and never a value, which may be a key. */
export function readEnv(env: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) return failure(parsed.error);
  return parsed.data;
}

/** The Lambda's environment: the same four c-storage variables and no listener, since API
 * Gateway is the listener. Errors as `readEnv` does. */
export function readStorageEnv(env: Record<string, string | undefined>): StorageEnv {
  const parsed = z.object(storageShape).safeParse(env);
  if (!parsed.success) return failure(parsed.error);
  return parsed.data;
}
