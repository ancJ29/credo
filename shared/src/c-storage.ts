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

async function send(
  connection: Connection,
  path: string,
  init: { method: string; headers: Record<string, string>; body?: unknown },
) {
  const {
    baseUrl,
    internalAccessKey,
    fetch: call = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = connection;
  const hasBody = init.body !== undefined;
  try {
    return await call(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        'x-internal-access-key': internalAccessKey,
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      body: hasBody ? JSON.stringify(init.body) : null,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new CStorageError(null, `c-storage did not answer ${init.method} ${path}`, {
      cause: error,
    });
  }
}

const refused = (response: Response, what: string) =>
  new CStorageError(response.status, `c-storage answered ${response.status} to ${what}`);

const recordReplySchema = z.object({ record: z.object({ data: z.unknown(), tag: z.string() }) });

export type StoredRecord = { data: unknown; tag: string };

/** One service's records. Its keys belong to the instance, never to the process, so two clients
 * of two services (or a test's and the BFF's) never share a key. */
export type CStorageClient = {
  /** A record that is not there is null; the tag is the one to send back in `ifTag`. */
  getRecord(key: string): Promise<StoredRecord | null>;
  /** `ifTag` a string writes only over the record as that tag read it, null only where none
   * exists, undefined over whatever is there. A moved record is 'moved', not an error. */
  putRecord(key: string, data: unknown, ifTag?: string | null): Promise<'saved' | 'moved'>;
  removeRecord(key: string, ifTag?: string): Promise<'removed' | 'moved'>;
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
      const response = await send(connection, path, { method: 'GET', headers: keyed });
      if (response.status === 404) return null;
      if (response.status !== 200) throw refused(response, `GET ${path}`);
      const parsed = recordReplySchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success)
        throw new CStorageError(null, `c-storage sent a record in no known shape`);
      return parsed.data.record;
    },

    async putRecord(key, data, ifTag) {
      const response = await send(connection, base, {
        method: 'POST',
        headers: { ...keyed, ...preconditionHeaders(ifTag) },
        body: { key, data },
      });
      if (response.status === 201) return 'saved';
      if (response.status === 412) return 'moved';
      throw refused(response, `POST ${base}`);
    },

    async removeRecord(key, ifTag) {
      const path = `${base}/${encodeURIComponent(key)}`;
      const response = await send(connection, path, {
        method: 'DELETE',
        headers: { ...keyed, ...preconditionHeaders(ifTag) },
      });
      if (response.status === 204) return 'removed';
      if (response.status === 412) return 'moved';
      throw refused(response, `DELETE ${path}`);
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
  const path = '/api/services/register';
  const response = await send(connection, path, {
    method: 'POST',
    headers: { 'x-super-admin-key': connection.superAdminKey },
    body: service,
  });
  if (response.status === 201) return 'registered';
  if (response.status === 409) return 'exists';
  throw refused(response, `POST ${path}`);
}
