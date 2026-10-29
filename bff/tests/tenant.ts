import { randomUUID } from 'node:crypto';
import type { InjectOptions } from 'fastify';
import {
  CLIENT_HEADER,
  type CStorageClient,
  type Employee,
  normaliseSignInName,
  recordKeys,
  type StoredOperator,
  type StoredUser,
} from '@credo/shared';
import { buildApp } from '../src/app';
import { hashPassword } from '../src/password';
import { freshTenant, type RunningCStorage } from './c-storage';

export const DEVICE = 'device-aaaa-0001';
export const OTHER_DEVICE = 'device-bbbb-0002';
export const ROOT = { name: 'root', password: 'correct horse battery' };

export const CODE = 'acme-co';
export const OPERATOR = { name: 'operator', password: 'an operator password' };

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
  tenantId: string,
  user: { name: string; password: string; root: boolean },
) {
  const stored: StoredUser = {
    passwordHash: await hashPassword(user.password),
    root: user.root,
    employeeId: null,
    passwordAt: 0,
  };
  await storage.putRecord(recordKeys.tenant(tenantId).user(normaliseSignInName(user.name)), stored);
}

/** A person and their sign-in, written as the root's add leaves them, with the test's password. */
export async function seedEmployee(
  storage: CStorageClient,
  tenantId: string,
  person: Partial<Employee> & { code: string; password?: string | null },
) {
  const { password = 'Staff-pass-1!', ...given } = person;
  const employee: Employee = {
    id: randomUUID(),
    name: 'A person',
    department: null,
    position: null,
    permissions: {},
    archived: false,
    extra: {},
    ...given,
  };
  const keys = recordKeys.tenant(tenantId);
  const stored: StoredUser = {
    passwordHash: password === null ? null : await hashPassword(password),
    root: false,
    employeeId: employee.id,
    passwordAt: 0,
  };
  await storage.putRecord(keys.user(normaliseSignInName(employee.code)), stored);
  await storage.putRecord(keys.employee(employee.id), employee);
  return { employee, password };
}

export async function seedOperator(
  storage: CStorageClient,
  operator: { name: string; password: string } = OPERATOR,
) {
  const stored: StoredOperator = { passwordHash: await hashPassword(operator.password) };
  await storage.putRecord(recordKeys.operatorUser(normaliseSignInName(operator.name)), stored);
}

/** A tenant's index and its root, as the operator's create leaves them but with the test's known
 * password, and no settings yet. Returns the minted id. */
export async function seedTenant(storage: CStorageClient, code: string) {
  const id = randomUUID();
  await storage.putRecord(recordKeys.client(code), { id, name: 'Acme' }, null);
  await seedUser(storage, id, { ...ROOT, root: true });
  return id;
}

/** The BFF over a service of its own on the running c-storage, where tests keep apart. */
export async function bffOn(
  cs: RunningCStorage,
  options: {
    now?: () => number;
    wrap?: (client: CStorageClient) => CStorageClient;
    logger?: Parameters<typeof buildApp>[0]['logger'];
  } = {},
) {
  const service = await freshTenant(cs);
  const time = clock();
  const storage = options.wrap ? options.wrap(service.client) : service.client;
  const app = buildApp({ storage, now: options.now ?? time.now, logger: options.logger ?? false });
  return { ...service, app, time };
}

/** A tenant in a service of its own: the client's index and its root seeded as the operator's
 * create makes them, but with the test's known password and no settings yet (a test that wants
 * settings asks the create, or saves them). The app sends the tenant's code on every call. */
export async function tenantWithRoot(
  cs: RunningCStorage,
  options: Parameters<typeof bffOn>[1] & { code?: string } = {},
) {
  const code = options.code ?? CODE;
  const base = await bffOn(cs, options);
  const id = await seedTenant(base.client, code);
  const app = scoped(base.app, code);
  return { ...base, app, id, code, keys: recordKeys.tenant(id) };
}

/** The same app, every call sent with a client's code unless the call names its own headers. */
export function scoped(app: ReturnType<typeof buildApp>, code: string) {
  return {
    inject: (options: InjectOptions) =>
      app.inject({ ...options, headers: { [CLIENT_HEADER]: code, ...options.headers } }),
    app,
  };
}

export type TenantApp = Pick<ReturnType<typeof scoped>, 'inject'>;

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
