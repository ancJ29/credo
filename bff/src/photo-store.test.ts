import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signUrl } from './photo-store';

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
});
