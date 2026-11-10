import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createActivityClient } from '@credo/shared';
import { freePort } from './c-storage';

export type RunningAudit = {
  /** The keyed listener, where entries are written and tokens minted. */
  keyedUrl: string;
  /** The open listener, where a token reads. */
  openUrl: string;
  key: string;
  stop: () => Promise<void>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function answers(url: string, child: ChildProcess) {
  for (let waited = 0; waited < 10_000; waited += 25) {
    if (child.exitCode !== null) return false;
    const reply = await fetch(`${url}/health`).catch(() => null);
    if (reply?.ok) return true;
    await sleep(25);
  }
  throw new Error('the audit service did not answer /health in 10 s');
}

/** The real audit service on a fresh database and two free loopback ports, stopped by `stop()` or
 * at the test process's exit. */
export async function startAudit(binary: string): Promise<RunningAudit> {
  const dir = await mkdtemp(join(tmpdir(), 'credo-audit-db-'));
  const key = randomBytes(24).toString('hex');
  for (let attempt = 0; attempt < 5; attempt++) {
    const [port, openPort] = [await freePort(), await freePort()];
    const child = spawn(binary, [], {
      env: {
        PORT: String(port),
        OPEN_PORT: String(openPort),
        DB_PATH: join(dir, 'activities.db'),
        ACTIVITY_WRITE_KEY: key,
        LOG_LEVEL: 'warn',
      },
      stdio: 'ignore',
    });
    const killAtExit = () => child.kill('SIGKILL');
    process.once('exit', killAtExit);
    const keyedUrl = `http://127.0.0.1:${port}`;
    if (await answers(keyedUrl, child)) {
      return {
        keyedUrl,
        openUrl: `http://127.0.0.1:${openPort}`,
        key,
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
  throw new Error('the audit service did not start on any of 5 ports');
}

/** The client of a running audit service, with its own key. */
export const clientOf = (audit: RunningAudit, timeoutMs?: number) =>
  createActivityClient({
    baseUrl: audit.keyedUrl,
    key: audit.key,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
