import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import type { StartedStack } from './stack';

let root: string;
let paths: LocalPaths;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'credo-local-test-'));
  paths = localPaths(root);
});
afterEach(() => rm(root, { recursive: true, force: true }));

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
  ports: LOCAL_PORTS,
  build: () => Promise.reject(new Error('not built here')),
  keeper: () => Promise.reject(new Error('no keeper here')),
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
      { dataDir: paths.data, ports: LOCAL_PORTS },
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
          ports: { ...LOCAL_PORTS, front: port },
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
    expect(said.err).toEqual([`the environment is already up: its handle is ${paths.handle}`]);
    expect(await keeperOfHandle()).toBe(40);
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
    expect(said.err).toEqual(['usage: pnpm local up']);
  });
});
