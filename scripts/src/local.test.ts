import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer as createHttpServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CStorageClient,
  recordKeys,
  storedClientSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type Handle,
  LOCAL_PORTS,
  type LocalIo,
  type LocalPaths,
  localPaths,
  runLocal,
  writeHandle,
} from './local';
import { freePort, type Started, startProcess } from './running/processes';
import { seedDemo } from './generator';
import type { StartedStack } from './stack';

let root: string;
let paths: LocalPaths;
let ports: LocalIo['ports'];
beforeEach(async () => {
  ports = {
    front: await freePort(),
    cStorage: await freePort(),
    bff: await freePort(),
    seedDoor: await freePort(),
  };
  root = await mkdtemp(join(tmpdir(), 'credo-local-test-'));
  paths = localPaths(root);
});
afterEach(() => rm(root, { recursive: true, force: true }));

/** A c-storage service in memory: records, each with a tag that changes at every write. */
function memoryStorage() {
  const records = new Map<string, unknown>();
  const tags = new Map<string, string>();
  let writes = 0;
  const storage: CStorageClient = {
    getRecord: (key) =>
      Promise.resolve(
        records.has(key) ? { data: records.get(key), tag: tags.get(key) as string } : null,
      ),
    listRecords: (prefix) =>
      Promise.resolve({
        records: [...records]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([key, data]) => ({ key, data, tag: tags.get(key) as string })),
        more: false,
      }),
    putRecord: (key, data, ifTag) => {
      if (ifTag === null ? records.has(key) : tags.get(key) !== ifTag) {
        return Promise.resolve('moved');
      }
      records.set(key, data);
      tags.set(key, createHash('sha256').update(String(writes++)).digest('hex'));
      return Promise.resolve('saved');
    },
    removeRecord: (key) => {
      records.delete(key);
      tags.delete(key);
      return Promise.resolve('removed');
    },
    health: () => Promise.resolve({ buildVersion: 'dev' }),
  };
  return { records, storage };
}

const handleOf = (over: Partial<Handle> = {}): Handle => ({
  ports: { front: 3180, cStorage: 3181, bff: 3182, seedDoor: 3183 },
  pids: { cStorage: 41, bff: 42 },
  cStorage: { url: 'http://127.0.0.1:3181', internalAccessKey: 'ik', superAdminKey: 'sk' },
  service: { code: 'demo', accessKey: 'ak' },
  keeper: 40,
  dataDir: '/data',
  url: 'http://localhost:3180',
  demo: {
    clientCode: 'demo',
    rootName: 'root',
    rootPassword: 'pw-1',
    operatorLink: 'http://localhost:3180/operator/join#tok',
  },
  ...over,
});

const keeperOfHandle = async () =>
  (JSON.parse(await readFile(paths.handle, 'utf8')) as Handle).keeper;

const lines = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    say: (line: string) => out.push(line),
    complain: (line: string) => err.push(line),
  };
};

const baseIo = (said: ReturnType<typeof lines>, over: Partial<LocalIo> = {}): LocalIo => ({
  out: said.say,
  err: said.complain,
  paths,
  ports,
  build: () => Promise.reject(new Error('not built here')),
  keeper: () => Promise.reject(new Error('no keeper here')),
  alive: () => true,
  env: {},
  connect: () => memoryStorage().storage,
  clock: () => '12:34',
  waitMs: 5000,
  heartbeatMs: 5,
  start: () => Promise.reject(new Error('not started here')),
  stopped: Promise.resolve(),
  ...over,
});

describe('the fixed ports', () => {
  it('put the front at 3180 and c-storage at 3181, the port five ops scripts already reserve for it', () => {
    expect(LOCAL_PORTS).toEqual({ front: 3180, cStorage: 3181, bff: 3182, seedDoor: 3183 });
  });
});

