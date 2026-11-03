import {
  type AddCustomerRequest,
  type AddProductRequest,
  type AddEmployeeReply,
  addEmployeeReplySchema,
  type AddEmployeeRequest,
  type AddOperatorReply,
  addOperatorReplySchema,
  type AddOperatorRequest,
  AUTH_HEADER,
  type ClientListItem,
  clientListReplySchema,
  CLIENT_HEADER,
  type ChangeCodeRequest,
  type ConfigDoc,
  configDocSchema,
  type Customer,
  customerListReplySchema,
  type DeliverRequest,
  type DeliveryDoc,
  deliveryDocSchema,
  deliveryListReplySchema,
  type DeliveryPhotoReply,
  deliveryPhotoReplySchema,
  deliveryRoutes,
  type DeliveryRequest,
  type Driver,
  driverListReplySchema,
  type CancelRequest,
  type CloseDayRequest,
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
  type Order,
  type OrderDoc,
  orderDocSchema,
  orderListReplySchema,
  orderRoutes,
  type IssueQrReply,
  issueQrReplySchema,
  type JoinOptionsReply,
  joinOptionsReplySchema,
  type JoinRequest,
  type PhotoReply,
  photoReplySchema,
  type Product,
  productListReplySchema,
  type OperatorMeReply,
  type OperatorItem,
  operatorListReplySchema,
  operatorMeReplySchema,
  type OperatorSessionReply,
  operatorSessionReplySchema,
  bffErrorSchema,
  NO_RENEW_QUERY,
  type OptionsReply,
  optionsReplySchema,
  type ConfirmAct,
  type Confirmation,
  type PasskeyAddRequest,
  type PasskeyItem,
  passkeyListReplySchema,
  type PasskeySignInRequest,
  passkeyRoutes,
  type RootPasswordReply,
  rootPasswordReplySchema,
  rootPasswordRoute,
  type SetRootPasswordRequest,
  type Reconciliation,
  reconciliationListReplySchema,
  reconciliationRoutes,
  reconciliationSchema,
  ROUTES,
  type SaveEmployeeRequest,
  type SaveOrderRequest,
  type SendOrderRequest,
  type SavePhotoRequest,
  type SaveStaffSetupRequest,
  type ServicesReply,
  servicesReplySchema,
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
  /** `bff` is set where the answer came in the BFF's own error shape: the BFF answered, and the
   * status is its. A 503 of that shape is c-storage silent; the same status of any other shape
   * (the edge's own error) or no answer at all is the BFF not answering. */
  constructor(
    readonly status: number | null,
    readonly bff = false,
  ) {
    super(status === null ? 'no usable answer' : `answered ${status}`);
    this.name = 'ApiError';
  }
}

/** The hop a failure of the BFF's own calls names, since the session lives in c-storage: the BFF
 * answered and its storage did not (`storage`), or the BFF itself did not (`bff`). */
export type Hop = 'storage' | 'bff';

export function hopOf(error: unknown): Hop {
  return error instanceof ApiError && error.bff && error.status === 503 ? 'storage' : 'bff';
}

/** The one thing a reply is checked with: any zod schema fits. */
type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false } };

export type SaveResult = { kind: 'saved'; doc: ConfigDoc } | { kind: 'conflict' };

/** A client made, or the code was already taken: the answer 409 is not an error to the form. */
export type MakeResult = { kind: 'made'; client: CreateClientReply } | { kind: 'taken' };

/** An operator added, with the join link to send, or the name was already there: a 409 is a result. */
export type AddOperatorResult = ({ kind: 'made' } & AddOperatorReply) | { kind: 'taken' };

/** A passkey removed, with those left, or it was the operator's last: a 409 is a result. */
export type RemovePasskeyResult = { kind: 'removed'; passkeys: PasskeyItem[] } | { kind: 'last' };

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
/** An order saved, sent, confirmed or cancelled, or the version moved (or a step its state does not
 * allow): a conflict is a result, carrying the order as it is now when the answer held one. */
export type OrderResult =
  { kind: 'done'; doc: OrderDoc } | { kind: 'conflict'; current: OrderDoc | null };
