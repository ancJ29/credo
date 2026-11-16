import { createHash, createHmac } from 'node:crypto';

/** What one signed address is for: the object's own address (no query), the way to it, and the
 * headers the caller must send as signed. */
export type SignInput = {
  method: 'PUT' | 'GET';
  /** The object's address without a query, such as `https://<host>/<bucket>/<name>`. */
  url: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** R2 takes `auto`; AWS's published example is `us-east-1`. */
  region: string;
  /** Handed in, never read from the clock here. */
  now: Date;
  /** Seconds the address lives. */
  expiresSeconds: number;
  /** Headers signed beside the host: a PUT signs its type and exact length. */
  headers?: { 'content-type': string; 'content-length': string };
};

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();
const hex = (data: string) => createHash('sha256').update(data).digest('hex');
// RFC 3986: encodeURIComponent leaves ! ' ( ) * bare.
const encode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** The canonical request of Signature Version 4: the method, the path, the query, each header as
 * `name:value` with a newline after it (the blank line after the last one is part of the form), the
 * signed names and the payload's hash or `UNSIGNED-PAYLOAD`. Names are sorted by the caller's keys. */
export const canonicalRequest = (parts: {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  payload: string;
}): string => {
  const names = Object.keys(parts.headers).sort();
  return [
    parts.method,
    parts.path,
    parts.query,
    names.map((n) => `${n}:${parts.headers[n]}\n`).join(''),
    names.join(';'),
    parts.payload,
  ].join('\n');
};

/** One address that lets its holder PUT or GET one object until it expires, by AWS's query
 * signing (Signature Version 4), which R2 accepts at its S3 endpoint. It is arithmetic on a key
 * and the clock: it opens no connection. */
export const signUrl = (input: SignInput): string => {
  const { host, origin, pathname } = new URL(input.url);
  const path = pathname
    .split('/')
    .map((s) => encode(decodeURIComponent(s)))
    .join('/');
  const stamp = input.now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host, ...input.headers };
  const names = Object.keys(headers).sort();
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(input.expiresSeconds),
    'X-Amz-SignedHeaders': names.join(';'),
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encode(k)}=${encode(query[k])}`)
    .join('&');
  const canonical = canonicalRequest({
    method: input.method,
    path,
    query: canonicalQuery,
    headers,
    payload: 'UNSIGNED-PAYLOAD',
  });
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, hex(canonical)].join('\n');
  const key = [day, input.region, 's3', 'aws4_request'].reduce(
    (k, part) => hmac(k, part),
    Buffer.from(`AWS4${input.secretAccessKey}`),
  );
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return `${origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};

/** Where the photos are kept and the key that signs for them: `url` is the bucket's address at the
 * S3 endpoint, by path, with no query. */
export type PhotoStore = { url: string; keyId: string; keySecret: string };

/** The store the environment names, none where it names none. The environment is read with the three
 * together, so an address has its key; a trailing slash is dropped so a name joins with one. */
export const photoStoreOf = (config: {
  PHOTO_STORE_URL?: string | undefined;
  PHOTO_STORE_KEY_ID?: string | undefined;
  PHOTO_STORE_KEY_SECRET?: string | undefined;
}): PhotoStore | null =>
  config.PHOTO_STORE_URL === undefined
    ? null
    : {
        url: config.PHOTO_STORE_URL.replace(/\/$/, ''),
        keyId: config.PHOTO_STORE_KEY_ID as string,
        keySecret: config.PHOTO_STORE_KEY_SECRET as string,
      };

/** How long a photo's address lives, to send the picture or to read it. */
const PHOTO_ADDRESS_SECONDS = 300;

/** The address for one object of the store: a PUT signs the picture's type and exact length. */
export const photoAddress = (
  store: PhotoStore,
  name: string,
  now: number,
  put?: { type: string; bytes: number },
) =>
  signUrl({
    method: put ? 'PUT' : 'GET',
    url: `${store.url}/${name}`,
    accessKeyId: store.keyId,
    secretAccessKey: store.keySecret,
    region: 'auto',
    now: new Date(now),
    expiresSeconds: PHOTO_ADDRESS_SECONDS,
    ...(put ? { headers: { 'content-type': put.type, 'content-length': String(put.bytes) } } : {}),
  });
