import type { AddressInfo } from 'node:net';
import { photoAddress } from '@credo/bff/photo-store';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPhotoStore,
  FORGETTING_SINK,
  newPhotoKey,
  type PhotoStoreSettings,
  sendPicture,
} from './photo-store';

const APP = 'http://localhost:4000';
const NOW = Date.UTC(2026, 10, 14, 9, 0, 0);
const BYTES = Buffer.from('a picture');
let clock = NOW;
const key = newPhotoKey();
const stand = createPhotoStore({
  keyId: key.keyId,
  secret: key.secret,
  allowedOrigin: () => APP,
  now: () => clock,
});
let settings: PhotoStoreSettings;

beforeAll(async () => {
  await new Promise<void>((resolve) => stand.server.listen(0, '127.0.0.1', resolve));
  settings = stand.settingsAt((stand.server.address() as AddressInfo).port);
});
afterAll(() => new Promise((resolve) => stand.server.close(resolve)));

const putAddress = (name: string, at = NOW, bytes = BYTES.length, store = settings) =>
  photoAddress(store, name, at, { type: 'image/jpeg', bytes });
const put = (address: string, body: Buffer = BYTES, headers: Record<string, string> = {}) =>
  fetch(address, { method: 'PUT', headers: { 'content-type': 'image/jpeg', ...headers }, body });

describe('Case 14: the stand-in for the photo bucket', () => {
  it('keeps a picture sent to a signed address and gives it back at a signed read address, with its type', async () => {
    const sent = await put(putAddress('one/a b.jpg'));
    expect(sent.status).toBe(200);
    const read = await fetch(photoAddress(settings, 'one/a b.jpg', NOW));
    expect(read.status).toBe(200);
    expect(read.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await read.arrayBuffer())).toEqual(BYTES);
    expect(stand.size()).toBeGreaterThan(0);
  });

  it('refuses an expired address, a wrong signature and a longer body than signed, each a 403 that keeps nothing', async () => {
    const before = stand.size();
    clock = NOW + 301_000;
    expect((await put(putAddress('late.jpg'))).status).toBe(403);
    expect((await fetch(photoAddress(settings, 'one/a b.jpg', NOW))).status).toBe(403);
    clock = NOW;
    const address = putAddress('forged.jpg');
    expect((await put(address.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).status).toBe(403);
    // the same address, a longer body than the signed length: the length header is another one
    expect((await put(putAddress('long.jpg'), Buffer.from('a picture, longer'))).status).toBe(403);
    // another type than the signed one, another name than the signed one, another key
    expect((await put(putAddress('type.jpg'), BYTES, { 'content-type': 'image/png' })).status).toBe(
      403,
    );
    expect((await put(putAddress('x.jpg').replace('x.jpg', 'y.jpg'))).status).toBe(403);
    const other = { ...settings, keySecret: 'another-secret' };
    expect((await put(putAddress('key.jpg', NOW, BYTES.length, other))).status).toBe(403);
    // an address with no signature at all
    expect((await fetch(`${settings.url}/one/a%20b.jpg`)).status).toBe(403);
    // a PUT's address read as a GET, and a date or a length that is no number
    expect((await fetch(putAddress('get.jpg'))).status).toBe(403);
    expect(
      (await fetch(photoAddress(settings, 'late.jpg', NOW).replace('Expires=300', 'Expires=x')))
        .status,
    ).toBe(403);
    expect(stand.size()).toBe(before);
  });

  it('answers a 404 for a signed read of a name nothing was sent to, and a 405 for any method but PUT and GET', async () => {
    expect((await fetch(photoAddress(settings, 'none.jpg', NOW))).status).toBe(404);
    const address = photoAddress(settings, 'one/a b.jpg', NOW);
    expect((await fetch(address, { method: 'DELETE' })).status).toBe(405);
  });

  it('answers the preflight of the app’s own address as the bucket will: PUT and GET, the content-type header; another address is refused', async () => {
    const asked = (origin: string) =>
      fetch(putAddress('pre.jpg'), {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'content-type',
        },
      });
    const allowed = await asked(APP);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(APP);
    expect(allowed.headers.get('access-control-allow-methods')).toBe('PUT, GET');
    expect(allowed.headers.get('access-control-allow-headers')).toBe('content-type');
    const refused = await asked('http://evil.test');
    expect(refused.status).toBe(403);
    expect(refused.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('lets the app’s page read each answer, and no other page', async () => {
    const own = await fetch(photoAddress(settings, 'one/a b.jpg', NOW), {
      headers: { origin: APP },
    });
    expect(own.headers.get('access-control-allow-origin')).toBe(APP);
    const stranger = await fetch(photoAddress(settings, 'one/a b.jpg', NOW), {
      headers: { origin: 'http://evil.test' },
    });
    expect(stranger.status).toBe(200);
    expect(stranger.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('keeps a picture the seed hands in by the path of its address, read back by a fresh one', async () => {
    stand.keep(putAddress('seeded/b.jpg', Date.UTC(2026, 0, 1)), BYTES, 'image/jpeg');
    const read = await fetch(photoAddress(settings, 'seeded/b.jpg', NOW));
    expect(read.status).toBe(200);
    expect(Buffer.from(await read.arrayBuffer())).toEqual(BYTES);
  });

  it('sendPicture asks for the picture’s own length as a JPEG, then keeps its bytes at the address', async () => {
    const asks: unknown[] = [];
    const kept: [string, Buffer, string][] = [];
    const png = `data:image/png;base64,${BYTES.toString('base64')}`;
    await sendPicture({ store: settings, keep: (...args) => void kept.push(args) }, png, (body) => {
      asks.push(body);
      return Promise.resolve('http://store.test/x');
    });
    expect(asks).toEqual([{ type: 'image/jpeg', bytes: BYTES.length }]);
    expect(kept).toEqual([['http://store.test/x', BYTES, 'image/jpeg']]);
    expect(FORGETTING_SINK.keep('http://store.test/x', BYTES, 'image/jpeg')).toBeUndefined();
  });
});