/** A request cancelled or delivered, or the version moved (or a step its state does not allow). */
export type DeliveryResult =
  { kind: 'done'; doc: DeliveryDoc } | { kind: 'conflict'; current: DeliveryDoc | null };

/** A driver's day closed, or the day moved under the page (another set of requests, or closed
 * already): a 409 is a result, and the page reads the day again. */
export type CloseDayResult = { kind: 'closed'; reconciliation: Reconciliation } | { kind: 'moved' };

/** A staff setup or a person saved, or the version moved: a conflict is a result, not an error. */
export type SaveStaffSetupResult = { kind: 'saved'; doc: StaffSetupDoc } | { kind: 'conflict' };
export type SaveEmployeeResult = { kind: 'saved'; doc: EmployeeDoc } | { kind: 'conflict' };
export type ArchiveResult = { kind: 'archived'; doc: EmployeeDoc } | { kind: 'conflict' };

/** What a services check gives the page: the BFF's answer with the two times the page shows. The
 * BFF's is the round trip of the call, timed here; c-storage's is the BFF's own read of it. */
export type ServicesCheck = ServicesReply & { bffMs: number; checkedAt: number };

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
  /** The clock a services check is timed and stamped with. */
  now?: () => number;
};

/** The BFF's routes as the UI calls them. A client's calls carry its code and its handle; the
 * operator's carry the operator's handle and no code, since its routes never read one. */
