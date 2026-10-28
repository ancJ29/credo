import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runFake } from './cli';
import { buildFake, type FakeArtifacts, withFake } from './fake';

const UI_DIR = fileURLToPath(new URL('../../ui/', import.meta.url));

let dir: string;
let fake: FakeArtifacts;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-fake-test-'));
  fake = await buildFake(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

/** Every file of a built folder, as one text. */
async function bundleOf(folder: string) {
  const files = await readdir(folder, { recursive: true, withFileTypes: true });
  const texts = await Promise.all(
    files
      .filter((file) => file.isFile() && /\.(js|html)$/.test(file.name))
      .map((file) => readFile(join(file.parentPath, file.name), 'utf8')),
  );
  return texts.join('\n');
}

/** Whether anything accepts a connection on the address: a fresh socket, since a fetch may reuse
 * one a closed server left behind and fail for that reason alone. */
const listening = (url: string) =>
  new Promise<boolean>((resolve) => {
    const socket = connect(Number(new URL(url).port), '127.0.0.1');
    socket.once('connect', () => resolve(true));
    socket.once('error', () => resolve(false));
  });

describe('the fake build', () => {
  it('The switch and the data set are compiled into the fake build alone; the bundle `pnpm stack` and ridge serve holds no part of either', async () => {
    const served = join(dir, 'app');
    await build({
      root: UI_DIR,
      logLevel: 'warn',
      build: { outDir: served, emptyOutDir: true },
    });

    const fakeBundle = await bundleOf(fake.uiDir);
    const appBundle = await bundleOf(served);

    // The fake's own handle, and the data set's company: the code and the data.
    for (const part of ['fake.session', 'Minh Phát']) {
      expect(fakeBundle.includes(part), part).toBe(true);
      expect(appBundle.includes(part), part).toBe(false);
    }
  });

  it('puts the fake UI in its own folder, so a running fake’s files are never emptied', () => {
    expect(fake.uiDir).toBe(join(dir, 'ui-fake'));
  });
});

describe('pnpm fake', () => {
  it('serves the fake’s page and nothing behind it, and leaves nothing listening, however it ends', async () => {
    let seen = '';
    await expect(
      withFake(fake, async (running) => {
        seen = running.url;
        expect(await (await fetch(`${running.url}/`)).text()).toContain('<div id="root">');
        expect((await fetch(`${running.url}/api/config`)).status).toBe(404);
        expect(running).toMatchObject({ clientCode: 'demo', rootName: 'root' });
        expect(await listening(seen)).toBe(true);
        throw new Error('the command failed');
      }),
    ).rejects.toThrow('the command failed');

    expect(await listening(seen)).toBe(false);
  });

  it('runs the command with the address and the demo client’s code, and passes its status on', async () => {
    const file = join(dir, 'read');
    const script = `
      fetch(process.env.CREDO_URL + '/?fake').then((page) => page.text()).then((text) => {
        require('fs').writeFileSync(${JSON.stringify(file)}, process.env.CREDO_CLIENT_CODE + text);
        process.exit(5);
      });`;
    const printed: string[] = [];

    const status = await runFake(
      ['--', process.execPath, '-e', script],
      () => Promise.resolve(fake),
      (line) => void printed.push(line),
    );

    expect(status).toBe(5);
    expect(await readFile(file, 'utf8')).toMatch(/^demo<!doctype html>/i);
    expect(printed.join('\n')).toMatch(/the fake is up at http:\/\/127\.0\.0\.1:\d+/);
    await rm(file);
  });

  it('with no command prints the address to open and waits for Ctrl-C', async () => {
    const printed: string[] = [];
    const running = runFake(
      [],
      () => Promise.resolve(fake),
      (line) => void printed.push(line),
    );
    while (!printed.some((line) => line.includes('Ctrl-C'))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    process.emit('SIGINT');

    expect(await running).toBe(0);
    expect(
      printed.filter((line) => /^open http:\/\/127\.0\.0\.1:\d+\/\?fake/.test(line)),
    ).toHaveLength(1);
  });
});
