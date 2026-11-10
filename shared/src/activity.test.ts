import { describe, expect, it } from 'vitest';
import {
  ActivityError,
  AUDIT_TIMEOUT_MS,
  createActivityClient,
  entryLine,
  readEntriesByTarget,
  type ReadEntry,
} from './activity';

type Call = { url: string; init: RequestInit };

function fake(...answers: (Response | Error)[]) {
  const calls: Call[] = [];
  const call: typeof fetch = (url, init) => {
    calls.push({ url: String(url instanceof Request ? url.url : url), init: init ?? {} });
    const answer = answers.shift() ?? new Response('{}', { status: 500 });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { calls, call };
}

const entry = {
  clientId: 'c1',
  actorId: 'root',
  action: 'customer.save',
  targetId: 't1',
  memo: {},
  timestamp: '2026-11-10T10:00:00.000Z',
} as const;

const client = (call: typeof fetch, timeoutMs?: number) =>
  createActivityClient({
    baseUrl: 'http://audit.test',
    key: 'write-key',
    fetch: call,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

describe('the audit client', () => {
  it('sends the batch under its key and takes a 201 as committed', async () => {
    const { calls, call } = fake(new Response('{"ids":["x"]}', { status: 201 }));
    await client(call).log([entry]);
    expect(calls[0]?.url).toBe('http://audit.test/api/activities');
    expect(new Headers(calls[0]?.init.headers).get('x-internal-access-key')).toBe('write-key');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ activities: [entry] });
  });

  it('reads any answer but 201 as a refusal naming the status and no key', async () => {
    const { call } = fake(new Response('{}', { status: 401 }));
    const failure = await client(call)
      .log([entry])
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ActivityError);
    expect(failure).toMatchObject({
      status: 401,
      message: 'the audit service answered 401 to a write',
    });
    expect((failure as Error).message).not.toContain('write-key');
  });

  it('is not held past its bound: a service that never answers is an error with no status', async () => {
    expect(AUDIT_TIMEOUT_MS).toBe(600);
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const began = Date.now();
    await expect(client(hanging, 50).log([entry])).rejects.toMatchObject({ status: null });
    expect(Date.now() - began).toBeLessThan(AUDIT_TIMEOUT_MS);
  });

  it('mints a token for one client, and refuses a refusal or an answer in no known shape', async () => {
    const ok = fake(new Response('{"token":"tok","expiresAt":"x"}', { status: 200 }));
    expect(await client(ok.call).mintToken('c1')).toBe('tok');
    expect(JSON.parse(ok.calls[0]?.init.body as string)).toEqual({ clientId: 'c1' });
    const no = fake(new Response('{}', { status: 401 }));
    await expect(client(no.call).mintToken('c1')).rejects.toMatchObject({ status: 401 });
    const odd = fake(new Response('nope', { status: 200 }));
    await expect(client(odd.call).mintToken('c1')).rejects.toMatchObject({ status: null });
  });
});

const read = { readUrl: 'http://open.test', token: 'tok' };

describe('reading entries by record', () => {
  it('sends the token as a bearer and answers the entries as the service sent them', async () => {
    const body = {
      activities: [
        {
          id: 'a',
          clientId: 'c1',
          actorId: 'root',
          action: 'customer.save',
          targetId: 't 1',
          memo: {},
          createdAt: 'z',
        },
      ],
    };
    const { calls, call } = fake(new Response(JSON.stringify(body), { status: 200 }));
    expect(await readEntriesByTarget({ ...read, fetch: call }, 't 1')).toEqual(body.activities);
    expect(calls[0]?.url).toBe('http://open.test/api/activities/by-target/t%201');
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer tok');
  });

  it('refuses a refusal, a page in no known shape and a body that is not JSON', async () => {
    const text = fake(new Response('<html>', { status: 200 }));
    await expect(readEntriesByTarget({ ...read, fetch: text.call }, 't')).rejects.toMatchObject({
      status: null,
    });
    const no = fake(new Response('{}', { status: 401 }));
    await expect(readEntriesByTarget({ ...read, fetch: no.call }, 't')).rejects.toMatchObject({
      status: 401,
    });
    const odd = fake(new Response('{"activities":3}', { status: 200 }));
    await expect(readEntriesByTarget({ ...read, fetch: odd.call }, 't')).rejects.toMatchObject({
      status: null,
    });
  });
});

describe('a printed line', () => {
  const customer = (name: string) => ({
    id: '3f1c1d4e-5b6a-4c7d-8e9f-0a1b2c3d4e5f',
    code: 'KH-1',
    name,
    extra: {},
  });
  const base: ReadEntry = {
    id: 'a',
    clientId: 'c1',
    actorId: 'employee.7',
    action: 'customer.save',
    targetId: 't',
    memo: { by: 'Lan', before: customer('Mai'), after: customer('Mai Linh') },
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  it('is the time, the person, what was done, and the name before and after', () => {
    expect(entryLine(base)).toBe('2026-11-10T10:00:00.000Z  Lan  customer saved  Mai -> Mai Linh');
  });

  it('shows a create’s missing side as a dash', () => {
    const created = { ...base, memo: { by: 'Lan', before: null, after: customer('Mai') } };
    expect(entryLine(created)).toBe('2026-11-10T10:00:00.000Z  Lan  customer saved  - -> Mai');
    const removed = { ...base, memo: { by: 'Lan', before: customer('Mai'), after: null } };
    expect(entryLine(removed)).toBe('2026-11-10T10:00:00.000Z  Lan  customer saved  Mai -> -');
  });

  it('falls back to the actor and the action as written when the memo or the action is unknown', () => {
    expect(entryLine({ ...base, memo: { odd: true }, action: 'thing.done' })).toBe(
      '2026-11-10T10:00:00.000Z  employee.7  thing.done',
    );
  });
});
