import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SoftwareAuthenticator } from '@credo/bff/tests/authenticator';
import {
  CLIENT_HEADER,
  joinOptionsReplySchema,
  operatorMeReplySchema,
  operatorSessionReplySchema,
  optionsReplySchema,
  tokenOfFragment,
} from '@credo/shared';
import { DEMO_INVITED_NAME, DEMO_PASSKEYS } from '@credo/shared/demo';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { commandOf, runStack } from './cli';
import { BFF_ENV_KEYS } from '@credo/bff/env';
import { freePort } from './running/processes';
import {
  type Artifacts,
  bffEnvironment,
  buildArtifacts,
  listening,
  startStack,
  withStack,
} from './stack';

let dir: string;
let artifacts: Artifacts;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-stack-test-'));
  artifacts = await buildArtifacts(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const json = (body: unknown) => JSON.stringify(body);
const signIn = async (url: string, name: string, password: string) => {
  const body = json({ name, password });
  return await fetch(`${url}/api/auth/sign-in`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-device-id': 'device-aaaa-0001',
      [CLIENT_HEADER]: 'demo',
    },
    body,
  });
};

const post = (url: string, path: string, body: unknown, authId?: string) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-device-id': 'device-aaaa-0001',
      ...(authId ? { 'x-auth-id': authId } : {}),
    },
    body: body === undefined ? undefined : json(body),
  });

/** The operator joins by the stack's link with a software authenticator, through the front. */
async function joinByStackLink(stack: { url: string; operatorLink: string }) {
  const token = tokenOfFragment(new URL(stack.operatorLink).hash)!;
  const opened = joinOptionsReplySchema.parse(
    await (await post(stack.url, '/api/operator/join/options', { link: token })).json(),
  );
  const authenticator = new SoftwareAuthenticator(stack.url);
  const joined = await post(stack.url, '/api/operator/join', {
    link: token,
    token: opened.token,
    response: authenticator.register(opened.options as never),
  });
  return { token, joined, authenticator };
}

