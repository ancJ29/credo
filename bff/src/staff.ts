import { randomUUID } from 'node:crypto';
import {
  addEmployeeRequestSchema,
  archiveEmployeeRequestSchema,
  CStorageError,
  byCode,
  type CStorageClient,
  type Employee,
  type EmployeeDoc,
  employeeRoutes,
  employeeSchema,
  normaliseEmployeeCode,
  normaliseSignInName,
  PERMISSIONS,
  type PermissionId,
  recordKeys,
  ROUTES,
  saveEmployeeRequestSchema,
  saveStaffSetupRequestSchema,
  setPasswordRequestSchema,
  type StaffSetup,
  type StoredUser,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, parse } from './errors';
import { hashPassword, madePassword } from './password';
import { namesBack, NO_SETUP_VERSION, readEmployee, readSetup, readSignIn } from './staff-records';

/** How often a write on a record that moved without cause is re-read and tried again. */
const ATTEMPTS = 3;

/** The longest an add can run: the BFF's or Lambda's timeout. A sign-in claim its person does not
 * name back is a failed add's, to be taken over, only once it is older than this; before that
 * its add may still be about to write the person. */
export const ADD_MAX_MS = 60_000;

/** Who is calling, with the setup the check read when it had to (never for the root). */
type Who = {
  root: boolean;
  permissions: Record<PermissionId, boolean>;
  setup?: { setup: StaffSetup; version: string };
};

type Deps = {
  storage: CStorageClient;
  now: () => number;
  forClient: { onRequest: (request: FastifyRequest) => Promise<void> };
  signedIn: (request: FastifyRequest) => Promise<Who>;
  mustBeRoot: (who: Who) => void;
  mustCan: (who: Who, id: PermissionId) => void;
};

const conflict = (current: unknown) => new HttpError(409, 'Conflict', { current });

/** A route's `:id` that is no id names no one. */
function idOf(request: FastifyRequest) {
  const id = z.uuid().safeParse((request.params as { id: string }).id);
  if (!id.success) throw new HttpError(404, 'Not found');
  return id.data;
}

/** The staff routes: each checks who may call it on the server, with the permissions the app
 * resolved from the layers, and the root-only ones by the root flag alone. */
