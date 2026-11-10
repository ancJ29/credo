import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { listClients } from '@credo/bff/clients';
import { readAppOrigin, readStorageEnv } from '@credo/bff/env';
import { type CStorageClient, clientCodeSchema, type createCStorageClient } from '@credo/shared';
import { ROOT_NAME, seedClient } from './generator';
import { type Artifacts, type StackFacts, type StartedStack, type StartOptions } from './stack';
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
};

/** Writes the handle for its owner alone, and never over one that exists: a second stack's
 * handle would hide the first, whose processes would then have no way to be found. */
export async function writeHandle(paths: LocalPaths, handle: Handle) {
  await mkdir(paths.dir, { recursive: true, mode: 0o700 });
  await writeFile(paths.handle, JSON.stringify(handle, null, 2), { flag: 'wx', mode: 0o600 });
  await chmod(paths.handle, 0o600);
}

/** Where a command reaches c-storage, and the address a tenant's link starts with. */
type StorageTarget = Parameters<typeof createCStorageClient>[0] & { origin: string };

export type LocalIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  paths: LocalPaths;
  ports: StackFacts['ports'];
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
  connect: (target: StorageTarget) => CStorageClient;
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

const USAGE = 'usage: pnpm local up | status | seed <code> [<name>]';

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Every failure met here is an Error: a file's, a fetch's, or `waitUntilUp`'s own. */
const messageOf = (error: unknown) => (error as Error).message;

const PARTS = ['front', 'cStorage', 'bff', 'seedDoor'] as const;
const PART_NAMES = {
  front: 'the front',
  cStorage: 'c-storage',
  bff: 'the BFF',
  seedDoor: 'the seed door',
};

/** The ports among `ports` that something already listens on, by part, found by binding each. */
async function takenPorts(ports: StackFacts['ports']) {
  const taken: [string, number][] = [];
  for (const part of PARTS) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.listen(ports[part], () => probe.close(() => resolve(true)));
    });
    if (!free) taken.push([PART_NAMES[part], ports[part]]);
  }
  return taken;
}

/** `pnpm local up`: builds, starts the keeper and returns once the front answers, leaving the stack
 * standing and a handle behind. */
async function up(io: LocalIo) {
  const { paths, ports } = io;
  const taken = await takenPorts(ports);
  const standing = await exists(paths.handle);
  if (standing || taken.length > 0) {
    for (const [part, port] of taken) io.err(`port ${port} (${part}) is taken`);
    if (standing) io.err(`the environment is already up: its handle is ${paths.handle}`);
    io.err('nothing was changed; run pnpm local status to see what is up');
    return 2;
  }
  io.out(
    `building c-storage and the UI, then starting the stack: this may take up to ${io.waitMs / 1000} s, until ${io.clock(io.waitMs)}`,
  );
  const beat = setInterval(() => io.out('still working'), io.heartbeatMs);
  let keeper: Started | null = null;
  try {
    await mkdir(paths.dir, { recursive: true, mode: 0o700 });
    await io.build(paths.build);
    keeper = await io.keeper();
    await waitUntilUp(`http://localhost:${ports.front}/`, keeper, 'the stack', io.waitMs);
  } catch (error) {
    clearInterval(beat);
    await keeper?.stop();
    await rm(paths.dir, { recursive: true, force: true });
    io.err(`the environment did not come up: ${messageOf(error)}`);
    return 1;
  }
  clearInterval(beat);
  const handle = JSON.parse(await readFile(paths.handle, 'utf8')) as Handle;
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
  const { paths, ports } = io;
  let stack: StartedStack | null = null;
  let status = 0;
  try {
    await mkdir(paths.data, { recursive: true, mode: 0o700 });
    stack = await io.start(
      {
        cStorage: join(paths.build, 'c-storage'),
        uiDir: join(paths.build, 'ui'),
        dir: paths.build,
      },
      { dataDir: paths.data, ports },
    );
    await writeHandle(paths, {
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
 * already holds a tenant stops the run through `seedClient`'s own refusal, and nothing is replaced.
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
    io.err(`${code} was not seeded: ${messageOf(error)}`);
    return 1;
  }
}

/**
 * The local environment's commands. `up` leaves the stack standing after it returns; `keep` is the
 * process `up` leaves behind to hold it. Exit 0 done, 1 a failure, 2 refused before anything was
 * acted on or a verb that cannot be read.
 */
export async function runLocal(argv: string[], io: LocalIo): Promise<number> {
  if (argv[0] === 'up') return await up(io);
  if (argv[0] === 'status') return await status(io);
  if (argv[0] === 'seed') return await seed(io, argv[1], argv[2]);
  if (argv[0] === 'keep') return await keep(io);
  io.err(USAGE);
  return 2;
}
