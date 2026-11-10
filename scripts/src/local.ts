import { access, chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { listClients } from '@credo/bff/clients';
import { readAppOrigin, readStorageEnv } from '@credo/bff/env';
import {
  ActivityError,
  type CStorageClient,
  clientCodeSchema,
  createActivityClient,
  type createCStorageClient,
  entryLine,
  readEntriesByTarget,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import { ROOT_NAME, SeededAlready, seedClient } from './generator';
import {
  type ActivityTarget,
  activityTargetOf,
  type Artifacts,
  type StackFacts,
  type StartedStack,
  type StartOptions,
} from './stack';
import { type Started, waitUntilUp } from './running/processes';

/** The four ports of the local environment, fixed so one address is bookmarked and every command
 * finds the others. c-storage's is the one five `ops/` scripts already reserve as "the local
 * stack's port" and refuse to use; the others sit beside it. */
export const LOCAL_PORTS: StackFacts['ports'] = {
  front: 3180,
  cStorage: 3181,
  bff: 3182,
  seedDoor: 3183,
};

/** The audit service's two ports, the keyed one and the open one, fixed beside the four. */
export const LOCAL_AUDIT_PORTS = { keyed: 3184, open: 3185 };

export type LocalPaths = {
  /** Everything the environment keeps, removed as one folder; git-ignored. */
  dir: string;
  handle: string;
  /** The database and the logs of c-storage and the BFF. */
  data: string;
  /** The built c-storage and UI, kept so the standing stack's files outlive the command. */
  build: string;
  /** The keeper's own log. */
  keeperLog: string;
};

export const localPaths = (credoRoot: string): LocalPaths => {
  const dir = join(credoRoot, '.local-env');
  return {
    dir,
    handle: join(dir, 'handle.json'),
    data: join(dir, 'data'),
    build: join(dir, 'build'),
    keeperLog: join(dir, 'keeper.log'),
  };
};

/** What one run chose, for the next command to find: where each part listens, which processes hold
 * them, the folder of data, the keys, and what the demo tenant's first sign-in is. It holds
 * c-storage's keys and the root's first password, so it is written for its owner alone. */
export type Handle = StackFacts & {
  /** The process that keeps the stack standing; ending it takes the whole stack down. */
  keeper: number;
  dataDir: string;
  url: string;
  demo: { clientCode: string; rootName: string; rootPassword: string; operatorLink: string };
  /** Set by `stop`, and by nothing else: the processes are ended on purpose and the data is kept
   * to be resumed. A handle without it whose processes are gone is a crashed run. */
  stopped?: { at: string };
};

/** Writes the handle for its owner alone, and never over one that exists: a second stack's
 * handle would hide the first, whose processes would then have no way to be found. */
export async function writeHandle(paths: LocalPaths, handle: Handle) {
  await mkdir(paths.dir, { recursive: true, mode: 0o700 });
  await writeFile(paths.handle, JSON.stringify(handle, null, 2), { flag: 'wx', mode: 0o600 });
  await chmod(paths.handle, 0o600);
}

/** Replaces the handle in one step, for its owner alone: a stopped handle becomes a running one (or
 * the other way) without a moment when neither exists, since its keys are all that opens the data. */
async function replaceHandle(paths: LocalPaths, handle: Handle) {
  const next = `${paths.handle}.next`;
  await writeFile(next, JSON.stringify(handle, null, 2), { mode: 0o600 });
  await chmod(next, 0o600);
  await rename(next, paths.handle);
}

type StorageConnection = Parameters<typeof createCStorageClient>[0];
/** Where a command reaches c-storage, and the address a tenant's link starts with. */
type StorageTarget = StorageConnection & { origin: string };

export type LocalIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  paths: LocalPaths;
  ports: StackFacts['ports'];
  auditPorts: typeof LOCAL_AUDIT_PORTS;
  /** `up`: builds c-storage and the UI into the folder given. */
  build: (dir: string) => Promise<Artifacts>;
  /** `up`: starts the process that keeps the stack standing, free of this one. */
  keeper: () => Promise<Started>;
  /** `up`: the time of day as a person reads it, for "wait until". */
  clock: (afterMs: number) => string;
  /** `up`: how long the build and the start-up may take, and how often a line says they go on. */
  waitMs: number;
  heartbeatMs: number;
  /** The variables of this process: a target in them (`C_STORAGE_URL` and the BFF's other three, and
   * `APP_ORIGIN` for the link) is where `seed` goes, in place of the handle's. */
  env: Record<string, string | undefined>;
  /** `status` and `seed`: the c-storage client for a target. */
  connect: (target: StorageConnection) => CStorageClient;
  /** `down`: asks a process to end (SIGTERM), never to be killed. */
  signal: (pid: number) => void;
  /** `down`: the command line of a running process, or nothing when it cannot be read. */
  commandOf: (pid: number) => string | undefined;
  /** `down`: every process running, by pid and command line (the whole line, not cut to a window). */
  listProcesses: () => { pid: number; command: string }[];
  /** `down`, and `up`'s failure: how long a process may take to go after it is asked. */
  settleMs: number;
  /** `status`: whether a process of this machine is running. A pid alone is never an answer. */
  alive: (pid: number) => boolean;
  /** `keep`: brings the stack up on the folder and ports given. */
  start: (
    artifacts: Artifacts,
    options: StartOptions & { dataDir: string },
  ) => Promise<StartedStack>;
  /** `keep`: settles when the keeper is asked to end. */
  stopped: Promise<void>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const USAGE =
  'usage: pnpm local up | status | seed <code> [<name>] | activity <code> <record id> | stop | down';

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Every failure met here is an Error: a file's, a fetch's, or `waitUntilUp`'s own. */
const messageOf = (error: unknown) => (error as Error).message;

const PARTS = ['front', 'cStorage', 'bff', 'seedDoor'] as const;
const AUDIT_NAME = 'the audit service';
const AUDIT_READ_NAME = "the audit service's read side";
const PART_NAMES = {
  front: 'the front',
  cStorage: 'c-storage',
  bff: 'the BFF',
  seedDoor: 'the seed door',
};

/** Every port the environment holds, by part: the four, then the audit service's keyed and open. */
const partsOf = ({
  ports,
  auditPorts,
}: Pick<LocalIo, 'ports' | 'auditPorts'>): [string, number][] => [
  ...PARTS.map((part): [string, number] => [PART_NAMES[part], ports[part]]),
  [AUDIT_NAME, auditPorts.keyed],
  [AUDIT_READ_NAME, auditPorts.open],
];

/** The ports among the environment's six that something already listens on, by part, found by
 * binding each. */
async function takenPorts(io: Pick<LocalIo, 'ports' | 'auditPorts'>) {
  const taken: [string, number][] = [];
  for (const [name, port] of partsOf(io)) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, () => probe.close(() => resolve(true)));
    });
    if (!free) taken.push([name, port]);
  }
  return taken;
}