describe('the handle', () => {
  it('holds the ports, the pids, the data folder and the keys, and is written for its owner alone', async () => {
    await writeHandle(paths, handleOf());

    const written = JSON.parse(await readFile(paths.handle, 'utf8')) as Handle;
    expect(written).toEqual(handleOf());
    expect((await stat(paths.handle)).mode & 0o777).toBe(0o600);
    expect((await stat(paths.dir)).mode & 0o777).toBe(0o700);
  });

  it('is never written over one that exists', async () => {
    await writeHandle(paths, handleOf());

    await expect(writeHandle(paths, handleOf({ keeper: 99 }))).rejects.toThrow('EEXIST');
    expect(await keeperOfHandle()).toBe(40);
  });
});

describe('local keep', () => {
  const stubStack = (stop: () => Promise<void>): StartedStack =>
    ({
      url: 'http://localhost:3180',
      clientCode: 'demo',
      rootName: 'root',
      rootPassword: 'pw-1',
      operatorLink: 'http://localhost:3180/operator/join#tok',
      dataDir: paths.data,
      facts: {
        ports: LOCAL_PORTS,
        pids: { cStorage: 41, bff: 42 },
        cStorage: { url: 'http://127.0.0.1:3181', internalAccessKey: 'ik', superAdminKey: 'sk' },
        service: { code: 'demo', accessKey: 'ak' },
      },
      stop,
    }) as unknown as StartedStack;

  it('starts the stack on the fixed ports and its own folder, publishes the handle, and stops only when asked', async () => {
    const said = lines();
    const stop = vi.fn(() => Promise.resolve());
    const start = vi.fn(() => Promise.resolve(stubStack(stop)));
    let ask!: () => void;
    const stopped = new Promise<void>((resolve) => (ask = resolve));
    const running = runLocal(['keep'], baseIo(said, { start, stopped }));
    while (!said.out.some((line) => line.startsWith('listening'))) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(stop).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith(
      {
        cStorage: join(paths.build, 'c-storage'),
        uiDir: join(paths.build, 'ui'),
        dir: paths.build,
      },
      { dataDir: paths.data, ports },
    );
    expect(JSON.parse(await readFile(paths.handle, 'utf8'))).toEqual(
      handleOf({ keeper: process.pid, dataDir: paths.data }),
    );
    ask();
    expect(await running).toBe(0);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('says why when the stack will not start, publishes no handle, and exits 1', async () => {
    const said = lines();

    const status = await runLocal(['keep'], baseIo(said));

    expect(status).toBe(1);
    expect(said.err).toEqual(['the stack did not stay up: not started here']);
    await expect(stat(paths.handle)).rejects.toThrow('ENOENT');
  });

  it('takes the stack down again when the handle cannot be published', async () => {
    const said = lines();
    const stop = vi.fn(() => Promise.resolve());
    await writeHandle(paths, handleOf({ keeper: 99 }));

    const status = await runLocal(
      ['keep'],
      baseIo(said, { start: () => Promise.resolve(stubStack(stop)) }),
    );

    expect(status).toBe(1);
    expect(stop).toHaveBeenCalledOnce();
    expect(said.err[0]).toContain('EEXIST');
    expect(await keeperOfHandle()).toBe(99);
  });
});

describe('local status', () => {
  /** One server on each part's port, answering as that part does. */
  const serve = async (answerFor: (part: keyof typeof ports) => number) => {
    const servers: Server[] = [];
    for (const part of ['front', 'cStorage', 'bff', 'seedDoor'] as const) {
      const server = createHttpServer((_, reply) => reply.writeHead(answerFor(part)).end('{}'));
      await new Promise<void>((resolve) => server.listen(ports[part], '127.0.0.1', resolve));
      servers.push(server);
    }
    return () => Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  };
  const own = (part: string) => (part === 'seedDoor' ? 404 : 200);
  const written = () =>
    writeHandle(
      paths,
      handleOf({
        ports,
        url: `http://localhost:${ports.front}`,
        cStorage: {
          url: `http://127.0.0.1:${ports.cStorage}`,
          internalAccessKey: 'i',
          superAdminKey: 's',
        },
      }),
    );

  it('says nothing is up when there is no handle', async () => {
    const said = lines();

    expect(await runLocal(['status'], baseIo(said))).toBe(0);
    expect(said.out).toEqual(['nothing is up: there is no handle']);
  });

  it('prints four up lines when every part answers its own way and its process runs', async () => {
    const said = lines();
    await written();
    const close = await serve(own);
    try {
      expect(await runLocal(['status'], baseIo(said))).toBe(0);
    } finally {
      await close();
    }

    expect(said.out).toEqual([
      `c-storage: up on port ${ports.cStorage}`,
      `the BFF: up on port ${ports.bff}`,
      `the front: up on port ${ports.front}`,
      `the seed door: up on port ${ports.seedDoor}`,
      'tenants: 0',
    ]);
  });

  it('calls a part down when nothing answers on its port, whatever its pid does', async () => {
    const said = lines();
    await written();

    expect(await runLocal(['status'], baseIo(said))).toBe(1);
    expect(said.out.every((line) => line.includes(': DOWN on port'))).toBe(true);
    expect(said.out).toHaveLength(4);
    expect(said.out.join()).not.toContain('tenants');
  });

  it('calls a part down when something else answers on its port than its own answer', async () => {
    const said = lines();
    await written();
    const close = await serve(() => 500);
    try {
      expect(await runLocal(['status'], baseIo(said))).toBe(1);
    } finally {
      await close();
    }

    expect(said.out.every((line) => line.includes('DOWN'))).toBe(true);
  });

  it('calls a part down when it answers but the process the handle names is gone', async () => {
    const said = lines();
    await written();
    const close = await serve(own);
    try {
      const gone = (pid: number) => pid !== 41;
      expect(await runLocal(['status'], baseIo(said, { alive: gone }))).toBe(1);
    } finally {
      await close();
    }

    expect(said.out.filter((line) => line.includes('DOWN'))).toEqual([
      `c-storage: DOWN on port ${ports.cStorage}`,
    ]);
  });
});

describe('local seed', () => {
  const envOf = (port: number) => ({
    C_STORAGE_URL: `http://127.0.0.1:${port}`,
    INTERNAL_ACCESS_KEY: 'env-internal',
    SERVICE_CODE: 'env-service',
    SERVICE_ACCESS_KEY: 'env-access',
    APP_ORIGIN: 'https://ridge.example.com',
  });

  it('makes a tenant under the name given on the handle’s stack, prints its link and passwords, and status counts four', async () => {
    const said = lines();
    const { records, storage } = memoryStorage();
    await seedDemo(storage);
    await writeHandle(paths, handleOf({ ports, url: 'http://localhost:3180' }));
    const connect = vi.fn(() => storage);

    const status = await runLocal(['seed', 'acme', 'Acme Foods'], baseIo(said, { connect }));

    expect(status).toBe(0);
    expect(connect).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:3181',
      internalAccessKey: 'ik',
      serviceCode: 'demo',
      accessKey: 'ak',
      origin: 'http://localhost:3180',
    });
    expect(said.out[0]).toBe('acme (Acme Foods): http://localhost:3180/login?client-code=acme');
    expect(said.out[1]).toMatch(/^sign in as root with the password \S+$/);
    expect(said.out.slice(2).every((line) => /^EMP-\d+: \S+$/.test(line))).toBe(true);
    expect(said.out.length).toBeGreaterThan(5);
    const index = storedClientSchema.parse(records.get(recordKeys.client('acme')));
    expect(tenantConfigSchema.parse(records.get(recordKeys.tenant(index.id).config)).name).toBe(
      'Acme Foods',
    );
    expect(index.name).toBe('Acme Foods');

    // The same storage, read back by status: the three demo tenants and acme.
    const pulse = lines();
    await rm(paths.handle);
    await writeHandle(
      paths,
      handleOf({
        ports,
        url: `http://localhost:${ports.front}`,
        cStorage: {
          url: `http://127.0.0.1:${ports.cStorage}`,
          internalAccessKey: 'i',
          superAdminKey: 's',
        },
      }),
    );
    const close = await (async () => {
      const server = createHttpServer((_, reply) => reply.writeHead(200).end('{}'));
      await new Promise<void>((resolve) => server.listen(ports.cStorage, '127.0.0.1', resolve));
      return () => new Promise((resolve) => server.close(resolve));
    })();
    try {
      await runLocal(['status'], baseIo(pulse, { connect }));
    } finally {
      await close();
    }
    expect(pulse.out.at(-1)).toBe('tenants: 4');
  });

  it('takes its target from the environment when one is given, and reads no handle', async () => {
    const said = lines();
    const { storage } = memoryStorage();
    await writeHandle(paths, handleOf({ ports }));
    const connect = vi.fn(() => storage);

    const status = await runLocal(['seed', 'ridge-one'], baseIo(said, { connect, env: envOf(9) }));

    expect(status).toBe(0);
    expect(connect).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:9',
      internalAccessKey: 'env-internal',
      serviceCode: 'env-service',
      accessKey: 'env-access',
      origin: 'https://ridge.example.com',
    });
    expect(said.out[0]).toBe(
      'ridge-one (ridge-one): https://ridge.example.com/login?client-code=ridge-one',
    );
  });

  it('refuses before writing when the environment names a target badly, or names none and there is no handle', async () => {
    const connect = vi.fn(() => memoryStorage().storage);
    const cases: [string[], Partial<LocalIo>, string][] = [
      [['seed', 'acme'], { env: { C_STORAGE_URL: 'http://127.0.0.1:9' } }, 'invalid environment'],
      [['seed', 'acme'], {}, 'there is nowhere to seed'],
      [['seed', 'Not A Code'], {}, 'is not a client code'],
      [['seed'], {}, 'no code is not a client code'],
    ];
    for (const [argv, over, words] of cases) {
      const said = lines();

      expect(await runLocal(argv, baseIo(said, { connect, ...over })), argv.join(' ')).toBe(2);
      expect(said.err.join()).toContain(words);
    }
    expect(connect).not.toHaveBeenCalled();
  });

  it('stops at a code that holds a tenant already and replaces nothing', async () => {
    const said = lines();
    const { records, storage } = memoryStorage();
    await writeHandle(paths, handleOf({ ports }));
    const io = baseIo(said, { connect: () => storage });
    await runLocal(['seed', 'acme'], io);
    const before = JSON.stringify([...records]);
    const second = lines();

    const status = await runLocal(['seed', 'acme'], baseIo(second, { connect: () => storage }));

    expect(status).toBe(1);
    expect(second.err).toEqual([
      'acme was not seeded: the service already holds data: not seeded over',
    ]);
    expect(JSON.stringify([...records])).toBe(before);
  });
});

