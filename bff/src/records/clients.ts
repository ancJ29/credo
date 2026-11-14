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
  storedClientDeletionSchema,
  storedClientSchema,
  type StoredUser,
  type TenantConfig,
} from '@credo/shared';
import { hashPassword, newPassword } from '../calling/password';
import { type RecordStore, recordTools, tenantStorage } from './records';

export const ROOT_NAME = 'root';

/** A write that must find nothing there. The id is fresh, so a record already under it is a fault
 * of the store and not a caller's to settle: it surfaces as an unavailable store. */
export async function createRecord(storage: RecordStore, key: string, data: unknown) {
  if ((await storage.putRecord(key, data, null)) === 'moved') {
    throw new CStorageError(412, 'a record already sat under a fresh id');
  }
}

/** The settings a new client starts with: `settings` laid over the defaults. One home, so a caller
 * that asks whether a client still holds them cannot drift from what `createClient` writes. */
export function startingConfig(name: string, settings: Partial<TenantConfig> = {}): TenantConfig {
  return {
    name,
    logo: null,
    colour: CREDO_COLOUR,
    whiteHeader: false,
    whiteMenu: false,
    menuIcons: false,
    languages: ['vi', 'en'],
    defaultLanguage: 'vi',
    ...settings,
  };
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
    box,
  }: {
    code: string;
    name: string;
    madeAt: number;
    settings?: Partial<TenantConfig>;
    /** The box the company lives on: its settings and root are written there and its line names
     * it. None, they sit in `storage` and the line names no box. */
    box?: { name: string; storage: CStorageClient };
  },
): Promise<{ id: string; password: string } | 'taken'> {
  if (await storage.getRecord(recordKeys.client(code))) return 'taken';
  // A deletion of an earlier client of this code still unfinished keeps the code, or its records
  // would be left with no way to finish them.
  if (await storage.getRecord(recordKeys.clientDeletion(code))) return 'taken';
  const id = randomUUID();
  const keys = recordKeys.tenant(id);
  const company = tenantStorage(box?.storage ?? storage, id);
  const password = newPassword();
  const config = startingConfig(name, settings);
  const root: StoredUser = {
    passwordHash: await hashPassword(password),
    root: true,
    employeeId: null,
    passwordAt: 0,
    generation: '',
  };
  await createRecord(company, keys.config, config);
  await createRecord(company, keys.user(ROOT_NAME), root);
  const index: StoredClient = { id, name, madeAt, ...(box ? { box: box.name } : {}) };
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
  const listed = await recordTools(storage).every(
    recordKeys.clientPrefix,
    storedClientSchema,
    'client index',
  );
  return listed
    .map(({ key, record: index }) => {
      const code = clientCodeSchema.safeParse(key.slice(recordKeys.clientPrefix.length));
      if (!code.success) throw new Error('a client index key holds no client code');
      return {
        code: code.data,
        name: index.name,
        madeAt: index.madeAt ?? null,
        link: clientLinkPath(code.data),
      };
    })
    .sort(newestFirst);
}

/** The most records one press of a deletion removes, so one request ends well inside the BFF's
 * time and the page presses again for the rest. */
export const DELETE_BOUND = 200;
/** How many of a press's removals run at once. */
const DELETE_AT_ONCE = 20;

/**
 * Deletes a client whole, as the mirror of `createClient`. With the client's index in hand (read
 * with its tag), it writes the deletion record first, then removes the index only if it is still as
 * it was read: the one door into the client, so from that write the client is out of the list and
 * every session of it is refused at its next step. An index that changed in the meantime (the code
 * deleted and made again by another operator) is another client, which nobody confirmed:
 * `'moved'`, and nothing is swept. An earlier deletion of another tenant under this code, still
 * unfinished, is `'busy'`, and the deletion record is written only over what was read. With no
 * index (`null`) it resumes from the deletion record a press before left, or answers `'unknown'`
 * where there is none. Then it removes up to `DELETE_BOUND` of the records under the tenant's
 * prefix and answers how many are left; the deletion record goes only when a list of the prefix
 * comes back empty. The caller has checked everything before this writes.
 */
export async function deleteClient(
  storage: CStorageClient,
  {
    code,
    index,
    by,
    now,
  }: {
    code: string;
    index: (StoredClient & { tag: string }) | null;
    by: string;
    now: () => number;
  },
): Promise<{ left: number } | 'unknown' | 'busy' | 'moved'> {
  const key = recordKeys.clientDeletion(code);
  let deletion;
  if (index) {
    const prior = await storage.getRecord(key);
    if (prior && storedClientDeletionSchema.parse(prior.data).id !== index.id) return 'busy';
    deletion = { id: index.id, name: index.name, by, startedAt: now() };
    if ((await storage.putRecord(key, deletion, prior?.tag ?? null)) === 'moved') return 'busy';
    if ((await storage.removeRecord(recordKeys.client(code), index.tag)) === 'moved') {
      if (!prior) await storage.removeRecord(key);
      return 'moved';
    }
  } else {
    const held = await storage.getRecord(key);
    if (!held) return 'unknown';
    deletion = storedClientDeletionSchema.parse(held.data);
  }
  const company = tenantStorage(storage, deletion.id);
  const prefix = recordKeys.tenant(deletion.id).all;
  const listed = await company.listRecords(prefix);
  const batch = listed.records.slice(0, DELETE_BOUND);
  for (let from = 0; from < batch.length; from += DELETE_AT_ONCE) {
    await Promise.all(
      batch.slice(from, from + DELETE_AT_ONCE).map((record) => company.removeRecord(record.key)),
    );
  }
  const rest = await company.listRecords(prefix);
  if (rest.records.length === 0 && !rest.more) {
    await storage.removeRecord(key);
    return { left: 0 };
  }
  return { left: rest.records.length };
}