/** The ports as a line lists them. */
const portList = (io: Pick<LocalIo, 'ports' | 'auditPorts'>) =>
  partsOf(io)
    .map(([, port]) => port)
    .join(', ');

/** Whether a stopped environment left what it takes to start again: the database, and the built
 * c-storage and UI. */
const dataIntact = async (paths: LocalPaths) =>
  (await exists(join(paths.data, 'records.db'))) &&
  (await exists(join(paths.build, 'c-storage'))) &&
  (await exists(join(paths.build, 'audit'))) &&
  (await exists(join(paths.build, 'ui')));

/** `pnpm local up`: builds, starts the keeper and returns once the front answers, leaving the stack
 * standing and a handle behind. */
async function up(io: LocalIo) {
  const { paths, ports } = io;
  const taken = await takenPorts(io);
  // A handle that `stop` marked is not a running environment: it is data to resume, if it is intact.
  let stopped = false;
  if (await exists(paths.handle)) {
    const read = readableHandle(await readFile(paths.handle, 'utf8'), paths);
    stopped = typeof read !== 'string' && read.stopped !== undefined;
    if (!stopped) {
      io.err(`the environment is already up: its handle is ${paths.handle}`);
      io.err('nothing was changed; run pnpm local status to see what is up');
      return 2;
    }
  }
  if (taken.length > 0) {
    for (const [part, port] of taken) io.err(`port ${port} (${part}) is taken`);
    io.err('nothing was changed; run pnpm local status to see what is up');
    return 2;
  }
  const resuming = stopped && (await dataIntact(paths));
  io.out(
    resuming
      ? `resuming the stopped environment: its data is kept and nothing is rebuilt; this may take up to ${io.waitMs / 1000} s, until ${io.clock(io.waitMs)}`
      : `${stopped ? 'the stopped environment’s data is not intact, so it starts new: ' : ''}building c-storage and the UI, then starting the stack: this may take up to ${io.waitMs / 1000} s, until ${io.clock(io.waitMs)}`,
  );
  const beat = setInterval(() => io.out('still working'), io.heartbeatMs);
  let keeper: Started | null = null;
  let handle: Handle;
  try {
    if (resuming) {
      await rm(paths.keeperLog, { force: true });
    } else {
      // A folder left by a run whose removal failed holds a stale log and data: nothing stands on it.
      await rm(paths.dir, { recursive: true, force: true });
      await mkdir(paths.dir, { recursive: true, mode: 0o700 });
      await io.build(paths.build);
    }
    keeper = await io.keeper();
    await waitUntilUp(`http://localhost:${ports.front}/`, keeper, 'the stack', io.waitMs);
    handle = JSON.parse(await readFile(paths.handle, 'utf8')) as Handle;
  } catch (error) {
    // The wait for the keeper to end is bounded and keeps printing: a keeper that will not go
    // is named and left, with its folder, rather than waited on in silence.
    const ended = keeper
      ? await Promise.race([keeper.stop().then(() => true), sleep(io.settleMs).then(() => false)])
      : true;
    clearInterval(beat);
    // A resumed environment's data is not this run's to remove: it stays, stopped, for the next try.
    if (ended && !resuming) await rm(paths.dir, { recursive: true, force: true });
    io.err(`the environment did not come up: ${messageOf(error)}`);
    if (!ended) {
      io.err(
        `the keeper (pid ${keeper!.child.pid}) did not end in ${io.settleMs / 1000} s and is left running with ${paths.dir}: end it with kill ${keeper!.child.pid}, then run pnpm local down`,
      );
    }
    return 1;
  }
  clearInterval(beat);
  io.out(`the environment is up at ${handle.url}`);
  io.out(`the demo client's link is ${handle.url}/login?client-code=${handle.demo.clientCode}`);
  io.out(`sign in as ${handle.demo.rootName} with the password ${handle.demo.rootPassword}`);
  io.out(`the invited operator joins by ${handle.demo.operatorLink}`);
  return 0;
}

