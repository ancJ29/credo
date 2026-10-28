import {
  AUTH_HEADER,
  CLIENT_HEADER,
  type ConfigDoc,
  configDocSchema,
  type CreateClientReply,
  createClientReplySchema,
  DEVICE_HEADER,
  meReplySchema,
  type MeReply,
  type OperatorMeReply,
  operatorMeReplySchema,
  type OperatorSessionReply,
  operatorSessionReplySchema,
  ROUTES,
  type SessionReply,
  sessionReplySchema,
  type TenantConfig,
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

/** A client made, or the code was already taken: the answer 409 is not an error to the form. */
export type MakeResult = { kind: 'made'; client: CreateClientReply } | { kind: 'taken' };

type Options = {
  /** The device id this device minted once. */
  deviceId: string;
  /** The client this device is linked to, or null. Sent on every call of a client's. */
  clientCode: () => string | null;
  /** The client's session handle now held, or null. */
  authId: () => string | null;
  /** The operator's own handle now held, or null. */
  operatorAuthId: () => string | null;
  fetch?: typeof fetch;
};

/** The BFF's routes as the UI calls them. A client's calls carry its code and its handle; the
 * operator's carry the operator's handle and no code, since its routes never read one. */
export function createApi({
  deviceId,
  clientCode,
  authId,
  operatorAuthId,
  fetch: call = fetch,
}: Options) {
  async function send(
    method: string,
    path: string,
    body?: unknown,
    as: 'client' | 'operator' = 'client',
  ) {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const code = as === 'client' ? clientCode() : null;
    const handle = as === 'client' ? authId() : operatorAuthId();
    const headers: Record<string, string> = {
      [DEVICE_HEADER]: deviceId,
      ...(code ? { [CLIENT_HEADER]: code } : {}),
      ...(handle ? { [AUTH_HEADER]: handle } : {}),
      ...(text === undefined ? {} : { 'content-type': 'application/json' }),
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

    async operatorSignIn(name: string, password: string): Promise<OperatorSessionReply> {
      const response = await send('POST', ROUTES.operatorSignIn, { name, password }, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, operatorSessionReplySchema);
    },

    async operatorSignOut() {
      const response = await send('POST', ROUTES.operatorSignOut, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
    },

    async operatorMe(): Promise<OperatorMeReply> {
      const response = await send('GET', ROUTES.operatorMe, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, operatorMeReplySchema);
    },

    /** A code already taken is a result, not an error: the form says so and keeps what was typed. */
    async makeClient(code: string, name: string): Promise<MakeResult> {
      const response = await send('POST', ROUTES.operatorClients, { code, name }, 'operator');
      if (response.status === 409) return { kind: 'taken' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'made', client: await read(response, createClientReplySchema) };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
