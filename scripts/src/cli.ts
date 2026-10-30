import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { type FakeArtifacts, type RunningFake, withFake } from './fake';
import { startDemo, type DemoCopy } from './demo/apply';
import { vietnamToday } from './demo/days';
import { type Artifacts, type RunningStack, withStack } from './stack';

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

/** Runs `command` with the stack's address, the demo client's code, its root's sign-in, its
 * people's and the operator's in its environment, and the door to more clients; a signal this
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

/** What differs between the programs that bring something up for a command: what is built, what
 * stands, and what the command and the reader are told of it. */
type Kit<Built, Running> = {
  /** What stands, as the first line says it: "the stack". */
  name: string;
  building: string;
  build: (dir: string) => Promise<Built>;
  up: (built: Built, use: (running: Running) => Promise<number>) => Promise<number>;
  url: (running: Running) => string;
  env: (running: Running) => Record<string, string>;
  /** What is printed when no command was given, before the wait for Ctrl-C. */
  waiting: (running: Running) => string[];
};

/**
 * The whole of `pnpm stack` and `pnpm fake`: build, bring it up, and either run the command given
 * against it or wait for Ctrl-C, then always take it down. The exit status is the command's. What
 * the waiting prints, passwords included, is printed only when no command was given: a command gets
 * them in its environment and needs no printed copy. A signal at any point, the build and the
 * start-up included, is held until it is down: it goes on to the command, or ends the wait, and a
 * signal that arrives before the command starts keeps the command from starting.
 */
async function runUp<Built, Running>(
  argv: string[],
  kit: Kit<Built, Running>,
  out: (line: string) => void,
) {
  const command = commandOf(argv);
  const signals = watchSignals();
  const dir = await mkdtemp(join(tmpdir(), 'credo-stack-build-'));
  try {
    out(kit.building);
    const built = await kit.build(dir);
    return await kit.up(built, async (running) => {
      const early = signals.received();
      if (early) return statusOfSignal(early);
      out(`${kit.name} is up at ${kit.url(running)}`);
      if (command.length > 0) return await runCommand(command, kit.env(running), signals);
      for (const line of kit.waiting(running)) out(line);
      out('Ctrl-C takes it all down');
      await signals.arrived;
      return 0;
    });
  } finally {
    signals.stop();
    await rm(dir, { recursive: true, force: true });
  }
}

/** `pnpm stack`: c-storage, the BFF and the UI, with the demo client. */
export const runStack = (
  argv: string[],
  build: (dir: string) => Promise<Artifacts>,
  out: (line: string) => void,
) =>
  runUp<Artifacts, RunningStack>(
    argv,
    {
      name: 'the stack',
      building: 'building c-storage and the UI',
      build,
      up: withStack,
      url: (stack) => stack.url,
      env: (stack) => ({
        CREDO_URL: stack.url,
        CREDO_CLIENT_CODE: stack.clientCode,
        CREDO_ROOT_NAME: stack.rootName,
        CREDO_ROOT_PASSWORD: stack.rootPassword,
        CREDO_OPERATOR_NAME: stack.operatorName,
        CREDO_OPERATOR_PASSWORD: stack.operatorPassword,
        CREDO_PEOPLE: JSON.stringify(stack.people),
        CREDO_SEED_URL: stack.seedUrl,
      }),
      waiting: (stack) => [
        `the demo client's link is ${stack.url}/login?client-code=${stack.clientCode}`,
        `sign in as ${stack.rootName} with the password ${stack.rootPassword}`,
        `the operator signs in at ${stack.url}/operator`,
        `the operator is ${stack.operatorName}, first password ${stack.operatorPassword}`,
      ],
    },
    out,
  );

/** `pnpm fake`: the UI alone, over invented data, with no BFF and no c-storage. */
export const runFake = (
  argv: string[],
  build: (dir: string) => Promise<FakeArtifacts>,
  out: (line: string) => void,
) =>
  runUp<FakeArtifacts, RunningFake>(
    argv,
    {
      name: 'the fake',
      building: 'building the fake UI',
      build,
      up: withFake,
      url: (fake) => fake.url,
      env: (fake) => ({ CREDO_URL: fake.url, CREDO_CLIENT_CODE: fake.clientCode }),
      waiting: (fake) => [`open ${fake.url}/?fake, any password signs ${fake.rootName} in`],
    },
    out,
  );

/** The stack with the demo's copies on it: what `pnpm demo` brings up. */
export type RunningDemo = RunningStack & { copies: DemoCopy[] };

/**
 * `pnpm demo`: the same stack as `pnpm stack`, then every copy of the demo mapping (or one
 * partner's, by `partner`) made by the operator's own create and filled as of four days ago, then
 * three daily runs to yesterday. Each copy's link and root password are printed once, when no
 * command was given; a command gets them in `CREDO_COPIES` (JSON) instead.
 */
export const runDemo = (
  argv: string[],
  build: (dir: string) => Promise<Artifacts>,
  out: (line: string) => void,
  settings: { partner?: string; now?: () => number } = {},
) =>
  runUp<Artifacts, RunningDemo>(
    argv,
    {
      name: 'the demo stack',
      building: 'building c-storage and the UI',
      build,
      up: (artifacts, use) =>
        withStack(artifacts, async (stack) => {
          out('making the demo copies');
          const copies = await startDemo(
            stack.storage,
            vietnamToday((settings.now ?? Date.now)()),
            settings.partner,
          );
          return await use({ ...stack, copies });
        }),
      url: (demo) => demo.url,
      env: (demo) => ({
        CREDO_URL: demo.url,
        CREDO_OPERATOR_NAME: demo.operatorName,
        CREDO_OPERATOR_PASSWORD: demo.operatorPassword,
        CREDO_COPIES: JSON.stringify(
          demo.copies.map(({ code, partner, client, scenario, company, rootPassword }) => ({
            code,
            partner,
            client,
            scenario,
            company,
            rootName: demo.rootName,
            rootPassword,
          })),
        ),
      }),
      waiting: (demo) => [
        ...demo.copies.flatMap((copy) => [
          `${copy.company} (${copy.scenario}, for ${copy.partner}): ${demo.url}/login?client-code=${copy.code}`,
          `  sign in as ${demo.rootName} with the password ${copy.rootPassword}`,
        ]),
        `the operator signs in at ${demo.url}/operator`,
        `the operator is ${demo.operatorName}, first password ${demo.operatorPassword}`,
      ],
    },
    out,
  );