/** `pnpm local keep`, started by `up` and never by a person: stands the stack up on the fixed
 * ports, publishes the handle, says it is listening, and takes the stack down when asked to end.
 * It removes nothing it did not write: the data folder is `down`'s. */
async function keep(io: LocalIo) {
  const { paths, ports, auditPorts } = io;
  let stack: StartedStack | null = null;
  let status = 0;
  try {
    await mkdir(paths.data, { recursive: true, mode: 0o700 });
    // A handle `stop` marked holds the keys that open the data: the stack starts again on it.
    const before = (await exists(paths.handle))
      ? readableHandle(await readFile(paths.handle, 'utf8'), paths)
      : null;
    const resume = typeof before === 'object' && before?.stopped ? before : null;
    stack = await io.start(
      {
        cStorage: join(paths.build, 'c-storage'),
        audit: join(paths.build, 'audit'),
        uiDir: join(paths.build, 'ui'),
        dir: paths.build,
      },
      {
        dataDir: paths.data,
        ports,
        auditPorts,
        ...(resume && {
          resume: {
            internalAccessKey: resume.cStorage.internalAccessKey,
            superAdminKey: resume.cStorage.superAdminKey,
            service: resume.service,
            auditKey: resume.audit.key,
            demo: resume.demo,
          },
        }),
      },
    );
    await (resume ? replaceHandle : writeHandle)(paths, {
      ...stack.facts,
      keeper: process.pid,
      dataDir: stack.dataDir,
      url: stack.url,
      demo: {
        clientCode: stack.clientCode,
        rootName: stack.rootName,
        rootPassword: stack.rootPassword,
        operatorLink: stack.operatorLink,
      },
    });
    io.out(`listening: the stack stands at ${stack.url}`);
    await io.stopped;
  } catch (error) {
    io.err(`the stack did not stay up: ${messageOf(error)}`);
    status = 1;
  }
  await stack?.stop();
  return status;
}

