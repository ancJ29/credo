import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCStorageClient, registerCStorageService } from '@credo/shared';

export type RunningCStorage = {
  baseUrl: string;
  internalAccessKey: string;
  superAdminKey: string;
  stop: () => Promise<void>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nothing listens on now. Another process may take it before c-storage binds, which
 * c-storage reports by exiting; `startCStorage` then asks for another. */
export function freePort() {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function answers(url: string, child: ChildProcess) {
  for (let waited = 0; waited < 10_000; waited += 25) {
    if (child.exitCode !== null) return false;
    const reply = await fetch(`${url}/health`).catch(() => null);
    if (reply?.ok) return true;
    await sleep(25);
  }
  throw new Error('c-storage did not answer /health in 10 s');
}

/** The real c-storage on a fresh database and a free loopback port, stopped by `stop()` or at
 * the test process's exit. */
export async function startCStorage(binary: string): Promise<RunningCStorage> {
  const dir = await mkdtemp(join(tmpdir(), 'credo-cs-db-'));
  const internalAccessKey = randomBytes(24).toString('hex');
  const superAdminKey = randomBytes(24).toString('hex');
  for (let attempt = 0; attempt < 5; attempt++) {
    const port = await freePort();
    const child = spawn(binary, [], {
      env: {
        PORT: String(port),
        DB_PATH: join(dir, 'records.db'),
        INTERNAL_ACCESS_KEY: internalAccessKey,
        X_SUPER_ADMIN_KEY: superAdminKey,
      },
      stdio: 'ignore',
    });
    const killAtExit = () => child.kill('SIGKILL');
    process.once('exit', killAtExit);
    const baseUrl = `http://127.0.0.1:${port}`;
    if (await answers(baseUrl, child)) {
      return {
        baseUrl,
        internalAccessKey,
        superAdminKey,
        stop: async () => {
          const exited = new Promise((resolve) => child.once('exit', resolve));
          child.kill('SIGTERM');
          await exited;
          process.off('exit', killAtExit);
          await rm(dir, { recursive: true, force: true });
        },
      };
    }
    process.off('exit', killAtExit);
  }
  await rm(dir, { recursive: true, force: true });
  throw new Error('c-storage did not start on any of 5 ports');
}

/** A service of its own on the running c-storage: a test's tenant, isolated from every other
 * test's records, with a client that holds only that service's keys. */
export async function freshTenant(cs: RunningCStorage) {
  const serviceCode = `t-${randomUUID()}`;
  const accessKey = randomBytes(24).toString('hex');
  const connection = { baseUrl: cs.baseUrl, internalAccessKey: cs.internalAccessKey };
  await registerCStorageService(
    { ...connection, superAdminKey: cs.superAdminKey },
    { code: serviceCode, accessKey },
  );
  return {
    serviceCode,
    accessKey,
    connection,
    client: createCStorageClient({ ...connection, serviceCode, accessKey }),
  };
}
