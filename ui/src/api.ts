import {
  type AddCustomerRequest,
  type AddProductRequest,
  type AddEmployeeReply,
  addEmployeeReplySchema,
  type AddEmployeeRequest,
  AUTH_HEADER,
  type ClientListItem,
  clientListReplySchema,
  CLIENT_HEADER,
  type ChangeCodeRequest,
  type ConfigDoc,
  configDocSchema,
  type Customer,
  customerListReplySchema,
  type CreateClientReply,
  createClientReplySchema,
  DEVICE_HEADER,
  type Employee,
  type EmployeeDoc,
  employeeDocSchema,
  employeeListReplySchema,
  employeeRoutes,
  IMPORT_ROUTE,
  type ImportCustomersReply,
  importCustomersReplySchema,
  type ImportEmployeesReply,
  importEmployeesReplySchema,
  type ImportProductsReply,
  importProductsReplySchema,
  listImportRoute,
  meReplySchema,
  type MeReply,
  type IssueQrReply,
  issueQrReplySchema,
  type PhotoReply,
  photoReplySchema,
  type Product,
  productListReplySchema,
  type OperatorMeReply,
  operatorMeReplySchema,
  type OperatorSessionReply,
  operatorSessionReplySchema,
  ROUTES,
  type SaveEmployeeRequest,
  type SavePhotoRequest,
  type SaveStaffSetupRequest,
  type SessionReply,
  sessionReplySchema,
  type SetEmailRequest,
  signInRoutes,
  type SetPasswordReply,
  setPasswordReplySchema,
  type StaffSetupDoc,
  staffSetupDocSchema,
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

/** A person added, or the code was already taken: the answer 409 is not an error to the form. */
export type AddResult = { kind: 'added'; reply: AddEmployeeReply } | { kind: 'taken' };

/** A person as the add form gives them: a code left out asks for the next number. */
export type NewPerson = Omit<AddEmployeeRequest, 'code'> & { code?: string };

/** A new code given, or one already taken, or the version moved: none is an error to the form. */
export type ChangeCodeResult =
  { kind: 'changed'; doc: EmployeeDoc } | { kind: 'taken' } | { kind: 'conflict' };

/** An email given or removed, or one already signing someone in, or the version moved. */
export type SetEmailResult =
  { kind: 'set'; doc: EmployeeDoc } | { kind: 'taken' } | { kind: 'conflict' };

/** One's own password changed, with the session that replaces every other; or the current one wrong. */
export type ChangePasswordResult = { kind: 'changed'; session: SessionReply } | { kind: 'wrong' };

/** A photo saved, or the version moved. */
/** A conflict carries the photo as it is now, when the answer held one the shared schema reads. */
export type SavePhotoResult =
  { kind: 'saved'; reply: PhotoReply } | { kind: 'conflict'; current: PhotoReply | null };

/** A staff setup or a person saved, or the version moved: a conflict is a result, not an error. */
export type SaveStaffSetupResult = { kind: 'saved'; doc: StaffSetupDoc } | { kind: 'conflict' };
export type SaveEmployeeResult = { kind: 'saved'; doc: EmployeeDoc } | { kind: 'conflict' };
export type ArchiveResult = { kind: 'archived'; doc: EmployeeDoc } | { kind: 'conflict' };

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

    /** Every client on this stack, newest first, as the operator is shown them. */
    async listClients(): Promise<ClientListItem[]> {
      const response = await send('GET', ROUTES.operatorClients, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, clientListReplySchema)).clients;
    },

    async getStaffSetup(): Promise<StaffSetupDoc> {
      const response = await send('GET', ROUTES.staffSetup);
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, staffSetupDocSchema);
    },

    async saveStaffSetup(
      setup: SaveStaffSetupRequest['setup'],
      version: string,
    ): Promise<SaveStaffSetupResult> {
      const response = await send('PUT', ROUTES.staffSetup, { setup, version });
      if (response.status === 409) return { kind: 'conflict' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'saved', doc: await read(response, staffSetupDocSchema) };
    },

    async listEmployees(): Promise<Employee[]> {
      const response = await send('GET', ROUTES.employees);
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, employeeListReplySchema)).employees;
    },

    async getEmployee(id: string): Promise<EmployeeDoc> {
      const response = await send('GET', employeeRoutes.one(id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, employeeDocSchema);
    },

    /** A code already taken is a result: the form says so and keeps what was typed. */
    async addEmployee(request: NewPerson): Promise<AddResult> {
      const response = await send('POST', ROUTES.employees, request);
      if (response.status === 409) return { kind: 'taken' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'added', reply: await read(response, addEmployeeReplySchema) };
    },

    /** The root's: up to a call's rows, each added as one add by hand but without a sign-in. One
     * result for each row, in order; a refused row is a result, not an error. */
    async importEmployees(rows: AddEmployeeRequest[]): Promise<ImportEmployeesReply> {
      const response = await send('POST', IMPORT_ROUTE, { rows });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, importEmployeesReplySchema);
    },

    /** The root's: every customer of the company, in code order. */
    async listCustomers(): Promise<Customer[]> {
      const response = await send('GET', ROUTES.customers);
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, customerListReplySchema)).customers;
    },

    /** The root's: every product of the company, in code order. */
    async listProducts(): Promise<Product[]> {
      const response = await send('GET', ROUTES.products);
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, productListReplySchema)).products;
    },

    /** The root's: up to a call's rows, one result for each in order; a refused row is a result,
     * not an error. */
    async importCustomers(rows: AddCustomerRequest[]): Promise<ImportCustomersReply> {
      const response = await send('POST', listImportRoute('customers'), { rows });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, importCustomersReplySchema);
    },

    /** The root's, as the customers' import is. */
    async importProducts(rows: AddProductRequest[]): Promise<ImportProductsReply> {
      const response = await send('POST', listImportRoute('products'), { rows });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, importProductsReplySchema);
    },

    async saveEmployee(id: string, request: SaveEmployeeRequest): Promise<SaveEmployeeResult> {
      const response = await send('PUT', employeeRoutes.one(id), request);
      if (response.status === 409) return { kind: 'conflict' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'saved', doc: await read(response, employeeDocSchema) };
    },

    /** The root's: `null` asks the BFF to make one. The answer is the password, shown once. */
    async setPassword(id: string, password: string | null): Promise<SetPasswordReply> {
      const response = await send('PUT', employeeRoutes.password(id), { password });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, setPasswordReplySchema);
    },

    /** The root's. A 409 that carries the newer person is a moved version, any other is a code
     * already taken. */
    async changeCode(id: string, request: ChangeCodeRequest): Promise<ChangeCodeResult> {
      const response = await send('PUT', employeeRoutes.code(id), request);
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as object | null;
        return body !== null && 'current' in body ? { kind: 'conflict' } : { kind: 'taken' };
      }
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'changed', doc: await read(response, employeeDocSchema) };
    },

    /** The root's. A 409 that carries the newer person is a moved version, any other is an email
     * already signing someone in. No mail is sent whatever the answer. */
    async setEmail(id: string, request: SetEmailRequest): Promise<SetEmailResult> {
      const response = await send('PUT', signInRoutes.email(id), request);
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as object | null;
        return body !== null && 'current' in body ? { kind: 'conflict' } : { kind: 'taken' };
      }
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'set', doc: await read(response, employeeDocSchema) };
    },

    /** The root's: a QR code for one sign-in, which cancels the last. */
    async issueQr(id: string): Promise<IssueQrReply> {
      const response = await send('POST', signInRoutes.issueQr(id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, issueQrReplySchema);
    },

    /** A phone opening a QR code's link: a 401 is a code used before, or past its time. */
    async signInQr(id: string, secret: string): Promise<SessionReply> {
      const response = await send('POST', signInRoutes.qr, { id, secret });
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, sessionReplySchema);
    },

    /** One's own: the current password first. A 403 is a current one that is wrong; the answer
     * holds the session that replaces the one held, since every other is signed out. */
    async changePassword(current: string, password: string): Promise<ChangePasswordResult> {
      const response = await send('PUT', signInRoutes.password, { current, password });
      if (response.status === 403) return { kind: 'wrong' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'changed', session: await read(response, sessionReplySchema) };
    },

    async getPhoto(id: string): Promise<PhotoReply> {
      const response = await send('GET', employeeRoutes.photo(id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, photoReplySchema);
    },

    async savePhoto(id: string, request: SavePhotoRequest): Promise<SavePhotoResult> {
      const response = await send('PUT', employeeRoutes.photo(id), request);
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as { current?: unknown } | null;
        const current = photoReplySchema.safeParse(body?.current);
        return { kind: 'conflict', current: current.success ? current.data : null };
      }
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'saved', reply: await read(response, photoReplySchema) };
    },

    async archiveEmployee(id: string, version: string): Promise<ArchiveResult> {
      const response = await send('POST', employeeRoutes.archive(id), { version });
      if (response.status === 409) return { kind: 'conflict' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'archived', doc: await read(response, employeeDocSchema) };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
