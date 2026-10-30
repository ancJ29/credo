import { randomUUID } from 'node:crypto';
import {
  type ClientListItem,
  clientCodeSchema,
  clientLinkPath,
  CStorageError,
  CREDO_COLOUR,
  newestFirst,
  type CStorageClient,
  type StoredClient,
  recordKeys,
  storedClientSchema,
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
 * local stack's demo client; the operator's route never passes any. `madeAt` is the time the
 * index records, from the caller's clock: the route's is the BFF's own, never a request's.
 * `'taken'` means the code names a client already, and nothing was written.
 */
export async function createClient(
  storage: CStorageClient,
  {
    code,
    name,
    madeAt,
    settings = {},
  }: { code: string; name: string; madeAt: number; settings?: Partial<TenantConfig> },
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
  const index: StoredClient = { id, name, madeAt };
  const saved = await storage.putRecord(recordKeys.client(code), index, null);
  return saved === 'saved' ? { id, password } : 'taken';
}

/**
 * Every client on this stack, as the operator is shown them: the code, the name as made, the time
 * it was made (null for an index written before the time was kept) and the link's path, newest
 * first. It reads the index alone, never a client's own records. Never a short list that looks
 * whole: more than c-storage returns, or a record or key that does not parse, is an error that
 * names the kind and not the key.
 */
export async function listClients(storage: CStorageClient): Promise<ClientListItem[]> {
  const listed = await storage.listRecords(recordKeys.clientPrefix);
  if (listed.more) throw new Error('the client list is longer than c-storage returns');
  return listed.records
    .map((record) => {
      const index = storedClientSchema.safeParse(record.data);
      const code = clientCodeSchema.safeParse(record.key.slice(recordKeys.clientPrefix.length));
      if (!index.success) throw new Error('a client index record does not parse');
      if (!code.success) throw new Error('a client index key holds no client code');
      return {
        code: code.data,
        name: index.data.name,
        madeAt: index.data.madeAt ?? null,
        link: clientLinkPath(code.data),
      };
    })
    .sort(newestFirst);
}
