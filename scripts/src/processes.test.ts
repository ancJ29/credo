import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freePort, startProcess, waitUntilUp } from './processes';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-processes-test-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const node = (script: string, name: string) =>
  startProcess(process.execPath, ['-e', script], { env: {}, logFile: join(dir, `${name}.log`) });

describe('child processes', () => {
  it('finds a port that can be bound', async () => {
    const port = await freePort();
    const server = createServer();

    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

    server.close();
    expect(port).toBeGreaterThan(0);
  });

  it('stops a running child, and stopping a child that has gone is harmless', async () => {
    const started = await node('setInterval(() => {}, 1000)', 'running');

    await started.stop();
    expect(started.child.signalCode).toBe('SIGTERM');
    await started.stop();
  });

  it('waits until the url answers', async () => {
    const port = await freePort();
    const started = await node(
      `require('http').createServer((_, r) => r.end('ok')).listen(${port}, '127.0.0.1')`,
      'serving',
    );
    try {
      await waitUntilUp(`http://127.0.0.1:${port}/`, started, 'the test server');
    } finally {
      await started.stop();
    }
  });

  it('says why a child never came up: it exited, with the end of its log', async () => {
    const started = await node("console.log('could not bind'); process.exit(3)", 'exits');

    await expect(waitUntilUp('http://127.0.0.1:1/', started, 'the test server')).rejects.toThrow(
      /the test server exited 3: could not bind/,
    );
  });

  it('says why a child never came up: it never answered', async () => {
    const started = await node('setInterval(() => {}, 1000)', 'silent');
    try {
      await expect(
        waitUntilUp('http://127.0.0.1:1/', started, 'the test server', 100),
      ).rejects.toThrow('the test server did not answer http://127.0.0.1:1/ in 0.1 s');
    } finally {
      await started.stop();
    }
  });
});
