import type { CStorageClient } from '@credo/shared';
import { normaliseSignInName, recordKeys } from '@credo/shared';
import { buildApp } from '../src/app';
import { hashPassword } from '../src/password';
import { freshTenant, type RunningCStorage } from './c-storage';

export const DEVICE = 'device-aaaa-0001';
export const OTHER_DEVICE = 'device-bbbb-0002';
export const ROOT = { name: 'root', password: 'correct horse battery' };

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A clock the test moves, started on a fixed day. */
function clock() {
  let time = Date.UTC(2026, 9, 28, 9, 0, 0);
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

export async function seedUser(
  storage: CStorageClient,
  user: { name: string; password: string; root: boolean },
) {
  await storage.putRecord(recordKeys.user(normaliseSignInName(user.name)), {
    passwordHash: await hashPassword(user.password),
    root: user.root,
  });
}

/** A tenant of its own on the running c-storage, the root seeded as the stack will make it, and a
 * BFF over it. Over `storage` when a test wraps the client. */
export async function tenantWithRoot(
  cs: RunningCStorage,
  options: { now?: () => number; wrap?: (client: CStorageClient) => CStorageClient } = {},
) {
  const tenant = await freshTenant(cs);
  await seedUser(tenant.client, { ...ROOT, root: true });
  const time = clock();
  const app = buildApp({
    storage: options.wrap ? options.wrap(tenant.client) : tenant.client,
    now: options.now ?? time.now,
    logger: false,
  });
  return { ...tenant, app, time };
}

export type TenantApp = Awaited<ReturnType<typeof tenantWithRoot>>['app'];

export async function signIn(
  app: TenantApp,
  credentials: { name: string; password: string } = ROOT,
  device = DEVICE,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    headers: { 'x-device-id': device },
    payload: credentials,
  });
  return { response, body: response.json<{ authId: string; expiresAt: number }>() };
}

export const withAuth = (authId: string) => ({ 'x-auth-id': authId });
