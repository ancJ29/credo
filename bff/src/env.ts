import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  HOST: z.string().min(1).default('127.0.0.1'),
  C_STORAGE_URL: z.url(),
  /** c-storage's `x-internal-access-key`, the stack's. */
  INTERNAL_ACCESS_KEY: z.string().min(1),
  /** The one service this BFF is, which is the tenant. */
  SERVICE_CODE: z.string().min(1),
  SERVICE_ACCESS_KEY: z.string().min(1),
});

/** The BFF's configuration from its environment. It never holds c-storage's super-admin key: that
 * key registers the service at stack start and is the stack's alone. An error names the variables
 * at fault and never a value, which may be a key. */
export function readEnv(env: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`invalid environment: ${names.join(', ')}`);
  }
  return parsed.data;
}
