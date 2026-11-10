import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

/** A logo is at most 200 KB; with the rest of a settings body nothing real nears a megabyte. */
const MAX_BODY_BYTES = 1024 * 1024;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/** Headers a hop sets for itself: the front's request to the BFF names its own. */
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);

class TooLarge extends Error {}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new TooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function send(response: ServerResponse, status: number, body: string | Buffer, type?: string) {
  response.writeHead(status, type ? { 'content-type': type } : {});
  response.end(body);
}

const sendError = (response: ServerResponse, status: number, error: string) =>
  send(response, status, JSON.stringify({ error }), 'application/json');

/**
 * The local front, standing where CloudFront and the HTTP API stand: the UI's files, and `/api`
 * on to the BFF. Each `/api` call goes on as it came, any method and any body, and the BFF's answer
 * comes back with its status; the front asks for nothing and signs nothing. With no BFF, as under
 * `pnpm fake`, every `/api` call is a 404.
 */
export function createFront({ staticDir, bffUrl }: { staticDir: string; bffUrl: string | null }) {
  const root = resolve(staticDir);

  async function api(request: IncomingMessage, response: ServerResponse, url: URL) {
    if (bffUrl === null) return sendError(response, 404, 'No BFF here');
    const writes = request.method !== 'GET' && request.method !== 'HEAD';
    let body: Buffer;
    try {
      body = await readBody(request);
    } catch {
      return sendError(response, 413, 'Payload too large');
    }
    const headers = Object.entries(request.headers).flatMap(([name, value]) =>
      HOP.has(name) || typeof value !== 'string' ? [] : [[name, value] as [string, string]],
    );
    try {
      const answer = await fetch(`${bffUrl}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: writes ? new Uint8Array(body) : null,
      });
      return send(
        response,
        answer.status,
        Buffer.from(await answer.arrayBuffer()),
        answer.headers.get('content-type') ?? undefined,
      );
    } catch {
      return sendError(response, 502, 'Bad gateway');
    }
  }

  /** The file the path names inside the UI's folder; anything else is the app's own page, which
   * routes it. A page that cannot be read answers 500 and leaves the front standing. */
  async function page(response: ServerResponse, pathname: string) {
    let wanted = resolve(root, 'index.html');
    try {
      const candidate = resolve(root, `.${decodeURIComponent(pathname)}`);
      if (candidate.startsWith(root + sep)) wanted = candidate;
    } catch {
      // a path that does not decode names no file
    }
    try {
      const bytes = await readFile(wanted).catch(() => null);
      if (bytes) return send(response, 200, bytes, TYPES[extname(wanted)]);
      return send(response, 200, await readFile(resolve(root, 'index.html')), TYPES['.html']);
    } catch {
      return sendError(response, 500, 'The page could not be read');
    }
  }

  return createServer((request, response) => {
    let url: URL;
    try {
      url = new URL(request.url as string, 'http://front');
    } catch {
      // a request line that names no path, such as `GET // HTTP/1.1`
      return sendError(response, 400, 'Bad request');
    }
    void (url.pathname.startsWith('/api/')
      ? api(request, response, url)
      : page(response, url.pathname));
  });
}
