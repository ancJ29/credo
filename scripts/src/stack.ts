import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createCStorageClient } from '@credo/shared';
import { build } from 'vite';
import { createFront } from './front';
import { newRootPassword, ROOT_NAME, seedDemoTenant } from './generator';
import { freePort, startProcess, waitUntilUp } from './processes';
import { ensureService } from './register';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const UI_DIR = join(ROOT, 'ui');
const SERVICE_CODE = 'demo';

export type Artifacts = { cStorage: string; uiDir: string; dir: string };

/**
 * What the stack runs, built from the checkout: c-storage as a binary for this machine, and the
 * UI's files. Built once and started as often as needed; `dir` holds the binary.
 */
export async function buildArtifacts(dir: string): Promise<Artifacts> {
  const cStorage = join(dir, 'c-storage');
  await promisify(execFile)('go', ['build', '-o', cStorage, './cmd/server'], {
    cwd: join(ROOT, 'c-storage'),
    env: { ...process.env, CGO_ENABLED: '0' },
  });
  await build({ root: UI_DIR, logLevel: 'warn' });
  return { cStorage, uiDir: join(UI_DIR, 'dist/app'), dir };
}

export type RunningStack = {
  /** The front, where a browser goes. */
  url: string;
  rootName: string;
  /** Known to this process and to whoever it hands it to; stored nowhere readable. */
  rootPassword: string;
  /** The folder the stack keeps its database and logs in, removed when the stack goes down. */
  dataDir: string;
};

const listening = (server: Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

const key = () => randomBytes(24).toString('hex');

/**
 * The local stack for the length of `use`: c-storage on a fresh database, the BFF's service
 * registered with the super-admin key (which the BFF never holds), the demo tenant and its root
 * written, the BFF started, and the front standing before them. Everything goes down when `use`
 * ends, however it ends, and the database with it.
 */
export async function withStack<T>(
  artifacts: Artifacts,
  use: (stack: RunningStack) => Promise<T>,
): Promise<T> {
  const dataDir = await mkdtemp(join(tmpdir(), 'credo-stack-'));
  const stops: (() => Promise<unknown>)[] = [];
  try {
    const internalAccessKey = key();
    const superAdminKey = key();
    const service = { code: SERVICE_CODE, accessKey: key() };
    const csPort = await freePort();
    const cStorageUrl = `http://127.0.0.1:${csPort}`;
    const cStorage = await startProcess(artifacts.cStorage, [], {
      env: {
        PORT: String(csPort),
        DB_PATH: join(dataDir, 'records.db'),
        INTERNAL_ACCESS_KEY: internalAccessKey,
        X_SUPER_ADMIN_KEY: superAdminKey,
      },
      logFile: join(dataDir, 'c-storage.log'),
    });
    stops.unshift(cStorage.stop);
    await waitUntilUp(`${cStorageUrl}/health`, cStorage, 'c-storage');

    await ensureService({ baseUrl: cStorageUrl, internalAccessKey, superAdminKey }, service);
    const rootPassword = newRootPassword();
    await seedDemoTenant(
      createCStorageClient({
        baseUrl: cStorageUrl,
        internalAccessKey,
        serviceCode: service.code,
        accessKey: service.accessKey,
      }),
      { rootPassword },
    );

    const bffPort = await freePort();
    const bffUrl = `http://127.0.0.1:${bffPort}`;
    const bff = await startProcess(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), join(ROOT, 'bff/src/main.ts')],
      {
        env: {
          PORT: String(bffPort),
          C_STORAGE_URL: cStorageUrl,
          INTERNAL_ACCESS_KEY: internalAccessKey,
          SERVICE_CODE: service.code,
          SERVICE_ACCESS_KEY: service.accessKey,
        },
        logFile: join(dataDir, 'bff.log'),
      },
    );
    stops.unshift(bff.stop);
    await waitUntilUp(`${bffUrl}/api/config`, bff, 'the BFF');

    const front = createFront({ staticDir: artifacts.uiDir, bffUrl });
    stops.unshift(() => new Promise((resolve) => front.close(resolve)));
    const port = await listening(front);

    return await use({
      url: `http://127.0.0.1:${port}`,
      rootName: ROOT_NAME,
      rootPassword,
      dataDir,
    });
  } finally {
    for (const stop of stops) await stop();
    await rm(dataDir, { recursive: true, force: true });
  }
}
