import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Artifacts, withStack } from './stack';

/** `pnpm stack -- <command>` or `pnpm stack <command>`; pnpm may or may not pass the `--` on. */
export const commandOf = (argv: string[]) => (argv[0] === '--' ? argv.slice(1) : argv);

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
type Signal = (typeof SIGNALS)[number];

/** The status of a process a signal ended, as a shell reads it. */
const statusOfSignal = (signal: NodeJS.Signals) => 128 + constants.signals[signal];

/**
 * Catches Ctrl-C, a termination and a hang-up for as long as the stack is being built, brought up
 * or used, so none of them ends this process before the stack is down. The first of each is
 * caught; a second falls to the default and ends the process, the way out of a stuck shutdown.
 */
function watchSignals() {
  let received: Signal | null = null;
  let forwardTo: ((signal: Signal) => void) | null = null;
  const { promise: arrived, resolve: wake } = Promise.withResolvers<void>();
  const onSignal = (signal: Signal) => {
    received ??= signal;
    forwardTo?.(signal);
    wake();
  };
  const handlers = SIGNALS.map((signal) => [signal, () => onSignal(signal)] as const);
  for (const [signal, handler] of handlers) process.once(signal, handler);
  return {
    /** The first signal caught, if any. */
    received: () => received,
    /** Resolves at the first signal. */
    arrived,
    /** Hands every signal on to the command's process from now on. */
    forward: (to: (signal: Signal) => void) => void (forwardTo = to),
    stop: () => {
      for (const [signal, handler] of handlers) process.off(signal, handler);
    },
  };
}

/** Runs `command` with the stack's address and root sign-in in its environment; a signal this
 * process catches is passed on to it. Resolves with its exit status, or 128 + the signal's number
 * when a signal ended it. */
function runCommand(
  command: string[],
  env: Record<string, string>,
  signals: ReturnType<typeof watchSignals>,
) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    signals.forward((signal) => child.kill(signal));
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? statusOfSignal(signal as NodeJS.Signals)));
  });
}

/**
 * The whole of `pnpm stack`: build, bring the stack up, and either run the command given against
 * it or wait for Ctrl-C, then always take the stack down. The exit status is the command's. The
 * root's password is printed once, only when no command was given: a command gets it in its
 * environment and needs no printed copy. A signal at any point, the build and the start-up
 * included, is held until the stack is down: it goes on to the command, or ends the wait, and a
 * signal that arrives before the command starts keeps the command from starting.
 */
export async function runStack(
  argv: string[],
  build: (dir: string) => Promise<Artifacts>,
  out: (line: string) => void,
) {
  const command = commandOf(argv);
  const signals = watchSignals();
  const dir = await mkdtemp(join(tmpdir(), 'credo-stack-build-'));
  try {
    out('building c-storage and the UI');
    const artifacts = await build(dir);
    return await withStack(artifacts, async (stack) => {
      const early = signals.received();
      if (early) return statusOfSignal(early);
      out(`the stack is up at ${stack.url}`);
      if (command.length > 0) {
        return await runCommand(
          command,
          {
            CREDO_URL: stack.url,
            CREDO_ROOT_NAME: stack.rootName,
            CREDO_ROOT_PASSWORD: stack.rootPassword,
          },
          signals,
        );
      }
      out(`sign in as ${stack.rootName} with the password ${stack.rootPassword}`);
      out('Ctrl-C takes it all down');
      await signals.arrived;
      return 0;
    });
  } finally {
    signals.stop();
    await rm(dir, { recursive: true, force: true });
  }
}
