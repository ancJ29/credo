import { type ChildProcess, spawn } from 'node:child_process';
import { open, readFile } from 'node:fs/promises';
import { type AddressInfo, createServer } from 'node:net';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nothing listens on now. Another process may take it before the child binds, which the
 * child reports by exiting, and `waitUntilUp` then says so with the child's own log. */
export function freePort() {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

export type Started = { child: ChildProcess; logFile: string; stop: () => Promise<void> };

/** The one part of this process's environment a child is given: where the machine keeps its temp
 * files, which the loader that runs the BFF writes its cache into. */
const TEMP_FOLDER = ['TMPDIR', 'TMP', 'TEMP'];

/** A child whose output goes to `logFile`, stopped by `stop()` or, if this process dies first, at
 * its exit. It runs in the `env` given and the temp folder's variables, and nothing else of this
 * process's environment, so a key this process holds (the super-admin key, a cloud login) is
 * never inherited by accident. */
export async function startProcess(
  command: string,
  args: string[],
  options: { env: Record<string, string>; logFile: string },
): Promise<Started> {
  const log = await open(options.logFile, 'a');
  const child = spawn(command, args, {
    env: {
      ...Object.fromEntries(
        TEMP_FOLDER.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
      ),
      ...options.env,
    },
    stdio: ['ignore', log.fd, log.fd],
  });
  await log.close();
  /* v8 ignore next -- untested: the hook runs only on a normal exit of this process, a crash with the child still up; no test outlives its own process */
  const killAtExit = () => child.kill('SIGKILL');
  process.once('exit', killAtExit);
  return {
    child,
    logFile: options.logFile,
    stop: async () => {
      process.off('exit', killAtExit);
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    },
  };
}

/** What each server the stack starts logs once it has bound its port. */
const LISTENING = /listening/i;

/** Waits until `url` answers with a success and the child has logged that it is listening, or says
 * why it never did: the child's exit and the end of its log, or the time spent. The log line is
 * what proves the answer is the child's own: a stranger already on the port answers too, and the
 * child, unable to bind, never logs it. */
export async function waitUntilUp(
  url: string,
  started: Started,
  what: string,
  timeoutMs = 20_000,
  headers: Record<string, string> = {},
) {
  for (let waited = 0; waited < timeoutMs; waited += 25) {
    if (started.child.exitCode !== null) {
      const log = await readFile(started.logFile, 'utf8');
      throw new Error(`${what} exited ${started.child.exitCode}: ${log.trim().slice(-600)}`);
    }
    if (LISTENING.test(await readFile(started.logFile, 'utf8'))) {
      const reply = await fetch(url, { headers }).catch(() => null);
      if (reply?.ok) return;
    }
    await sleep(25);
  }
  throw new Error(`${what} did not answer ${url} in ${timeoutMs / 1000} s`);
}
