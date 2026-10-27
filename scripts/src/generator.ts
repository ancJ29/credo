import { randomBytes } from 'node:crypto';
import { hashPassword } from '@credo/bff/password';
import { type CStorageClient, recordKeys, type StoredUser, type TenantConfig } from '@credo/shared';

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

export const ROOT_NAME = 'root';

/** Random for each stack, so no password is written anywhere in the repository. */
export const newRootPassword = () => randomBytes(12).toString('base64url');

/**
 * Piece 1's demo data: the tenant's settings, and its root, the first user, made with the tenant
 * through the BFF's own hash and the shared record keys. Only the hash is stored. Writes only
 * where nothing exists, so a second run over a tenant stops rather than replaces it.
 */
export async function seedDemoTenant(
  storage: CStorageClient,
  { rootPassword }: { rootPassword: string },
) {
  const root: StoredUser = { passwordHash: await hashPassword(rootPassword), root: true };
  const written = [
    await storage.putRecord(recordKeys.user(ROOT_NAME), root, null),
    await storage.putRecord(recordKeys.config, DEMO_CONFIG, null),
  ];
  if (written.includes('moved')) throw new Error('the tenant already holds data: not seeded over');
}