/** Whether `url` answers with `status`, the part's own answer to a request (a door that takes only a
 * POST answers a GET with 404, which is still its own voice). */
const answers = (url: string, status: number, headers: Record<string, string> = {}) =>
  fetch(url, { headers }).then(
    (reply) => reply.status === status,
    () => false,
  );

const targetOfHandle = (handle: Handle): StorageTarget => ({
  baseUrl: handle.cStorage.url,
  internalAccessKey: handle.cStorage.internalAccessKey,
  serviceCode: handle.service.code,
  accessKey: handle.service.accessKey,
  origin: handle.url,
});

/** `pnpm local status`: one line a part. A part is up only when it answers on its own port with
 * its own answer and the process the handle names for it is running: a pid alone, or a stranger
 * answering on the port, is not an answer. */
async function status(io: LocalIo) {
  const { paths } = io;
  if (!(await exists(paths.handle))) {
    io.out('nothing is up: there is no handle');
    return 0;
  }
  const handle = JSON.parse(await readFile(paths.handle, 'utf8')) as Handle;
  if (handle.stopped) {
    io.out(
      `the environment is stopped (since ${handle.stopped.at}) and its data is kept: pnpm local up resumes it, pnpm local down deletes it`,
    );
    return 0;
  }
  const { ports, pids } = handle;
  const checks: [string, number, Promise<boolean>, number][] = [
    [
      PART_NAMES.cStorage,
      ports.cStorage,
      answers(`${handle.cStorage.url}/health`, 200),
      pids.cStorage,
    ],
    [
      PART_NAMES.bff,
      ports.bff,
      answers(`http://127.0.0.1:${ports.bff}/api/config`, 200, {
        'x-client-code': handle.demo.clientCode,
      }),
      pids.bff,
    ],
    [PART_NAMES.front, ports.front, answers(`${handle.url}/`, 200), handle.keeper],
    [
      PART_NAMES.seedDoor,
      ports.seedDoor,
      answers(`http://127.0.0.1:${ports.seedDoor}/`, 404),
      handle.keeper,
    ],
    [
      AUDIT_NAME,
      Number(new URL(handle.audit.url).port),
      answers(`${handle.audit.url}/health`, 200),
      pids.audit,
    ],
    [
      AUDIT_READ_NAME,
      Number(new URL(handle.audit.readUrl).port),
      answers(`${handle.audit.readUrl}/health`, 200),
      pids.audit,
    ],
  ];
  let allUp = true;
  let storageUp = false;
  for (const [name, port, answered, pid] of checks) {
    const up = (await answered) && io.alive(pid);
    allUp &&= up;
    if (name === PART_NAMES.cStorage) storageUp = up;
    io.out(`${name}: ${up ? 'up' : 'DOWN'} on port ${port}`);
  }
  if (storageUp) {
    const tenants = await listClients(io.connect(targetOfHandle(handle)));
    io.out(`tenants: ${tenants.length}`);
  }
  return allUp ? 0 : 1;
}

