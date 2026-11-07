import {
  addCustomerRequestSchema,
  addDays,
  addedNewestFirst,
  addOperatorRequestSchema,
  deleteClientRequestSchema,
  deleteOperatorRequestSchema,
  operatorLinkRequestSchema,
  addProductRequestSchema,
  byCode,
  can,
  type CancelRequest,
  type ClientListItem,
  type CloseDayRequest,
  customerSchema,
  clientLinkPath,
  joinLinkPath,
  driverDay,
  type DeliveryRequest,
  deliveryRequestSchema,
  type Customer,
  type CustomerDoc,
  type Driver,
  type Employee,
  type EmployeeDoc,
  gapOf,
  handedInSchema,
  type ImportResult,
  keptSetupParts,
  layersOf,
  newestFirst,
  type OperatorItem,
  sameOperatorName,
  newestOrdersFirst,
  nextCode,
  numberText,
  type Order,
  ORDER_LIST_DAYS,
  ORDER_PREFIX,
  orderSchema,
  type PermissionId,
  type PhotoReply,
  priceLines,
  proofIsValid,
  normaliseEmployeeCode,
  normaliseSignInName,
  passwordIsValid,
  type Product,
  type ProductDoc,
  productSchema,
  QR_MINUTES,
  qrLink,
  type Reconciliation,
  reconciliationSchema,
  REQUEST_PREFIX,
  resolvePermissions,
  sameIds,
  type SaveOrderRequest,
  type SendOrderRequest,
  sendableOn,
  setRootPasswordRequestSchema,
  staffConfig,
  type StaffSetup,
  type TenantConfig,
  type UserView,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_DRIVER_QR_SECRET,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TODAY,
  DEMO_WALK_PROOF,
  DEMO_QR_SECRET,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_OPERATOR_ID,
  DEMO_PASSKEYS,
  DEMO_PHOTOS,
  DEMO_RECONCILIATIONS,
  DEMO_ROOT_NAME,
  DEMO_SERVICES,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
  DEMO_TEAM,
} from '@credo/shared/demo';
import {
  type Api,
  ApiError,
  type ChangePasswordResult,
  type CloseDayResult,
  type DeliveryResult,
  type OrderResult,
} from './api';
import { createDeviceStore } from './device';
import { type Passkeys, PasskeyAlreadyHere, PasskeyNotGiven } from './passkeys';

/** The statuses the address may ask the fake to answer, once. */
const STATUSES = [401, 403, 404, 409, 503] as const;
type Status = (typeof STATUSES)[number];

/** What the authenticator may be asked to answer instead of a passkey: it was not given. */
const NOT_GIVEN = 'notGiven';

/** What a call may be asked to do instead of an answer: nothing at all, as when the BFF is down. */
const SILENT = 'silent';

/** One call and the status it answers once: `?cue=saveConfig:409`. The authenticator's is
 * `passkey:notGiven`, and `operatorServices:silent` is a call nothing answers. */
export type Cue = { call: string; status: Status | typeof NOT_GIVEN | typeof SILENT };

/** The cue an address names, or null for none or one the fake does not know. */
export function parseCue(raw: string | null): Cue | null {
  const [call, status] = (raw ?? '').split(':');
  const found = ([...STATUSES, NOT_GIVEN, SILENT] as const).find(
    (known) => String(known) === status,
  );
  return call && found ? { call, status: found } : null;
}

const OPTIONS = { options: { challenge: 'fake-challenge' }, token: 'fake.token' };
const DEMO_OPERATOR = { id: DEMO_OPERATOR_ID, name: OPERATOR_NAME };
const INVITED_OPERATOR = { id: '00000000-0000-4000-8000-000000000202', name: DEMO_INVITED_NAME };

/** The credential the fake authenticator answers every ceremony with. */
const CREDENTIAL = {
  id: 'fake-credential',
  rawId: 'fake-credential',
  type: 'public-key' as const,
  response: {},
  clientExtensionResults: {},
};

/** The fake device, which a test may tell what it already holds, as a real one holds the passkeys
 * made on it. */
export type FakePasskeys = Passkeys & {
  /** The device now holds the credential with this id. */
  hold: (id: string) => void;
};

/** The device's passkeys, faked: each ceremony answers a fixed credential after a tick, as the
 * device would after a touch. The cue `passkey:notGiven` makes the first one not given. A device
 * that holds a credential the options exclude refuses a registration as a real one does, with
 * "already here"; a fake device holds none until a test says so. */
export function createFakePasskeys({ cue }: { cue: Cue | null }): FakePasskeys {
  let notGiven = cue?.call === 'passkey' && cue.status === NOT_GIVEN;
  const held = new Set<string>();
  const tick = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (notGiven) {
      notGiven = false;
      throw new PasskeyNotGiven();
    }
    return CREDENTIAL;
  };
  return {
    register: async (options) => {
      const excluded = Array.isArray(options.excludeCredentials) ? options.excludeCredentials : [];
      if (excluded.some((credential: { id?: unknown }) => held.has(String(credential.id)))) {
        // What the browser's own refusal (`InvalidStateError`) is read as.
        throw new PasskeyAlreadyHere();
      }
      return await tick();
    },
    authenticate: tick,
    hold: (id) => void held.add(id),
  };
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** The handle of the operator who joined by the data set's link, apart from the data set's own. */
const JOINED_HANDLE = 'fake.operator.joined';
const ROOT: UserView = { name: DEMO_ROOT_NAME, root: true, permissions: {} };
/** The password every fake sign-in hands out, since none is ever checked. */
const MADE_PASSWORD = 'Fake-password-1!';
/** A staff member's handle is this and their id; the root's is the bare prefix. */
const STAFF_HANDLE = 'fake.session.';

type Options = {
  /** Where the fake finds out whether this device holds a handle. */
  device: Pick<ReturnType<typeof createDeviceStore>, 'authId' | 'operatorAuthId'>;
  cue: Cue | null;
  /** The company has turned on sign-in by email and by QR code, which the data set leaves off. */
  signIns?: boolean;
  /** A deploy half done: c-storage runs the newer build the others have not reached. */
  drift?: boolean;
  /** No one is allowed to deliver yet: the data set's drivers' departments lack the right. */
  noDrivers?: boolean;
};

