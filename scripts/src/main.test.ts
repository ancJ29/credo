import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goBuildEnv } from '@credo/bff/tests/build';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPTS = fileURLToPath(new URL('..', import.meta.url));

let temp: string;
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), 'credo-main-test-'));
});
afterAll(() => rm(temp, { recursive: true, force: true }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const portIn = async (file: string) =>
  Number((/127\.0\.0\.1:(\d+)/.exec(await readFile(file, 'utf8')) ?? [])[1]);
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('pnpm stack as a process', () => {
  it('a termination signal takes the whole stack down: its servers, its command and its database', async () => {
    const pidFile = join(temp, 'command.pid');
    // Its own temp folder, so what the stack leaves in it is easy to read.
    const stackTemp = await mkdtemp(join(temp, 'tmp-'));
    const command = `require('fs').writeFileSync(process.env.PID_FILE, String(process.pid)); setInterval(() => {}, 1000)`;
    const stack = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/main.ts', '--', process.execPath, '-e', command],
      {
        cwd: SCRIPTS,
        env: {
          ...process.env,
          ...goBuildEnv(process.env),
          TMPDIR: stackTemp,
          PID_FILE: pidFile,
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    );
    let output = '';
    stack.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const exited = new Promise<number | null>((resolve) =>
      stack.once('exit', (code, signal) => resolve(signal ? null : code)),
    );
    let commandPid = 0;
    try {
      while (!output.includes('the stack is up')) {
        if (stack.exitCode !== null) throw new Error(`the stack exited early: ${output}`);
        await sleep(100);
      }
      while (!(await readFile(pidFile, 'utf8').catch(() => ''))) await sleep(50);
      commandPid = Number(await readFile(pidFile, 'utf8'));
      const [running] = (await readdir(stackTemp)).filter(
        (name) => name.startsWith('credo-stack-') && !name.startsWith('credo-stack-build-'),
      );
      const ports = [
        await portIn(join(stackTemp, running, 'bff.log')),
        await portIn(join(stackTemp, running, 'c-storage.log')),
      ];
      const front = /http:\/\/127\.0\.0\.1:\d+/.exec(output)![0];
      expect(
        (await fetch(`${front}/api/config`, { headers: { 'x-client-code': 'demo' } })).status,
      ).toBe(200);

      stack.kill('SIGTERM');

      expect(await exited).toBe(143);
      for (const port of ports) {
        await expect(fetch(`http://127.0.0.1:${port}/`), String(port)).rejects.toThrow();
      }
      await expect(fetch(`${front}/api/config`)).rejects.toThrow();
      expect(alive(commandPid)).toBe(false);
      // Nothing of the stack's is left: its data folder and its build folder are gone (the loader's
      // own cache is not the stack's).
      expect((await readdir(stackTemp)).filter((name) => name.startsWith('credo-'))).toEqual([]);
    } finally {
      stack.kill('SIGKILL');
      if (commandPid && alive(commandPid)) process.kill(commandPid, 'SIGKILL');
    }
  });
});
