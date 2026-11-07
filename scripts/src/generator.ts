import { generateKeyPairSync } from 'node:crypto';
import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { createOperator, makeLink } from '@credo/bff/operators';
import { createSessions, OPERATOR_SESSION } from '@credo/bff/sessions';
import {
  type AddEmployeeReply,
  type Customer,
  type DeliveryDoc,
  deliveryRoutes,
  type Driver,
  type OrderDoc,
  orderRoutes,
  type Product,
  type ProductDoc,
  productRoutes,
  type DeliveryRequest,
  type Reconciliation,
  reconciliationRoutes,
  CLIENT_HEADER,
  type CStorageClient,
  IMPORT_CALL_ROWS,
  listImportRoute,
  DEVICE_HEADER,
  type EmployeeDoc,
  employeeRoutes,
  type Employee,
  type UnitLink,
  ROUTES,
  type SessionReply,
  type StaffSetupDoc,
  type StoredAccount,
  type StoredRoster,
  AUTH_HEADER,
  recordKeys,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_ORDERS,
  DEMO_RECONCILIATIONS,
  DEMO_EMPLOYEES,
  DEMO_INVITED_NAME,
  DEMO_OPERATOR_ID,
  DEMO_PASSKEYS,
  DEMO_PHOTOS,
  DEMO_PRODUCTS,
  DEMO_TEAM,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
} from '@credo/shared/demo';

export { ROOT_NAME };

/** The id the colleague's adder had, an operator since deleted: no roster line holds it. */
const DELETED_ADDER_ID = '00000000-0000-4000-8000-000000000204';

/** The generator drives a client's routes alone, through the BFF's own functions: it signs no
 * operator in, so no passkey is ever checked against this address or challenge signed under this key. */
const NO_OPERATOR = { origin: 'http://localhost', serviceKey: 'the generator' };

/** A client the generator made: its code, its root's first password and a first password for each
 * data-set person who may sign in, by code. */
export type SeededClient = { code: string; rootPassword: string; people: Record<string, string> };

/** The data-set person who has no sign-in, and is added by someone else, as the product allows. */
const NO_SIGN_IN = 'EMP-0007';
/** Who adds that person: allowed to add and with no unit to give. */
const ADDER = 'EMP-0001';

/**
 * A client made from the data set: the demo company by the operator's own create function, then
 * its staff setup, its people and the one who left through the BFF's own routes, signed in as the
 * root, so each rule the product holds holds on the data set too. Ids are minted by the BFF; a
 * person's unit is named by the data set's position in its setup. A client of the same code stops
 * the run: nothing is replaced.
 */
