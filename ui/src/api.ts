import {
  AUTH_HEADER,
  type ConfigDoc,
  configDocSchema,
  DEVICE_HEADER,
  HASH_HEADER,
  meReplySchema,
  ROUTES,
  type SessionReply,
  sessionReplySchema,
  sha256Hex,
  type TenantConfig,
  type MeReply,
} from '@credo/shared';

/** A call that did not give the answer its route promises. `status` is the HTTP status, or null
 * when no answer came or it was not the shape promised. Only a 401 means "signed out". */
export class ApiError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? 'no usable answer' : `answered ${status}`);
    this.name = 'ApiError';
  }
}

/** The one thing a reply is checked with: any zod schema fits. */
type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false } };

export type SaveResult = { kind: 'saved'; doc: ConfigDoc } | { kind: 'conflict' };

type Options = {
  /** The device id this device minted once. */
  deviceId: string;
  /** The session handle now held, or null. */
  authId: () => string | null;
  fetch?: typeof fetch;
};

/** The BFF's routes as the UI calls them. Every write carries its body's SHA-256, as CloudFront
 * requires; the local front refuses a write without it. */
export function createApi({ deviceId, authId, fetch: call = fetch }: Options) {
  async function send(method: string, path: string, body?: unknown) {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const handle = authId();
    const headers: Record<string, string> = {
      [DEVICE_HEADER]: deviceId,
      ...(handle ? { [AUTH_HEADER]: handle } : {}),
      ...(text === undefined ? {} : { 'content-type': 'application/json' }),
      ...(method === 'GET' ? {} : { [HASH_HEADER]: await sha256Hex(text ?? '') }),
    };
    try {
      return await call(path, { method, headers, body: text ?? null });
    } catch {
      throw new ApiError(null);
    }
  }

  async function read<T>(response: Response, schema: Schema<T>) {
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new ApiError(null);
    return parsed.data;
  }

  return {
    async getConfig(): Promise<ConfigDoc> {
      const response = await send('GET', ROUTES.config);
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, configDocSchema);
    },

    async signIn(name: string, password: string): Promise<SessionReply> {
      const response = await send('POST', ROUTES.signIn, { name, password });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, sessionReplySchema);
    },

    async signOut() {
      const response = await send('POST', ROUTES.signOut);
      if (!response.ok) throw new ApiError(response.status);
    },

    async me(): Promise<MeReply> {
      const response = await send('GET', ROUTES.me);
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, meReplySchema);
    },

    /** `version` is the one the settings were read at; a moved one is a conflict, not an error. */
    async saveConfig(config: TenantConfig, version: string): Promise<SaveResult> {
      const response = await send('PUT', ROUTES.config, { config, version });
      if (response.status === 409) return { kind: 'conflict' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'saved', doc: await read(response, configDocSchema) };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
