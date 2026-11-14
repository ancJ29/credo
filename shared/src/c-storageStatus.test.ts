import { describe, expect, it } from 'vitest';
import { createCStorageClient } from './c-storage';

const connect = (answer: Response | Error) => {
  const calls: { url: string; headers: Headers }[] = [];
  const client = createCStorageClient({
    baseUrl: 'http://cs.test',
    internalAccessKey: 'internal-key',
    serviceCode: 'svc',
    accessKey: 'service-key',
    fetch: (url, init) => {
      calls.push({
        url: url instanceof Request ? url.url : url.toString(),
        headers: new Headers(init?.headers),
      });
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  });
  return { client, calls };
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('the status read', () => {
  it('8: gives the free bytes and the last write, sending the internal key alone', async () => {
    const { client, calls } = connect(json({ freeBytes: 4096, lastWriteAt: null }));

    expect(await client.status()).toEqual({ freeBytes: 4096, lastWriteAt: null });
    expect(calls[0]?.url).toBe('http://cs.test/api/status');
    expect(calls[0]?.headers.get('x-internal-access-key')).toBe('internal-key');
    expect(calls[0]?.headers.get('x-access-key')).toBeNull();
  });

  it('8: reads a last write given as a time', async () => {
    const at = '2026-11-14T02:00:00Z';
    const { client } = connect(json({ freeBytes: 1, lastWriteAt: at }));

    expect(await client.status()).toEqual({ freeBytes: 1, lastWriteAt: at });
  });

  it('8: refuses a refusal, no answer and an answer in no known shape', async () => {
    await expect(connect(json({}, 503)).client.status()).rejects.toMatchObject({ status: 503 });
    await expect(connect(new TypeError('x')).client.status()).rejects.toMatchObject({
      status: null,
    });
    for (const bad of [json({ freeBytes: -1, lastWriteAt: null }), json({ freeBytes: 1 })]) {
      await expect(connect(bad).client.status()).rejects.toMatchObject({ status: null });
    }
    await expect(
      connect(new Response('nope', { status: 200 })).client.status(),
    ).rejects.toMatchObject({ status: null });
  });
});