/**
 * `pnpm local seed <code> [<name>]`: one more tenant, filled with the data set. The target is
 * c-storage as the environment names it (`C_STORAGE_URL`, `INTERNAL_ACCESS_KEY`, `SERVICE_CODE`,
 * `SERVICE_ACCESS_KEY`, `APP_ORIGIN`, the variables `runRidge` reads) when `C_STORAGE_URL` is set,
 * and the handle's otherwise, so nothing below the choice knows which stack it fills. A code that
 * already holds a tenant is refused, exit 2, and nothing is replaced.
 */
async function seed(io: LocalIo, code: string | undefined, name: string | undefined) {
  if (!clientCodeSchema.safeParse(code).success) {
    io.err(`${USAGE}: ${code ?? 'no code'} is not a client code`);
    return 2;
  }
  let target: StorageTarget;
  try {
    if (io.env['C_STORAGE_URL']) {
      const storage = readStorageEnv(io.env);
      target = {
        baseUrl: storage.C_STORAGE_URL,
        internalAccessKey: storage.INTERNAL_ACCESS_KEY,
        serviceCode: storage.SERVICE_CODE,
        accessKey: storage.SERVICE_ACCESS_KEY,
        origin: readAppOrigin(io.env),
      };
    } else if (await exists(io.paths.handle)) {
      target = targetOfHandle(JSON.parse(await readFile(io.paths.handle, 'utf8')) as Handle);
    } else {
      io.err('there is nowhere to seed: no C_STORAGE_URL in the environment and no handle');
      return 2;
    }
  } catch (error) {
    io.err(messageOf(error));
    return 2;
  }
  try {
    const company = name ?? code!;
    const made = await seedClient(io.connect(target), code!, Date.now(), company);
    io.out(`${made.code} (${company}): ${target.origin}/login?client-code=${made.code}`);
    io.out(`sign in as ${ROOT_NAME} with the password ${made.rootPassword}`);
    for (const [person, password] of Object.entries(made.people)) {
      io.out(`${person}: ${password}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof SeededAlready) {
      io.err(`${code} is a tenant here already: nothing was seeded and nothing was changed`);
      return 2;
    }
    io.err(`${code} was not seeded: ${messageOf(error)}`);
    return 1;
  }
}

/**
 * `pnpm local activity <client code> <record id>`: one record's entries, newest first, one line each:
 * the time, the person, what was done, and a customer's name before and after. The client's code
 * becomes its minted id through c-storage, a read token is minted for that client alone, and the
 * entries are read through the audit service's open listener. The target is `CREDO_AUDIT` (which
 * `pnpm stack` hands a command) when set, and the handle's otherwise. No key or token is printed.
 * The service has no read of a client's every entry, only by record and by person, so a record id
 * is asked for.
 */
async function activity(io: LocalIo, code: string | undefined, recordId: string | undefined) {
  if (!clientCodeSchema.safeParse(code).success || !recordId) {
    io.err(`${USAGE}: a client code and a record id are both needed`);
    return 2;
  }
  let target: ActivityTarget;
  try {
    if (io.env['CREDO_AUDIT']) {
      target = JSON.parse(io.env['CREDO_AUDIT']) as ActivityTarget;
    } else if (await exists(io.paths.handle)) {
      target = activityTargetOf(JSON.parse(await readFile(io.paths.handle, 'utf8')) as Handle);
    } else {
      io.err('there is nowhere to read: no CREDO_AUDIT in the environment and no handle');
      return 2;
    }
  } catch (error) {
    io.err(messageOf(error));
    return 2;
  }
  try {
    const found = await io.connect(target.storage).getRecord(recordKeys.client(code!));
    if (!found) {
      io.err(`${code} is not a client here: nothing was read`);
      return 2;
    }
    const connection = { timeoutMs: 5000 };
    const token = await createActivityClient({
      ...connection,
      baseUrl: target.audit.url,
      key: target.audit.key,
    }).mintToken(storedClientSchema.parse(found.data).id);
    const entries = await readEntriesByTarget(
      { ...connection, readUrl: target.audit.readUrl, token },
      recordId,
    );
    if (entries.length === 0) io.out('no entries');
    for (const entry of entries) io.out(entryLine(entry));
    return 0;
  } catch (error) {
    io.err(
      error instanceof ActivityError
        ? `the entries were not read: ${error.message}`
        : `the entries were not read: ${messageOf(error)}`,
    );
    return 1;
  }
}

/** The handle as `down` may trust it: a message when it is not one, since a handle is a file
 * anyone can write, and what it names is about to be signalled and deleted. */
function readableHandle(text: string, paths: LocalPaths): Handle | string {
  let found: Partial<Handle> | null;
  try {
    found = JSON.parse(text) as Partial<Handle> | null;
  } catch {
    return 'it is not JSON';
  }
  const pid = (value: unknown) => Number.isInteger(value) && (value as number) > 1;
  if (
    !found ||
    !pid(found.keeper) ||
    !pid(found.pids?.cStorage) ||
    !pid(found.pids?.audit) ||
    !pid(found.pids?.bff)
  ) {
    return 'it does not name the four processes';
  }
  if (found.dataDir !== paths.data) {
    return `its data folder is ${String(found.dataDir)}, not ${paths.data}, the only folder this command removes`;
  }
  return found as Handle;
}

type Ended = {
  ours: [string, number, (command: string) => boolean][];
  strangers: Set<number>;
  reasons: Map<number, string>;
};

/** Asks each process the handle names to end, one line each, and waits for it to go. A process is
 * signalled only while its command line still is the stack's; what could not be proved or would not
 * go is in `reasons`, what a stranger holds now in `strangers`. Never a kill. */
async function endProcesses(io: LocalIo, handle: Handle | null): Promise<Ended> {
  const { paths } = io;
  const ours: [string, number, (command: string) => boolean][] = handle
    ? [
        ['keeper', handle.keeper, (command) => command.includes('local-main.ts')],
        [
          'c-storage',
          handle.pids.cStorage,
          (command) => command.includes(join(paths.build, 'c-storage')),
        ],
        [
          'the audit service',
          handle.pids.audit,
          (command) => command.includes(join(paths.build, 'audit')),
        ],
        ['the BFF', handle.pids.bff, (command) => command.includes('bff/src/main.ts')],
      ]
    : [];
  const strangers = new Set<number>();
  const reasons = new Map<number, string>();
  for (const [name, pid, isOurs] of ours) {
    if (!io.alive(pid)) {
      io.out(`${name} (pid ${pid}): was not running`);
      continue;
    }
    const command = io.commandOf(pid);
    if (command !== undefined && !isOurs(command)) {
      // The stack's process is gone and the number is another program's now: not ours to touch.
      strangers.add(pid);
      io.out(`${name} (pid ${pid}): already gone; that number is now ${command}, left alone`);
      continue;
    }
    if (command === undefined) {
      io.out(
        `${name} (pid ${pid}): left alone, its command could not be read to prove it is the stack's`,
      );
      reasons.set(pid, "is running and could not be proved the stack's");
      continue;
    }
    io.signal(pid);
    for (let waited = 0; io.alive(pid) && waited < io.settleMs; waited += 25) await sleep(25);
    if (io.alive(pid)) {
      io.out(`${name} (pid ${pid}): asked to end, still running after ${io.settleMs / 1000} s`);
      reasons.set(pid, 'is still running');
    } else {
      io.out(`${name} (pid ${pid}): stopped`);
    }
  }
  return { ours, strangers, reasons };
}

