import { randomUUID } from 'node:crypto';
import {
  CStorageError,
  CREDO_COLOUR,
  type CStorageClient,
  type StoredClient,
  recordKeys,
  type StoredUser,
  type TenantConfig,
} from '@credo/shared';
import { hashPassword, newPassword } from './password';

export const ROOT_NAME = 'root';

/** A write that must find nothing there. The id is fresh, so a record already under it is a fault
 * of the store and not a caller's to settle: it surfaces as an unavailable store. */
async function createRecord(storage: CStorageClient, key: string, data: unknown) {
  if ((await storage.putRecord(key, data, null)) === 'moved') {
    throw new CStorageError(412, 'a record already sat under a fresh id');
  }
}

/**
 * Makes a client: its settings and its root under a freshly minted id, then the code's index. The
 * index is written last, and with `If-None-Match: *`, so it alone makes the client: a failure
 * before it leaves the code free, and two operators racing for a code leave one winner. The
 * records of the loser stay unreachable, a few hundred bytes. The root's first password is
 * returned here and stored as its hash alone. `settings` replaces the starting settings, for the
 * local stack's demo client; the operator's route never passes any. `'taken'` means the code names a client already, and
 * nothing was written.
 */
export async function createClient(
  storage: CStorageClient,
  { code, name, settings = {} }: { code: string; name: string; settings?: Partial<TenantConfig> },
): Promise<{ id: string; password: string } | 'taken'> {
  if (await storage.getRecord(recordKeys.client(code))) return 'taken';
  const id = randomUUID();
  const keys = recordKeys.tenant(id);
  const password = newPassword();
  const config: TenantConfig = {
    name,
    logo: null,
    colour: CREDO_COLOUR,
    languages: ['vi', 'en'],
    defaultLanguage: 'vi',
    ...settings,
  };
  const root: StoredUser = {
    passwordHash: await hashPassword(password),
    root: true,
    employeeId: null,
    passwordAt: 0,
    generation: '',
  };
  await createRecord(storage, keys.config, config);
  await createRecord(storage, keys.user(ROOT_NAME), root);
  const index: StoredClient = { id, name };
  const saved = await storage.putRecord(recordKeys.client(code), index, null);
  return saved === 'saved' ? { id, password } : 'taken';
}
