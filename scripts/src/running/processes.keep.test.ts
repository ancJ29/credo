import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startProcess } from './processes';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-keep-test-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `code` as a process of its own and answers what it printed once it has exited. */
const runToExit = (code: string) =>
  new Promise<string>((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', code],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let printed = '';
    runner.stdout.on('data', (chunk: Buffer) => (printed += String(chunk)));
    runner.once('error', reject);
    runner.once('exit', () => resolve(printed));
  });

const startAndLeave = (keepOnExit: boolean) =>
  runToExit(`
    import { startProcess } from ${JSON.stringify(fileURLToPath(new URL('./processes.ts', import.meta.url)))};
    // The child ends on its own after 15 s: a check that fails midway leaves nothing for long.
    const started = await startProcess(process.execPath, ['-e', 'setTimeout(() => {}, 15000)'], {
      env: {}, logFile: ${JSON.stringify(join(dir, `left-${keepOnExit}.log`))}, keepOnExit: ${keepOnExit},
    });
    console.log(started.child.pid);
    // A starter that ends while its child runs: the exit hook is what a default child dies by.
    process.exit(0);
  `).then((printed) => Number(printed.trim()));

describe('a child that outlives the process that started it', () => {
  it('is still alive after its starter has exited, and ends when it is signalled', async () => {
    const pid = await startAndLeave(true);
    try {
      expect(pid).toBeGreaterThan(0);
      expect(alive(pid)).toBe(true);
    } finally {
      process.kill(pid, 'SIGKILL');
    }
    for (let waited = 0; alive(pid) && waited < 2000; waited += 25) await sleep(25);
    expect(alive(pid)).toBe(false);
  });

  it('is killed with its starter by default, which keepOnExit alone changes', async () => {
    const pid = await startAndLeave(false);
    for (let waited = 0; alive(pid) && waited < 2000; waited += 25) await sleep(25);
    try {
      expect(alive(pid)).toBe(false);
    } finally {
      if (alive(pid)) process.kill(pid, 'SIGKILL');
    }
  });

  it('is stopped by stop() like any other child', async () => {
    const started = await startProcess(process.execPath, ['-e', 'setTimeout(() => {}, 15000)'], {
      env: {},
      logFile: join(dir, 'kept.log'),
      keepOnExit: true,
    });

    await started.stop();

    expect(started.child.signalCode).toBe('SIGTERM');
    expect(alive(started.child.pid!)).toBe(false);
  });
});
