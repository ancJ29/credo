import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCStorageClient } from '@credo/shared';
import { runLocal, LOCAL_PORTS, localPaths } from './local';
import { startProcess } from './running/processes';
import { buildArtifacts, startStack } from './stack';

const [verb = '', root] = process.argv.slice(2);
// The credo root is the folder that holds .bare: the parent of the repository's common git folder.
// `up` reads it from git; the keeper it starts is given it, since a child has no PATH to find git.
const credoRoot =
  (verb === 'keep' ? root : undefined) ??
  dirname(
    execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
    }).trim(),
  );
const paths = localPaths(credoRoot);
const WAIT_MS = 300_000;

const stopped = new Promise<void>((resolve) => {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(signal, resolve);
});

process.exitCode = await runLocal(process.argv.slice(2), {
  out: console.log,
  err: console.error,
  paths,
  ports: LOCAL_PORTS,
  build: buildArtifacts,
  keeper: () =>
    startProcess(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), fileURLToPath(import.meta.url), 'keep', credoRoot],
      { env: {}, logFile: paths.keeperLog, keepOnExit: true },
    ),
  clock: (afterMs) => new Date(Date.now() + afterMs).toTimeString().slice(0, 5),
  waitMs: WAIT_MS,
  heartbeatMs: 30_000,
  env: process.env,
  connect: (target) => createCStorageClient(target),
  alive: (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  },
  signal: (pid) => process.kill(pid, 'SIGTERM'),
  commandOf: (pid) => {
    try {
      return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
    } catch {
      return undefined;
    }
  },
  settleMs: 10_000,
  start: startStack,
  stopped,
});
