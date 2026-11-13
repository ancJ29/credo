import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/**
 * A store of this Mac's own for the length of `use`: c-storage built from the checkout and started
 * on a scratch database in a temp folder, its service registered; stopped, and the folder removed
 * with its database, however `use` ends.
 */
export async function withLocalStore<T>(use: (storage: CStorageClient) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'credo-local-store-'));
  const stops: (() => Promise<unknown>)[] = [];
  try {
    const binary = join(dir, 'c-storage');
    await buildCStorage(binary);
    const store = await startStore(binary, dir, stops);
    return await use(store.storage);
  } finally {
    for (const stop of stops.splice(0)) await stop();
    await rm(dir, { recursive: true, force: true });
  }
}
