import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalRequest, photoAddress, photoStoreOf, signUrl } from './photo-store';

// AWS's published example of a signed address: a GET of `test.txt` from `examplebucket`, signed
// with the documented example key on 2013-05-24, valid 86400 seconds, region us-east-1.
const example = {
  method: 'GET' as const,
  url: 'https://examplebucket.s3.amazonaws.com/test.txt',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  now: new Date('2013-05-24T00:00:00Z'),
  expiresSeconds: 86400,
};
const published =
  'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';

describe('the signer of a photo address', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gives AWS’s published example exactly, with every outbound call refused', () => {
    const refuse = () => {
      throw new Error('outbound call');
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(refuse);
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(refuse);
    expect(signUrl(example)).toBe(published);
  });

  it('writes several signed headers as AWS’s GET Object example does', () => {
    // The example's four signed headers (host, range, x-amz-content-sha256, x-amz-date) of AWS's
    // Signature Version 4 page for S3, whose canonical request hashes to the value below; the PUT of
    // a photo signs three headers, and a blank line between them would make R2 refuse every upload.
    const request = canonicalRequest({
      method: 'GET',
      path: '/test.txt',
      query: '',
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        range: 'bytes=0-9',
        'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'x-amz-date': '20130524T000000Z',
      },
      payload: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    expect(createHash('sha256').update(request).digest('hex')).toBe(
      '7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972',
    );
  });

  it('changes with one byte of the secret', () => {
    expect(signUrl({ ...example, secretAccessKey: `${example.secretAccessKey}x` })).not.toBe(
      published,
    );
  });

  it('signs a PUT’s type and exact length, so a different one no longer matches', () => {
    const put = (length: string, type = 'image/jpeg') =>
      signUrl({
        ...example,
        method: 'PUT',
        url: 'https://acct.example.test/bucket/a b/it’s(1).jpg',
        headers: { 'content-type': type, 'content-length': length },
      });
    const url = put('1000');
    expect(url).toContain('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost');
    expect(url).toContain('/bucket/a%20b/it%E2%80%99s%281%29.jpg?');
    expect(url).not.toBe(put('1001'));
    expect(url).not.toBe(put('1000', 'image/png'));
    expect(url).toBe(put('1000'));
  });

  it('is made from the environment’s three settings, or is none, and its addresses live five minutes', () => {
    expect(photoStoreOf({})).toBeNull();
    const store = photoStoreOf({
      PHOTO_STORE_URL: 'https://objects.test/bucket/',
      PHOTO_STORE_KEY_ID: 'id',
      PHOTO_STORE_KEY_SECRET: 'secret',
    });
    expect(store).toEqual({ url: 'https://objects.test/bucket', keyId: 'id', keySecret: 'secret' });
    const read = new URL(photoAddress(store!, 'a/b.jpg', Date.UTC(2026, 10, 14)));
    expect(read.pathname).toBe('/bucket/a/b.jpg');
    expect(read.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(read.searchParams.get('X-Amz-Date')).toBe('20261114T000000Z');
    const put = new URL(photoAddress(store!, 'a/b.jpg', 0, { type: 'image/jpeg', bytes: 7 }));
    expect(put.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
  });
});
