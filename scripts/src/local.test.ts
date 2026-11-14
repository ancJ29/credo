import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CStorageClient,
  createActivityClient,
  recordKeys,
  storedClientSchema,
  tenantConfigSchema,
} from '@credo/shared';
import { listClients } from '@credo/bff/clients';
import { type RunningAudit, startAudit } from '@credo/bff/tests/audit';
import { buildAudit } from '@credo/bff/tests/build';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Root ignores a folder's permission bits (act runs as root), so a removal that must fail is refused
// here, at the one path the case names, and passes through for every other.
const refusedRemoval = vi.hoisted(() => ({ path: null as string | null }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rm: (path: Parameters<typeof real.rm>[0], options?: Parameters<typeof real.rm>[1]) =>
      path === refusedRemoval.path
        ? Promise.reject(new Error(`EACCES: permission denied, rm '${String(path)}'`))
        : real.rm(path, options),
  };
});

let root: string;
let paths: LocalPaths;
let ports: LocalIo['ports'];
let auditPorts: LocalIo['auditPorts'];
beforeEach(async () => {
  auditPorts = { keyed: await freePort(), open: await freePort() };
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
    status: () => Promise.resolve({ freeBytes: 1, lastWriteAt: null }),
  };
  return { records, storage };
}

const handleOf = (over: Partial<Handle> = {}): Handle => ({
  ports: { front: 3180, cStorage: 3181, bff: 3182, seedDoor: 3183 },
  pids: { cStorage: 41, audit: 43, bff: 42 },
  cStorage: { url: 'http://127.0.0.1:3181', internalAccessKey: 'ik', superAdminKey: 'sk' },
  service: { code: 'demo', accessKey: 'ak' },
  audit: { url: 'http://127.0.0.1:3184', readUrl: 'http://127.0.0.1:3185', key: 'audit-key' },
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

const readHandle = async () => JSON.parse(await readFile(paths.handle, 'utf8')) as unknown;

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
  auditPorts,
  build: () => Promise.reject(new Error('not built here')),
  keeper: () => Promise.reject(new Error('no keeper here')),
  alive: () => true,
  signal: () => undefined,
  commandOf: () => undefined,
  listProcesses: () => [],
  settleMs: 100,
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
        pids: { cStorage: 41, audit: 43, bff: 42 },
        cStorage: { url: 'http://127.0.0.1:3181', internalAccessKey: 'ik', superAdminKey: 'sk' },
        service: { code: 'demo', accessKey: 'ak' },
        audit: { url: 'http://127.0.0.1:3184', readUrl: 'http://127.0.0.1:3185', key: 'audit-key' },
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
        audit: join(paths.build, 'audit'),
        uiDir: join(paths.build, 'ui'),
        dir: paths.build,
      },
      { dataDir: paths.data, ports, auditPorts },
    );
    expect(JSON.parse(await readFile(paths.handle, 'utf8'))).toEqual(
      handleOf({ keeper: process.pid, dataDir: paths.data }),
    );
    ask();
    expect(await running).toBe(0);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('starts again on the keys of a stopped handle and replaces it with a running one', async () => {
    const said = lines();
    const stop = vi.fn(() => Promise.resolve());
    const start = vi.fn(() => Promise.resolve(stubStack(stop)));
    await writeHandle(
      paths,
      handleOf({ ports, dataDir: paths.data, stopped: { at: '09:00' }, keeper: 11 }),
    );
    const running = runLocal(['keep'], baseIo(said, { start, stopped: Promise.resolve() }));

    expect(await running).toBe(0);
    expect(start).toHaveBeenCalledWith(expect.anything(), {
      dataDir: paths.data,
      ports,
      auditPorts,
      resume: {
        internalAccessKey: 'ik',
        superAdminKey: 'sk',
        service: { code: 'demo', accessKey: 'ak' },
        auditKey: 'audit-key',
        demo: handleOf().demo,
      },
    });
    const now = (await readHandle()) as Handle;
    expect(now.stopped).toBeUndefined();
    expect(now.keeper).toBe(process.pid);
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
  const serve = async (answerFor: (part: string) => number) => {
    const servers: Server[] = [];
    const listening = [
      ...(['front', 'cStorage', 'bff', 'seedDoor'] as const).map(
        (part) => [part, ports[part]] as const,
      ),
      ['auditKeyed', auditPorts.keyed] as const,
      ['auditOpen', auditPorts.open] as const,
    ];
    for (const [part, port] of listening) {
      const server = createHttpServer((_, reply) => reply.writeHead(answerFor(part)).end('{}'));
      await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
      servers.push(server);
    }
    return () => Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  };
  // The BFF's own answer to a call without the front door's key is a refusal.
  const own = (part: string) => (part === 'seedDoor' ? 404 : part === 'bff' ? 403 : 200);
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
        audit: {
          url: `http://127.0.0.1:${auditPorts.keyed}`,
          readUrl: `http://127.0.0.1:${auditPorts.open}`,
          key: 'audit-key',
        },
      }),
    );

  it('says nothing is up when there is no handle', async () => {
    const said = lines();

    expect(await runLocal(['status'], baseIo(said))).toBe(0);
    expect(said.out).toEqual(['nothing is up: there is no handle']);
  });

  it('prints six up lines when every part answers its own way and its process runs', async () => {
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
      `the audit service: up on port ${auditPorts.keyed}`,
      `the audit service's read side: up on port ${auditPorts.open}`,
      'tenants: 0',
    ]);
  });

  it('calls a part down when nothing answers on its port, whatever its pid does', async () => {
    const said = lines();
    await written();

    expect(await runLocal(['status'], baseIo(said))).toBe(1);
    expect(said.out.every((line) => line.includes(': DOWN on port'))).toBe(true);
    expect(said.out).toHaveLength(6);
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

  it('calls the BFF down when it answers a call without the front door’s key, since its door is open', async () => {
    const said = lines();
    await written();
    const close = await serve((part) => (part === 'bff' ? 200 : own(part)));
    try {
      expect(await runLocal(['status'], baseIo(said))).toBe(1);
    } finally {
      await close();
    }

    expect(said.out.filter((line) => line.includes('DOWN'))).toEqual([
      `the BFF: DOWN on port ${ports.bff}`,
    ]);
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

  it('calls the audit service down when only its read side does not answer, and when its process is gone', async () => {
    const said = lines();
    await written();
    const close = await serve((part) => (part === 'auditOpen' ? 500 : own(part)));
    try {
      expect(await runLocal(['status'], baseIo(said))).toBe(1);
      const gone = lines();
      expect(await runLocal(['status'], baseIo(gone, { alive: (pid) => pid !== 43 }))).toBe(1);
      expect(gone.out.filter((line) => line.includes('DOWN'))).toEqual([
        `the audit service: DOWN on port ${auditPorts.keyed}`,
        `the audit service's read side: DOWN on port ${auditPorts.open}`,
      ]);
    } finally {
      await close();
    }

    expect(said.out.filter((line) => line.includes('DOWN'))).toEqual([
      `the audit service's read side: DOWN on port ${auditPorts.open}`,
    ]);
  });
});

describe('local activity', () => {
  let audit: RunningAudit;
  let binaryDir: string;
  beforeAll(async () => {
    binaryDir = await mkdtemp(join(tmpdir(), 'credo-audit-bin-'));
    await buildAudit(join(binaryDir, 'audit'));
    audit = await startAudit(join(binaryDir, 'audit'));
  });
  afterAll(async () => {
    await audit.stop();
    await rm(binaryDir, { recursive: true, force: true });
  });

  // Fresh for each case: the one audit service keeps every entry written to it.
  let CLIENT_ID = '';
  let RECORD_ID = '';
  beforeEach(() => {
    CLIENT_ID = crypto.randomUUID();
    RECORD_ID = crypto.randomUUID();
  });
  const customer = (name: string) => ({
    id: '7b6e3a1c-2f55-4d0e-9a6b-1e8c4f2d9a30',
    code: 'KH-1',
    name,
    extra: {},
  });

  /** A c-storage that knows the client `acme`, the audit service's target, and one saved entry. */
  async function standing() {
    const { storage } = memoryStorage();
    await storage.putRecord(recordKeys.client('acme'), { id: CLIENT_ID, name: 'Acme' }, null);
    const target = {
      audit: { url: audit.keyedUrl, readUrl: audit.openUrl, key: audit.key },
      storage: { baseUrl: 'http://x', internalAccessKey: 'i', serviceCode: 's', accessKey: 'a' },
    };
    return { storage, target };
  }

  const writeOne = (id = CLIENT_ID, at = '2026-11-10T10:15:00.000Z') =>
    createActivityClient({ baseUrl: audit.keyedUrl, key: audit.key }).log([
      {
        clientId: id,
        actorId: 'employee.7',
        action: 'customer.save',
        targetId: RECORD_ID,
        memo: { by: 'Lan', before: customer('Mai'), after: customer('Mai Linh') },
        timestamp: at,
      },
    ]);

  it('prints the one entry of a record as one line: the time, the person, what was done, the name before and after, the fields that changed, and no key or token', async () => {
    const { storage, target } = await standing();
    await writeOne();
    const said = lines();

    const status = await runLocal(
      ['activity', 'acme', RECORD_ID],
      baseIo(said, { env: { CREDO_AUDIT: JSON.stringify(target) }, connect: () => storage }),
    );

    expect(status).toBe(0);
    expect(said.out).toEqual([
      '2026-11-10T10:15:00.000Z  Lan  customer saved  Mai -> Mai Linh  changed: name',
    ]);
    expect(said.err).toEqual([]);
    const everything = JSON.stringify(said);
    expect(everything).not.toContain(audit.key);
    expect(everything).not.toContain('Bearer');
  });

  it('prints another client’s entries to no one: a client reads its own, and says so when it has none', async () => {
    const { storage, target } = await standing();
    await storage.putRecord(
      recordKeys.client('other'),
      { id: crypto.randomUUID(), name: 'Other' },
      null,
    );
    await writeOne();
    const said = lines();

    const status = await runLocal(
      ['activity', 'other', RECORD_ID],
      baseIo(said, { env: { CREDO_AUDIT: JSON.stringify(target) }, connect: () => storage }),
    );

    expect(status).toBe(0);
    expect(said.out).toEqual(['no entries']);
  });

  it('prints newest written first', async () => {
    const { storage, target } = await standing();
    await writeOne(CLIENT_ID, '2026-11-10T10:00:00.000Z');
    await writeOne(CLIENT_ID, '2026-11-10T09:00:00.000Z');
    const said = lines();

    await runLocal(
      ['activity', 'acme', RECORD_ID],
      baseIo(said, { env: { CREDO_AUDIT: JSON.stringify(target) }, connect: () => storage }),
    );

    expect(said.out.map((line) => line.slice(0, 24))).toEqual([
      '2026-11-10T09:00:00.000Z',
      '2026-11-10T10:00:00.000Z',
    ]);
  });

  it('finds its target in the handle when the environment names none', async () => {
    const { storage } = await standing();
    await writeHandle(
      paths,
      handleOf({ audit: { url: audit.keyedUrl, readUrl: audit.openUrl, key: audit.key } }),
    );
    const said = lines();

    const status = await runLocal(
      ['activity', 'acme', RECORD_ID],
      baseIo(said, { connect: () => storage }),
    );

    expect(status).toBe(0);
    expect(said.out).toEqual(['no entries']);
  });

  it('refuses what it cannot read, each with its reason and nothing printed as an entry', async () => {
    const { storage, target } = await standing();
    const down = { ...target, audit: { ...target.audit, url: 'http://127.0.0.1:9' } };
    const cases: [string[], Partial<LocalIo>, number, string][] = [
      [['activity'], {}, 2, 'a client code and a record id are both needed'],
      [['activity', 'acme'], {}, 2, 'a client code and a record id are both needed'],
      [['activity', 'acme', RECORD_ID], {}, 2, 'there is nowhere to read'],
      [['activity', 'acme', RECORD_ID], { env: { CREDO_AUDIT: '{' } }, 2, 'JSON'],
      [
        ['activity', 'nobody', RECORD_ID],
        { env: { CREDO_AUDIT: JSON.stringify(target) }, connect: () => storage },
        2,
        'nobody is not a client here',
      ],
      [
        ['activity', 'acme', RECORD_ID],
        { env: { CREDO_AUDIT: JSON.stringify(down) }, connect: () => storage },
        1,
        'the entries were not read: the audit service did not answer a token',
      ],
      [
        ['activity', 'acme', RECORD_ID],
        {
          env: { CREDO_AUDIT: JSON.stringify(target) },
          connect: () => ({
            ...storage,
            getRecord: () => Promise.reject(new Error('c-storage went')),
          }),
        },
        1,
        'the entries were not read: c-storage went',
      ],
    ];
    for (const [argv, over, code, message] of cases) {
      const said = lines();
      expect(await runLocal(argv, baseIo(said, over)), argv.join(' ')).toBe(code);
      expect(said.out).toEqual([]);
      expect(said.err.join('\n')).toContain(message);
    }
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
        audit: {
          url: `http://127.0.0.1:${auditPorts.keyed}`,
          readUrl: `http://127.0.0.1:${auditPorts.open}`,
          key: 'audit-key',
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

  it('refuses a code that holds a tenant already: exit 2, its code named, nothing written', async () => {
    const said = lines();
    const { records, storage } = memoryStorage();
    await writeHandle(paths, handleOf({ ports }));
    await runLocal(['seed', 'acme'], baseIo(said, { connect: () => storage }));
    const before = JSON.stringify([...records]);
    const count = () => listClients(storage).then((clients) => clients.length);
    const second = lines();

    const status = await runLocal(['seed', 'acme'], baseIo(second, { connect: () => storage }));

    expect(status).toBe(2);
    expect(second.out).toEqual([]);
    expect(second.err).toEqual([
      'acme is a tenant here already: nothing was seeded and nothing was changed',
    ]);
    expect(JSON.stringify([...records])).toBe(before);
    expect(await count()).toBe(1);
  });

  it('ends 1, not 2, on a failure that is not a held code', async () => {
    const said = lines();
    const { storage } = memoryStorage();
    await writeHandle(paths, handleOf({ ports }));
    const broken = { ...storage, getRecord: () => Promise.reject(new Error('c-storage went')) };

    const status = await runLocal(['seed', 'acme'], baseIo(said, { connect: () => broken }));

    expect(status).toBe(1);
    expect(said.err).toEqual(['acme was not seeded: c-storage went']);
  });
});

describe('local down', () => {
  const commandsOf = (): Record<number, string> => ({
    40: 'node --import tsx /x/scripts/src/local-main.ts keep /x',
    41: join(paths.build, 'c-storage'),
    43: join(paths.build, 'audit'),
    42: 'node --import tsx /x/bff/src/main.ts',
  });

  /** The environment as `up` leaves it, and a world of processes that end when signalled. */
  async function standing(handleOver: Partial<Handle> = {}) {
    await mkdir(paths.data, { recursive: true });
    await mkdir(join(paths.build, 'ui'), { recursive: true });
    await writeFile(join(paths.build, 'c-storage'), 'binary');
    await writeFile(join(paths.build, 'audit'), 'binary');
    await writeFile(join(paths.data, 'records.db'), 'rows');
    await writeHandle(paths, handleOf({ ports, dataDir: paths.data, ...handleOver }));
    const running = new Set([40, 41, 43, 42]);
    const signalled: number[] = [];
    return {
      running,
      signalled,
      io: (said: ReturnType<typeof lines>, over: Partial<LocalIo> = {}) =>
        baseIo(said, {
          alive: (pid) => running.has(pid),
          signal: (pid) => {
            signalled.push(pid);
            running.delete(pid);
          },
          commandOf: (pid) => commandsOf()[pid],
          ...over,
        }),
    };
  }
  const gone = (path: string) =>
    stat(path).then(
      () => false,
      () => true,
    );

  it('says there is nothing to take down when there is no handle and no folder', async () => {
    const said = lines();

    expect(await runLocal(['down'], baseIo(said))).toBe(0);
    expect(said.out).toEqual([
      'there is no handle and no environment folder: nothing is up, nothing was changed',
    ]);
  });

  it('stops the four processes, removes the folders and the handle, and reads each back', async () => {
    const said = lines();
    const world = await standing();

    const status = await runLocal(['down'], world.io(said));

    expect(status).toBe(0);
    expect(world.signalled).toEqual([40, 41, 43, 42]);
    expect(said.out).toEqual([
      'keeper (pid 40): stopped',
      'c-storage (pid 41): stopped',
      'the audit service (pid 43): stopped',
      'the BFF (pid 42): stopped',
      'read back after the teardown:',
      '  keeper: gone',
      '  c-storage: gone',
      '  the audit service: gone',
      '  the BFF: gone',
      `  ports ${ports.front}, ${ports.cStorage}, ${ports.bff}, ${ports.seedDoor}, ${auditPorts.keyed}, ${auditPorts.open}: nothing is listening`,
      '  data folder and its database: gone',
      '  build folder: gone',
      '  handle: gone',
      'down: everything is cleared',
    ]);
    expect(said.err).toEqual([]);
    expect(await gone(paths.dir)).toBe(true);
  });

  it('really ends a running process and reads it gone', async () => {
    const said = lines();
    const world = await standing();
    const child = await startProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      env: {},
      logFile: join(root, 'child.log'),
    });
    const pid = child.child.pid!;
    await writeFile(
      paths.handle,
      JSON.stringify(handleOf({ ports, dataDir: paths.data, keeper: pid })),
    );
    const alive = (p: number) => {
      try {
        process.kill(p, 0);
        return true;
      } catch {
        return false;
      }
    };
    try {
      const status = await runLocal(
        ['down'],
        world.io(said, {
          alive: (p) => (p === pid ? alive(p) : world.running.has(p)),
          signal: (p) => (p === pid ? process.kill(p, 'SIGTERM') : world.running.delete(p)),
          commandOf: (p) => (p === pid ? 'node local-main.ts' : commandsOf()[p]),
          settleMs: 3000,
        }),
      );

      expect(status).toBe(0);
      expect(said.out).toContain(`keeper (pid ${pid}): stopped`);
      expect(alive(pid)).toBe(false);
    } finally {
      await child.stop();
    }
  });

  it('takes a handle whose processes are already dead as a case: nothing to stop, the rest removed', async () => {
    const said = lines();
    const world = await standing();
    world.running.clear();

    expect(await runLocal(['down'], world.io(said))).toBe(0);
    expect(said.out.slice(0, 4)).toEqual([
      'keeper (pid 40): was not running',
      'c-storage (pid 41): was not running',
      'the audit service (pid 43): was not running',
      'the BFF (pid 42): was not running',
    ]);
    expect(world.signalled).toEqual([]);
    expect(await gone(paths.dir)).toBe(true);
  });

  it('removes the folder when only the folder is left, and when the data folder is already gone', async () => {
    const said = lines();
    const world = await standing();
    await rm(paths.data, { recursive: true });
    world.running.clear();
    await rm(paths.handle);

    expect(await runLocal(['down'], world.io(said))).toBe(0);
    expect(said.out[0]).toBe(
      'there is no handle and no process of the environment: only the environment folder is removed',
    );
    expect(said.out.at(-1)).toBe('down: everything is cleared');
    expect(await gone(paths.dir)).toBe(true);
  });

  it('keeps the folder and names the processes when there is no handle but the environment’s processes run', async () => {
    const said = lines();
    const world = await standing();
    await rm(paths.handle);
    const listing = [
      { pid: 7001, command: `${join(paths.build, 'c-storage')}` },
      { pid: 7002, command: `node --import tsx /x/scripts/src/local-main.ts keep ${root}` },
      { pid: 7003, command: `node --import tsx /x/scripts/src/local-main.ts keep /someone/elses` },
      { pid: 7004, command: '/usr/bin/vim notes.md' },
    ];

    const status = await runLocal(['down'], world.io(said, { listProcesses: () => listing }));

    expect(status).toBe(1);
    expect(said.out).toEqual([
      `pid 7001 is running: ${listing[0].command}`,
      `pid 7002 is running: ${listing[1].command}`,
    ]);
    expect(said.err).toHaveLength(1);
    expect(said.err[0]).toContain('end them with kill 7001 7002 and run pnpm local down again');
    expect(await gone(paths.data)).toBe(false);
    expect(world.signalled).toEqual([]);
  });

  it('keeps the folder and says so when there is no handle and the processes cannot be listed', async () => {
    const said = lines();
    const world = await standing();
    await rm(paths.handle);

    const status = await runLocal(
      ['down'],
      world.io(said, {
        listProcesses: () => {
          throw new Error('ps is not here');
        },
      }),
    );

    expect(status).toBe(1);
    expect(said.err[0]).toContain('the processes could not be listed (ps is not here)');
    expect(await gone(paths.data)).toBe(false);
  });

  it('refuses a handle that names a folder it did not make, signals nothing and deletes nothing', async () => {
    const said = lines();
    const elsewhere = join(root, 'precious');
    await mkdir(elsewhere);
    const world = await standing();
    await rm(paths.handle);
    await writeHandle(paths, handleOf({ ports, dataDir: elsewhere }));

    expect(await runLocal(['down'], world.io(said))).toBe(2);
    expect(said.err).toEqual([
      `the handle at ${paths.handle} cannot be trusted: its data folder is ${elsewhere}, not ${paths.data}, the only folder this command removes; nothing was changed`,
    ]);
    expect(world.signalled).toEqual([]);
    expect(await gone(elsewhere)).toBe(false);
    expect(await gone(paths.data)).toBe(false);
  });

  it('refuses a handle that is not one', async () => {
    for (const text of ['not json', 'null', JSON.stringify({ dataDir: paths.data, keeper: 40 })]) {
      const said = lines();
      await rm(paths.dir, { recursive: true, force: true });
      const world = await standing();
      await writeFile(paths.handle, text);

      expect(await runLocal(['down'], world.io(said)), text).toBe(2);
      expect(said.err[0]).toContain('cannot be trusted');
      expect(world.signalled).toEqual([]);
      expect(await gone(paths.data)).toBe(false);
    }
  });

  it('names a process that will not go, leaves the data and the handle, and ends red', async () => {
    const said = lines();
    const world = await standing();

    const status = await runLocal(
      ['down'],
      world.io(said, { signal: (pid) => void world.signalled.push(pid) }),
    );

    expect(status).toBe(1);
    expect(said.out).toContain('keeper (pid 40): asked to end, still running after 0.1 s');
    expect(said.out).toContain('nothing was removed: a process may still use the data');
    expect(said.out).toContain('  keeper: FOUND, pid 40 is running');
    expect(said.err[0]).toContain('down: NOT cleared: keeper (pid 40) is still running');
    expect(await gone(paths.handle)).toBe(false);
    expect(await gone(paths.data)).toBe(false);
  });

  it('leaves alone a number another program holds now, and a process it cannot prove is the stack’s', async () => {
    const said = lines();
    const world = await standing();
    const stranger = lines();

    const status = await runLocal(
      ['down'],
      world.io(stranger, {
        commandOf: (pid) => (pid === 40 ? '/usr/bin/vim notes.md' : commandsOf()[pid]),
      }),
    );

    expect(status).toBe(0);
    expect(world.signalled).toEqual([41, 43, 42]);
    expect(stranger.out).toContain(
      'keeper (pid 40): already gone; that number is now /usr/bin/vim notes.md, left alone',
    );
    expect(stranger.out).toContain("  keeper: gone (pid 40 is another program's now)");

    await rm(paths.dir, { recursive: true, force: true });
    const second = await standing();
    const unreadable = await runLocal(['down'], second.io(said, { commandOf: () => undefined }));
    expect(unreadable).toBe(1);
    expect(second.signalled).toEqual([]);
    expect(said.err[0]).toContain("could not be proved the stack's");
  });

  it('ends red and names the port when something else holds one after the teardown', async () => {
    const said = lines();
    const world = await standing();
    const stranger = createHttpServer();
    await new Promise<void>((resolve) => stranger.listen(ports.cStorage, resolve));
    try {
      expect(await runLocal(['down'], world.io(said))).toBe(1);
    } finally {
      await new Promise((resolve) => stranger.close(resolve));
    }

    expect(said.out).toContain(
      `  port ${ports.cStorage} (c-storage): FOUND, something is listening`,
    );
    expect(said.err).toEqual([
      `down: NOT cleared: port ${ports.cStorage} (c-storage) is held by something`,
    ]);
  });

  it('ends red and names the audit service’s port when something holds it after the teardown', async () => {
    const said = lines();
    const world = await standing();
    const stranger = createHttpServer();
    await new Promise<void>((resolve) => stranger.listen(auditPorts.open, resolve));
    try {
      expect(await runLocal(['down'], world.io(said))).toBe(1);
    } finally {
      await new Promise((resolve) => stranger.close(resolve));
    }

    expect(said.err).toEqual([
      `down: NOT cleared: port ${auditPorts.open} (the audit service's read side) is held by something`,
    ]);
  });

  it('ends red and names the folder when it is still there after the removal', async () => {
    const said = lines();
    const world = await standing();
    refusedRemoval.path = paths.dir;
    try {
      expect(await runLocal(['down'], world.io(said))).toBe(1);
    } finally {
      refusedRemoval.path = null;
    }

    expect(said.out).toContain(`  data folder and its database: FOUND at ${paths.data}`);
    expect(said.err[0]).toContain(`data folder and its database is still at ${paths.data}`);
    expect(said.err[0]).toContain('could not be removed');
  });

  it('stop ends the four processes, keeps the data, the build and the logs, and marks the handle stopped', async () => {
    const said = lines();
    const world = await standing();
    await writeFile(join(paths.data, 'bff.log'), 'a log');

    const status = await runLocal(['stop'], world.io(said));

    expect(status).toBe(0);
    expect(world.signalled).toEqual([40, 41, 43, 42]);
    expect(said.out).toEqual([
      'keeper (pid 40): stopped',
      'c-storage (pid 41): stopped',
      'the audit service (pid 43): stopped',
      'the BFF (pid 42): stopped',
      'read back after the stop:',
      '  keeper: gone',
      '  c-storage: gone',
      '  the audit service: gone',
      '  the BFF: gone',
      `  ports ${ports.front}, ${ports.cStorage}, ${ports.bff}, ${ports.seedDoor}, ${auditPorts.keyed}, ${auditPorts.open}: nothing is listening`,
      '  data folder and its database: kept',
      '  build folder: kept',
      'stop: the environment is stopped and its data is kept; pnpm local up resumes it, pnpm local down deletes it',
    ]);
    const handle = JSON.parse(await readFile(paths.handle, 'utf8')) as Handle;
    expect(handle.stopped).toEqual({ at: '12:34' });
    expect(handle.cStorage.superAdminKey).toBe('sk');
    expect((await stat(paths.handle)).mode & 0o777).toBe(0o600);
    expect(await gone(join(paths.data, 'records.db'))).toBe(false);
    expect(await gone(join(paths.data, 'bff.log'))).toBe(false);
    expect(await gone(paths.build)).toBe(false);

    const read = lines();
    expect(await runLocal(['status'], baseIo(read))).toBe(0);
    expect(read.out).toEqual([
      'the environment is stopped (since 12:34) and its data is kept: pnpm local up resumes it, pnpm local down deletes it',
    ]);
  });

  it('stop says so, and changes nothing, when there is no handle or the environment is stopped already', async () => {
    const none = lines();
    expect(await runLocal(['stop'], baseIo(none))).toBe(0);
    expect(none.out).toEqual(['nothing is up: there is no handle, so there is nothing to stop']);

    const world = await standing();
    await runLocal(['stop'], world.io(lines()));
    world.signalled.length = 0;
    const again = lines();

    expect(await runLocal(['stop'], world.io(again))).toBe(0);
    expect(again.out).toEqual([
      'the environment is stopped already (since 12:34) and its data is kept',
    ]);
    expect(world.signalled).toEqual([]);
  });

  it('stop refuses a handle it cannot trust, and signals nothing', async () => {
    const said = lines();
    const world = await standing();
    await rm(paths.handle);
    await writeHandle(paths, handleOf({ ports, dataDir: join(root, 'precious') }));

    expect(await runLocal(['stop'], world.io(said))).toBe(2);
    expect(said.err[0]).toContain('cannot be trusted');
    expect(world.signalled).toEqual([]);
  });

  it('stop leaves the handle unmarked, and ends red, when a process will not go or cannot be proved the stack’s', async () => {
    const stuck = lines();
    const world = await standing();
    expect(
      await runLocal(
        ['stop'],
        world.io(stuck, { signal: (pid) => void world.signalled.push(pid) }),
      ),
    ).toBe(1);
    expect(stuck.out).toContain('the handle is left as it was: a process may still use the data');
    expect(stuck.err[0]).toContain('stop: NOT stopped: keeper (pid 40) is still running');
    expect(((await readHandle()) as Handle).stopped).toBeUndefined();

    await rm(paths.dir, { recursive: true, force: true });
    const unproved = lines();
    const second = await standing();
    expect(await runLocal(['stop'], second.io(unproved, { commandOf: () => undefined }))).toBe(1);
    expect(second.signalled).toEqual([]);
    expect(((await readHandle()) as Handle).stopped).toBeUndefined();
  });

  it('stop ends red, unmarked, when a port is held by something else or the data is not there to keep', async () => {
    const held = lines();
    const world = await standing();
    const stranger = createHttpServer();
    await new Promise<void>((resolve) => stranger.listen(ports.bff, resolve));
    try {
      expect(await runLocal(['stop'], world.io(held))).toBe(1);
    } finally {
      await new Promise((resolve) => stranger.close(resolve));
    }
    expect(held.err[0]).toContain(`port ${ports.bff} (the BFF) is held by something`);
    expect(((await readHandle()) as Handle).stopped).toBeUndefined();

    const audit = lines();
    const keyed = createHttpServer();
    await new Promise<void>((resolve) => keyed.listen(auditPorts.keyed, resolve));
    try {
      expect(await runLocal(['stop'], world.io(audit))).toBe(1);
    } finally {
      await new Promise((resolve) => keyed.close(resolve));
    }
    expect(audit.err[0]).toContain(
      `port ${auditPorts.keyed} (the audit service) is held by something`,
    );

    await rm(paths.dir, { recursive: true, force: true });
    const missing = lines();
    const bare = await standing();
    await rm(join(paths.data, 'records.db'));
    expect(await runLocal(['stop'], bare.io(missing))).toBe(1);
    expect(missing.err[0]).toContain('is missing, so there is nothing to resume');
    expect(((await readHandle()) as Handle).stopped).toBeUndefined();
  });

  it('down deletes a stopped environment as it deletes a running one', async () => {
    const said = lines();
    const world = await standing();
    await runLocal(['stop'], world.io(lines()));

    expect(await runLocal(['down'], world.io(said))).toBe(0);
    expect(said.out.at(-1)).toBe('down: everything is cleared');
    expect(await gone(paths.dir)).toBe(true);
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
    const build = vi.fn(() =>
      Promise.resolve({ cStorage: 'c', audit: 'a', uiDir: 'u', dir: paths.build }),
    );
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

  it('names a keeper that will not end, within the bound, and leaves its folder', async () => {
    const said = lines();
    const dead = await startProcess(process.execPath, ['-e', 'process.exit(3)'], {
      env: {},
      logFile: join(root, 'keeper-stub.log'),
    });
    const stuck = { ...dead, stop: () => new Promise<void>(() => undefined) };

    const status = await runLocal(
      ['up'],
      baseIo(said, {
        build: () => Promise.resolve({ cStorage: 'c', audit: 'a', uiDir: 'u', dir: paths.build }),
        keeper: () => Promise.resolve(stuck),
        settleMs: 150,
      }),
    );

    expect(status).toBe(1);
    expect(said.err[0]).toContain('the environment did not come up');
    expect(said.err[1]).toContain(
      `the keeper (pid ${dead.child.pid}) did not end in 0.15 s and is left running`,
    );
    expect(said.err[1]).toContain(`kill ${dead.child.pid}, then run pnpm local down`);
    expect((await stat(paths.dir)).isDirectory()).toBe(true);
  });

  it('starts over a folder a failed removal left, and never reads a stale log as its own', async () => {
    const port = await freePort();
    const said = lines();
    const keeper = await standIn(port, 60);
    await writeFile(paths.keeperLog, 'listening: the stale run\n');
    await mkdir(paths.data, { recursive: true });
    await writeFile(join(paths.data, 'records.db'), 'stale');
    const kept: { current: Started | null } = { current: null };
    try {
      const status = await runLocal(
        ['up'],
        baseIo(said, {
          ports: { ...ports, front: port },
          build: () => Promise.resolve({ cStorage: 'c', audit: 'a', uiDir: 'u', dir: paths.build }),
          keeper: async () => (kept.current = await keeper()),
        }),
      );

      expect(status).toBe(0);
      expect(await readFile(paths.keeperLog, 'utf8')).not.toContain('stale');
      expect(await stat(join(paths.data, 'records.db')).catch(() => null)).toBeNull();
    } finally {
      await kept.current?.stop();
    }
  });

  it('fails plainly, and cleans up, when the handle it waited for cannot be read', async () => {
    const port = await freePort();
    const said = lines();
    const script = `
      require('fs').writeFileSync(${JSON.stringify(paths.handle)}, 'not json');
      require('http').createServer((_, r) => r.end('ok')).listen(${port}, '127.0.0.1', () => console.log('listening'));
      setTimeout(() => {}, 20000);`;
    const kept: { current: Started | null } = { current: null };

    const status = await runLocal(
      ['up'],
      baseIo(said, {
        ports: { ...ports, front: port },
        build: () => Promise.resolve({ cStorage: 'c', audit: 'a', uiDir: 'u', dir: paths.build }),
        keeper: async () =>
          (kept.current = await startProcess(process.execPath, ['-e', script], {
            env: {},
            logFile: paths.keeperLog,
          })),
      }),
    );

    expect(status).toBe(1);
    expect(said.err[0]).toContain('the environment did not come up');
    await expect(stat(paths.dir)).rejects.toThrow('ENOENT');
  });

  it('resumes a stopped environment: its data is kept, nothing is rebuilt, a fresh handle replaces the stopped one', async () => {
    const port = await freePort();
    const said = lines();
    const keeper = await standIn(port, 60);
    await mkdir(paths.data, { recursive: true });
    await mkdir(join(paths.build, 'ui'), { recursive: true });
    await writeFile(join(paths.data, 'records.db'), 'my rows');
    await writeFile(join(paths.build, 'c-storage'), 'binary');
    await writeFile(join(paths.build, 'audit'), 'binary');
    await writeFile(paths.keeperLog, 'listening: the previous run\n');
    await writeHandle(paths, handleOf({ ports, dataDir: paths.data, stopped: { at: '09:00' } }));
    const build = vi.fn(() => Promise.reject(new Error('must not build')));
    const kept: { current: Started | null } = { current: null };
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
      expect(said.out[0]).toBe(
        'resuming the stopped environment: its data is kept and nothing is rebuilt; this may take up to 5 s, until 12:34',
      );
      expect(build).not.toHaveBeenCalled();
      expect(await readFile(join(paths.data, 'records.db'), 'utf8')).toBe('my rows');
      expect(await readFile(paths.keeperLog, 'utf8')).not.toContain('previous');
      expect(((await readHandle()) as Handle).stopped).toBeUndefined();
    } finally {
      await kept.current?.stop();
    }
  });

  it('builds new, and says why, when the stopped environment’s data is not intact', async () => {
    const said = lines();
    await writeHandle(paths, handleOf({ ports, dataDir: paths.data, stopped: { at: '09:00' } }));
    const build = vi.fn(() => Promise.reject(new Error('no go')));

    const status = await runLocal(['up'], baseIo(said, { build }));

    expect(status).toBe(1);
    expect(build).toHaveBeenCalledWith(paths.build);
    expect(said.out[0]).toBe(
      'the stopped environment’s data is not intact, so it starts new: building c-storage and the UI, then starting the stack: this may take up to 5 s, until 12:34',
    );
  });

  it('keeps the stopped environment, data and handle, when a resume fails', async () => {
    const said = lines();
    await mkdir(paths.data, { recursive: true });
    await mkdir(join(paths.build, 'ui'), { recursive: true });
    await writeFile(join(paths.data, 'records.db'), 'my rows');
    await writeFile(join(paths.build, 'c-storage'), 'binary');
    await writeFile(join(paths.build, 'audit'), 'binary');
    await writeHandle(paths, handleOf({ ports, dataDir: paths.data, stopped: { at: '09:00' } }));

    const status = await runLocal(
      ['up'],
      baseIo(said, {
        keeper: () =>
          startProcess(process.execPath, ['-e', 'process.exit(3)'], {
            env: {},
            logFile: paths.keeperLog,
          }),
      }),
    );

    expect(status).toBe(1);
    expect(await readFile(join(paths.data, 'records.db'), 'utf8')).toBe('my rows');
    expect(((await readHandle()) as Handle).stopped).toEqual({ at: '09:00' });
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
    const build = () =>
      Promise.resolve({ cStorage: 'c', audit: 'a', uiDir: 'u', dir: paths.build });
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
    expect(said.err).toEqual([
      'usage: pnpm local up | status | seed <code> [<name>] | activity <code> <record id> | stop | down',
    ]);
  });
});
