import { z } from 'zod';

/** A c-storage call that did not answer as its route promises: `status` is the HTTP status, or
 * null when no answer came (refused, reset, timed out) or the answer was not the shape promised. */
export class CStorageError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CStorageError';
  }
}

type Connection = {
  baseUrl: string;
  /** `x-internal-access-key`: the stack's, which every route but /health needs. */
  internalAccessKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5000;
/** How often a write over a record that moved is read again and tried again before the call gives
 * up: the one bound every back-end retry loop reads, beside how long one call to storage waits. */
export const ATTEMPTS = 3;
/** How long the services status waits for c-storage's `/health` (the plan's row 38). */
const HEALTH_TIMEOUT_MS = 3000;

const healthReplySchema = z.object({ status: z.literal('OK'), buildVersion: z.string().min(1) });

async function send(
  connection: Connection,
  path: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: unknown;
    /** `/health` is the one route without the internal key, and sends none. */
    keyless?: boolean;
    timeoutMs?: number;
  },
  what: string,
) {
  const { baseUrl, internalAccessKey, fetch: call = fetch } = connection;
  const timeoutMs = init.timeoutMs ?? connection.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hasBody = init.body !== undefined;
  try {
    return await call(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        ...(init.keyless ? {} : { 'x-internal-access-key': internalAccessKey }),
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      body: hasBody ? JSON.stringify(init.body) : null,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new CStorageError(null, `c-storage did not answer ${what}`, {
      cause: error,
    });
  }
}

/** How an error names a record call: its verb and the record's kind (`user`, `session`, `config`),
 * never its key, which may be a sign-in name and would land in a log. */
const recordCall = (method: string, key: string) => `${method} a ${key.split('.')[0]} record`;

const refused = (response: Response, what: string) =>
  new CStorageError(response.status, `c-storage answered ${response.status} to ${what}`);

const recordReplySchema = z.object({ record: z.object({ data: z.unknown(), tag: z.string() }) });

export type StoredRecord = { data: unknown; tag: string };

const listReplySchema = z.object({
  records: z.array(z.object({ key: z.string(), data: z.unknown(), tag: z.string() })),
  more: z.boolean(),
});

/** What a list reads: a page of the records under a prefix in key order, and whether c-storage holds
 * more past it. The next page is the same list `after` the last key read. */
export type RecordList = { records: (StoredRecord & { key: string })[]; more: boolean };

/** One service's records. Its keys belong to the instance, never to the process, so two clients
 * of two services (or a test's and the BFF's) never share a key. */
export type CStorageClient = {
  /** A record that is not there is null; the tag is the one to send back in `ifTag`. */
  getRecord(key: string): Promise<StoredRecord | null>;
  /** A page of the records whose key starts with `prefix`, a non-empty literal, in key order, at
   * most 1,000, and those past `after` when it is given. */
  listRecords(prefix: string, after?: string): Promise<RecordList>;
  /** `ifTag` a string writes only over the record as that tag read it, null only where none
   * exists, undefined over whatever is there. A moved record is 'moved', not an error. */
  putRecord(key: string, data: unknown, ifTag?: string | null): Promise<'saved' | 'moved'>;
  removeRecord(key: string, ifTag?: string): Promise<'removed' | 'moved'>;
  /** c-storage's build, from its `/health`, which answers `OK` without a key within 3 seconds.
   * Anything else, a late answer included, is an error. */
  health(): Promise<{ buildVersion: string }>;
};

export function createCStorageClient(
  connection: Connection & { serviceCode: string; accessKey: string },
): CStorageClient {
  const base = `/api/records/${encodeURIComponent(connection.serviceCode)}`;
  const keyed = { 'x-access-key': connection.accessKey };
  const preconditionHeaders = (ifTag: string | null | undefined): Record<string, string> => {
    if (ifTag === undefined) return {};
    return ifTag === null ? { 'if-none-match': '*' } : { 'if-match': ifTag };
  };

  return {
    async getRecord(key) {
      const path = `${base}/${encodeURIComponent(key)}`;
      const what = recordCall('GET', key);
      const response = await send(connection, path, { method: 'GET', headers: keyed }, what);
      if (response.status === 404) return null;
      if (response.status !== 200) throw refused(response, what);
      const parsed = recordReplySchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success)
        throw new CStorageError(null, `c-storage sent a record in no known shape`);
      return parsed.data.record;
    },

    async listRecords(prefix, after) {
      const page = after ? `&after=${encodeURIComponent(after)}` : '';
      const path = `${base}?prefix=${encodeURIComponent(prefix)}${page}`;
      const what = 'GET a record list';
      const response = await send(connection, path, { method: 'GET', headers: keyed }, what);
      if (response.status !== 200) throw refused(response, what);
      const parsed = listReplySchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new CStorageError(null, `c-storage sent a list in no known shape`);
      return parsed.data;
    },

    async putRecord(key, data, ifTag) {
      const what = recordCall('POST', key);
      const response = await send(
        connection,
        base,
        {
          method: 'POST',
          headers: { ...keyed, ...preconditionHeaders(ifTag) },
          body: { key, data },
        },
        what,
      );
      if (response.status === 201) return 'saved';
      if (response.status === 412) return 'moved';
      throw refused(response, what);
    },

    async removeRecord(key, ifTag) {
      const path = `${base}/${encodeURIComponent(key)}`;
      const what = recordCall('DELETE', key);
      const response = await send(
        connection,
        path,
        { method: 'DELETE', headers: { ...keyed, ...preconditionHeaders(ifTag) } },
        what,
      );
      if (response.status === 204) return 'removed';
      if (response.status === 412) return 'moved';
      throw refused(response, what);
    },

    async health() {
      const what = 'GET /health';
      const response = await send(
        connection,
        '/health',
        { method: 'GET', headers: {}, keyless: true, timeoutMs: HEALTH_TIMEOUT_MS },
        what,
      );
      if (response.status !== 200) throw refused(response, what);
      const parsed = healthReplySchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success)
        throw new CStorageError(null, 'c-storage sent a health in no known shape');
      return { buildVersion: parsed.data.buildVersion };
    },
  };
}

/** Adds a service. It takes the super-admin key and no access key: no instance holds both, and
 * the BFF holds neither this key nor this function's caller. A taken code is 'exists', read by its
 * status, which does not say that the key stored is this one. */
export async function registerCStorageService(
  connection: Connection & { superAdminKey: string },
  service: { code: string; accessKey: string },
): Promise<'registered' | 'exists'> {
  const what = 'POST /api/services/register';
  const response = await send(
    connection,
    '/api/services/register',
    { method: 'POST', headers: { 'x-super-admin-key': connection.superAdminKey }, body: service },
    what,
  );
  if (response.status === 201) return 'registered';
  if (response.status === 409) return 'exists';
  throw refused(response, what);
}
