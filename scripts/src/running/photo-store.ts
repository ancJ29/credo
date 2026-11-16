import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { signUrl } from '@credo/bff/photo-store';

/** What the back end is handed to sign with: the bucket's address by path, and its key. */
export type PhotoStoreSettings = { url: string; keyId: string; keySecret: string };

/** What the seed sends a picture through: the settings its back end signs with, and where the
 * bytes go once an address is asked. The seed's clock is the data set's past, so its addresses are
 * long expired by the stand-in's clock: the seed hands the bytes in by the address's path. */
export type PhotoSink = {
  store: PhotoStoreSettings;
  keep: (address: string, bytes: Buffer, type: string) => void;
};

/** The sink a seed uses when no stand-in is given (the ridge seed, a test): the address is asked, the
 * picture is not kept anywhere. */
export const FORGETTING_SINK: PhotoSink = {
  store: { url: 'http://photos.invalid/seed', keyId: 'seed', keySecret: 'seed' },
  keep: () => undefined,
};

/** The bucket's name in an address, as it is by path at the S3 endpoint. */
const BUCKET = 'photos';

const send = (response: ServerResponse, status: number, headers: Record<string, string> = {}) =>
  response.writeHead(status, headers);

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * The local stand-in for the photo bucket (R2), beside the front that stands for CloudFront: it keeps
 * pictures in memory behind the same signed addresses the back end makes, checks each with the back
 * end's own signer, and answers the browser's cross-origin preflight as the bucket will, for the
 * app's address alone. An address that is expired, signed for another method, name, type or length,
 * or made with another key, is a 403, as the bucket answers it.
 */
export function createPhotoStore({
  secret,
  keyId,
  allowedOrigin,
  now = Date.now,
}: {
  keyId: string;
  secret: string;
  /** The address the app is opened at, read at each request: the front binds after this does. */
  allowedOrigin: () => string;
  now?: () => number;
}) {
  const objects = new Map<string, { bytes: Buffer; type: string }>();

  /** The headers that let the app's page use the answer: only the app's own address is allowed. */
  const cors = (request: IncomingMessage): Record<string, string> =>
    request.headers.origin === allowedOrigin()
      ? { 'access-control-allow-origin': allowedOrigin(), vary: 'Origin' }
      : {};

  /** Whether the address is one this stand-in's key signed for this very request, still alive. */
  function signedFor(request: IncomingMessage, url: URL) {
    const query = url.searchParams;
    const stamp = query.get('X-Amz-Date') ?? '';
    const expires = Number(query.get('X-Amz-Expires'));
    const at = Date.parse(
      stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'),
    );
    // Written so a date or a length that is not a number refuses too: NaN is never `<=`.
    if (!(now() <= at + expires * 1000)) return false;
    const put = request.method === 'PUT';
    const expected = signUrl({
      method: put ? 'PUT' : 'GET',
      url: `http://${request.headers.host}${url.pathname}`,
      accessKeyId: keyId,
      secretAccessKey: secret,
      region: 'auto',
      now: new Date(at),
      expiresSeconds: expires,
      ...(put
        ? {
            headers: {
              'content-type': request.headers['content-type'] as string,
              'content-length': request.headers['content-length'] as string,
            },
          }
        : {}),
    });
    return expected === `http://${request.headers.host}${url.pathname}${url.search}`;
  }

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url as string, 'http://photos');
    if (request.method === 'OPTIONS') {
      const allowed = cors(request);
      if (!allowed['access-control-allow-origin']) return send(response, 403);
      return send(response, 200, {
        ...allowed,
        'access-control-allow-methods': 'PUT, GET',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '3600',
      });
    }
    if (request.method !== 'PUT' && request.method !== 'GET') return send(response, 405);
    if (!signedFor(request, url)) return send(response, 403, cors(request));
    const name = decodeURIComponent(url.pathname);
    if (request.method === 'GET') {
      const held = objects.get(name);
      if (!held) return send(response, 404, cors(request));
      send(response, 200, {
        ...cors(request),
        'content-type': held.type,
        'content-length': String(held.bytes.length),
      });
      return void response.end(held.bytes);
    }
    objects.set(name, {
      bytes: await readBody(request),
      type: request.headers['content-type'] as string,
    });
    return send(response, 200, cors(request));
  }

  const server = createServer((request, response) => {
    void handle(request, response).then(() => response.end());
  });

  /** What the back end is handed once the stand-in listens at `port`. */
  const settingsAt = (port: number): PhotoStoreSettings => ({
    url: `http://127.0.0.1:${port}/${BUCKET}`,
    keyId,
    keySecret: secret,
  });

  return {
    server,
    settingsAt,
    /** A picture put by the seed, by the path of the address it asked. */
    keep: (address: string, bytes: Buffer, type: string) =>
      void objects.set(decodeURIComponent(new URL(address).pathname), { bytes, type }),
    /** How many pictures are held. */
    size: () => objects.size,
  };
}

/** A key pair made for one stack, held by the stand-in and the back end alone. */
export const newPhotoKey = () => ({
  keyId: randomBytes(8).toString('hex'),
  secret: randomBytes(24).toString('hex'),
});

/**
 * One picture of the data set sent: the address asked for it (by `ask`, which makes the back end's
 * call and answers the address), then the bytes kept where the address leads. The data set's pictures
 * are drawn PNGs and the back end takes a JPEG alone, so the ask says `image/jpeg` for the same
 * length; nothing here opens the picture.
 */
export async function sendPicture(
  sink: PhotoSink,
  photo: string,
  ask: (request: { type: 'image/jpeg'; bytes: number }) => Promise<string>,
) {
  const bytes = Buffer.from(photo.split(',')[1], 'base64');
  sink.keep(await ask({ type: 'image/jpeg', bytes: bytes.length }), bytes, 'image/jpeg');
}
