import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAudit, buildCStorage } from '@credo/bff/tests/build';
import { createCStorageClient, type CStorageClient, joinLinkPath } from '@credo/shared';
import { DEMO_CODE, OPERATOR_NAME } from '@credo/shared/demo';
import { build } from 'vite';
import { createFront } from './running/front';
import { ROOT_NAME, seedClient, seedDemo } from './generator';
import { freePort, startProcess, waitUntilUp } from './running/processes';
import { ensureService } from './register';
import { createSeeding, logToStderr } from './seeding';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const UI_DIR = join(ROOT, 'ui');
const SERVICE_CODE = 'demo';

export type Artifacts = { cStorage: string; audit: string; uiDir: string; dir: string };

/**
 * What the stack runs, built from the checkout: c-storage and the audit service as binaries for this machine, and the
 * UI's files. Built once and started as often as needed. Both go into `dir`, never into the
 * checkout: Vite empties its output folder first, and a running stack's front serves from it.
 */
export async function buildArtifacts(dir: string): Promise<Artifacts> {
  const cStorage = join(dir, 'c-storage');
  const audit = join(dir, 'audit');
  const uiDir = join(dir, 'ui');
  await buildCStorage(cStorage);
  await buildAudit(audit);
  await build({ root: UI_DIR, logLevel: 'warn', build: { outDir: uiDir, emptyOutDir: true } });
  return { cStorage, audit, uiDir, dir };
}

export type RunningStack = {
  /** The front, where a browser goes. */
  url: string;
  /** The demo client's code, whose link is `/login?client-code=<code>`. */
  clientCode: string;
  rootName: string;
  /** Known to this process and to whoever it hands it to; stored nowhere readable. */
  rootPassword: string;
  /** The data set's active operator, whose two passkeys are the fake's. */
  operatorName: string;
  /** That operator's session, kept on a device in place of a sign-in: a passkey ceremony would
   * stamp today on a passkey the list shows. Known to this process and to whoever it hands it to. */
  operatorHandle: string;
  /** One of that operator's two passkeys as a walk can touch it, minted per stack: the credential's id
   * and user handle (base64url) and its private key (PKCS8, base64), as JSON. Handed to a command
   * once, never printed, stored or committed. */
  operatorPasskey: string;
  /** The invited operator's one-time link to make their first passkey,
   * `<address>/operator/join#<token>`, made by the active one. Known to this process and to whoever
   * it hands it to; stored only as its hash. */
  operatorLink: string;
  /** The data set's people with a sign-in, each with the first password the generator made, by
   * code. Known to this process and to whoever it hands it to; stored nowhere readable. */
  people: Record<string, string>;
  /** `POST` here makes another client from the data set and answers its code and passwords:
   * the full run opens each screen on one. Loopback only, up while the stack is. */
  seedUrl: string;
  /** The folder the stack keeps its database and logs in, removed when the stack goes down. */
  dataDir: string;
  /** Where `pnpm local activity` reads an entry from and how it finds the client's id: the audit
   * service's addresses and key, and c-storage's. Handed to a command once, never printed. */
  activityTarget: ActivityTarget;
  /** The BFF's own c-storage service, for `pnpm demo` to make its copies in this process. Never
   * handed to a command. */
  storage: CStorageClient;
};

/** Listens on loopback alone, on a free port or the one given, and answers where it is bound. */
export const listening = (server: Server, port = 0) =>
  new Promise<AddressInfo>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server.address() as AddressInfo));
  });

const key = () => randomBytes(24).toString('hex');

/** What a command needs to print one client's entries: the audit service's keyed and open
 * addresses and its key, and the c-storage that maps a client's code to its minted id. */
export type ActivityTarget = {
  audit: { url: string; readUrl: string; key: string };
  storage: { baseUrl: string; internalAccessKey: string; serviceCode: string; accessKey: string };
};

export const activityTargetOf = (facts: StackFacts): ActivityTarget => ({
  audit: facts.audit,
  storage: {
    baseUrl: facts.cStorage.url,
    internalAccessKey: facts.cStorage.internalAccessKey,
    serviceCode: facts.service.code,
    accessKey: facts.service.accessKey,
  },
});

/**
 * Exactly the variables the BFF reads, each given here and none taken from this process: the
 * stack holds c-storage's super-admin key and every other secret of the machine it runs on, and
 * the BFF gets none of them. `HOST` is set, so an exported `HOST` cannot move it off loopback.
 */
