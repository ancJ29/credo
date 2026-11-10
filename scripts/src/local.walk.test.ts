import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCStorageClient } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type LocalIo, type LocalPaths, localPaths, runLocal } from './local';
import { freePort } from './running/processes';
import { buildArtifacts, startStack } from './stack';

let root: string;
let paths: LocalPaths;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'credo-local-walk-'));
  paths = localPaths(root);
  await buildArtifacts(paths.build);
});
afterAll(() => rm(root, { recursive: true, force: true }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * The commands together on one real stack: c-storage, the BFF and the front start from the built
 * files, the handle is published, `status` reads it, `seed` fills a second tenant through the
 * handle, a second seed is refused, `down` ends the processes and reads the world back, and `status`
 * then says nothing is up. In place of `up`, which leaves a detached process no test may leave, the
 * keeper runs in this process and `down` asks it to end through a stand-in for the signal.
 */
describe('the local environment, whole', () => {
  it('comes up, is read, takes a seed, refuses a second, and is cleared', async () => {
    const ports = {
      front: await freePort(),
      cStorage: await freePort(),
      bff: await freePort(),
      seedDoor: await freePort(),
    };
    const printed: string[] = [];
    const errors: string[] = [];
    let ask!: () => void;
    const stopped = new Promise<void>((resolve) => (ask = resolve));
    let keeperEnded = false;
    const io: LocalIo = {
      out: (line) => printed.push(line),
      err: (line) => errors.push(line),
      paths,
      ports,
      build: () => Promise.reject(new Error('built already')),
      keeper: () => Promise.reject(new Error('the keeper runs in this process')),
      clock: () => '00:00',
      waitMs: 1000,
      heartbeatMs: 1000,
      env: {},
      connect: (target) => createCStorageClient(target),
      // This process stands in for the keeper: it is "running" until `keep` has ended.
      alive: (pid) => {
        if (pid === process.pid) return !keeperEnded;
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      },
      signal: (pid) => {
        if (pid === process.pid) ask();
        else process.kill(pid, 'SIGTERM');
      },
      commandOf: (pid) =>
        pid === process.pid
          ? 'node --import tsx scripts/src/local-main.ts keep'
          : `${join(paths.build, 'c-storage')} bff/src/main.ts`,
      listProcesses: () => [],
      settleMs: 10_000,
      start: startStack,
      stopped,
    };
    const keeping = runLocal(['keep'], io).finally(() => (keeperEnded = true));
    try {
      while (!(await exists(paths.handle)) && !keeperEnded) await sleep(50);
      expect(errors).toEqual([]);

      const say = async (...argv: string[]) => {
        printed.length = 0;
        const status = await runLocal(argv, io);
        return { status, lines: [...printed] };
      };
      const up = await say('status');
      expect(up.status).toBe(0);
      expect(up.lines.filter((line) => line.includes(': up on port'))).toHaveLength(4);
      expect(up.lines.at(-1)).toBe('tenants: 3');

      const seeded = await say('seed', 'acme', 'Acme Foods');
      expect(seeded.status).toBe(0);
      expect(seeded.lines[0]).toBe(
        `acme (Acme Foods): http://localhost:${ports.front}/login?client-code=acme`,
      );
      expect((await say('status')).lines.at(-1)).toBe('tenants: 4');

      errors.length = 0;
      expect((await say('seed', 'acme')).status).toBe(2);
      expect(errors).toEqual([
        'acme is a tenant here already: nothing was seeded and nothing was changed',
      ]);
      expect((await say('status')).lines.at(-1)).toBe('tenants: 4');

      const down = await say('down');
      expect(down.status).toBe(0);
      expect(down.lines.at(-1)).toBe('down: everything is cleared');
      expect(await exists(paths.dir)).toBe(false);
      await expect(fetch(`http://127.0.0.1:${ports.cStorage}/health`)).rejects.toThrow();
      await expect(fetch(`http://localhost:${ports.front}/`)).rejects.toThrow();
      expect((await say('status')).lines).toEqual(['nothing is up: there is no handle']);
    } finally {
      ask();
      await keeping;
    }
  });
});
