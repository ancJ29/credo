import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { buildCStorage } from '@credo/bff/tests/build';
import { createCStorageClient, type CStorageClient } from '@credo/shared';
import { freePort, startProcess, waitUntilUp } from './running/processes';
import { ensureService } from './register';

/** The BFF's service on a store this Mac starts: the stack's and the remake's. */
const SERVICE_CODE = 'demo';

export const newKey = () => randomBytes(24).toString('hex');

export type StoreKeys = {
  internalAccessKey: string;
  superAdminKey: string;
  service: { code: string; accessKey: string };
};

/**
 * c-storage on the database in `dataDir`, its log beside it, and the BFF's service registered with
 * the super-admin key, which only this process holds: what the stack stands on, and the store the
 * remake fills its copies in. Its stop goes first onto `stops` as soon as the process runs, so the
 * caller's own unwinding takes it down whether the start ends well or not.
 */
export async function startStore(
  binary: string,
  dataDir: string,
  stops: (() => Promise<unknown>)[],
  options: { port?: number; keys?: StoreKeys } = {},
) {
  const internalAccessKey = options.keys?.internalAccessKey ?? newKey();
  const superAdminKey = options.keys?.superAdminKey ?? newKey();
  const service = options.keys?.service ?? { code: SERVICE_CODE, accessKey: newKey() };
  const port = options.port ?? (await freePort());
  const url = `http://127.0.0.1:${port}`;
  const started = await startProcess(binary, [], {
    env: {
      PORT: String(port),
      DB_PATH: join(dataDir, 'records.db'),
      INTERNAL_ACCESS_KEY: internalAccessKey,
      X_SUPER_ADMIN_KEY: superAdminKey,
    },
    logFile: join(dataDir, 'c-storage.log'),
  });
  stops.unshift(started.stop);
  await waitUntilUp(`${url}/health`, started, 'c-storage');
  await ensureService({ baseUrl: url, internalAccessKey, superAdminKey }, service);
  const storage = createCStorageClient({
    baseUrl: url,
    internalAccessKey,
    serviceCode: service.code,
    accessKey: service.accessKey,
  });
  // A child that has started has a pid: spawn answers none only for one that never ran.
  return { url, port, pid: started.child.pid!, internalAccessKey, superAdminKey, service, storage };
}

/** The keys of a kept store, beside its database, so the next start on it is let in by its service. */
const KEYS_FILE = 'keys.json';

/** The folder a remake keeps its store in, by name: the credo root's own. */
const KEPT_NAME = '.demo-remake-store';

/** Refuses to empty a folder that holds files but no keys file of a kept store, unless it is named for
 * the remake's store (a mistyped REMAKE_STORE_DIR would be removed whole). */
async function refuseNotAStore(dir: string) {
  const held = await readdir(dir).catch(() => [] as string[]);
  if (held.length > 0 && !held.includes(KEYS_FILE) && basename(dir) !== KEPT_NAME)
    throw new Error(`${dir} is not a kept store (no ${KEYS_FILE} in it): it is not emptied`);
}

/**
 * A store of this Mac's own for the length of `use`: c-storage built from the checkout and started
 * on a database in a temp folder, its service registered, and stopped however `use` ends. With
 * `kept`, the folder is `kept.dir`: emptied first, or with `reuse` started again on the database and
 * keys an earlier run left there; it is removed when `use` ends well and kept when it does not, so a
 * stopped run can be gone on with. A temp folder is always removed.
 */
export async function withLocalStore<T>(
  use: (storage: CStorageClient, dir: string) => Promise<T>,
  kept?: { dir: string; reuse: boolean },
): Promise<T> {
  const dir = kept?.dir ?? (await mkdtemp(join(tmpdir(), 'credo-local-store-')));
  if (kept && !kept.reuse) {
    await refuseNotAStore(dir);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true, mode: 0o700 });
  }
  const stops: (() => Promise<unknown>)[] = [];
  let ended = false;
  try {
    const binary = join(dir, 'c-storage');
    await buildCStorage(binary);
    const keysAt = join(dir, KEYS_FILE);
    const keys = kept?.reuse
      ? (JSON.parse(await readFile(keysAt, 'utf8')) as StoreKeys)
      : undefined;
    const store = await startStore(binary, dir, stops, { keys });
    if (kept && !kept.reuse) {
      const { internalAccessKey, superAdminKey, service } = store;
      await writeFile(keysAt, JSON.stringify({ internalAccessKey, superAdminKey, service }), {
        mode: 0o600,
      });
    }
    const result = await use(store.storage, dir);
    ended = true;
    return result;
  } finally {
    for (const stop of stops.splice(0)) await stop();
    if (ended || !kept) await rm(dir, { recursive: true, force: true });
  }
}
