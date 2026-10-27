import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HASH_HEADER, sha256Hex } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFront } from './front';

type Seen = { method: string; url: string; headers: IncomingMessage['headers']; body: string };

const listen = (server: Server) =>
  new Promise<string>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  );
const close = (server: Server) => new Promise((resolve) => server.close(resolve));

let dir: string;
let bff: Server;
let front: Server;
let url: string;
let seen: Seen[] = [];
let bffAnswer = { status: 200, type: 'application/json', body: '{"from":"bff"}' };

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-front-test-'));
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'index.html'), '<div id="root"></div>');
  await writeFile(join(dir, 'assets', 'app.js'), 'console.log(1)');
  await writeFile(join(dir, 'assets', 'font.bin'), 'bytes');
  await writeFile(join(dirname(dir), 'secret.txt'), 'outside');
  bff = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      seen.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString(),
      });
      response.writeHead(
        bffAnswer.status,
        bffAnswer.type ? { 'content-type': bffAnswer.type } : {},
      );
      response.end(bffAnswer.status === 204 ? undefined : bffAnswer.body);
    });
  });
  front = createFront({ staticDir: dir, bffUrl: await listen(bff) });
  url = await listen(front);
});

afterAll(async () => {
  await close(front);
  await close(bff);
  await rm(dir, { recursive: true, force: true });
  await rm(join(dirname(dir), 'secret.txt'), { force: true });
});

const dirname = (path: string) => join(path, '..');

const put = async (body: string, hash?: string) =>
  await fetch(`${url}/api/config?x=1`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(hash ? { [HASH_HEADER]: hash } : {}) },
    body,
  });

describe('the local front', () => {
  it('serves the UI’s files with their types, and the app’s page for any other path', async () => {
    const script = await fetch(`${url}/assets/app.js`);
    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect(await script.text()).toBe('console.log(1)');
    expect((await fetch(`${url}/assets/font.bin`)).headers.get('content-type')).toBeNull();

    for (const path of ['/', '/settings', '/assets/missing.js', '/assets']) {
      const page = await fetch(`${url}${path}`);
      expect(page.headers.get('content-type')).toContain('text/html');
      expect(await page.text()).toBe('<div id="root"></div>');
    }
  });

  it('serves nothing outside the UI’s folder, however the path is spelled', async () => {
    for (const path of ['/..%2fsecret.txt', '/%2e%2e/secret.txt', '/%E0%A4%A']) {
      expect(await (await fetch(`${url}${path}`)).text()).toBe('<div id="root"></div>');
    }
  });

  it('passes a read to the BFF with its headers, and gives the BFF’s answer back', async () => {
    seen = [];
    bffAnswer = { status: 404, type: 'application/json', body: '{"error":"Not set up"}' };

    const answer = await fetch(`${url}/api/config?v=2`, {
      headers: { 'x-auth-id': 'device.secret' },
    });

    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: 'Not set up' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: 'GET', url: '/api/config?v=2', body: '' });
    expect(seen[0]?.headers['x-auth-id']).toBe('device.secret');
  });

  it('Every write carries its body’s SHA-256; the front refuses one without it', async () => {
    seen = [];
    const body = JSON.stringify({ config: 'x', version: null });

    expect((await put(body)).status).toBe(403);
    expect((await put(body, await sha256Hex('another body'))).status).toBe(403);
    expect(seen).toHaveLength(0);

    bffAnswer = { status: 409, type: 'application/json', body: '{"error":"Conflict"}' };
    const accepted = await put(body, await sha256Hex(body));
    expect(accepted.status).toBe(409);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: 'PUT', url: '/api/config?x=1', body });
  });

  it('hashes the bytes sent, whatever they are', async () => {
    const body = '{"name":"Minh Phát"}';
    const bytes = new TextEncoder().encode(body);
    bffAnswer = { status: 204, type: '', body: '' };

    const answer = await fetch(`${url}/api/auth/sign-out`, {
      method: 'POST',
      headers: { [HASH_HEADER]: await sha256Hex(bytes) },
      body: bytes,
    });

    expect(answer.status).toBe(204);
  });

  it('answers 502 when the BFF cannot be reached', async () => {
    const lonely = createFront({ staticDir: dir, bffUrl: 'http://127.0.0.1:1' });
    const lonelyUrl = await listen(lonely);
    try {
      expect((await fetch(`${lonelyUrl}/api/config`)).status).toBe(502);
    } finally {
      await close(lonely);
    }
  });

  it('answers 500, and stays up, when the app’s page is missing', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'credo-front-empty-'));
    await mkdir(join(empty, 'assets'));
    await writeFile(join(empty, 'assets', 'app.js'), 'console.log(2)');
    const rebuilding = createFront({ staticDir: empty, bffUrl: 'http://127.0.0.1:1' });
    const rebuildingUrl = await listen(rebuilding);
    try {
      for (const path of ['/', '/settings', '/assets/missing.js']) {
        expect((await fetch(`${rebuildingUrl}${path}`)).status, path).toBe(500);
      }
      const still = await fetch(`${rebuildingUrl}/assets/app.js`);
      expect(still.status).toBe(200);
      expect(await still.text()).toBe('console.log(2)');
    } finally {
      await close(rebuilding);
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('answers 400, and stays up, to a request line that names no path', async () => {
    const { port } = front.address() as AddressInfo;
    const raw = await new Promise<string>((resolve) => {
      const socket = connect(port, '127.0.0.1', () =>
        socket.write('GET // HTTP/1.1\r\nHost: x\r\n\r\n'),
      );
      let received = '';
      socket.on('data', (chunk) => (received += chunk.toString()));
      socket.on('close', () => resolve(received));
      socket.setTimeout(2000, () => socket.destroy());
    });

    expect(raw.split('\r\n')[0]).toBe('HTTP/1.1 400 Bad Request');
    expect((await fetch(`${url}/`)).status).toBe(200);
  });

  it('refuses a body of more than a megabyte', async () => {
    const body = 'x'.repeat(1024 * 1024 + 1);

    expect((await put(body, await sha256Hex(body))).status).toBe(413);
  });
});