describe('local up', () => {
  /** A keeper stand-in: a child that publishes the handle, then serves the front's port. */
  const standIn = async (port: number, delayMs: number) => {
    const handle = handleOf({
      url: `http://localhost:${port}`,
      ports: { ...LOCAL_PORTS, front: port },
    });
    const script = `
      const fs = require('fs'); const http = require('http');
      setTimeout(() => {
        fs.writeFileSync(${JSON.stringify(paths.handle)}, ${JSON.stringify(JSON.stringify(handle))});
        http.createServer((_, r) => r.end('ok')).listen(${port}, '127.0.0.1', () => console.log('listening'));
      }, ${delayMs});
      setTimeout(() => {}, 20000);`;
    await mkdir(paths.dir, { recursive: true });
    return () =>
      startProcess(process.execPath, ['-e', script], { env: {}, logFile: paths.keeperLog });
  };

  it('builds, starts the keeper, waits for the front and prints where to go and how to sign in', async () => {
    const port = await freePort();
    const said = lines();
    const keeper = await standIn(port, 80);
    const kept: { current: Started | null } = { current: null };
    const build = vi.fn(() => Promise.resolve({ cStorage: 'c', uiDir: 'u', dir: paths.build }));
    try {
      const status = await runLocal(
        ['up'],
        baseIo(said, {
          ports: { ...ports, front: port },
          build,
          keeper: async () => (kept.current = await keeper()),
        }),
      );

      expect(status).toBe(0);
      expect(build).toHaveBeenCalledWith(paths.build);
      expect(said.out[0]).toBe(
        'building c-storage and the UI, then starting the stack: this may take up to 5 s, until 12:34',
      );
      expect(said.out).toContain('still working');
      expect(said.out.slice(-4)).toEqual([
        `the environment is up at http://localhost:${port}`,
        `the demo client's link is http://localhost:${port}/login?client-code=demo`,
        'sign in as root with the password pw-1',
        `the invited operator joins by http://localhost:3180/operator/join#tok`,
      ]);
      expect(said.err).toEqual([]);
    } finally {
      await kept.current?.stop();
    }
  });

  it('refuses when the environment has a handle already, before it builds anything', async () => {
    const said = lines();
    const build = vi.fn(() => Promise.reject(new Error('must not build')));
    await writeHandle(paths, handleOf());

    const status = await runLocal(['up'], baseIo(said, { build }));

    expect(status).toBe(2);
    expect(build).not.toHaveBeenCalled();
    expect(said.err).toEqual([
      `the environment is already up: its handle is ${paths.handle}`,
      'nothing was changed; run pnpm local status to see what is up',
    ]);
    expect(await keeperOfHandle()).toBe(40);
  });

  it('refuses a taken port by naming it and its part, writes nothing and builds nothing', async () => {
    const said = lines();
    const build = vi.fn(() => Promise.reject(new Error('must not build')));
    const stranger = createHttpServer();
    await new Promise<void>((resolve) => stranger.listen(ports.cStorage, resolve));
    try {
      const status = await runLocal(['up'], baseIo(said, { build }));

      expect(status).toBe(2);
      expect(build).not.toHaveBeenCalled();
      expect(said.err).toEqual([
        `port ${ports.cStorage} (c-storage) is taken`,
        'nothing was changed; run pnpm local status to see what is up',
      ]);
      await expect(stat(paths.dir)).rejects.toThrow('ENOENT');
    } finally {
      await new Promise((resolve) => stranger.close(resolve));
    }
  });

  it('leaves nothing when the keeper dies at once: its log is the reason, and the folder is gone', async () => {
    const said = lines();
    const build = () => Promise.resolve({ cStorage: 'c', uiDir: 'u', dir: paths.build });
    const status = await runLocal(
      ['up'],
      baseIo(said, {
        build,
        keeper: () =>
          startProcess(process.execPath, ['-e', "console.log('no port for me'); process.exit(3)"], {
            env: {},
            logFile: paths.keeperLog,
          }),
      }),
    );

    expect(status).toBe(1);
    expect(said.err).toHaveLength(1);
    expect(said.err[0]).toContain(
      'the environment did not come up: the stack exited 3: no port for me',
    );
    await expect(stat(paths.dir)).rejects.toThrow('ENOENT');
  });

  it('leaves nothing when the build fails', async () => {
    const said = lines();

    const status = await runLocal(
      ['up'],
      baseIo(said, { build: () => Promise.reject(new Error('no go')) }),
    );

    expect(status).toBe(1);
    expect(said.err).toEqual(['the environment did not come up: no go']);
    await expect(stat(paths.dir)).rejects.toThrow('ENOENT');
  });
});

describe('a verb it does not know', () => {
  it('is refused with the usage, exit 2', async () => {
    const said = lines();

    expect(await runLocal(['sideways'], baseIo(said))).toBe(2);
    expect(said.err).toEqual(['usage: pnpm local up | status | seed <code> [<name>]']);
  });
});