export function bffEnvironment(settings: {
  port: number;
  cStorageUrl: string;
  internalAccessKey: string;
  service: { code: string; accessKey: string };
  /** The audit service's keyed address and key, which the BFF writes its entries with. */
  audit: { url: string; key: string };
  /** The address the operator opens: the front's, which every passkey is checked against. */
  appOrigin: string;
}) {
  return {
    PORT: String(settings.port),
    HOST: '127.0.0.1',
    C_STORAGE_URL: settings.cStorageUrl,
    INTERNAL_ACCESS_KEY: settings.internalAccessKey,
    SERVICE_CODE: settings.service.code,
    SERVICE_ACCESS_KEY: settings.service.accessKey,
    AUDIT_URL: settings.audit.url,
    AUDIT_KEY: settings.audit.key,
    APP_ORIGIN: settings.appOrigin,
  };
}

/** What a command that outlives the stack needs to find it again: where each part listens, the
 * processes that hold them, and the keys that open c-storage. Secrets: written only to a 0600 file. */
export type StackFacts = {
  ports: { cStorage: number; front: number; bff: number; seedDoor: number };
  pids: { cStorage: number; audit: number; bff: number };
  cStorage: { url: string; internalAccessKey: string; superAdminKey: string };
  service: { code: string; accessKey: string };
  /** The audit service: its keyed address, its open one (where a read token reads) and its key. */
  audit: { url: string; readUrl: string; key: string };
};

/** What `startStack` may be told: a data folder and ports of its own in place of a fresh temp
 * folder and free ports, and `seed` standing in for the generator's client, for a test of the
 * door's failure. */
export type StartOptions = {
  seed?: typeof seedClient;
  dataDir?: string;
  ports?: Partial<StackFacts['ports']>;
  /** The audit service's two ports: the keyed one and the open one. */
  auditPorts?: { keyed: number; open: number };
  /** Stands the stack up again on data a stopped stack left: the keys that open it, kept from the
   * first start, and what the first start printed. The demo set is not made again, so the people
   * and the operator's session are not known to the resumed stack. */
  resume?: {
    internalAccessKey: string;
    superAdminKey: string;
    service: { code: string; accessKey: string };
    auditKey: string;
    demo: { rootPassword: string; operatorLink: string };
  };
};

export type StartedStack = RunningStack & { facts: StackFacts; stop: () => Promise<void> };

/**
 * The local stack, left standing: c-storage on a fresh database in `dataDir`, the BFF's service
 * registered with the super-admin key (which the BFF never holds), the operator and the demo client
 * made, the BFF started, and the front standing before them. It answers the stack and a `stop`
 * that takes every part down and removes nothing: the data folder is the caller's. A part that
 * fails to start takes down the parts already up before the failure is passed on.
 */
