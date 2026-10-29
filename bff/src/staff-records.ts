import {
  type CStorageClient,
  type Employee,
  employeeSchema,
  normaliseSignInName,
  type PermissionLayer,
  recordKeys,
  type StaffSetup,
  staffSetupSchema,
  type StoredUser,
  storedUserSchema,
} from '@credo/shared';

/** The staff records as the routes and the sign-in read them. A record that does not parse is a
 * fault, a 500 that names its kind and never its key: never a person skipped or defaulted. */

export type ReadEmployee = { employee: Employee; tag: string };

export async function readEmployee(
  storage: CStorageClient,
  tenantId: string,
  id: string,
): Promise<ReadEmployee | null> {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).employee(id));
  if (!found) return null;
  const parsed = employeeSchema.safeParse(found.data);
  if (!parsed.success) throw new Error('an employee record does not parse');
  return { employee: parsed.data, tag: found.tag };
}

/** `version` is `''` for a company that has never saved a setup: it reads as an empty one. */
export const NO_SETUP_VERSION = '';

export async function readSetup(storage: CStorageClient, tenantId: string) {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).staffSetup);
  if (!found) {
    const setup: StaffSetup = { departments: [], positions: [], extra: {} };
    return { setup, version: NO_SETUP_VERSION };
  }
  const parsed = staffSetupSchema.safeParse(found.data);
  if (!parsed.success) throw new Error('the staff setup does not parse');
  return { setup: parsed.data, version: found.tag };
}

/** A sign-in record that does not parse is no sign-in. */
export async function readSignIn(storage: CStorageClient, tenantId: string, name: string) {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).user(name));
  const parsed = found ? storedUserSchema.safeParse(found.data) : null;
  return found && parsed?.success ? { user: parsed.data, tag: found.tag } : null;
}

/** A sign-in record is live only while its person names it back: by id, and by the code it is
 * keyed under. */
export async function namesBack(
  storage: CStorageClient,
  tenantId: string,
  name: string,
  user: StoredUser,
) {
  const person = user.employeeId ? await readEmployee(storage, tenantId, user.employeeId) : null;
  return person !== null && normaliseSignInName(person.employee.code) === name;
}

/** What each layer allows, in the order they apply: department, position, person. A unit since
 * removed adds nothing. */
export function layersOf(setup: StaffSetup, person: Employee): PermissionLayer[] {
  const unit = (units: StaffSetup['departments'], link: Employee['department']) =>
    units.find((candidate) => candidate.id === link?.id)?.permissions ?? {};
  return [
    unit(setup.departments, person.department),
    unit(setup.positions, person.position),
    person.permissions,
  ];
}
