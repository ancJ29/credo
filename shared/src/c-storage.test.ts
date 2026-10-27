import { describe, expect, it } from 'vitest';
import { CStorageError, createCStorageClient, registerCStorageService } from './c-storage';

type Call = { url: string; init: RequestInit };

/** A fetch that answers each call from `answers` in turn and records what was sent. */
function fake(...answers: (Response | Error)[]) {
  const calls: Call[] = [];
  const call: typeof fetch = (url, init) => {
    calls.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    const answer = answers.shift() ?? new Response('{}', { status: 500 });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { calls, call };
}

const headersOf = (call: Call) => new Headers(call.init.headers);

const connect = (call: typeof fetch) =>
  createCStorageClient({
    baseUrl: 'http://cs.test',
    internalAccessKey: 'internal-key',
    serviceCode: 'svc a',
    accessKey: 'service-key',
    fetch: call,
  });

describe('the c-storage client', () => {
  it('sends its own keys on a record route, and the key as one encoded segment', async () => {
    const { calls, call } = fake(
      new Response(JSON.stringify({ record: { data: { a: 1 }, tag: 't1' } }), { status: 200 }),
    );
    const record = await connect(call).getRecord('user.a/b c');
    expect(record).toEqual({ data: { a: 1 }, tag: 't1' });
    expect(calls[0]?.url).toBe('http://cs.test/api/records/svc%20a/user.a%2Fb%20c');
    expect(headersOf(calls[0]).get('x-internal-access-key')).toBe('internal-key');
    expect(headersOf(calls[0]).get('x-access-key')).toBe('service-key');
  });

  it('takes its keys per instance: two clients never share one', async () => {
    const one = fake(new Response('{}', { status: 404 }));
    const two = fake(new Response('{}', { status: 404 }));
    await connect(one.call).getRecord('k');
    await createCStorageClient({
      baseUrl: 'http://cs.test',
      internalAccessKey: 'other-internal',
      serviceCode: 'other',
      accessKey: 'other-key',
      fetch: two.call,
    }).getRecord('k');
    expect(headersOf(one.calls[0]).get('x-access-key')).toBe('service-key');
    expect(headersOf(two.calls[0]).get('x-access-key')).toBe('other-key');
  });

  it('reads a record that is not there as null and any other refusal as an error', async () => {
    const missing = fake(new Response('{}', { status: 404 }));
    expect(await connect(missing.call).getRecord('k')).toBeNull();
    const forbidden = fake(new Response('{}', { status: 403 }));
    await expect(connect(forbidden.call).getRecord('k')).rejects.toMatchObject({ status: 403 });
  });

  it('refuses an answer in no known shape, and a call that gets no answer', async () => {
    const odd = fake(new Response('not json', { status: 200 }));
    await expect(connect(odd.call).getRecord('k')).rejects.toMatchObject({ status: null });
    const down = fake(new TypeError('fetch failed'));
    const error = await connect(down.call)
      .getRecord('k')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CStorageError);
    expect(error).toMatchObject({ status: null });
  });

  it('gives up on a call that outlasts its timeout', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = createCStorageClient({
      baseUrl: 'http://cs.test',
      internalAccessKey: 'i',
      serviceCode: 's',
      accessKey: 'a',
      fetch: hang,
      timeoutMs: 20,
    });
    await expect(client.getRecord('k')).rejects.toMatchObject({ status: null });
  });

  it('writes with If-Match for a tag, If-None-Match for none, and neither for a blind write', async () => {
    const { calls, call } = fake(
      new Response('{}', { status: 201 }),
      new Response('{}', { status: 201 }),
      new Response('{}', { status: 201 }),
    );
    const client = connect(call);
    await client.putRecord('k', { a: 1 }, 'tag-1');
    await client.putRecord('k', { a: 1 }, null);
    await client.putRecord('k', { a: 1 });
    expect(headersOf(calls[0]).get('if-match')).toBe('tag-1');
    expect(headersOf(calls[0]).get('if-none-match')).toBeNull();
    expect(headersOf(calls[1]).get('if-none-match')).toBe('*');
    expect(headersOf(calls[1]).get('if-match')).toBeNull();
    expect(headersOf(calls[2]).get('if-match')).toBeNull();
    expect(headersOf(calls[2]).get('if-none-match')).toBeNull();
    expect(calls[0]?.init.body).toBe('{"key":"k","data":{"a":1}}');
    expect(headersOf(calls[0]).get('content-type')).toBe('application/json');
  });

  it('answers a write on a moved record "moved", and any other refusal as an error', async () => {
    const { call } = fake(new Response('{}', { status: 412 }), new Response('{}', { status: 400 }));
    const client = connect(call);
    expect(await client.putRecord('k', {}, 'old')).toBe('moved');
    await expect(client.putRecord('k', {}, 'x')).rejects.toMatchObject({ status: 400 });
  });

  it('removes with If-Match, and answers a moved record "moved"', async () => {
    const { calls, call } = fake(
      new Response(null, { status: 204 }),
      new Response('{}', { status: 412 }),
      new Response('{}', { status: 500 }),
    );
    const client = connect(call);
    expect(await client.removeRecord('k', 'tag-1')).toBe('removed');
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(headersOf(calls[0]).get('if-match')).toBe('tag-1');
    expect(headersOf(calls[0]).get('content-type')).toBeNull();
    expect(await client.removeRecord('k', 'tag-2')).toBe('moved');
    await expect(client.removeRecord('k')).rejects.toMatchObject({ status: 500 });
  });
});

describe('registering a service', () => {
  const connection = (call: typeof fetch) => ({
    baseUrl: 'http://cs.test',
    internalAccessKey: 'internal-key',
    superAdminKey: 'admin-key',
    fetch: call,
  });

  it('sends the super-admin key and the new service, never an access key header', async () => {
    const { calls, call } = fake(new Response('{}', { status: 201 }));
    expect(await registerCStorageService(connection(call), { code: 's', accessKey: 'k' })).toBe(
      'registered',
    );
    expect(calls[0]?.url).toBe('http://cs.test/api/services/register');
    expect(headersOf(calls[0]).get('x-super-admin-key')).toBe('admin-key');
    expect(headersOf(calls[0]).get('x-access-key')).toBeNull();
    expect(calls[0]?.init.body).toBe('{"code":"s","accessKey":"k"}');
  });

  it('reads a taken code by its 409 status, never by message, and fails on any other', async () => {
    const { call } = fake(
      new Response('{"error":"whatever words"}', { status: 409 }),
      new Response('{}', { status: 401 }),
    );
    const service = { code: 's', accessKey: 'k' };
    expect(await registerCStorageService(connection(call), service)).toBe('exists');
    await expect(registerCStorageService(connection(call), service)).rejects.toMatchObject({
      status: 401,
    });
  });
});