export function createApi({
  deviceId,
  clientCode,
  authId,
  operatorAuthId,
  fetch: call = fetch,
  now = Date.now,
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

  /** A refusal of the calls whose failure names a hop: it keeps whether the BFF's own error shape
   * came back. */
  async function refused(response: Response) {
    const body: unknown = await response.json().catch(() => null);
    return new ApiError(response.status, bffErrorSchema.safeParse(body).success);
  }

  async function read<T>(response: Response, schema: Schema<T>) {
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new ApiError(null);
    return parsed.data;
  }

  /** The record a 409 carries as it is now, or null when the answer holds none the schema reads. */
  async function currentOf<T>(response: Response, schema: Schema<T>) {
    const body = (await response.json().catch(() => null)) as { current?: unknown } | null;
    const current = schema.safeParse(body?.current);
    return current.success ? current.data : null;
  }

  /** A write to an order: a 409 is a result and keeps the order as it is now. */
  async function orderWrite(method: string, path: string, body: unknown): Promise<OrderResult> {
    const response = await send(method, path, body);
    if (response.status === 409) {
      return { kind: 'conflict', current: await currentOf(response, orderDocSchema) };
    }
    if (!response.ok) throw new ApiError(response.status);
    return { kind: 'done', doc: await read(response, orderDocSchema) };
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

    /** The options a passkey sign-in starts from, with the token that binds their challenge. */
    async operatorPasskeyOptions(): Promise<OptionsReply> {
      const response = await send('POST', ROUTES.operatorPasskeyOptions, undefined, 'operator');
      if (!response.ok) throw await refused(response);
      return await read(response, optionsReplySchema);
    },

    /** A 401 means no operator here holds that passkey; it does not say which part failed. */
    async operatorPasskeySignIn(request: PasskeySignInRequest): Promise<OperatorSessionReply> {
      const response = await send('POST', ROUTES.operatorPasskeySignIn, request, 'operator');
      if (!response.ok) throw await refused(response);
      return await read(response, operatorSessionReplySchema);
    },

    /** Opens a join link: whose it is, who made it, and the options for its passkey. The token is
     * sent in the body; a 404 is a link used, old or replaced. */
    async operatorJoinOptions(link: string): Promise<JoinOptionsReply> {
      const response = await send('POST', ROUTES.operatorJoinOptions, { link }, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, joinOptionsReplySchema);
    },

    /** Makes the operator's first passkey, spends the link, and signs them in. */
    async operatorJoin(request: JoinRequest): Promise<OperatorSessionReply> {
      const response = await send('POST', ROUTES.operatorJoin, request, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, operatorSessionReplySchema);
    },

    async operatorSignOut() {
      const response = await send('POST', ROUTES.operatorSignOut, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
    },

    async operatorMe(): Promise<OperatorMeReply> {
      const response = await send('GET', ROUTES.operatorMe, undefined, 'operator');
      if (!response.ok) throw await refused(response);
      return await read(response, operatorMeReplySchema);
    },

    /** One check of the three services. The read is marked as no use of the sign-in, so a page
     * left open does not hold it open; the round trip and the moment are the page's. A 503 in the
     * BFF's own shape is c-storage silent, and any other failure is the BFF silent. */
    async operatorServices(): Promise<ServicesCheck> {
      const began = now();
      const response = await send(
        'GET',
        `${ROUTES.operatorServices}?${NO_RENEW_QUERY}`,
        undefined,
        'operator',
      );
      if (!response.ok) throw await refused(response);
      const reply = await read(response, servicesReplySchema);
      const ended = now();
      return { ...reply, bffMs: ended - began, checkedAt: ended };
    },

    /** The signed-in operator's own passkeys. */
    async operatorPasskeys(): Promise<PasskeyItem[]> {
      const response = await send('GET', ROUTES.operatorPasskeys, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, passkeyListReplySchema)).passkeys;
    },

    /** The options of the fresh touch an add or a remove needs, made for that act. */
    async operatorPasskeyConfirmOptions(act: ConfirmAct): Promise<OptionsReply> {
      const response = await send('POST', passkeyRoutes.confirmOptions, { act }, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, optionsReplySchema);
    },

    async operatorPasskeyAddOptions(): Promise<OptionsReply> {
      const response = await send('POST', passkeyRoutes.options, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, optionsReplySchema);
    },

    /** Adds a passkey beside the ones held; the answer is the list after it. */
    async operatorPasskeyAdd(request: PasskeyAddRequest): Promise<PasskeyItem[]> {
      const response = await send('POST', ROUTES.operatorPasskeys, request, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, passkeyListReplySchema)).passkeys;
    },

    /** The last passkey is never removed: that is a result the page words, not an error. */
    async operatorPasskeyRemove(id: string, confirm: Confirmation): Promise<RemovePasskeyResult> {
      const response = await send(
        'DELETE',
        passkeyRoutes.one(encodeURIComponent(id)),
        { confirm },
        'operator',
      );
      if (response.status === 409) return { kind: 'last' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'removed', passkeys: (await read(response, passkeyListReplySchema)).passkeys };
    },

    /** A code already taken is a result, not an error: the form says so and keeps what was typed. */
    async makeClient(code: string, name: string): Promise<MakeResult> {
      const response = await send('POST', ROUTES.operatorClients, { code, name }, 'operator');
      if (response.status === 409) return { kind: 'taken' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'made', client: await read(response, createClientReplySchema) };
    },

    /** Every operator who may sign in, the one added last first, as the operator is shown them. */
    async listOperators(): Promise<OperatorItem[]> {
      const response = await send('GET', ROUTES.operatorOperators, undefined, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, operatorListReplySchema)).operators;
    },

    /** An operator added by a name, with the operator's fresh touch: the join link, once. A name
     * already there is a result, not an error: the form says so and keeps what was typed. */
    async addOperator(request: AddOperatorRequest): Promise<AddOperatorResult> {
      const response = await send('POST', ROUTES.operatorOperators, request, 'operator');
      if (response.status === 409) return { kind: 'taken' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'made', ...(await read(response, addOperatorReplySchema)) };
    },

    /** A client's root password set anew, with the operator's fresh touch: the answer holds the
     * password the app made, or none for a typed one. */
    async setRootPassword(
      code: string,
      request: SetRootPasswordRequest,
    ): Promise<RootPasswordReply> {
      const response = await send('POST', rootPasswordRoute(code), request, 'operator');
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, rootPasswordReplySchema);
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

    /** The orders of the days `from` to `to` (at most a week), newest first. */
    async listOrders(from: string, to: string): Promise<Order[]> {
      const response = await send('GET', orderRoutes.list(from, to));
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, orderListReplySchema)).orders;
    },

    async getOrder(day: string, id: string): Promise<OrderDoc> {
      const response = await send('GET', orderRoutes.one(day, id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, orderDocSchema);
    },

    /** A first save: the BFF gives the order its number. */
    async createOrder(request: SaveOrderRequest): Promise<OrderDoc> {
      const response = await send('POST', ROUTES.orders, request);
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, orderDocSchema);
    },

    /** A draft saved again over the version read. */
    async saveOrder(day: string, id: string, request: SaveOrderRequest): Promise<OrderResult> {
      return await orderWrite('PUT', orderRoutes.one(day, id), request);
    },

    /** A draft confirmed with its driver and day: the order and its request are made together. */
    async confirmOrder(day: string, id: string, request: SendOrderRequest): Promise<OrderResult> {
      return await orderWrite('POST', orderRoutes.confirm(day, id), request);
    },

    /** A confirmed order whose request was cancelled, sent again as a new request. */
    async sendOrder(day: string, id: string, request: SendOrderRequest): Promise<OrderResult> {
      return await orderWrite('POST', orderRoutes.send(day, id), request);
    },

    async cancelOrder(day: string, id: string, request: CancelRequest): Promise<OrderResult> {
      return await orderWrite('POST', orderRoutes.cancel(day, id), request);
    },

    /** The requests of one day. */
    async listDeliveries(day: string): Promise<DeliveryRequest[]> {
      const response = await send('GET', deliveryRoutes.list(day));
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, deliveryListReplySchema)).deliveries;
    },

    async getDelivery(day: string, id: string): Promise<DeliveryDoc> {
      const response = await send('GET', deliveryRoutes.one(day, id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, deliveryDocSchema);
    },

    async cancelDelivery(day: string, id: string, request: CancelRequest): Promise<DeliveryResult> {
      const response = await send('POST', deliveryRoutes.cancel(day, id), request);
      if (response.status === 409) {
        return { kind: 'conflict', current: await currentOf(response, deliveryDocSchema) };
      }
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'done', doc: await read(response, deliveryDocSchema) };
    },

    /** The signed-in driver's own requests of one day. */
    async myDeliveries(day: string): Promise<DeliveryRequest[]> {
      const response = await send('GET', deliveryRoutes.mine(day));
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, deliveryListReplySchema)).deliveries;
    },

    /** A request marked delivered with its photo, by its own driver; a 409 carries it as it is now. */
    async deliver(day: string, id: string, request: DeliverRequest): Promise<DeliveryResult> {
      const response = await send('POST', deliveryRoutes.deliver(day, id), request);
      if (response.status === 409) {
        return { kind: 'conflict', current: await currentOf(response, deliveryDocSchema) };
      }
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'done', doc: await read(response, deliveryDocSchema) };
    },

    /** A delivered request's photo. */
    async getDeliveryPhoto(day: string, id: string): Promise<DeliveryPhotoReply> {
      const response = await send('GET', deliveryRoutes.photo(day, id));
      if (!response.ok) throw new ApiError(response.status);
      return await read(response, deliveryPhotoReplySchema);
    },

    /** The drivers' days closed on one day. */
    async listReconciliations(day: string): Promise<Reconciliation[]> {
      const response = await send('GET', reconciliationRoutes.list(day));
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, reconciliationListReplySchema)).reconciliations;
    },

    /** A driver's day closed with the requests the page showed and the cash handed in. */
    async closeDay(
      day: string,
      driverId: string,
      request: CloseDayRequest,
    ): Promise<CloseDayResult> {
      const response = await send('POST', reconciliationRoutes.close(day, driverId), request);
      if (response.status === 409) return { kind: 'moved' };
      if (!response.ok) throw new ApiError(response.status);
      return { kind: 'closed', reconciliation: await read(response, reconciliationSchema) };
    },

    /** The people the office may name as a driver: active, and allowed to deliver. */
    async listDrivers(): Promise<Driver[]> {
      const response = await send('GET', ROUTES.drivers);
      if (!response.ok) throw new ApiError(response.status);
      return (await read(response, driverListReplySchema)).drivers;
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
