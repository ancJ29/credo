import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCStorageClient, registerCStorageService } from './c-storage';

/**
 * The client sends what c-storage's Bruno collection sends. The collection is the service's own
 * description of its routes, run against the real server by `c-storage/scripts/e2e.sh`, so a
 * client that drifts from it is a client the real server would refuse.
 */
const BRUNO = new URL('../../c-storage/bruno/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, BRUNO), 'utf8');

/** `name: value` pairs of the environment file, quotes off. */
function environment(): Record<string, string> {
  const pairs = [...read('environments/local.yml').matchAll(/- name: (\w+)\n\s+value: (.+)/g)];
  return Object.fromEntries(pairs.map(([, name, value]) => [name, value.replace(/^"|"$/g, '')]));
}

/** A request file as the wire carries it, its `{{variables}}` filled from `values`. */
function requestOf(path: string, values: Record<string, string>) {
  const text = read(path);
  const fill = (raw: string) => raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name]);
  const http = text.slice(text.indexOf('\nhttp:'), text.indexOf('\nruntime:'));
  const headers = [...http.matchAll(/- name: (\S+)\n\s+value: "?([^"\n]*)"?/g)].map(
    ([, name, value]) => [name.toLowerCase(), fill(value)] as const,
  );
  const body = /data: \|-\n((?: {6}.*\n?)+)/.exec(http)?.[1];
  return {
    method: /method: (\w+)/.exec(http)![1],
    url: fill(/url: "(.+)"/.exec(http)![1]),
    headers: Object.fromEntries(headers),
    body: body === undefined ? null : (JSON.parse(fill(body)) as unknown),
  };
}

/** What a client call put on the wire, taken from a fetch that refuses so nothing is parsed. */
async function sent(use: (call: typeof fetch) => Promise<unknown>) {
  let seen: { url: string; init: RequestInit } | undefined;
  const call: typeof fetch = (url, init) => {
    seen = { url: url instanceof Request ? url.url : url.toString(), init: init ?? {} };
    return Promise.resolve(new Response('{}', { status: 500 }));
  };
  await use(call).catch(() => undefined);
  const { url, init } = seen!;
  return {
    method: init.method,
    url,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
  };
}

const values: Record<string, string> = { ...environment(), staleTag: 'a'.repeat(64) };
const connection = {
  baseUrl: values['baseUrl'],
  internalAccessKey: values['internalAccessKey'],
};
const client = (call: typeof fetch) =>
  createCStorageClient({
    ...connection,
    serviceCode: values['serviceCode'],
    accessKey: values['accessKey'],
    fetch: call,
  });
const key = values['recordKey'];

describe('the c-storage client sends what its Bruno request sends', () => {
  it('registers a service as 01-register-service does', async () => {
    const wire = await sent((call) =>
      registerCStorageService(
        { ...connection, superAdminKey: values['superAdminKey'], fetch: call },
        { code: values['serviceCode'], accessKey: values['accessKey'] },
      ),
    );
    expect(wire).toEqual(requestOf('01-services/01-register-service.yml', values));
  });

  it('reads a record as 04-get-record does', async () => {
    const wire = await sent((call) => client(call).getRecord(key));
    expect(wire).toEqual(requestOf('02-records/04-get-record.yml', values));
  });

  it('writes a record whole as 02-push-record does', async () => {
    const data = (requestOf('02-records/02-push-record.yml', values).body as { data: unknown })
      .data;
    const wire = await sent((call) => client(call).putRecord(key, data));
    expect(wire).toEqual(requestOf('02-records/02-push-record.yml', values));
  });

  it('writes naming no record as 09-push-naming-no-record does', async () => {
    const request = requestOf('02-records/09-push-naming-no-record.yml', values);
    const wire = await sent((call) =>
      client(call).putRecord(key, (request.body as { data: unknown }).data, null),
    );
    expect(wire).toEqual(request);
  });

  it('writes naming a tag as 12-push-naming-a-stale-tag does', async () => {
    const request = requestOf('02-records/12-push-naming-a-stale-tag.yml', values);
    const wire = await sent((call) =>
      client(call).putRecord(
        key,
        (request.body as { data: unknown }).data,
        request.headers['if-match'],
      ),
    );
    expect(wire).toEqual(request);
  });

  it('removes a record as 07-remove-record does', async () => {
    const wire = await sent((call) => client(call).removeRecord(key));
    expect(wire).toEqual(requestOf('02-records/07-remove-record.yml', values));
  });

  it('removes naming a tag as 15-remove-naming-a-stale-tag does', async () => {
    const wire = await sent((call) => client(call).removeRecord(key, values['staleTag']));
    expect(wire).toEqual(requestOf('02-records/15-remove-naming-a-stale-tag.yml', values));
  });
});