/** The read-back of the processes: each one read again, gone or named. */
function readBackProcesses(io: LocalIo, { ours, strangers, reasons }: Ended, stillThere: string[]) {
  for (const [name, pid] of ours) {
    if (strangers.has(pid)) io.out(`  ${name}: gone (pid ${pid} is another program's now)`);
    // Alive here means the stop phase gave it a reason: the others are gone or are strangers.
    else if (io.alive(pid)) {
      io.out(`  ${name}: FOUND, pid ${pid} is running`);
      stillThere.push(`${name} (pid ${pid}) ${reasons.get(pid)!}`);
    } else io.out(`  ${name}: gone`);
  }
}

/**
 * `pnpm local down`: takes the environment down and proves it by reading back, never by its own
 * exit. It acts only on what it can prove is its own: the folders it removes are the ones under the
 * environment's folder, whatever the handle says, and a process is signalled only when its command
 * line is still the one the stack started. Each process is asked to end and then read to be gone;
 * one that will not go is named and everything is left as it was. Exit 0 every reading found
 * nothing left, 1 something is still there and named, 2 refused for a handle it cannot trust.
 */
async function down(io: LocalIo) {
  const { paths } = io;
  const kept = await exists(paths.dir);
  if (!(await exists(paths.handle))) {
    if (!kept) {
      io.out('there is no handle and no environment folder: nothing is up, nothing was changed');
      return 0;
    }
    // Without a handle the processes are found by what only the environment's own can carry in
    // their command lines: the binary built under its folder, and the keeper started for its root.
    let running: { pid: number; command: string }[];
    try {
      running = io
        .listProcesses()
        .filter(
          ({ command }) =>
            command.includes(join(paths.build, 'c-storage')) ||
            command.includes(join(paths.build, 'audit')) ||
            command.includes(`local-main.ts keep ${dirname(paths.dir)}`),
        );
    } catch (error) {
      io.err(
        `there is no handle, and the processes could not be listed (${messageOf(error)}): the folder ${paths.dir} is kept; free ports ${portList(io)}, then run pnpm local down`,
      );
      return 1;
    }
    if (running.length > 0) {
      for (const { pid, command } of running) io.out(`pid ${pid} is running: ${command}`);
      io.err(
        `down: NOT cleared: there is no handle, but these processes of the environment are still writing into ${paths.dir}, which is kept; end them with kill ${running.map(({ pid }) => pid).join(' ')} and run pnpm local down again (the BFF, if it is up, shows as a held port 3182 afterwards)`,
      );
      return 1;
    }
    io.out(
      'there is no handle and no process of the environment: only the environment folder is removed',
    );
  }
  let handle: Handle | null = null;
  if (await exists(paths.handle)) {
    const read = readableHandle(await readFile(paths.handle, 'utf8'), paths);
    if (typeof read === 'string') {
      io.err(`the handle at ${paths.handle} cannot be trusted: ${read}; nothing was changed`);
      return 2;
    }
    handle = read;
  }

  const stillThere: string[] = [];
  const { ours, strangers, reasons } = await endProcesses(io, handle);
  if (reasons.size === 0) {
    try {
      await rm(paths.dir, { recursive: true, force: true });
    } catch (error) {
      stillThere.push(`the environment folder could not be removed: ${messageOf(error)}`);
    }
  } else io.out('nothing was removed: a process may still use the data');

  io.out('read back after the teardown:');
  readBackProcesses(io, { ours, strangers, reasons }, stillThere);
  const holding = await takenPorts(io);
  for (const [part, port] of holding) {
    io.out(`  port ${port} (${part}): FOUND, something is listening`);
    stillThere.push(`port ${port} (${part}) is held by something`);
  }
  if (holding.length === 0) {
    io.out(`  ports ${portList(io)}: nothing is listening`);
  }
  for (const [what, path] of [
    ['data folder and its database', paths.data],
    ['build folder', paths.build],
    ['handle', paths.handle],
  ] as const) {
    if (await exists(path)) {
      io.out(`  ${what}: FOUND at ${path}`);
      stillThere.push(`${what} is still at ${path}`);
    } else {
      io.out(`  ${what}: gone`);
    }
  }
  if (stillThere.length === 0) {
    io.out('down: everything is cleared');
    return 0;
  }
  io.err(`down: NOT cleared: ${[...new Set(stillThere)].join('; ')}`);
  return 1;
}