export async function seedClient(
  storage: CStorageClient,
  code: string,
  madeAt: number = Date.now(),
): Promise<SeededClient> {
  const made = await createClient(storage, {
    code,
    name: DEMO_CONFIG.name,
    madeAt,
    settings: DEMO_CONFIG,
  });
  if (made === 'taken') throw new Error('the service already holds data: not seeded over');

  // The clock is the BFF's `madeAt` alone; the week's replay sets it at each record's own time.
  let clock: number | null = null;
  const app = buildApp({ storage, now: () => clock ?? Date.now(), ...NO_OPERATOR, logger: false });
  const call = async <T>(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    authId: string | null,
    payload?: unknown,
  ) => {
    const reply = await app.inject({
      method,
      url,
      headers: {
        [CLIENT_HEADER]: code,
        [DEVICE_HEADER]: 'device-generator',
        ...(authId ? { [AUTH_HEADER]: authId } : {}),
      },
      payload: payload as object | undefined,
    });
    if (reply.statusCode >= 300) {
      throw new Error(`the generator's ${method} ${url} answered ${reply.statusCode}`);
    }
    return reply.json<T>();
  };
  const signIn = async (name: string, password: string) =>
    (await call<SessionReply>('POST', ROUTES.signIn, null, { name, password })).authId;

  const root = await signIn(ROOT_NAME, made.password);
  const read = await call<StaffSetupDoc>('GET', ROUTES.staffSetup, root);
  const withoutIds = ({ id: _id, ...unit }: { id: string }) => unit;
  const saved = await call<StaffSetupDoc>('PUT', ROUTES.staffSetup, root, {
    setup: {
      departments: DEMO_STAFF_SETUP.departments.map(withoutIds),
      positions: DEMO_STAFF_SETUP.positions.map(withoutIds),
      fields: DEMO_STAFF_SETUP.fields,
      customFields: DEMO_STAFF_SETUP.customFields,
      numbering: DEMO_STAFF_SETUP.numbering,
      extra: DEMO_STAFF_SETUP.extra,
    },
    version: read.version,
  });
  /** The minted id of the unit the data set holds at this place in its list. Only a person added
   * by the root is given units, and each of them has both in the data set. */
  const minted = (kind: 'departments' | 'positions', link: UnitLink | null) =>
    saved.setup[kind][DEMO_STAFF_SETUP[kind].findIndex((unit) => unit.id === link!.id)].id;

  const people: Record<string, string> = {};
  const add = async (person: Employee, authId: string, units: boolean) => {
    const reply = await call<AddEmployeeReply>('POST', ROUTES.employees, authId, {
      name: person.name,
      code: person.code,
      extra: person.extra,
      ...(units
        ? {
            departmentId: minted('departments', person.department),
            positionId: minted('positions', person.position),
          }
        : {}),
    });
    if (reply.password !== null) people[person.code] = reply.password;
    let doc: EmployeeDoc = reply.employee;
    if (Object.keys(person.permissions).length > 0) {
      doc = await call<EmployeeDoc>('PUT', employeeRoutes.one(doc.employee.id), root, {
        version: doc.version,
        name: person.name,
        extra: person.extra,
        permissions: person.permissions,
      });
    }
    const photo = DEMO_PHOTOS[person.id];
    if (photo) {
      await call('PUT', employeeRoutes.photo(doc.employee.id), root, { photo, version: '' });
    }
    if (person.archived) {
      await call<EmployeeDoc>('POST', employeeRoutes.archive(doc.employee.id), root, {
        version: doc.version,
      });
    }
  };
  for (const person of DEMO_EMPLOYEES.filter((p) => p.code !== NO_SIGN_IN)) {
    await add(person, root, true);
  }
  const adder = await signIn(ADDER, people[ADDER]);
  await add(
    DEMO_EMPLOYEES.find((p) => p.code === NO_SIGN_IN)!,
    adder,
    false,
  );

  // The customers and the products, through the root's two import routes as the app sends them: the
  // data set's id is dropped, since the BFF mints it. A row not added stops the run.
  for (const list of ['customers', 'products'] as const) {
    const rows = (list === 'customers' ? DEMO_CUSTOMERS : DEMO_PRODUCTS).map(
      ({ id: _id, ...row }) => row,
    );
    for (let from = 0; from < rows.length; from += IMPORT_CALL_ROWS) {
      const sent = rows.slice(from, from + IMPORT_CALL_ROWS);
      const { results } = await call<{ results: { kind: string }[] }>(
        'POST',
        listImportRoute(list),
        root,
        { rows: sent },
      );
      if (results.some((result) => result.kind !== 'added')) {
        throw new Error(`the generator's ${list} import did not add every row`);
      }
    }
  }

  await replayWeek(
    call,
    root,
    (time) => {
      clock = time;
    },
    (driverCode) => signIn(driverCode, people[driverCode]),
  );
  await closeWeek(call, signIn, people, (time) => {
    clock = time;
  });
  clock = null;
  return { code, rootPassword: made.password, people };
}

/** A passkey's public key in the COSE form it is stored in (EC2, ES256), with the private half of
 * its pair as PKCS8, base64. */
function mintedKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const { x, y } = publicKey.export({ format: 'jwk' });
  return {
    publicKey: Buffer.concat([
      Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      Buffer.from(x!, 'base64url'),
      Buffer.from([0x22, 0x58, 0x20]),
      Buffer.from(y!, 'base64url'),
    ]).toString('base64url'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

/** A public key whose private half is dropped at once: nothing can sign in with the data set's
 * passkeys, which the list shows, but the first. */
const forgottenPublicKey = () => mintedKeyPair().publicKey;

/** The one passkey of the data set's active operator that a walk can touch: the first, whose pair
 * is minted per stack and handed over once, never stored beside the stack or committed. `id` is
 * the credential's, `userHandle` the operator's id as the BFF's ceremonies bind it, both base64url. */
type WalkPasskey = { id: string; privateKey: string; userHandle: string };

/** The device the data set's operator session is kept for. */
const OPERATOR_DEVICE = 'device-operator-seed';

type Call = <T>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  authId: string | null,
  payload?: unknown,
) => Promise<T>;

/**
 * The data set's week of orders and requests, made through the BFF's own routes as the root, in
 * the order they were made and with the clock at each one's time: an order is saved, confirmed to
 * its driver for the day it was sent for, and cancelled (the order, or only its request) as the
 * data set says; a request the data set delivered is then delivered through the route by its driver,
 * signed in, at the time the data set gives, with its drawn photo. The BFF mints every id and number, so the numbers meet the data set's only because
 * the order of the calls does.
 */
async function replayWeek(
  call: Call,
  root: string,
  setClock: (time: number) => void,
  signInAs: (code: string) => Promise<string>,
) {
  const customers = await call<{ customers: Customer[] }>('GET', ROUTES.customers, root);
  const products = await call<{ products: Product[] }>('GET', ROUTES.products, root);
  const drivers = await call<{ drivers: Driver[] }>('GET', ROUTES.drivers, root);
  const idOf = <T extends { id: string; code: string }>(held: T[], code: string) =>
    held.find((one) => one.code === code)!.id;
  // A line saved at a price the list no longer has (a draft taken before a product's price rose) is
  // made as it happens in life: the product is set to the price of the day, the order taken, and the
  // product put back to today's price at once after, so no other order's total moves.
  const setPrice = async (code: string, price: number) => {
    const id = idOf(products.products, code);
    const { product, version } = await call<ProductDoc>('GET', productRoutes.one(id), root);
    await call<ProductDoc>('PUT', productRoutes.one(id), root, {
      version,
      name: product.name,
      unit: product.unit,
      price,
      stocked: product.stocked,
      extra: product.extra,
    });
  };
  for (const order of DEMO_ORDERS) {
    setClock(order.madeAt);
    const moved = order.lines.filter(
      (line) => line.price !== products.products.find((one) => one.code === line.code)!.price,
    );
    for (const line of moved) await setPrice(line.code, line.price);
    const saved = await call<OrderDoc>('POST', ROUTES.orders, root, {
      day: order.day,
      customerId: idOf(customers.customers, order.customer.code),
      lines: order.lines.map((line) => ({
        productId: idOf(products.products, line.code),
        quantity: line.quantity,
      })),
      extra: order.extra,
    });
    for (const line of moved) {
      await setPrice(line.code, products.products.find((one) => one.code === line.code)!.price);
    }
    const request = DEMO_DELIVERIES.find((one) => one.order.id === order.id);
    let doc = saved;
    if (request) {
      setClock(request.madeAt);
      doc = await call<OrderDoc>('POST', orderRoutes.confirm(order.day, saved.order.id), root, {
        version: saved.version,
        driverId: idOf(drivers.drivers, request.driver.code),
        day: request.day,
      });
    }
    if (order.state === 'cancelled') {
      await call<OrderDoc>('POST', orderRoutes.cancel(order.day, saved.order.id), root, {
        version: doc.version,
      });
    } else if (request?.state === 'delivered') {
      const { id } = doc.order.request!;
      setClock(request.deliveredAt!);
      const driver = await signInAs(request.driver.code);
      const sent = await call<DeliveryDoc>('GET', deliveryRoutes.one(request.day, id), driver);
      await call<DeliveryDoc>('POST', deliveryRoutes.deliver(request.day, id), driver, {
        version: sent.version,
        photo: DEMO_DELIVERY_PHOTOS[request.id],
      });
    } else if (request?.state === 'cancelled') {
      const { id } = doc.order.request!;
      const sent = await call<DeliveryDoc>('GET', deliveryRoutes.one(request.day, id), root);
      await call<DeliveryDoc>('POST', deliveryRoutes.cancel(request.day, id), root, {
        version: sent.version,
      });
    }
  }
}

/** The office person who closes the data set's past days at the day's end. */
const CLOSER = 'EMP-0001';

/**
 * The data set's past days closed, through the route as `EMP-0001`, signed in, at each closed day's
 * time: the requests of the day are read for their ids (the BFF minted them, and the numbers meet
 * the data set's), and the close names the delivered ones and the cash the data set gives.
 */
async function closeWeek(
  call: Call,
  signIn: (code: string, password: string) => Promise<string>,
  people: Record<string, string>,
  setClock: (time: number) => void,
) {
  const office = await signIn(CLOSER, people[CLOSER]);
  for (const closed of DEMO_RECONCILIATIONS) {
    setClock(closed.closedAt);
    const { deliveries } = await call<{ deliveries: DeliveryRequest[] }>(
      'GET',
      deliveryRoutes.list(closed.day),
      office,
    );
    const driver = deliveries.find((one) => one.driver.code === closed.driver.code)!.driver;
    await call<Reconciliation>('POST', reconciliationRoutes.close(closed.day, driver.id), office, {
      delivered: closed.requests.map(
        (one) => deliveries.find((request) => request.number === one.number)!.id,
      ),
      waiting: [],
      handedIn: closed.handedIn,
    });
  }
}

/**
 * The data set's operators, as the fake has them: `operator`, active, with the data set's two
 * passkeys at their fixed times and a session signed in (its handle, for a walk to keep on the
 * device without a ceremony that would stamp today on a passkey); and the invited one, with a link
 * `operator` made. Returns that link's token and the session's handle.
 */
async function seedOperators(storage: CStorageClient, now: number) {
  const taken = () => new Error('the service already holds data: not seeded over');
  const first = DEMO_PASSKEYS[0].addedAt;
  const [operator, colleague, newest] = DEMO_TEAM;
  const walkPair = mintedKeyPair();
  const account: StoredAccount = {
    passkeys: DEMO_PASSKEYS.map(({ id, addedAt, lastUsedAt }, index) => ({
      id,
      publicKey: index === 0 ? walkPair.publicKey : forgottenPublicKey(),
      counter: 0,
      transports: ['internal'],
      addedAt,
      lastUsedAt,
    })),
    linkHash: null,
    generation: 0,
    signedInAt: operator.signedInAt,
    spent: [],
  };
  // The colleague an operator since deleted added: active, with a passkey of their own.
  const colleagueAccount: StoredAccount = {
    passkeys: [
      {
        id: 'demo-passkey-colleague',
        publicKey: forgottenPublicKey(),
        counter: 0,
        transports: ['internal'],
        addedAt: colleague.addedAt,
        lastUsedAt: colleague.signedInAt,
      },
    ],
    linkHash: null,
    generation: 0,
    signedInAt: colleague.signedInAt,
    spent: [],
  };
  const line: StoredRoster = {
    operators: [
      {
        id: DEMO_OPERATOR_ID,
        name: OPERATOR_NAME,
        state: 'active',
        addedBy: null,
        addedAt: first,
        joinedAt: first,
      },
      {
        id: colleague.id,
        name: colleague.name,
        state: 'active',
        addedBy: DELETED_ADDER_ID,
        addedAt: colleague.addedAt,
        joinedAt: colleague.addedAt,
      },
    ],
  };
  if ((await storage.putRecord(recordKeys.operatorRoster, line, null)) === 'moved') throw taken();
  if (
    (await storage.putRecord(recordKeys.operatorAccount(DEMO_OPERATOR_ID), account, null)) ===
    'moved'
  ) {
    throw taken();
  }
  if (
    (await storage.putRecord(recordKeys.operatorAccount(colleague.id), colleagueAccount, null)) ===
    'moved'
  ) {
    throw taken();
  }
  // Made at the data set's fixed time, so the list reads the same on every stack; that time also
  // ends its first link, so the link is made again from the stack's own clock.
  const invited = await createOperator(storage, {
    name: DEMO_INVITED_NAME,
    addedBy: DEMO_OPERATOR_ID,
    now: newest.addedAt,
  });
  /* v8 ignore next -- unreachable: the roster was read empty and written a moment ago */
  if (invited === 'taken') throw taken();
  const invitedToken = await makeLink(storage, {
    operatorId: invited.id,
    kind: 'join',
    madeBy: DEMO_OPERATOR_ID,
    now,
  });
  /* v8 ignore next -- unreachable: the account was written a moment ago */
  if (!invitedToken) throw taken();
  const { authId } = await createSessions({
    storage,
    now: () => now,
    keyOf: recordKeys.operatorSession,
    sliding: OPERATOR_SESSION,
  }).issue(OPERATOR_DEVICE, DEMO_OPERATOR_ID, String(account.generation));
  const operatorPasskey: WalkPasskey = {
    id: DEMO_PASSKEYS[0].id,
    privateKey: walkPair.privateKey,
    userHandle: Buffer.from(DEMO_OPERATOR_ID).toString('base64url'),
  };
  return { invitedToken, operatorHandle: authId, operatorPasskey };
}

/**
 * The stack's data: the data set's operators (see `seedOperators`), the demo client made from the
 * data set, and the data set's other clients, made by the same function with their fixed times.
 * Only hashes are stored. Every write is where nothing exists, so a second run over a service
 * stops rather than replaces it. Returns the root's first password, each person's, the invited
 * operator's link token and the operator's session handle, which the stack shows once as the first
 * password was.
 */
export async function seedDemo(storage: CStorageClient, now: number = Date.now()) {
  const { invitedToken, operatorHandle, operatorPasskey } = await seedOperators(storage, now);
  const demo = DEMO_CLIENTS.find((client) => client.code === DEMO_CODE)!;
  const { rootPassword, people } = await seedClient(storage, demo.code, demo.madeAt);
  // The operator's list shows three clients: the other two are only made, with their fixed times.
  for (const { code, name, madeAt } of DEMO_CLIENTS.filter((client) => client !== demo)) {
    if ((await createClient(storage, { code, name, madeAt })) === 'taken') {
      throw new Error('the service already holds data: not seeded over');
    }
  }
  return { rootPassword, people, invitedToken, operatorHandle, operatorPasskey };
}
