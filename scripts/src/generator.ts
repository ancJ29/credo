import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { hashPassword, newPassword } from '@credo/bff/password';
import {
  type CStorageClient,
  recordKeys,
  type StoredOperator,
  type TenantConfig,
} from '@credo/shared';

const logo = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#2f7d6d"/><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>',
).toString('base64')}`;

/** An invented company, never a client's. Fixed, so every walk starts from the same screens. */
export const DEMO_CONFIG: TenantConfig = {
  name: 'Minh Phát',
  logo,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

export { ROOT_NAME };
export const DEMO_CODE = 'demo';
export const OPERATOR_NAME = 'operator';

/** Random for each stack, so no password is written anywhere in the repository. */
export const newOperatorPassword = newPassword;

/**
 * The stack's data: the operator's account, and the demo client made by the operator's own
 * create function, with piece 1's demo settings. Only hashes are stored. Every write is
 * where nothing exists, so a second run over a service stops rather than replaces it. Returns the
 * root's first password, which the create made.
 */
export async function seedDemo(
  storage: CStorageClient,
  { operatorPassword }: { operatorPassword: string },
) {
  const operator: StoredOperator = { passwordHash: await hashPassword(operatorPassword) };
  const saved = await storage.putRecord(recordKeys.operatorUser(OPERATOR_NAME), operator, null);
  const made = await createClient(storage, {
    code: DEMO_CODE,
    name: DEMO_CONFIG.name,
    settings: DEMO_CONFIG,
  });
  if (saved === 'moved' || made === 'taken') {
    throw new Error('the service already holds data: not seeded over');
  }
  return { rootPassword: made.password };
}