/**
 * `pnpm local stop`: ends the processes and keeps everything else, then marks the handle stopped so
 * that nothing mistakes it for a crashed run and `up` resumes it. It signals under the same
 * ownership guard as `down` and reads back that each process is gone and the six ports are free,
 * and that the data and the build are still there. Exit 0 stopped, 1 not, 2 a handle it cannot trust.
 */
async function stop(io: LocalIo) {
  const { paths } = io;
  if (!(await exists(paths.handle))) {
    io.out('nothing is up: there is no handle, so there is nothing to stop');
    return 0;
  }
  const read = readableHandle(await readFile(paths.handle, 'utf8'), paths);
  if (typeof read === 'string') {
    io.err(`the handle at ${paths.handle} cannot be trusted: ${read}; nothing was changed`);
    return 2;
  }
  if (read.stopped) {
    io.out(`the environment is stopped already (since ${read.stopped.at}) and its data is kept`);
    return 0;
  }
  const stillThere: string[] = [];
  const ended = await endProcesses(io, read);
  if (ended.reasons.size > 0)
    io.out('the handle is left as it was: a process may still use the data');
  io.out('read back after the stop:');
  readBackProcesses(io, ended, stillThere);
  const holding = await takenPorts(io);
  for (const [part, port] of holding) {
    io.out(`  port ${port} (${part}): FOUND, something is listening`);
    stillThere.push(`port ${port} (${part}) is held by something`);
  }
  if (holding.length === 0) {
    io.out(`  ports ${portList(io)}: nothing is listening`);
  }
  for (const [what, path] of [
    ['data folder and its database', join(paths.data, 'records.db')],
    ['build folder', join(paths.build, 'c-storage')],
  ] as const) {
    if (await exists(path)) {
      io.out(`  ${what}: kept`);
    } else {
      io.out(`  ${what}: MISSING at ${path}`);
      stillThere.push(`${what} is missing, so there is nothing to resume`);
    }
  }
  if (stillThere.length > 0) {
    io.err(`stop: NOT stopped: ${[...new Set(stillThere)].join('; ')}`);
    return 1;
  }
  await replaceHandle(paths, { ...read, stopped: { at: io.clock(0) } });
  io.out(
    'stop: the environment is stopped and its data is kept; pnpm local up resumes it, pnpm local down deletes it',
  );
  return 0;
}

/**
 * The local environment's commands. `up` leaves the stack standing after it returns; `keep` is the
 * process `up` leaves behind to hold it. Exit 0 done, 1 a failure, 2 refused before anything was
 * acted on or a verb that cannot be read.
 */
export async function runLocal(argv: string[], io: LocalIo): Promise<number> {
  if (argv[0] === 'up') return await up(io);
  if (argv[0] === 'status') return await status(io);
  if (argv[0] === 'stop') return await stop(io);
  if (argv[0] === 'down') return await down(io);
  if (argv[0] === 'seed') return await seed(io, argv[1], argv[2]);
  if (argv[0] === 'activity') return await activity(io, argv[1], argv[2]);
  if (argv[0] === 'keep') return await keep(io);
  io.err(USAGE);
  return 2;
}
