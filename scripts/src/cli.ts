import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Artifacts, withStack } from './stack';

/** `pnpm stack -- <command>` or `pnpm stack <command>`; pnpm may or may not pass the `--` on. */
export const commandOf = (argv: string[]) => (argv[0] === '--' ? argv.slice(1) : argv);

/** Runs `command` with the stack's address and root sign-in in its environment; resolves with its
 * exit status, or 128 + the signal's number when a signal ended it. */
function runCommand(command: string[], env: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143)));
  });
}

/** Resolves at the first Ctrl-C or termination, leaving the stack to go down. */
const untilSignal = () =>
  new Promise<void>((resolve) => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => resolve());
  });

/**
 * The whole of `pnpm stack`: build, bring the stack up, and either run the command given against
 * it or wait for Ctrl-C, then always take the stack down. The exit status is the command's. The
 * root's password is printed once, only when no command was given: a command gets it in its
 * environment and needs no printed copy.
 */
export async function runStack(
  argv: string[],
  build: (dir: string) => Promise<Artifacts>,
  out: (line: string) => void,
) {
  const command = commandOf(argv);
  const dir = await mkdtemp(join(tmpdir(), 'credo-stack-build-'));
  try {
    out('building c-storage and the UI');
    const artifacts = await build(dir);
    return await withStack(artifacts, async (stack) => {
      out(`the stack is up at ${stack.url}`);
      if (command.length > 0) {
        return await runCommand(command, {
          CREDO_URL: stack.url,
          CREDO_ROOT_NAME: stack.rootName,
          CREDO_ROOT_PASSWORD: stack.rootPassword,
        });
      }
      out(`sign in as ${stack.rootName} with the password ${stack.rootPassword}`);
      out('Ctrl-C takes it all down');
      await untilSignal();
      return 0;
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