export function registerStaffRoutes(app: FastifyInstance, deps: Deps) {
  const { storage, now, forClient, signedIn, mustBeRoot, mustCan } = deps;

  const setupDoc = (tenantId: string) => readSetup(storage, tenantId);

  /** A person with how they sign in: ready once the root has given a password to the record that
   * names them. */
  async function docOf(tenantId: string, found: { employee: Employee; tag: string }) {
    const signIn = await readSignIn(storage, tenantId, normaliseSignInName(found.employee.code));
    const ready = signIn?.user.employeeId === found.employee.id && !!signIn.user.passwordHash;
    const doc: EmployeeDoc = {
      employee: found.employee,
      version: found.tag,
      signIn: { name: found.employee.code, ready },
    };
    return doc;
  }

  async function mustFind(tenantId: string, id: string) {
    const found = await readEmployee(storage, tenantId, id);
    if (!found) throw new HttpError(404, 'Not found');
    return found;
  }

  /** The link a person holds to a unit: the id and the name as saved. An unknown unit is a 400. */
  function linkTo(units: StaffSetup['departments'], id: string | null | undefined, kind: string) {
    if (id === null || id === undefined) return null;
    const unit = units.find((candidate) => candidate.id === id);
    if (!unit) throw new HttpError(400, 'Bad request', { details: `${kind}: no such unit` });
    return { id: unit.id, name: unit.name };
  }

  app.get(ROUTES.staffSetup, forClient, async (request) => {
    const who = await signedIn(request);
    mustCan(who, 'staff.canView');
    return who.setup ?? (await setupDoc(request.tenantId));
  });

  app.put(ROUTES.staffSetup, forClient, async (request) => {
    mustBeRoot(await signedIn(request));
    const body = parse(saveStaffSetupRequestSchema, request.body);
    const current = await setupDoc(request.tenantId);
    if (current.version !== body.version) throw conflict(current);
    /** An id sent must be one this list already holds: the BFF mints, a caller never chooses. */
    const mint = (units: typeof body.setup.departments, held: StaffSetup['departments']) => {
      const known = new Set(held.map((unit) => unit.id));
      const given = units.flatMap((unit) => (unit.id ? [unit.id] : []));
      if (new Set(given).size !== given.length || given.some((id) => !known.has(id))) {
        throw new HttpError(400, 'Bad request', { details: 'setup: an id is repeated or unknown' });
      }
      return units.map((unit) => ({ ...unit, id: unit.id ?? randomUUID() }));
    };
    const setup: StaffSetup = {
      departments: mint(body.setup.departments, current.setup.departments),
      positions: mint(body.setup.positions, current.setup.positions),
      extra: body.setup.extra,
    };
    const key = recordKeys.tenant(request.tenantId).staffSetup;
    const saved = await storage.putRecord(
      key,
      setup,
      body.version === NO_SETUP_VERSION ? null : body.version,
    );
    if (saved === 'moved') throw conflict(await setupDoc(request.tenantId));
    return await setupDoc(request.tenantId);
  });

  app.get(ROUTES.employees, forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canView');
    const listed = await storage.listRecords(recordKeys.tenant(request.tenantId).employeePrefix);
    // Never a short list that looks whole: more than c-storage returns, or a record that does not
    // parse, is a 500 that names the kind and not the key.
    if (listed.more) throw new Error('the employee list is longer than c-storage returns');
    const employees = listed.records.map((record) => {
      const parsed = employeeSchema.safeParse(record.data);
      if (!parsed.success) throw new Error('an employee record does not parse');
      return parsed.data;
    });
    employees.sort(byCode);
    return { employees };
  });

  app.get(employeeRoutes.one(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canView');
    return await docOf(request.tenantId, await mustFind(request.tenantId, idOf(request)));
  });

  /** Claims the sign-in name for a person, before the person is written. A record already under
   * the name that its person names back is a taken code. One its person does not name back is
   * answered 503 while its claim time, `passwordAt`, is younger than the longest an add runs (it may
   * be a running add's), and is a failed add's after that, taken over with the tag it was read at. */
  async function claimSignIn(tenantId: string, name: string, record: StoredUser) {
    const key = recordKeys.tenant(tenantId).user(name);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if ((await storage.putRecord(key, record, null)) === 'saved') return;
      const found = await readSignIn(storage, tenantId, name);
      const raw = found ? null : await storage.getRecord(key);
      if (raw) throw new HttpError(409, 'That code is taken');
      if (found) {
        // The root's record names no person and is never a failed add's; nor is a person's who is
        // there.
        if (found.user.root || (await namesBack(storage, tenantId, name, found.user))) {
          throw new HttpError(409, 'That code is taken');
        }
        // A claim no one is named by yet, inside the longest an add runs, may be an add still
        // writing its person: not taken, not free either. The UI says the save failed and keeps
        // what was typed, and the retry meets the person, or the free code.
        if (now() - found.user.passwordAt <= ADD_MAX_MS) {
          throw new HttpError(503, 'Service unavailable');
        }
        if ((await storage.putRecord(key, record, found.tag)) === 'saved') return;
      }
    }
    throw new HttpError(409, 'That code is taken');
  }

  app.post(ROUTES.employees, forClient, async (request, reply) => {
    const who = await signedIn(request);
    mustCan(who, 'staff.canCreate');
    const body = parse(addEmployeeRequestSchema, request.body);
    // Only the root gives a department, a position or a sign-in.
    if (!who.root && (body.departmentId != null || body.positionId != null)) {
      throw new HttpError(403, 'Forbidden');
    }
    const { setup } = who.root ? await setupDoc(request.tenantId) : { setup: null };
    const department = setup ? linkTo(setup.departments, body.departmentId, 'department') : null;
    const position = setup ? linkTo(setup.positions, body.positionId, 'position') : null;

    const id = randomUUID();
    const code = normaliseEmployeeCode(body.code);
    const password = who.root ? madePassword() : null;
    await claimSignIn(request.tenantId, normaliseSignInName(code), {
      passwordHash: password ? await hashPassword(password) : null,
      root: false,
      employeeId: id,
      passwordAt: now(),
    });
    const person: Employee = {
      id,
      code,
      name: body.name,
      department,
      position,
      permissions: {},
      archived: false,
      extra: body.extra,
    };
    // The person is written last: the list finds them as soon as they are there.
    if (
      (await storage.putRecord(recordKeys.tenant(request.tenantId).employee(id), person, null)) ===
      'moved'
    ) {
      throw new CStorageError(412, 'a record already sat under a fresh id');
    }
    const employee = await docOf(request.tenantId, await mustFind(request.tenantId, id));
    return reply.status(201).send({ employee, password });
  });

  app.put(employeeRoutes.one(':id'), forClient, async (request) => {
    const who = await signedIn(request);
    mustCan(who, 'staff.canEdit');
    const found = await mustFind(request.tenantId, idOf(request));
    const body = parse(saveEmployeeRequestSchema, request.body);
    const current = found.employee;
    // Whoever is not the root changes a person's name and `extra` alone: any other change is a 403
    // and writes nothing.
    const sameLayer = (a: Employee['permissions'], b: Employee['permissions']) =>
      PERMISSIONS.every((id) => a[id] === b[id]);
    if (
      !who.root &&
      ((body.departmentId !== undefined &&
        body.departmentId !== (current.department?.id ?? null)) ||
        (body.positionId !== undefined && body.positionId !== (current.position?.id ?? null)) ||
        (body.permissions !== undefined && !sameLayer(body.permissions, current.permissions)))
    ) {
      throw new HttpError(403, 'Forbidden');
    }
    const { setup } = who.root ? await setupDoc(request.tenantId) : { setup: null };
    /** A link left as it is keeps the name it was saved with, whether or not its unit remains. */
    const link = (
      kept: Employee['department'],
      units: StaffSetup['departments'] | undefined,
      sent: string | null | undefined,
      kind: string,
    ) =>
      sent === undefined || sent === (kept?.id ?? null) || !units
        ? kept
        : linkTo(units, sent, kind);
    const updated: Employee = {
      ...current,
      name: body.name,
      extra: body.extra,
      department: link(current.department, setup?.departments, body.departmentId, 'department'),
      position: link(current.position, setup?.positions, body.positionId, 'position'),
      permissions: who.root && body.permissions ? body.permissions : current.permissions,
    };
    const key = recordKeys.tenant(request.tenantId).employee(current.id);
    if ((await storage.putRecord(key, updated, body.version)) === 'moved') {
      throw conflict(await newest(request.tenantId, current.id));
    }
    return await newest(request.tenantId, current.id);
  });

  /** The person as stored now, for an answer; none if they are gone. */
  async function newest(tenantId: string, id: string) {
    const found = await readEmployee(storage, tenantId, id);
    return found ? await docOf(tenantId, found) : null;
  }

  app.post(employeeRoutes.archive(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canDelete');
    const found = await mustFind(request.tenantId, idOf(request));
    const body = parse(archiveEmployeeRequestSchema, request.body);
    const key = recordKeys.tenant(request.tenantId).employee(found.employee.id);
    if (
      (await storage.putRecord(key, { ...found.employee, archived: true }, body.version)) ===
      'moved'
    ) {
      throw conflict(await newest(request.tenantId, found.employee.id));
    }
    return await newest(request.tenantId, found.employee.id);
  });

  app.put(employeeRoutes.password(':id'), forClient, async (request) => {
    mustBeRoot(await signedIn(request));
    const found = await mustFind(request.tenantId, idOf(request));
    const body = parse(setPasswordRequestSchema, request.body);
    const password = body.password ?? madePassword();
    const passwordHash = await hashPassword(password);
    const name = normaliseSignInName(found.employee.code);
    const key = recordKeys.tenant(request.tenantId).user(name);
    // A claim's takeover writes this record too, so a moved tag may be a real change of owner: read
    // it again, a few times at most. The person check then answers 409 for another's record, and a
    // record still this person's is written over.
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const signIn = await readSignIn(storage, request.tenantId, name);
      if (!signIn || signIn.user.employeeId !== found.employee.id) {
        throw new HttpError(409, 'Conflict');
      }
      // Strictly after the last, so a session issued at the last is refused whatever the clock reads.
      const passwordAt = Math.max(now(), signIn.user.passwordAt + 1);
      const changed: StoredUser = { ...signIn.user, passwordHash, passwordAt };
      if ((await storage.putRecord(key, changed, signIn.tag)) === 'saved') return { password };
    }
    throw new CStorageError(412, 'the sign-in moved on every attempt to give it a password');
  });
}