export async function startStack(
  artifacts: Artifacts,
  options: StartOptions & { dataDir: string },
): Promise<StartedStack> {
  const { dataDir } = options;
  const stops: (() => Promise<unknown>)[] = [];
  const stop = async () => {
    for (const stopOne of stops.splice(0)) await stopOne();
  };
  try {
    const { resume } = options;
    const internalAccessKey = resume?.internalAccessKey ?? key();
    const superAdminKey = resume?.superAdminKey ?? key();
    const service = resume?.service ?? { code: SERVICE_CODE, accessKey: key() };
    const auditKey = resume?.auditKey ?? key();
    const csPort = options.ports?.cStorage ?? (await freePort());
    const cStorageUrl = `http://127.0.0.1:${csPort}`;
    const cStorage = await startProcess(artifacts.cStorage, [], {
      env: {
        PORT: String(csPort),
        DB_PATH: join(dataDir, 'records.db'),
        INTERNAL_ACCESS_KEY: internalAccessKey,
        X_SUPER_ADMIN_KEY: superAdminKey,
      },
      logFile: join(dataDir, 'c-storage.log'),
    });
    stops.unshift(cStorage.stop);
    await waitUntilUp(`${cStorageUrl}/health`, cStorage, 'c-storage');

    await ensureService({ baseUrl: cStorageUrl, internalAccessKey, superAdminKey }, service);
    const storage = createCStorageClient({
      baseUrl: cStorageUrl,
      internalAccessKey,
      serviceCode: service.code,
      accessKey: service.accessKey,
    });
    const auditPort = options.auditPorts?.keyed ?? (await freePort());
    const auditOpenPort = options.auditPorts?.open ?? (await freePort());
    const auditUrl = `http://127.0.0.1:${auditPort}`;
    const auditProcess = await startProcess(artifacts.audit, [], {
      env: {
        PORT: String(auditPort),
        OPEN_PORT: String(auditOpenPort),
        DB_PATH: join(dataDir, 'activities.db'),
        ACTIVITY_WRITE_KEY: auditKey,
      },
      logFile: join(dataDir, 'audit.log'),
    });
    stops.unshift(auditProcess.stop);
    await waitUntilUp(`${auditUrl}/health`, auditProcess, 'the audit service');

    const seededDemo = resume ? null : await seedDemo(storage);
    let seeded = 0;
    const seeding = createSeeding(
      () => (options.seed ?? seedClient)(storage, `walk-${++seeded}`),
      logToStderr,
    );
    stops.unshift(() => new Promise((resolve) => seeding.close(resolve)));
    const { port: seedPort } = await listening(seeding, options.ports?.seedDoor);

    // A passkey is bound to a name and no IP address has one: the operator opens `localhost`, on the
    // front's port, which is picked before the BFF starts since the BFF checks every ceremony
    // against it.
    const frontPort = options.ports?.front ?? (await freePort());
    const appOrigin = `http://localhost:${frontPort}`;
    const bffPort = options.ports?.bff ?? (await freePort());
    const bffUrl = `http://127.0.0.1:${bffPort}`;
    const bff = await startProcess(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), join(ROOT, 'bff/src/main.ts')],
      {
        env: bffEnvironment({
          port: bffPort,
          cStorageUrl,
          internalAccessKey,
          service,
          audit: { url: auditUrl, key: auditKey },
          appOrigin,
        }),
        logFile: join(dataDir, 'bff.log'),
      },
    );
    stops.unshift(bff.stop);
    await waitUntilUp(`${bffUrl}/api/config`, bff, 'the BFF', undefined, {
      'x-client-code': DEMO_CODE,
    });

    const front = createFront({ staticDir: artifacts.uiDir, bffUrl });
    stops.unshift(() => new Promise((resolve) => front.close(resolve)));
    await listening(front, frontPort);

    const facts: StackFacts = {
      ports: { cStorage: csPort, front: frontPort, bff: bffPort, seedDoor: seedPort },
      // A child that has started has a pid: spawn answers none only for one that never ran.
      pids: { cStorage: cStorage.child.pid!, audit: auditProcess.child.pid!, bff: bff.child.pid! },
      cStorage: { url: cStorageUrl, internalAccessKey, superAdminKey },
      service,
      audit: { url: auditUrl, readUrl: `http://127.0.0.1:${auditOpenPort}`, key: auditKey },
    };
    return {
      url: appOrigin,
      clientCode: DEMO_CODE,
      rootName: ROOT_NAME,
      rootPassword: seededDemo ? seededDemo.rootPassword : resume!.demo.rootPassword,
      operatorName: OPERATOR_NAME,
      operatorHandle: seededDemo ? seededDemo.operatorHandle : '',
      operatorPasskey: seededDemo ? JSON.stringify(seededDemo.operatorPasskey) : '',
      operatorLink: seededDemo
        ? `${appOrigin}${joinLinkPath(seededDemo.invitedToken)}`
        : resume!.demo.operatorLink,
      people: seededDemo ? seededDemo.people : {},
      seedUrl: `http://127.0.0.1:${seedPort}/seed`,
      dataDir,
      activityTarget: activityTargetOf(facts),
      storage,
      facts,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

/**
 * The local stack for the length of `use`, on a fresh data folder: `startStack`, and everything
 * goes down when `use` ends, however it ends, and the database with it.
 */
export async function withStack<T>(
  artifacts: Artifacts,
  use: (stack: RunningStack) => Promise<T>,
  options: Pick<StartOptions, 'seed'> = {},
): Promise<T> {
  const dataDir = await mkdtemp(join(tmpdir(), 'credo-stack-'));
  try {
    const stack = await startStack(artifacts, { ...options, dataDir });
    try {
      return await use(stack);
    } finally {
      await stack.stop();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}
