import { randomUUID } from 'node:crypto';
import {
  ATTEMPTS,
  CStorageError,
  type CStorageClient,
  type Employee,
  employeeSchema,
  normaliseSignInName,
  recordKeys,
  type StaffSetup,
  staffSetupSchema,
  type StoredSignInEmail,
  storedSignInEmailSchema,
  type StoredSignInQr,
  storedSignInQrSchema,
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

/**
 * Gives a sign-in record a new password hash, the one write that ends every session of it: a fresh
 * `generation` is minted, which each call compares, and `passwordAt` is now. The record is read
 * with its tag and nothing is written unless `owns` says it is the caller's (a person's route: that
 * person's; the root's door: the root); the answer is then `'not owned'`, also for a record that
 * is gone. A claim's takeover writes this record too, so a moved tag may be a real change of owner:
 * it is read again, {@link ATTEMPTS} times at most, and a record still the caller's is written
 * over. The hash is made by the caller, once.
 */
export async function setSignInPassword(
  storage: CStorageClient,
  tenantId: string,
  name: string,
  owns: (user: StoredUser) => boolean,
  passwordHash: string,
  now: () => number,
): Promise<'set' | 'not owned'> {
  return await rewriteSignIn(storage, tenantId, name, owns, (user) => ({
    ...user,
    passwordHash,
    passwordAt: now(),
    generation: randomUUID(),
  }));
}

/**
 * Ends every session of a sign-in record and nothing else: a fresh `generation` is minted, the
 * password hash and its time left as they are, so the old password still signs the person in. The
 * same read, ownership check and retries as {@link setSignInPassword}.
 */
export async function endSessions(
  storage: CStorageClient,
  tenantId: string,
  name: string,
  owns: (user: StoredUser) => boolean,
): Promise<'set' | 'not owned'> {
  return await rewriteSignIn(storage, tenantId, name, owns, (user) => ({
    ...user,
    generation: randomUUID(),
  }));
}

async function rewriteSignIn(
  storage: CStorageClient,
  tenantId: string,
  name: string,
  owns: (user: StoredUser) => boolean,
  change: (user: StoredUser) => StoredUser,
): Promise<'set' | 'not owned'> {
  const key = recordKeys.tenant(tenantId).user(name);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const signIn = await readSignIn(storage, tenantId, name);
    if (!signIn || !owns(signIn.user)) return 'not owned';
    if ((await storage.putRecord(key, change(signIn.user), signIn.tag)) === 'saved') return 'set';
  }
  throw new CStorageError(412, 'the sign-in record moved on every attempt to write it');
}

/** An email's record: who claimed it, and when. A record that does not parse is a fault, a 500
 * that names its kind and never its key. */
export async function readEmailClaim(
  storage: CStorageClient,
  tenantId: string,
  email: string,
): Promise<{ claim: StoredSignInEmail; tag: string } | null> {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).signInEmail(email));
  if (!found) return null;
  const parsed = storedSignInEmailSchema.safeParse(found.data);
  if (!parsed.success) throw new Error('an email record does not parse');
  return { claim: parsed.data, tag: found.tag };
}

/** A person's QR code as kept. A record that does not parse is a fault, as an email's. */
export async function readQr(
  storage: CStorageClient,
  tenantId: string,
  employeeId: string,
): Promise<{ qr: StoredSignInQr; tag: string } | null> {
  const found = await storage.getRecord(recordKeys.tenant(tenantId).signInQr(employeeId));
  if (!found) return null;
  const parsed = storedSignInQrSchema.safeParse(found.data);
  if (!parsed.success) throw new Error('a QR record does not parse');
  return { qr: parsed.data, tag: found.tag };
}

/** Whether a person holds the code a sign-in record is keyed under. */
export const namesPerson = (name: string, person: Employee) =>
  normaliseSignInName(person.code) === name;

/** A sign-in record is live only while its person names it back: by id, and by the code it is
 * keyed under. */
export async function namesBack(
  storage: CStorageClient,
  tenantId: string,
  name: string,
  user: StoredUser,
) {
  const person = user.employeeId ? await readEmployee(storage, tenantId, user.employeeId) : null;
  return person !== null && namesPerson(name, person.employee);
}