describe('pnpm stack', () => {
  it('brings the demo tenant up behind the front: its page, its settings, its root’s sign-in', async () => {
    await withStack(artifacts, async (stack) => {
      expect(await (await fetch(`${stack.url}/settings`)).text()).toContain('<div id="root">');

      const config = (await (
        await fetch(`${stack.url}/api/config`, { headers: { [CLIENT_HEADER]: stack.clientCode } })
      ).json()) as {
        config: { name: string };
      };
      expect(config.config.name).toBe('Minh Phát');

      const signedIn = await signIn(stack.url, stack.rootName, stack.rootPassword);
      expect(signedIn.status).toBe(200);
      expect(await signedIn.json()).toMatchObject({ user: { name: 'root', root: true } });
      expect((await signIn(stack.url, stack.rootName, 'not the password')).status).toBe(401);
    });
  });

  it('The data set’s office person signs in on the demo client with the password the stack made, and is refused what their unit and position do not allow', async () => {
    await withStack(artifacts, async (stack) => {
      const office = await signIn(stack.url, 'EMP-0001', stack.people['EMP-0001']);
      expect(office.status).toBe(200);
      const { authId } = (await office.json()) as { authId: string };
      const headers = { [CLIENT_HEADER]: stack.clientCode, 'x-auth-id': authId };
      const list = await fetch(`${stack.url}/api/employees`, { headers });
      expect(((await list.json()) as { employees: unknown[] }).employees).toHaveLength(8);
      const setup = await fetch(`${stack.url}/api/staff-setup`, {
        method: 'PUT',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'x-device-id': 'device-aaaa-0001',
        },
        body: json({ setup: { departments: [], positions: [], extra: {} }, version: '' }),
      });
      expect(setup.status).toBe(403);
      expect((await signIn(stack.url, 'EMP-0001', 'not the password')).status).toBe(401);
    });
  });

  it('Each POST to the stack’s seed door makes a client of its own from the data set, whose root and people sign in on it and nowhere else', async () => {
    await withStack(artifacts, async (stack) => {
      const seed = async () =>
        (await (await fetch(stack.seedUrl, { method: 'POST' })).json()) as {
          code: string;
          rootPassword: string;
          people: Record<string, string>;
        };
      const [one, two] = [await seed(), await seed()];

      expect(one.code).not.toBe(two.code);
      expect(one.code).not.toBe(stack.clientCode);
      const on = async (code: string, name: string, password: string) =>
        (
          await fetch(`${stack.url}/api/auth/sign-in`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-device-id': 'device-aaaa-0001',
              [CLIENT_HEADER]: code,
            },
            body: json({ name, password }),
          })
        ).status;
      expect(await on(one.code, 'root', one.rootPassword)).toBe(200);
      expect(await on(one.code, 'EMP-0005', one.people['EMP-0005'])).toBe(200);
      expect(await on(two.code, 'EMP-0005', one.people['EMP-0005'])).toBe(401);
      expect(await on(stack.clientCode, 'root', one.rootPassword)).toBe(401);
    });
  });

  it('A failed seed answers 500 and its reason reaches the stack’s stderr, which outlives the stack’s data folder', async () => {
    const written: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    let dataDir = '';
    try {
      await withStack(
        artifacts,
        async (stack) => {
          dataDir = stack.dataDir;
          const reply = await fetch(stack.seedUrl, { method: 'POST' });
          expect(reply.status).toBe(500);
          expect(await reply.json()).toEqual({ error: 'could not seed' });
        },
        { seed: () => Promise.reject(new Error('the generator answered 503')) },
      );
    } finally {
      spy.mockRestore();
    }

    expect(written.join('')).toContain('seed failed: Error: the generator answered 503');
    expect(dataDir).not.toBe('');
    await expect(readdir(dataDir)).rejects.toThrow();
  });

  it('The invited operator’s link is at localhost on the front’s port, joins through the front, and signs in again by the passkey it made', async () => {
    await withStack(artifacts, async (stack) => {
      expect(stack.url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(stack.operatorLink).toMatch(
        new RegExp(`^${stack.url}/operator/join#[A-Za-z0-9_-]{43}$`),
      );
      const { joined, authenticator, token } = await joinByStackLink(stack);
      expect(joined.status).toBe(200);
      expect(operatorSessionReplySchema.parse(await joined.json()).operator.name).toBe(
        DEMO_INVITED_NAME,
      );
      // The link is spent.
      expect((await post(stack.url, '/api/operator/join/options', { link: token })).status).toBe(
        404,
      );
      const options = optionsReplySchema.parse(
        await (await post(stack.url, '/api/operator/passkey/options', undefined)).json(),
      );
      const answer = {
        token: options.token,
        response: authenticator.authenticate(options.options),
      };
      expect((await post(stack.url, '/api/operator/passkey/sign-in', answer)).status).toBe(200);
      // The same answer again is refused, and a passkey of another device opens nothing.
      expect((await post(stack.url, '/api/operator/passkey/sign-in', answer)).status).toBe(401);
      const stranger = new SoftwareAuthenticator(stack.url);
      stranger.userHandle = authenticator.userHandle;
      const again = optionsReplySchema.parse(
        await (await post(stack.url, '/api/operator/passkey/options', undefined)).json(),
      );
      const refused = await post(stack.url, '/api/operator/passkey/sign-in', {
        token: again.token,
        response: stranger.authenticate(again.options),
      });
      expect(refused.status).toBe(401);
    });
  });

  it('An options call writes nothing: c-storage’s database is byte for byte as it was', async () => {
    await withStack(artifacts, async (stack) => {
      const { joined } = await joinByStackLink(stack);
      const { authId } = operatorSessionReplySchema.parse(await joined.json());
      const bytes = async () =>
        createHash('sha256')
          .update(
            Buffer.concat(
              await Promise.all(
                (await readdir(stack.dataDir))
                  .filter((file) => file === 'records.db' || file === 'records.db-wal')
                  .sort()
                  .map((file) => readFile(join(stack.dataDir, file))),
              ),
            ),
          )
          .digest('hex');
      const before = await bytes();
      for (let i = 0; i < 3; i++) {
        expect((await post(stack.url, '/api/operator/passkey/options', undefined)).status).toBe(
          200,
        );
        expect(
          (await post(stack.url, '/api/operator/passkeys/options', undefined, authId)).status,
        ).toBe(200);
      }
      expect(await bytes()).toBe(before);
    });
  });

  it('The stack’s operator is signed in by the handle it gives, and its passkeys read as the fake’s, the days the data set’s', async () => {
    await withStack(artifacts, async (stack) => {
      const me = await fetch(`${stack.url}/api/operator/me`, {
        headers: { 'x-auth-id': stack.operatorHandle },
      });
      expect(operatorMeReplySchema.parse(await me.json()).operator.name).toBe(stack.operatorName);
      const listed = await fetch(`${stack.url}/api/operator/passkeys`, {
        headers: { 'x-auth-id': stack.operatorHandle },
      });
      expect(listed.status).toBe(200);
      expect(((await listed.json()) as { passkeys: unknown[] }).passkeys).toEqual(
        DEMO_PASSKEYS.map(({ id, addedAt, lastUsedAt }) => ({ id, addedAt, lastUsedAt })),
      );
    });
  });

  it('D: The stack hands a walk the first of the operator’s two passkeys, whose private key signs the operator in, and its list stays the data set’s', async () => {
    await withStack(artifacts, async (stack) => {
      const held = JSON.parse(stack.operatorPasskey) as {
        id: string;
        privateKey: string;
        userHandle: string;
      };
      expect(held.id).toBe(DEMO_PASSKEYS[0].id);
      const device = new SoftwareAuthenticator(stack.url, undefined, held);
      const options = optionsReplySchema.parse(
        await (await post(stack.url, '/api/operator/passkey/options', undefined)).json(),
      );

      const signedIn = await post(stack.url, '/api/operator/passkey/sign-in', {
        token: options.token,
        response: device.authenticate(options.options),
      });

      expect(signedIn.status).toBe(200);
      const listed = await fetch(`${stack.url}/api/operator/passkeys`, {
        headers: { 'x-auth-id': stack.operatorHandle },
      });
      expect(
        ((await listed.json()) as { passkeys: { id: string }[] }).passkeys.map(({ id }) => id),
      ).toEqual(DEMO_PASSKEYS.map(({ id }) => id));
    });
  });

  it('D: A stack’s private key is in neither its database nor a log, and each stack mints another', async () => {
    const keys: string[] = [];
    for (let run = 0; run < 2; run++) {
      await withStack(artifacts, async (stack) => {
        const { privateKey } = JSON.parse(stack.operatorPasskey) as { privateKey: string };
        keys.push(privateKey);
        for (const file of await readdir(stack.dataDir)) {
          const bytes = await readFile(join(stack.dataDir, file)).catch(() => Buffer.alloc(0));
          expect(bytes.includes(privateKey), file).toBe(false);
        }
      });
    }
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('The password route is gone: a name and password open no operator', async () => {
    await withStack(artifacts, async (stack) => {
      const reply = await post(stack.url, '/api/operator/sign-in', {
        name: stack.operatorName,
        password: stack.rootPassword,
      });
      expect(reply.status).toBe(404);
    });
  });

  it('Nothing secret is stored readable: not the root’s password, not the link’s token, in the database or a log', async () => {
    await withStack(artifacts, async (stack) => {
      const signedIn = await signIn(stack.url, stack.rootName, stack.rootPassword);
      expect(signedIn.status).toBe(200);
      // The join ran too, so a token that reached a log would be in it.
      const { joined, token } = await joinByStackLink(stack);
      expect(joined.status).toBe(200);

      let hashes = 0;
      for (const file of await readdir(stack.dataDir)) {
        const bytes = await readFile(join(stack.dataDir, file)).catch(() => Buffer.alloc(0));
        expect(bytes.includes(stack.rootPassword), file).toBe(false);
        expect(bytes.includes(token), file).toBe(false);
        if (bytes.includes('scrypt$')) hashes++;
      }
      // The scan looked at the bytes that hold the root: its hash is there, its password is not.
      expect(hashes).toBeGreaterThan(0);
    });
  });

  it('goes down with its command, however it ends, and its database goes with it', async () => {
    let seen = { url: '', dataDir: '' };
    await expect(
      withStack(artifacts, (stack) => {
        seen = stack;
        return Promise.reject(new Error('the command failed'));
      }),
    ).rejects.toThrow('the command failed');

    await expect(fetch(`${seen.url}/api/config`)).rejects.toThrow();
    await expect(readdir(seen.dataDir)).rejects.toThrow('ENOENT');
  });

  it('makes a fresh tenant each time: another root, another operator link, another database', async () => {
    const roots: string[] = [];
    const operators: string[] = [];
    for (let run = 0; run < 2; run++) {
      await withStack(artifacts, (stack) => {
        roots.push(stack.rootPassword);
        operators.push(stack.operatorLink);
        return Promise.resolve();
      });
    }
    expect(roots[0]).not.toBe(roots[1]);
    expect(operators[0]).not.toBe(operators[1]);
  });
});

describe('what the stack builds', () => {
  it('puts the UI and c-storage in its own folder, so a running stack’s files are never emptied', async () => {
    expect(artifacts.uiDir).toBe(join(dir, 'ui'));
    expect(artifacts.cStorage.startsWith(dir)).toBe(true);
    expect(await readFile(join(artifacts.uiDir, 'index.html'), 'utf8')).toContain(
      '<div id="root">',
    );
  });
});

describe('what the BFF is given', () => {
  it('binds a door it opens to loopback alone, never to every address', async () => {
    const server = createServer();
    try {
      const bound = await listening(server);
      expect(bound.address).toBe('127.0.0.1');
      expect(bound.port).toBeGreaterThan(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('The BFF never holds the super-admin key: its environment is exactly the variables it reads', () => {
    const environment = bffEnvironment({
      port: 4000,
      cStorageUrl: 'http://127.0.0.1:4001',
      internalAccessKey: 'internal',
      service: { code: 'demo', accessKey: 'service' },
      appOrigin: 'http://localhost:4002',
    });

    expect(Object.keys(environment).sort()).toEqual([...BFF_ENV_KEYS].sort());
    expect(environment.HOST).toBe('127.0.0.1');
    expect(environment.APP_ORIGIN).toBe('http://localhost:4002');
  });
});

describe('pnpm stack -- <command>', () => {
  const build = () => Promise.resolve(artifacts);
  const printed: string[] = [];
  const out = (line: string) => void printed.push(line);

  it('takes the command with or without the "--" pnpm may pass on', () => {
    expect(commandOf(['--', 'echo', 'a'])).toEqual(['echo', 'a']);
    expect(commandOf(['echo', 'a'])).toEqual(['echo', 'a']);
  });

  it('runs the command against the stack with the demo client, its root and the operator in its environment, and passes its status on', async () => {
    // The command is the walk's own path: the operator joins by the link it was given and makes a
    // client, that client's root signs in by its code with the first password it was shown, and an
    // unknown code is a 404.
    const file = join(dir, 'command.mts');
    const script = `
      import { SoftwareAuthenticator } from ${JSON.stringify(import.meta.resolve('@credo/bff/tests/authenticator'))};
      const env = process.env;
      const call = async (path, { code, auth, body, method } = {}) => {
        const response = await fetch(env.CREDO_URL + path, {
          method: method ?? (body ? 'POST' : 'GET'),
          body: body && JSON.stringify(body),
          headers: {
            ...(body ? { 'content-type': 'application/json' } : {}),
            'x-device-id': 'device-aaaa-0001',
            ...(code ? { 'x-client-code': code } : {}),
            ...(auth ? { 'x-auth-id': auth } : {}),
          },
        });
        return { status: response.status, json: await response.json().catch(() => null) };
      };
      const link = new URL(env.CREDO_OPERATOR_LINK).hash.slice(1);
      const opened = await call('/api/operator/join/options', { body: { link } });
      const device = new SoftwareAuthenticator(env.CREDO_URL);
      const operator = await call('/api/operator/join', {
        body: { link, token: opened.json.token, response: device.register(opened.json.options) },
      });
      // Signs out and in, is refused an add and a remove with no touch, adds a passkey, removes one,
      // is refused the last, replays an answer.
      const out = await call('/api/operator/sign-out', { auth: operator.json.authId, body: {} });
      const stale = await call('/api/operator/me', { auth: operator.json.authId });
      const options = await call('/api/operator/passkey/options', { body: {} });
      const answer = { token: options.json.token, response: device.authenticate(options.json.options) };
      const again = await call('/api/operator/passkey/sign-in', { body: answer });
      const replay = await call('/api/operator/passkey/sign-in', { body: answer });
      const auth = again.json.authId;
      // A session alone neither adds nor removes: each needs a fresh touch of a passkey held.
      const touch = async (act, holder = device) => {
        const asked = await call('/api/operator/passkeys/confirm-options', { auth, body: { act } });
        return { token: asked.json.token, response: holder.authenticate(asked.json.options) };
      };
      const addOptions = await call('/api/operator/passkeys/options', { auth, body: {} });
      const second = new SoftwareAuthenticator(env.CREDO_URL);
      const registered = second.register(addOptions.json.options);
      const untouched = await call('/api/operator/passkeys', {
        auth,
        body: { token: addOptions.json.token, response: registered },
      });
      const added = await call('/api/operator/passkeys', {
        auth,
        body: { token: addOptions.json.token, response: registered, confirm: await touch('add') },
      });
      const unremoved = await call('/api/operator/passkeys/' + encodeURIComponent(device.id), {
        auth,
        method: 'DELETE',
      });
      const removed = await call('/api/operator/passkeys/' + encodeURIComponent(device.id), {
        auth,
        method: 'DELETE',
        body: { confirm: await touch('remove') },
      });
      const last = await call('/api/operator/passkeys/' + encodeURIComponent(second.id), {
        auth,
        method: 'DELETE',
        body: { confirm: await touch('remove', second) },
      });
      const made = await call('/api/operator/clients', {
        auth,
        body: { code: 'made-by-command', name: 'Made By Command' },
      });
      const root = await call('/api/auth/sign-in', {
        code: 'made-by-command',
        body: { name: made.json.rootName, password: made.json.password },
      });
      const demo = await call('/api/auth/sign-in', {
        code: env.CREDO_CLIENT_CODE,
        body: { name: env.CREDO_ROOT_NAME, password: env.CREDO_ROOT_PASSWORD },
      });
      const nobody = await call('/api/config', { code: 'nobody-here' });
      const steps = [
        operator.status, out.status, stale.status, again.status, replay.status, untouched.status,
        added.status, unremoved.status, removed.status, last.status, made.status, root.status,
        demo.status, nobody.status,
      ];
      process.exit(steps.join() === '200,204,401,200,401,400,201,400,200,409,201,200,200,404' ? 7 : 1);`;
    await writeFile(file, script);
    printed.length = 0;

    const status = await runStack(
      ['--', process.execPath, '--import', import.meta.resolve('tsx'), file],
      build,
      out,
    );

    expect(status).toBe(7);
    expect(printed.join('\n')).toMatch(/the stack is up at http:\/\/localhost:\d+/);
    expect(printed.join('\n')).not.toContain('password');
  });

  it('gives the command the address, the demo client’s code and the two sign-ins, each under the name CLAUDE.md documents', async () => {
    const file = join(dir, 'names');
    const script = `
      const names = Object.keys(process.env).filter((name) => name.startsWith('CREDO_')).sort();
      require('fs').writeFileSync(${JSON.stringify(file)}, names.join(','));`;

    const status = await runStack(['--', process.execPath, '-e', script], build, out);

    expect(status).toBe(0);
    expect(await readFile(file, 'utf8')).toBe(
      [
        'CREDO_CLIENT_CODE',
        'CREDO_OPERATOR_HANDLE',
        'CREDO_OPERATOR_LINK',
        'CREDO_OPERATOR_NAME',
        'CREDO_OPERATOR_PASSKEY',
        'CREDO_PEOPLE',
        'CREDO_ROOT_NAME',
        'CREDO_ROOT_PASSWORD',
        'CREDO_SEED_URL',
        'CREDO_URL',
      ].join(','),
    );
    await rm(file);
  });

  it('reads a command ended by a signal as 128 plus its number', async () => {
    const kill = (signal: string) => [
      '--',
      process.execPath,
      '-e',
      `process.kill(process.pid, '${signal}')`,
    ];

    expect(await runStack(kill('SIGINT'), build, out)).toBe(130);
    expect(await runStack(kill('SIGTERM'), build, out)).toBe(143);
    expect(await runStack(kill('SIGKILL'), build, out)).toBe(137);
  });

  it('hands a signal it catches on to the command, and reads the command’s own status', async () => {
    const ready = join(dir, 'ready');
    const script = `
      process.on('SIGTERM', () => process.exit(9));
      require('fs').writeFileSync(${JSON.stringify(ready)}, 'up');
      setTimeout(() => process.exit(0), 8000);`;
    const running = runStack(['--', process.execPath, '-e', script], build, out);
    while (!(await readFile(ready, 'utf8').catch(() => ''))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    process.emit('SIGTERM');

    expect(await running).toBe(9);
    await rm(ready);
  });

  it('keeps a signal that comes during the build from starting the command, and ends with the signal’s status', async () => {
    const marker = join(dir, 'ran');
    const signalled = () => {
      process.emit('SIGTERM');
      return Promise.resolve(artifacts);
    };

    const status = await runStack(
      [
        '--',
        process.execPath,
        '-e',
        `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`,
      ],
      signalled,
      out,
    );

    expect(status).toBe(143);
    expect(await readFile(marker, 'utf8').catch(() => 'never ran')).toBe('never ran');
  });

  it('stops, with the stack taken down, when the command cannot start', async () => {
    await expect(runStack(['--', 'no-such-command-credo'], build, out)).rejects.toThrow('ENOENT');
  });

  it('with no command prints the root’s sign-in once and waits for Ctrl-C', async () => {
    printed.length = 0;
    const running = runStack([], build, out);
    while (!printed.some((line) => line.includes('Ctrl-C'))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    process.emit('SIGINT');

    expect(await running).toBe(0);
    expect(printed.filter((line) => line.includes('the password'))).toHaveLength(1);
    expect(
      printed.filter((line) =>
        /the invited operator joins by http:\/\/localhost:\d+\/operator\/join#[\w-]{43}, then signs in at http:\/\/localhost:\d+\/operator$/.test(
          line,
        ),
      ),
    ).toHaveLength(1);
    expect(printed.filter((line) => /\/login\?client-code=demo$/.test(line))).toHaveLength(1);
  });

  it('with no command waits as well for a termination or a hang-up, the first of several ending it', async () => {
    for (const signals of [['SIGTERM'], ['SIGHUP', 'SIGINT']] as const) {
      printed.length = 0;
      const running = runStack([], build, out);
      while (!printed.some((line) => line.includes('Ctrl-C'))) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      for (const signal of signals) process.emit(signal);

      expect(await running, signals.join()).toBe(0);
    }
  });
});

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('a stack that is started and stopped on its own', () => {
  it('stands on the folder and ports it is given, and stop() takes the parts down and removes nothing', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'credo-stack-start-'));
    const ports = {
      cStorage: await freePort(),
      front: await freePort(),
      bff: await freePort(),
      seedDoor: await freePort(),
    };
    const stack = await startStack(artifacts, { dataDir, ports });
    try {
      expect(stack.url).toBe(`http://localhost:${ports.front}`);
      expect(stack.dataDir).toBe(dataDir);
      expect(stack.facts.ports).toEqual(ports);
      expect(stack.facts.cStorage.url).toBe(`http://127.0.0.1:${ports.cStorage}`);
      expect((await fetch(`${stack.url}/`)).status).toBe(200);
      expect(stack.seedUrl).toBe(`http://127.0.0.1:${ports.seedDoor}/seed`);
      expect(alive(stack.facts.pids.cStorage)).toBe(true);
      expect(alive(stack.facts.pids.bff)).toBe(true);
    } finally {
      await stack.stop();
      await stack.stop();
    }

    try {
      await expect(fetch(`${stack.url}/`)).rejects.toThrow();
      await expect(fetch(`${stack.facts.cStorage.url}/health`)).rejects.toThrow();
      expect(alive(stack.facts.pids.cStorage)).toBe(false);
      expect(alive(stack.facts.pids.bff)).toBe(false);
      expect(await readdir(dataDir)).toContain('records.db');
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it('takes down what it had started when a later part will not start, and says which', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'credo-stack-start-'));
    const taken = createServer();
    const { port: bff } = await listening(taken);
    const cStorage = await freePort();
    try {
      await expect(startStack(artifacts, { dataDir, ports: { cStorage, bff } })).rejects.toThrow(
        'the BFF exited',
      );
      await expect(fetch(`http://127.0.0.1:${cStorage}/health`)).rejects.toThrow();
    } finally {
      await new Promise((resolve) => taken.close(resolve));
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it('starts again on the data and keys a stopped stack left, and the root’s password still signs in', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'credo-stack-resume-'));
    const ports = {
      cStorage: await freePort(),
      front: await freePort(),
      bff: await freePort(),
      seedDoor: await freePort(),
    };
    try {
      const first = await startStack(artifacts, { dataDir, ports });
      await first.stop();
      const again = await startStack(artifacts, {
        dataDir,
        ports,
        resume: {
          internalAccessKey: first.facts.cStorage.internalAccessKey,
          superAdminKey: first.facts.cStorage.superAdminKey,
          service: first.facts.service,
          demo: { rootPassword: first.rootPassword, operatorLink: first.operatorLink },
        },
      });
      try {
        expect(again.rootPassword).toBe(first.rootPassword);
        expect(again.operatorLink).toBe(first.operatorLink);
        const signedIn = await signIn(again.url, again.rootName, first.rootPassword);
        expect(signedIn.status).toBe(200);
        expect(await signedIn.json()).toMatchObject({ user: { root: true } });
      } finally {
        await again.stop();
      }
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
