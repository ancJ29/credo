import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HASH_HEADER, sha256Hex } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { commandOf, runStack } from './cli';
import { type Artifacts, buildArtifacts, withStack } from './stack';

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
      [HASH_HEADER]: await sha256Hex(body),
    },
    body,
  });
};

describe('pnpm stack', () => {
  it('brings the demo tenant up behind the front: its page, its settings, its root’s sign-in', async () => {
    await withStack(artifacts, async (stack) => {
      expect(await (await fetch(`${stack.url}/settings`)).text()).toContain('<div id="root">');

      const config = (await (await fetch(`${stack.url}/api/config`)).json()) as {
        config: { name: string };
      };
      expect(config.config.name).toBe('Minh Phát');

      const signedIn = await signIn(stack.url, stack.rootName, stack.rootPassword);
      expect(signedIn.status).toBe(200);
      expect(await signedIn.json()).toMatchObject({ user: { name: 'root', root: true } });
      expect((await signIn(stack.url, stack.rootName, 'not the password')).status).toBe(401);
    });
  });

  it('The password is stored nowhere readable: not in the database, not in a log', async () => {
    await withStack(artifacts, async (stack) => {
      await signIn(stack.url, stack.rootName, stack.rootPassword);

      for (const file of await readdir(stack.dataDir)) {
        const bytes = await readFile(join(stack.dataDir, file)).catch(() => Buffer.alloc(0));
        expect(bytes.includes(stack.rootPassword), file).toBe(false);
      }
    });
  });

  it('The front refuses a write without its hash, before the BFF sees it', async () => {
    await withStack(artifacts, async (stack) => {
      const body = json({ name: stack.rootName, password: stack.rootPassword });
      const headers = { 'content-type': 'application/json', 'x-device-id': 'device-aaaa-0001' };

      const bare = await fetch(`${stack.url}/api/auth/sign-in`, { method: 'POST', headers, body });
      expect(bare.status).toBe(403);
      const wrong = await fetch(`${stack.url}/api/auth/sign-in`, {
        method: 'POST',
        headers: { ...headers, [HASH_HEADER]: await sha256Hex('another body') },
        body,
      });
      expect(wrong.status).toBe(403);
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

  it('makes a fresh tenant each time: another root, another database', async () => {
    const roots: string[] = [];
    for (let run = 0; run < 2; run++) {
      await withStack(artifacts, (stack) => {
        roots.push(stack.rootPassword);
        return Promise.resolve();
      });
    }
    expect(roots[0]).not.toBe(roots[1]);
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

  it('runs the command against the stack with the root in its environment, and passes its status on', async () => {
    const script = `
      const url = process.env.CREDO_URL;
      const body = JSON.stringify({ name: process.env.CREDO_ROOT_NAME, password: process.env.CREDO_ROOT_PASSWORD });
      const hash = require('crypto').createHash('sha256').update(body).digest('hex');
      fetch(url + '/api/auth/sign-in', { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-device-id': 'device-aaaa-0001', '${HASH_HEADER}': hash } })
        .then((r) => process.exit(r.status === 200 ? 7 : 1));`;
    printed.length = 0;

    const status = await runStack(['--', process.execPath, '-e', script], build, out);

    expect(status).toBe(7);
    expect(printed.join('\n')).toMatch(/the stack is up at http:\/\/127\.0\.0\.1:\d+/);
    expect(printed.join('\n')).not.toContain('password');
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
  });
});