/**
 * The `Api` over the demo data set, held in memory and seeded afresh at each load: the same
 * methods, the same answers' shapes, no network. Any password signs the data set's root in. A
 * cue makes the call it names answer one status once, then the fake goes on from the data set.
 */
export function createFakeApi({
  device,
  cue,
  signIns = false,
  drift = false,
  noDrivers = false,
}: Options): Api {
  let config: TenantConfig = structuredClone(DEMO_CONFIG);
  let version = 1;
  let pending = cue;
  let setup: StaffSetup = structuredClone(DEMO_STAFF_SETUP);
  if (signIns) setup.fields = { ...staffConfig(setup).fields, email: true, qr: true };
  if (noDrivers) {
    setup.departments = setup.departments.map(({ permissions, ...rest }) => ({
      ...rest,
      permissions: { ...permissions, 'deliveries.canDeliver': false },
    }));
  }
  let setupVersion = 1;
  const people = new Map<string, Employee>(
    DEMO_EMPLOYEES.map((person) => [person.id, structuredClone(person)]),
  );
  const versions = new Map<string, number>(DEMO_EMPLOYEES.map((person) => [person.id, 1]));
  /** Each person's photo and the version it is at; a person with none is not here. */
  const photos = new Map(
    Object.entries(DEMO_PHOTOS).map(([owner, photo]) => [owner, { photo, version: 1 }]),
  );
  /** Who holds a password: the data set's people but one, and each one given a password since. */
  const ready = new Set(
    DEMO_EMPLOYEES.filter((person) => person.code !== 'EMP-0007').map((p) => p.id),
  );
  /** The company's customers and products, read through the shared schemas as the BFF reads its
   * records, by minted id. */
  const customers = new Map(DEMO_CUSTOMERS.map((one) => [one.id, customerSchema.parse(one)]));
  const products = new Map(DEMO_PRODUCTS.map((one) => [one.id, productSchema.parse(one)]));
  /** The version each customer is at, moved by a save. */
  const customerVersions = new Map(DEMO_CUSTOMERS.map((one) => [one.id, 1]));
  /** The version each product is at, moved by a save. */
  const productVersions = new Map(DEMO_PRODUCTS.map((one) => [one.id, 1]));
  /** The week of orders and requests, each at the version it is at, and the last number given. */
  const orders = new Map(DEMO_ORDERS.map((one) => [one.id, orderSchema.parse(one)]));
  const requests = new Map(
    DEMO_DELIVERIES.map((one) => [one.id, deliveryRequestSchema.parse(one)]),
  );
  const orderVersions = new Map(DEMO_ORDERS.map((one) => [one.id, 1]));
  const requestVersions = new Map(DEMO_DELIVERIES.map((one) => [one.id, 1]));
  /** Each delivered request's photo, by the request's id; the data set's, then any sent since. */
  const proofs = new Map(Object.entries(DEMO_DELIVERY_PHOTOS));
  /** The drivers' days closed, by the day and the driver; the data set's past days, then any closed since. */
  const closed = new Map(
    DEMO_RECONCILIATIONS.map((one) => [
      `${one.day}.${one.driver.id}`,
      reconciliationSchema.parse(one),
    ]),
  );
  let lastOrder = DEMO_ORDERS.length;
  let lastRequest = DEMO_DELIVERIES.length;
  /** How many QR codes have been minted: each one's secret is its number. */
  let minted = 0;
  /** The QR code each person was last shown, by the secret it signs in with; spending one removes it.
   * The data set holds two, a warehouse member's and the driver's, for the phone's walks. */
  const qrs = new Map<string, string>([
    [DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!.id, DEMO_QR_SECRET],
    [DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0005')!.id, DEMO_DRIVER_QR_SECRET],
  ]);

  /** Runs `answer`, unless the cue names `call` and has not fired: then its status instead, as
   * the real call's own answer for it, or as the error every other call raises. */
  async function call<T>(
    name: string,
    answer: () => T | Promise<T>,
    onConflict?: () => T,
    onForbidden?: () => T,
  ) {
    if (pending?.call === name && pending.status !== NOT_GIVEN) {
      const { status } = pending;
      pending = null;
      // Nothing answers: the request failed, or the edge's own error came back.
      if (status === SILENT) throw new ApiError(null);
      if (status === 409 && onConflict) return onConflict();
      if (status === 403 && onForbidden) return onForbidden();
      // The fake's BFF answered, in its own error shape.
      throw new ApiError(status, true);
    }
    return await answer();
  }

  /** Every client the operator's list shows: the data set's, then any made since the page loaded. */
  const clients = new Map<string, ClientListItem>(
    DEMO_CLIENTS.map((client) => [client.code, { ...client, link: clientLinkPath(client.code) }]),
  );

  /** The operator's own passkeys, and whether the data set's join link has been used. */
  let passkeys = DEMO_PASSKEYS.map((passkey) => ({ ...passkey }));
  let added = 0;
  let joined = false;
  /** The operators the roster shows: the data set's, then any added since the page loaded. */
  let team: Omit<OperatorItem, 'you'>[] = DEMO_TEAM.map((one) => ({ ...one }));
  let addedOperators = 0;
  let addedLinks = 0;

  const signedOut = () => new ApiError(401);
  const notFound = () => new ApiError(404);

  /** What a staff member may do, resolved as the BFF resolves it: department, position, person. */
  const staffUser = (person: Employee): UserView => {
    return {
      name: person.name,
      root: false,
      permissions: resolvePermissions(
        layersOf(setup, {
          departmentId: person.department?.id,
          positionId: person.position?.id,
          own: person.permissions,
        }),
      ),
    };
  };
  /** Who the device's handle names, the root when it names none of the data set's people. */
  const signedInUser = (handle: string): UserView => {
    const person = people.get(handle.slice(STAFF_HANDLE.length));
    return handle.startsWith(STAFF_HANDLE) && person ? staffUser(person) : ROOT;
  };
  const isRoot = () => !device.authId()?.startsWith(STAFF_HANDLE);
  /** The imports are the root's alone, as the BFF checks. */
  const rootOnly = () => {
    if (!isRoot()) throw new ApiError(403);
  };
  /** Whoever the permission lets, as the BFF checks it on every call. */
  const mayOnly = (id: PermissionId) => {
    if (!isRoot() && !can(signedInUser(device.authId()!), id)) throw new ApiError(403);
  };
  /** The signed-in driver: a staff member whom their layers allow to deliver, never the root (it
   * holds no employee, and no request names it). */
  const mayDeliver = () => {
    mayOnly('deliveries.canDeliver');
    if (isRoot()) throw new ApiError(403);
    return person(device.authId()!.slice(STAFF_HANDLE.length));
  };
  /** The people the office may name as a driver: not left, and allowed to deliver by their layers. */
  const driversNow = (): Driver[] =>
    [...people.values()]
      .filter((one) => !one.archived && staffUser(one).permissions['deliveries.canDeliver'])
      .map(({ id, code, name }) => ({ id, code, name }))
      .sort(byCode);
  /** A request its reader may see: the office (who may see orders), or the request's own driver. */
  const readable = (day: string, id: string) => {
    const office = isRoot() || can(signedInUser(device.authId()!), 'orders.canView');
    // Anyone but the office must be allowed to deliver before the request is looked for.
    const driver = office ? null : mayDeliver();
    const found = requestAt(day, id);
    if (driver && found.driver.id !== driver.id) throw new ApiError(403);
    return found;
  };
  const orderAt = (day: string, id: string) => {
    const found = orders.get(id);
    if (!found || found.day !== day) throw notFound();
    return found;
  };
  const requestAt = (day: string, id: string) => {
    const found = requests.get(id);
    if (!found || found.day !== day) throw notFound();
    return found;
  };
  const orderDoc = (found: Order) => ({
    order: structuredClone(found),
    version: `o${orderVersions.get(found.id)}`,
  });
  const requestDoc = (found: DeliveryRequest) => ({
    request: structuredClone(found),
    version: `g${requestVersions.get(found.id)}`,
  });
  /** An order whose request was delivered: its cancel is refused. */
  const deliveredOf = (found: Order) =>
    found.request !== null && requests.get(found.request.id)!.state === 'delivered';
  const orderMoved = (found: Order) => {
    orderVersions.set(found.id, (orderVersions.get(found.id) as number) + 1);
    return { kind: 'done' as const, doc: orderDoc(found) };
  };
  const requestMoved = (found: DeliveryRequest) => {
    requestVersions.set(found.id, (requestVersions.get(found.id) as number) + 1);
  };
  /** A waiting request cancelled, then its order freed of it, as the BFF writes them. */
  const cancelRequest = (found: DeliveryRequest) => {
    found.state = 'cancelled';
    requestMoved(found);
    const order = orders.get(found.order.id)!;
    order.request = null;
    orderMoved(order);
  };
  /** A waiting request marked delivered with its photo; its order is fulfilled with it. */
  const deliverRequest = (found: DeliveryRequest, photo: string) => {
    proofs.set(found.id, photo);
    found.state = 'delivered';
    found.deliveredAt = Date.now();
    requestMoved(found);
    // A waiting request's order is confirmed and names it, so the order is fulfilled with it.
    const order = orders.get(found.order.id)!;
    order.state = 'fulfilled';
    orderMoved(order);
  };
  /** A save's customer and lines as the BFF prices them: a customer or a product the lists lack
   * is a 400. */
  const priced = (request: SaveOrderRequest) => {
    const customer = customers.get(request.customerId);
    const lines = priceLines(request.lines, [...products.values()]);
    if (!customer || lines.kind !== 'priced') throw new ApiError(400);
    return { customer: structuredClone(customer), lines: lines.lines, total: lines.total };
  };
  /** A write that finds its order moved, or in a state the step does not allow, answers the order
   * as it is. */
  const orderStale = (found: Order, version: string | undefined, allowed: boolean) =>
    version !== `o${orderVersions.get(found.id)}` || !allowed
      ? { kind: 'conflict' as const, current: orderDoc(found) }
      : null;
  /** The office's cancel of an order: its request is cancelled first, then the order, as the BFF
   * writes them. */
  const withdraw = (found: Order): OrderResult => {
    const live = found.request && requests.get(found.request.id);
    if (live) {
      live.state = 'cancelled';
      requestMoved(live);
    }
    found.state = 'cancelled';
    found.request = null;
    return orderMoved(found);
  };
  /** Confirming a draft and sending a confirmed order again make a request the same way. */
  const issue = (
    day: string,
    id: string,
    request: SendOrderRequest,
    confirming: boolean,
  ): OrderResult => {
    mayOnly('orders.canEdit');
    const found = orderAt(day, id);
    const stale = orderStale(
      found,
      request.version,
      confirming ? found.state === 'draft' : found.state === 'confirmed' && found.request === null,
    );
    if (stale) return stale;
    const driver = driversNow().find((one) => one.id === request.driverId);
    if (!driver || !sendableOn(found.day, request.day)) throw new ApiError(400);
    // A driver whose day is closed is sent nothing more for it.
    if (closed.has(`${request.day}.${driver.id}`)) throw new ApiError(400);
    lastRequest += 1;
    const made: DeliveryRequest = {
      id: crypto.randomUUID(),
      number: numberText(REQUEST_PREFIX, lastRequest),
      day: request.day,
      state: 'waiting',
      driver,
      order: { id: found.id, day: found.day, number: found.number },
      customer: structuredClone(found.customer),
      lines: structuredClone(found.lines),
      total: found.total,
      madeAt: Date.now(),
      extra: {},
    };
    requests.set(made.id, made);
    requestVersions.set(made.id, 1);
    found.state = 'confirmed';
    found.request = { id: made.id, number: made.number, day: made.day, driver };
    return orderMoved(found);
  };
  /** A driver's day closed as the BFF closes it: the cash is whole đồng, the request has to name
   * the day as it is, and those still waiting are cancelled before the closed day is written. */
  const closeDay = (day: string, driverId: string, request: CloseDayRequest): CloseDayResult => {
    mayOnly('orders.canEdit');
    const asked = [...requests.values()].filter((one) => one.day === day);
    const driver = asked.find((one) => one.driver.id === driverId)?.driver;
    if (!driver) throw notFound();
    if (!handedInSchema.safeParse(request.handedIn).success) throw new ApiError(400);
    const key = `${day}.${driverId}`;
    const now = driverDay(asked, driverId);
    if (
      closed.has(key) ||
      !sameIds(
        request.delivered,
        now.delivered.map((one) => one.id),
      ) ||
      !sameIds(
        request.waiting,
        now.waiting.map((one) => one.id),
      )
    ) {
      return { kind: 'moved' };
    }
    if (now.tooLarge) throw new ApiError(400);
    for (const one of now.waiting) cancelRequest(one);
    const by = isRoot() ? null : person(device.authId()!.slice(STAFF_HANDLE.length));
    const made: Reconciliation = {
      day,
      driver,
      requests: now.delivered.map(({ id, number, total }) => ({ id, number, total })),
      toCollect: now.toCollect,
      handedIn: request.handedIn,
      difference: gapOf(now.toCollect, request.handedIn),
      closedBy: by
        ? { id: by.id, code: by.code, name: by.name }
        : { id: null, code: null, name: ROOT.name },
      closedAt: Date.now(),
    };
    closed.set(key, made);
    return { kind: 'closed', reconciliation: structuredClone(made) };
  };
  const customerDocOf = (found: Customer): CustomerDoc => ({
    customer: structuredClone(found),
    version: `c${customerVersions.get(found.id)}`,
  });
  const productDocOf = (found: Product): ProductDoc => ({
    product: structuredClone(found),
    version: `p${productVersions.get(found.id)}`,
  });
  /** A list in code order, as the BFF answers it. */
  const inOrder = <T extends { code: string }>(held: Map<string, T>) =>
    [...held.values()].map((one) => structuredClone(one)).sort(byCode);
  /** An import into a list, a row at a time as the BFF reads it: a row the add would refuse is
   * `invalid`, a code the list holds (or an earlier row gave) `taken`, else the record is added. */
  const importInto = <Request extends { code: string }, Held extends { id: string; code: string }>(
    held: Map<string, Held>,
    rows: readonly unknown[],
    schema: { safeParse: (row: unknown) => { success: true; data: Request } | { success: false } },
    make: (request: Request, code: string) => Held,
  ) => ({
    results: rows.map((row) => {
      const parsed = schema.safeParse(row);
      if (!parsed.success) return { kind: 'refused' as const, reason: 'invalid' as const };
      const code = normaliseEmployeeCode(parsed.data.code);
      if ([...held.values()].some((existing) => existing.code === code)) {
        return { kind: 'refused' as const, reason: 'taken' as const };
      }
      const record = make(parsed.data, code);
      held.set(record.id, record);
      return { kind: 'added' as const, record: structuredClone(record) };
    }),
  });

  const person = (id: string) => {
    const found = people.get(id);
    if (!found) throw notFound();
    return found;
  };
  const docOf = (found: Employee): EmployeeDoc => ({
    employee: structuredClone(found),
    version: `e${versions.get(found.id)}`,
    signIn: { name: found.code, ready: ready.has(found.id) },
  });
  const moved = (found: Employee) => {
    versions.set(found.id, (versions.get(found.id) as number) + 1);
    return docOf(found);
  };
  const linkOf = (units: StaffSetup['departments'], id: string | null | undefined) => {
    const unit = units.find((candidate) => candidate.id === id);
    return unit ? { id: unit.id, name: unit.name } : null;
  };

  /** A person's photo as the fake holds it now, with its version. */
  const photoNow = (id: string): PhotoReply => {
    const held = photos.get(id);
    return held ? { photo: held.photo, version: `p${held.version}` } : { photo: null, version: '' };
  };

  const fake: Api = {
    getConfig: () => call('getConfig', () => ({ config, version: `v${version}` })),

    signIn: (name) =>
      call('signIn', () => {
        const entered = normaliseSignInName(name);
        if (entered === DEMO_ROOT_NAME) {
          return { authId: 'fake.session', expiresAt: Date.now() + WEEK, user: ROOT };
        }
        const staff = [...people.values()].find(
          (candidate) =>
            (normaliseSignInName(candidate.code) === entered ||
              (staffConfig(setup).fields.email && candidate.email === entered)) &&
            !candidate.archived &&
            ready.has(candidate.id),
        );
        if (!staff) throw signedOut();
        return {
          authId: `${STAFF_HANDLE}${staff.id}`,
          expiresAt: Date.now() + WEEK,
          user: staffUser(staff),
        };
      }),

    signOut: () => call('signOut', () => undefined),

    me: () =>
      call('me', () => {
        const handle = device.authId();
        if (!handle) throw signedOut();
        return { user: signedInUser(handle) };
      }),

    saveConfig: (next, readAt) =>
      call(
        'saveConfig',
        () => {
          if (readAt !== `v${version}`) return { kind: 'conflict' as const };
          config = structuredClone(next);
          version += 1;
          return { kind: 'saved' as const, doc: { config, version: `v${version}` } };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    operatorPasskeyOptions: () => call('operatorPasskeyOptions', () => OPTIONS),

    operatorPasskeySignIn: () =>
      call('operatorPasskeySignIn', () => ({
        authId: 'fake.operator',
        expiresAt: Date.now() + HOUR,
        operator: DEMO_OPERATOR,
      })),

    operatorJoinOptions: (link) =>
      call('operatorJoinOptions', () => {
        if (link !== DEMO_JOIN_TOKEN || joined) throw notFound();
        return {
          ...OPTIONS,
          name: DEMO_INVITED_NAME,
          madeBy: OPERATOR_NAME,
          madeByTerminal: false,
        };
      }),

    operatorJoin: ({ link }) =>
      call('operatorJoin', () => {
        if (link !== DEMO_JOIN_TOKEN || joined) throw notFound();
        joined = true;
        passkeys = [{ id: 'fake-passkey-first', addedAt: Date.now(), lastUsedAt: null }];
        team = team.map((one) =>
          one.id === INVITED_OPERATOR.id
            ? { ...one, state: 'active', passkeys: 1, signedInAt: Date.now() }
            : one,
        );
        return { authId: JOINED_HANDLE, expiresAt: Date.now() + HOUR, operator: INVITED_OPERATOR };
      }),

    operatorSignOut: () => call('operatorSignOut', () => undefined),

    operatorMe: () =>
      call('operatorMe', () => {
        const handle = device.operatorAuthId();
        if (!handle) throw signedOut();
        return { operator: handle === JOINED_HANDLE ? INVITED_OPERATOR : DEMO_OPERATOR };
      }),

    operatorServices: () =>
      call('operatorServices', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return {
          build: DEMO_SERVICES.build,
          storage: {
            build: drift ? DEMO_SERVICES.driftBuild : DEMO_SERVICES.build,
            ms: DEMO_SERVICES.storageMs,
          },
          bffMs: DEMO_SERVICES.bffMs,
          checkedAt: DEMO_SERVICES.checkedAt,
        };
      }),

    operatorPasskeys: () =>
      call('operatorPasskeys', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return passkeys.map((passkey) => ({ ...passkey }));
      }),

    operatorPasskeyConfirmOptions: () =>
      call('operatorPasskeyConfirmOptions', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return OPTIONS;
      }),

    operatorPasskeyAddOptions: () =>
      call('operatorPasskeyAddOptions', () => {
        if (!device.operatorAuthId()) throw signedOut();
        // As the real options do: the passkeys held are excluded from another made on the device.
        return {
          ...OPTIONS,
          options: {
            ...OPTIONS.options,
            excludeCredentials: passkeys.map((passkey) => ({ id: passkey.id })),
          },
        };
      }),

    operatorPasskeyAdd: () =>
      call('operatorPasskeyAdd', () => {
        if (!device.operatorAuthId()) throw signedOut();
        added += 1;
        passkeys = [
          ...passkeys,
          { id: `fake-passkey-${added}`, addedAt: Date.now(), lastUsedAt: null },
        ];
        return passkeys.map((passkey) => ({ ...passkey }));
      }),

    operatorPasskeyRemove: (id) =>
      call('operatorPasskeyRemove', () => {
        if (!device.operatorAuthId()) throw signedOut();
        if (!passkeys.some((passkey) => passkey.id === id)) throw notFound();
        if (passkeys.length === 1) return { kind: 'last' as const };
        passkeys = passkeys.filter((passkey) => passkey.id !== id);
        return { kind: 'removed' as const, passkeys: passkeys.map((passkey) => ({ ...passkey })) };
      }),

    getStaffSetup: () =>
      call('getStaffSetup', () => ({
        setup: structuredClone(setup),
        version: `s${setupVersion}`,
      })),

    saveStaffSetup: (next, readAt) =>
      call(
        'saveStaffSetup',
        () => {
          if (readAt !== `s${setupVersion}`) return { kind: 'conflict' as const };
          const mint = (units: typeof next.departments) =>
            units.map((unit) => ({ ...unit, id: unit.id ?? crypto.randomUUID() }));
          setup = structuredClone({
            departments: mint(next.departments),
            positions: mint(next.positions),
            // A part the save leaves out stays as it was, as the BFF keeps it.
            ...keptSetupParts(next, setup),
            extra: next.extra,
          });
          setupVersion += 1;
          return {
            kind: 'saved' as const,
            doc: { setup: structuredClone(setup), version: `s${setupVersion}` },
          };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    listEmployees: () =>
      call('listEmployees', () =>
        [...people.values()].map((found) => structuredClone(found)).sort(byCode),
      ),

    getEmployee: (id) => call('getEmployee', () => docOf(person(id))),

    addEmployee: (request) =>
      call(
        'addEmployee',
        () => {
          const code = request.code
            ? normaliseEmployeeCode(request.code)
            : nextCode(
                staffConfig(setup).numbering,
                [...people.values()].map((existing) => existing.code),
              );
          if ([...people.values()].some((existing) => existing.code === code)) {
            return { kind: 'taken' as const };
          }
          const root = isRoot();
          const added: Employee = {
            id: crypto.randomUUID(),
            code,
            name: request.name,
            department: root ? linkOf(setup.departments, request.departmentId) : null,
            position: root ? linkOf(setup.positions, request.positionId) : null,
            permissions: {},
            archived: false,
            extra: structuredClone(request.extra),
          };
          people.set(added.id, added);
          versions.set(added.id, 1);
          if (root) ready.add(added.id);
          return {
            kind: 'added' as const,
            reply: { employee: docOf(added), password: root ? MADE_PASSWORD : null },
          };
        },
        () => ({ kind: 'taken' as const }),
      ),

    // Each row is added as one add by hand; the people come without a sign-in, which the root gives.
    importEmployees: (rows) =>
      call('importEmployees', async () => {
        const results: ImportResult[] = [];
        for (const row of rows) {
          // A row the system was busy on is its own result and the call goes on, as the BFF's does.
          const added = await fake.addEmployee(row).catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 503) return null;
            throw error;
          });
          if (!added) {
            results.push({ kind: 'refused', reason: 'busy' });
            continue;
          }
          if (added.kind === 'taken') {
            results.push({ kind: 'refused', reason: 'taken' });
            continue;
          }
          const { employee } = added.reply.employee;
          ready.delete(employee.id);
          results.push({ kind: 'added', employee });
        }
        return { results };
      }),

    listCustomers: () =>
      call('listCustomers', () => {
        mayOnly('orders.canView');
        return inOrder(customers);
      }),

    getCustomer: (id) =>
      call('getCustomer', () => {
        mayOnly('orders.canView');
        const found = customers.get(id);
        return found ? customerDocOf(found) : null;
      }),

    saveCustomer: (id, request) =>
      call(
        'saveCustomer',
        () => {
          mayOnly('orders.canEdit');
          const found = customers.get(id);
          if (!found) throw notFound();
          if (request.version !== `c${customerVersions.get(id)}`) {
            return { kind: 'conflict' as const };
          }
          found.name = request.name;
          found.extra = structuredClone(request.extra);
          customerVersions.set(id, (customerVersions.get(id) as number) + 1);
          return { kind: 'saved' as const, doc: customerDocOf(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    listProducts: () =>
      call('listProducts', () => {
        mayOnly('orders.canView');
        return inOrder(products);
      }),

    getProduct: (id) =>
      call('getProduct', () => {
        mayOnly('orders.canView');
        const found = products.get(id);
        return found ? productDocOf(found) : null;
      }),

    saveProduct: (id, request) =>
      call(
        'saveProduct',
        () => {
          mayOnly('orders.canEdit');
          const found = products.get(id);
          if (!found) throw notFound();
          if (request.version !== `p${productVersions.get(id)}`) {
            return { kind: 'conflict' as const };
          }
          found.name = request.name;
          found.unit = request.unit;
          found.price = request.price;
          found.stocked = request.stocked;
          found.extra = structuredClone(request.extra);
          productVersions.set(id, (productVersions.get(id) as number) + 1);
          return { kind: 'saved' as const, doc: productDocOf(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    importCustomers: (rows) =>
      call('importCustomers', () => {
        rootOnly();
        return importInto(customers, rows, addCustomerRequestSchema, (request, code) =>
          customerSchema.parse({
            id: crypto.randomUUID(),
            code,
            name: request.name,
            extra: request.extra,
          }),
        );
      }),

    importProducts: (rows) =>
      call('importProducts', () => {
        rootOnly();
        return importInto(products, rows, addProductRequestSchema, (request, code) =>
          productSchema.parse({
            id: crypto.randomUUID(),
            code,
            name: request.name,
            unit: request.unit,
            price: request.price,
            stocked: request.stocked,
            extra: request.extra,
          }),
        );
      }),

    listOrders: (from, to) =>
      call('listOrders', () => {
        mayOnly('orders.canView');
        if (from > to || addDays(from, ORDER_LIST_DAYS - 1) < to) throw new ApiError(400);
        return [...orders.values()]
          .filter((one) => one.day >= from && one.day <= to)
          .map((one) => structuredClone(one))
          .sort(newestOrdersFirst);
      }),

    getOrder: (day, id) =>
      call('getOrder', () => {
        mayOnly('orders.canView');
        return orderDoc(orderAt(day, id));
      }),

    createOrder: (request) =>
      call('createOrder', () => {
        mayOnly('orders.canEdit');
        const made: Order = {
          id: crypto.randomUUID(),
          number: numberText(ORDER_PREFIX, lastOrder + 1),
          day: request.day,
          state: 'draft',
          ...priced(request),
          request: null,
          madeAt: Date.now(),
          extra: structuredClone(request.extra),
        };
        lastOrder += 1;
        orders.set(made.id, made);
        orderVersions.set(made.id, 1);
        return orderDoc(made);
      }),

    saveOrder: (day, id, request) =>
      call(
        'saveOrder',
        () => {
          mayOnly('orders.canEdit');
          const found = orderAt(day, id);
          const stale = orderStale(found, request.version, found.state === 'draft');
          if (stale) return stale;
          if (request.day !== day) throw new ApiError(400);
          Object.assign(found, priced(request), { extra: structuredClone(request.extra) });
          return orderMoved(found);
        },
        () => ({ kind: 'conflict' as const, current: orderDoc(orderAt(day, id)) }),
      ),

    confirmOrder: (day, id, request) =>
      call(
        'confirmOrder',
        () => issue(day, id, request, true),
        () => ({ kind: 'conflict' as const, current: orderDoc(orderAt(day, id)) }),
      ),

    sendOrder: (day, id, request) =>
      call(
        'sendOrder',
        () => issue(day, id, request, false),
        () => ({ kind: 'conflict' as const, current: orderDoc(orderAt(day, id)) }),
      ),

    cancelOrder: (day, id, request: CancelRequest) =>
      call(
        'cancelOrder',
        (): OrderResult => {
          mayOnly('orders.canEdit');
          const found = orderAt(day, id);
          const stale = orderStale(
            found,
            request.version,
            found.state === 'draft' || (found.state === 'confirmed' && !deliveredOf(found)),
          );
          if (stale) return stale;
          return withdraw(found);
        },
        () => ({ kind: 'conflict' as const, current: orderDoc(orderAt(day, id)) }),
      ),

    listDeliveries: (day) =>
      call('listDeliveries', () => {
        mayOnly('orders.canView');
        return [...requests.values()]
          .filter((one) => one.day === day)
          .map((one) => structuredClone(one))
          .sort(
            (a, b) =>
              a.driver.code.localeCompare(b.driver.code) || a.number.localeCompare(b.number),
          );
      }),

    getDelivery: (day, id) =>
      call('getDelivery', () => {
        const found = readable(day, id);
        return requestDoc(found);
      }),

    myDeliveries: (day) =>
      call('myDeliveries', () => {
        const driver = mayDeliver();
        const rank = (one: DeliveryRequest) => (one.state === 'waiting' ? 0 : 1);
        return [...requests.values()]
          .filter((one) => one.day === day && one.driver.id === driver.id)
          .filter((one) => one.state !== 'cancelled')
          .map((one) => structuredClone(one))
          .sort((a, b) => rank(a) - rank(b) || a.number.localeCompare(b.number));
      }),

    deliver: (day, id, request) =>
      call<DeliveryResult>(
        'deliver',
        () => {
          const driver = mayDeliver();
          if (!proofIsValid(request.photo)) throw new ApiError(400);
          const found = requestAt(day, id);
          if (found.driver.id !== driver.id) throw new ApiError(403);
          if (request.version !== `g${requestVersions.get(id)}` || found.state !== 'waiting') {
            return { kind: 'conflict', current: requestDoc(found) };
          }
          // The photo, then the request, then the order, as the BFF writes them.
          deliverRequest(found, request.photo);
          return { kind: 'done', doc: requestDoc(found) };
        },
        // The office cancels the order, and so the request, before the driver's send arrives.
        () => {
          const found = requestAt(day, id);
          withdraw(orders.get(found.order.id)!);
          return { kind: 'conflict', current: requestDoc(found) };
        },
      ),

    getDeliveryPhoto: (day, id) =>
      call('getDeliveryPhoto', () => {
        const found = readable(day, id);
        const photo = proofs.get(found.id);
        if (found.state !== 'delivered' || photo === undefined) throw notFound();
        return { photo };
      }),

    cancelDelivery: (day, id, request: CancelRequest) =>
      call<DeliveryResult>(
        'cancelDelivery',
        () => {
          mayOnly('orders.canEdit');
          const found = requestAt(day, id);
          if (request.version !== `g${requestVersions.get(id)}` || found.state !== 'waiting') {
            return { kind: 'conflict', current: requestDoc(found) };
          }
          // The request is cancelled first; the order then names no live request.
          cancelRequest(found);
          return { kind: 'done', doc: requestDoc(found) };
        },
        () => ({ kind: 'conflict', current: requestDoc(requestAt(day, id)) }),
      ),

    listReconciliations: (day) =>
      call('listReconciliations', () => {
        mayOnly('orders.canView');
        return [...closed.values()]
          .filter((one) => one.day === day)
          .map((one) => structuredClone(one))
          .sort((a, b) => a.driver.code.localeCompare(b.driver.code));
      }),

    closeDay: (day, driverId, request) =>
      call<CloseDayResult>(
        'closeDay',
        () => closeDay(day, driverId, request),
        // The driver delivers what still waits before the close arrives, as the full run does it.
        () => {
          for (const one of requests.values()) {
            if (one.day === day && one.driver.id === driverId && one.state === 'waiting') {
              deliverRequest(one, DEMO_WALK_PROOF);
            }
          }
          return { kind: 'moved' };
        },
      ),

    listDrivers: () =>
      call('listDrivers', () => {
        mayOnly('orders.canEdit');
        return driversNow();
      }),

    saveEmployee: (id, request) =>
      call(
        'saveEmployee',
        () => {
          const found = person(id);
          if (request.version !== `e${versions.get(id)}`) return { kind: 'conflict' as const };
          found.name = request.name;
          found.extra = structuredClone(request.extra);
          if (request.departmentId !== undefined) {
            found.department = linkOf(setup.departments, request.departmentId);
          }
          if (request.positionId !== undefined) {
            found.position = linkOf(setup.positions, request.positionId);
          }
          if (request.permissions) found.permissions = { ...request.permissions };
          return { kind: 'saved' as const, doc: moved(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    setPassword: (id, password) =>
      call('setPassword', () => {
        ready.add(person(id).id);
        return { password: password ?? MADE_PASSWORD };
      }),

    changeCode: (id, request) =>
      call(
        'changeCode',
        () => {
          const found = person(id);
          if (request.version !== `e${versions.get(id)}`) return { kind: 'conflict' as const };
          const code = normaliseEmployeeCode(request.code);
          if ([...people.values()].some((other) => other.id !== id && other.code === code)) {
            return { kind: 'taken' as const };
          }
          found.code = code;
          return { kind: 'changed' as const, doc: moved(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    setEmail: (id, request) =>
      call(
        'setEmail',
        () => {
          const found = person(id);
          if (!staffConfig(setup).fields.email) throw new ApiError(403);
          if (request.version !== `e${versions.get(id)}`) return { kind: 'conflict' as const };
          const email = request.email === null ? null : normaliseSignInName(request.email);
          if ([...people.values()].some((other) => other.id !== id && other.email === email)) {
            return { kind: 'taken' as const };
          }
          if (email === null) delete found.email;
          else found.email = email;
          return { kind: 'set' as const, doc: moved(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    issueQr: (id) =>
      call('issueQr', () => {
        person(id);
        if (!staffConfig(setup).fields.qr) throw new ApiError(403);
        // Counted, not random: the same walk shows the same link on every build, so an answer
        // given to the screen keeps holding.
        const secret = `fake-qr-minted-${++minted}`;
        qrs.set(id, secret);
        return { link: qrLink(DEMO_CODE, id, secret), expiresAt: Date.now() + QR_MINUTES * 60_000 };
      }),

    signInQr: (id, secret) =>
      call('signInQr', () => {
        const staff = people.get(id);
        if (!staffConfig(setup).fields.qr || !staff || staff.archived || qrs.get(id) !== secret) {
          throw signedOut();
        }
        // Spent: a second opening finds nothing.
        qrs.delete(id);
        return {
          authId: `${STAFF_HANDLE}${staff.id}`,
          expiresAt: Date.now() + WEEK,
          user: staffUser(staff),
        };
      }),

    changePassword: (_current, password) =>
      call<ChangePasswordResult>(
        'changePassword',
        () => {
          const handle = device.authId();
          if (!handle) throw signedOut();
          if (!passwordIsValid(password)) throw new ApiError(400);
          return {
            kind: 'changed' as const,
            session: { authId: handle, expiresAt: Date.now() + WEEK, user: signedInUser(handle) },
          };
        },
        undefined,
        () => ({ kind: 'wrong' as const }),
      ),

    getPhoto: (id) =>
      call('getPhoto', () => {
        person(id);
        return photoNow(id);
      }),

    savePhoto: (id, request) =>
      call(
        'savePhoto',
        () => {
          person(id);
          const held = photos.get(id);
          if (request.version !== (held ? `p${held.version}` : '')) {
            return { kind: 'conflict' as const, current: photoNow(id) };
          }
          const version = (held?.version ?? 0) + 1;
          photos.set(id, { photo: request.photo, version });
          return {
            kind: 'saved' as const,
            reply: { photo: request.photo, version: `p${version}` },
          };
        },
        () => ({ kind: 'conflict' as const, current: photoNow(id) }),
      ),

    archiveEmployee: (id, readAt) =>
      call(
        'archiveEmployee',
        () => {
          const found = person(id);
          if (readAt !== `e${versions.get(id)}`) return { kind: 'conflict' as const };
          found.archived = true;
          return { kind: 'archived' as const, doc: moved(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    restoreEmployee: (id, readAt) =>
      call(
        'restoreEmployee',
        () => {
          const found = person(id);
          if (readAt !== `e${versions.get(id)}`) return { kind: 'conflict' as const };
          found.archived = false;
          return { kind: 'restored' as const, doc: moved(found) };
        },
        () => ({ kind: 'conflict' as const }),
      ),

    listClients: () =>
      call('listClients', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return [...clients.values()].map((client) => ({ ...client })).sort(newestFirst);
      }),

    listOperators: () =>
      call('listOperators', () => {
        const handle = device.operatorAuthId();
        if (!handle) throw signedOut();
        const me = handle === JOINED_HANDLE ? INVITED_OPERATOR : DEMO_OPERATOR;
        return team.map((one) => ({ ...one, you: one.id === me.id })).sort(addedNewestFirst);
      }),

    addOperator: (request) =>
      call(
        'addOperator',
        () => {
          const handle = device.operatorAuthId();
          if (!handle) throw signedOut();
          const parsed = addOperatorRequestSchema.safeParse(request);
          if (!parsed.success) throw new ApiError(400, true);
          const { name } = parsed.data;
          if (team.some((one) => sameOperatorName(one.name, name)))
            return { kind: 'taken' as const };
          const me = handle === JOINED_HANDLE ? INVITED_OPERATOR : DEMO_OPERATOR;
          addedOperators += 1;
          const id = `00000000-0000-4000-8000-0000000003${String(addedOperators).padStart(2, '0')}`;
          team = [
            ...team,
            {
              id,
              name,
              state: 'invited',
              addedBy: me.name,
              addedByTerminal: false,
              addedAt: Date.now(),
              passkeys: 0,
              signedInAt: null,
            },
          ];
          return {
            kind: 'made' as const,
            id,
            link: joinLinkPath(
              `fake-join-link-${String(addedOperators).padStart(2, '0')}`.padEnd(43, '0'),
            ),
          };
        },
        () => ({ kind: 'taken' as const }),
      ),

    newOperatorLink: (id, request) =>
      call('newOperatorLink', () => {
        const handle = device.operatorAuthId();
        if (!handle) throw signedOut();
        if (!operatorLinkRequestSchema.safeParse(request).success) throw new ApiError(400, true);
        const me = handle === JOINED_HANDLE ? INVITED_OPERATOR : DEMO_OPERATOR;
        if (!team.some((one) => one.id === id)) throw notFound();
        if (id === me.id) throw new ApiError(403, true);
        addedLinks += 1;
        return {
          link: joinLinkPath(
            `fake-new-link-${String(addedLinks).padStart(2, '0')}`.padEnd(43, '0'),
          ),
        };
      }),

    deleteOperator: (id, request) =>
      call('deleteOperator', () => {
        const handle = device.operatorAuthId();
        if (!handle) throw signedOut();
        if (!deleteOperatorRequestSchema.safeParse(request).success) throw new ApiError(400, true);
        const me = handle === JOINED_HANDLE ? INVITED_OPERATOR : DEMO_OPERATOR;
        const gone = team.find((one) => one.id === id);
        if (!gone) throw notFound();
        if (id === me.id) throw new ApiError(403, true);
        // The ones they added read no adder, as the BFF's roster reads a deleted one's name.
        team = team
          .filter((one) => one.id !== id)
          .map((one) =>
            one.addedBy === gone.name && !one.addedByTerminal ? { ...one, addedBy: null } : one,
          );
      }),

    deleteClient: (code, request) =>
      call('deleteClient', () => {
        if (!device.operatorAuthId()) throw signedOut();
        // As the BFF orders it: the client, then the body, and only then a write.
        if (!clients.has(code)) throw notFound();
        if (!deleteClientRequestSchema.safeParse(request).success) throw new ApiError(400, true);
        clients.delete(code);
        return { left: 0 };
      }),

    setRootPassword: (code, request) =>
      call('setRootPassword', () => {
        if (!device.operatorAuthId()) throw signedOut();
        if (!clients.has(code)) throw notFound();
        const parsed = setRootPasswordRequestSchema.safeParse(request);
        if (!parsed.success) throw new ApiError(400, true);
        return { made: parsed.data.password === null ? MADE_PASSWORD : null };
      }),

    makeClient: (code, name) =>
      call(
        'makeClient',
        () => {
          if (clients.has(code)) return { kind: 'taken' as const };
          clients.set(code, { code, name, madeAt: Date.now(), link: clientLinkPath(code) });
          return {
            kind: 'made' as const,
            client: {
              link: clientLinkPath(code),
              rootName: DEMO_ROOT_NAME,
              password: MADE_PASSWORD,
            },
          };
        },
        () => ({ kind: 'taken' as const }),
      ),
  };
  return fake;
}

/** The tab's own mark that it runs the fake: a reload, or a page the app navigates to, loses the
 * address's search, and must not turn into the real app. */
const FAKE_KEY = 'credo.fake';

/** What the app is given on `?fake`: the fake, and a device kept in the tab's own storage, linked
 * to the demo company, so a fake sign-in never touches what the device keeps for the real app.
 * The tab remembers the switch once read, so a reload without `?fake` is still the fake; null when
 * the address names no `?fake` and the tab never did. `&sign-ins` has the company use sign-in by
 * email and by QR code; `&drift` has c-storage a build ahead of the others. */
export function fakeParts(search: string, storage: Parameters<typeof createDeviceStore>[0]) {
  const params = new URLSearchParams(search);
  if (!params.has('fake') && storage.getItem(FAKE_KEY) === null) return null;
  storage.setItem(FAKE_KEY, '1');
  const device = createDeviceStore(storage);
  device.setClientCode(DEMO_CODE);
  const cue = parseCue(params.get('cue'));
  return {
    api: createFakeApi({
      device,
      cue,
      signIns: params.has('sign-ins'),
      drift: params.has('drift'),
      noDrivers: params.has('no-drivers'),
    }),
    device,
    passkeys: createFakePasskeys({ cue }),
    build: DEMO_SERVICES.build,
    /** The fake build's today is the data set's, so the week of orders is the week shown. */
    today: () => DEMO_TODAY,
  };
}
