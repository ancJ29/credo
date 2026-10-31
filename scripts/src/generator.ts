import { buildApp } from '@credo/bff';
import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { hashPassword, newPassword } from '@credo/bff/password';
import {
  type AddEmployeeReply,
  CLIENT_HEADER,
  type CStorageClient,
  IMPORT_CALL_ROWS,
  listImportRoute,
  DEVICE_HEADER,
  type EmployeeDoc,
  employeeRoutes,
  type Employee,
  type UnitLink,
  recordKeys,
  ROUTES,
  type SessionReply,
  type StaffSetupDoc,
  type StoredOperator,
  AUTH_HEADER,
} from '@credo/shared';
import {
  DEMO_CLIENTS,
  DEMO_CODE,
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_EMPLOYEES,
  DEMO_PHOTOS,
  DEMO_PRODUCTS,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
} from '@credo/shared/demo';

export { ROOT_NAME };

/** Random for each stack, so no password is written anywhere in the repository. */
export const newOperatorPassword = newPassword;

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

  const app = buildApp({ storage, now: () => Date.now(), logger: false });
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
  return { code, rootPassword: made.password, people };
}

/**
 * The stack's data: the operator's account, the demo client made from the data set, and the
 * data set's other clients, made by the same function with their fixed times. Only
 * hashes are stored. Every write is where nothing exists, so a second run over a service stops
 * rather than replaces it. Returns the root's first password and each person's.
 */
export async function seedDemo(
  storage: CStorageClient,
  { operatorPassword }: { operatorPassword: string },
) {
  const operator: StoredOperator = { passwordHash: await hashPassword(operatorPassword) };
  const saved = await storage.putRecord(recordKeys.operatorUser(OPERATOR_NAME), operator, null);
  if (saved === 'moved') throw new Error('the service already holds data: not seeded over');
  const demo = DEMO_CLIENTS.find((client) => client.code === DEMO_CODE)!;
  const { rootPassword, people } = await seedClient(storage, demo.code, demo.madeAt);
  // The operator's list shows three clients: the other two are only made, with their fixed times.
  for (const { code, name, madeAt } of DEMO_CLIENTS.filter((client) => client !== demo)) {
    if ((await createClient(storage, { code, name, madeAt })) === 'taken') {
      throw new Error('the service already holds data: not seeded over');
    }
  }
  return { rootPassword, people };
}
