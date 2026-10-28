import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLIENT_HEADER } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commandOf, runStack } from './cli';
import { BFF_ENV_KEYS } from '@credo/bff/env';
import { type Artifacts, bffEnvironment, buildArtifacts, withStack } from './stack';

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

  it('The operator signs in through the front with the first password the stack made, and a wrong one is refused', async () => {
    await withStack(artifacts, async (stack) => {
      const operatorSignIn = async (password: string) => {
        const body = json({ name: stack.operatorName, password });
        return await fetch(`${stack.url}/api/operator/sign-in`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-device-id': 'device-aaaa-0001',
          },
          body,
        });
      };
      expect((await operatorSignIn(stack.operatorPassword)).status).toBe(200);
      expect((await operatorSignIn('not the password')).status).toBe(401);
      expect(stack.operatorPassword).not.toBe(stack.rootPassword);
    });
  });

  it('The password is stored nowhere readable: not in the database, not in a log', async () => {
    await withStack(artifacts, async (stack) => {
      const signedIn = await signIn(stack.url, stack.rootName, stack.rootPassword);
      expect(signedIn.status).toBe(200);
      // Both sign-ins ran, so a password that reached a log would be in it.
      const operatorIn = await fetch(`${stack.url}/api/operator/sign-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-id': 'device-aaaa-0001' },
        body: json({ name: stack.operatorName, password: stack.operatorPassword }),
      });
      expect(operatorIn.status).toBe(200);

      let hashes = 0;
      for (const file of await readdir(stack.dataDir)) {
        const bytes = await readFile(join(stack.dataDir, file)).catch(() => Buffer.alloc(0));
        expect(bytes.includes(stack.rootPassword), file).toBe(false);
        expect(bytes.includes(stack.operatorPassword), file).toBe(false);
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

  it('makes a fresh tenant each time: another root, another operator password, another database', async () => {
    const roots: string[] = [];
    const operators: string[] = [];
    for (let run = 0; run < 2; run++) {
      await withStack(artifacts, (stack) => {
        roots.push(stack.rootPassword);
        operators.push(stack.operatorPassword);
        return Promise.resolve();
      });
    }
    expect(roots[0]).not.toBe(roots[1]);
    expect(operators[0]).not.toBe(operators[1]);
    expect(operators[0]).toHaveLength(16);
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
  it('The BFF never holds the super-admin key: its environment is exactly the variables it reads', () => {
    const environment = bffEnvironment({
      port: 4000,
      cStorageUrl: 'http://127.0.0.1:4001',
      internalAccessKey: 'internal',
      service: { code: 'demo', accessKey: 'service' },
    });

    expect(Object.keys(environment).sort()).toEqual([...BFF_ENV_KEYS].sort());
    expect(environment.HOST).toBe('127.0.0.1');
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
    // The command is the walk's own path: the operator signs in and makes a client, that client's
    // root signs in by its code with the first password it was shown, and an unknown code is a 404.
    const script = `
      const env = process.env;
      const call = async (path, { code, auth, body } = {}) => {
        const response = await fetch(env.CREDO_URL + path, {
          method: body ? 'POST' : 'GET',
          body: body && JSON.stringify(body),
          headers: {
            'content-type': 'application/json',
            'x-device-id': 'device-aaaa-0001',
            ...(code ? { 'x-client-code': code } : {}),
            ...(auth ? { 'x-auth-id': auth } : {}),
          },
        });
        return { status: response.status, json: await response.json().catch(() => null) };
      };
      (async () => {
        const operator = await call('/api/operator/sign-in', {
          body: { name: env.CREDO_OPERATOR_NAME, password: env.CREDO_OPERATOR_PASSWORD },
        });
        const made = await call('/api/operator/clients', {
          auth: operator.json.authId,
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
        const steps = [operator.status, made.status, root.status, demo.status, nobody.status];
        process.exit(steps.join() === '200,201,200,200,404' ? 7 : 1);
      })();`;
    printed.length = 0;

    const status = await runStack(['--', process.execPath, '-e', script], build, out);

    expect(status).toBe(7);
    expect(printed.join('\n')).toMatch(/the stack is up at http:\/\/127\.0\.0\.1:\d+/);
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
        'CREDO_OPERATOR_NAME',
        'CREDO_OPERATOR_PASSWORD',
        'CREDO_ROOT_NAME',
        'CREDO_ROOT_PASSWORD',
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
    expect(printed.filter((line) => line.includes('the operator is operator'))).toHaveLength(1);
    expect(printed.filter((line) => /\/login\?client-code=demo$/.test(line))).toHaveLength(1);
    expect(printed.filter((line) => /\/operator$/.test(line))).toHaveLength(1);
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
