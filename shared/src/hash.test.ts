import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';

describe("Every write carries its body's SHA-256; the front refuses one without it", () => {
  it('hashes the exact bytes of a body into lowercase hex', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes a string as UTF-8 and the same bytes alike', async () => {
    const body = '{"name":"Công ty Đại Việt"}';
    expect(await sha256Hex(body)).toBe(await sha256Hex(new TextEncoder().encode(body)));
    expect(await sha256Hex('Đ')).toBe(await sha256Hex(new Uint8Array([0xc4, 0x90])));
  });
});
