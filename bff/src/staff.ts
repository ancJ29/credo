import { randomUUID } from 'node:crypto';
import {
  addEmployeeRequestSchema,
  archiveEmployeeRequestSchema,
  changeCodeRequestSchema,
  CStorageError,
  byCode,
  type CStorageClient,
  type Employee,
  type EmployeeDoc,
  employeeRoutes,
  employeeSchema,
  keptSetupParts,
  normaliseEmployeeCode,
  nextCode,
  type Numbering,
  normaliseSignInName,
  PERMISSIONS,
  type PhotoReply,
  type PermissionId,
  recordKeys,
  ROUTES,
  saveEmployeeRequestSchema,
  savePhotoRequestSchema,
  saveStaffSetupRequestSchema,
  setPasswordRequestSchema,
  staffConfig,
  type StaffSetup,
  type StoredPhoto,
  storedNumberingSchema,
  storedPhotoSchema,
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
      // A part the request leaves out stays as it was, so a caller that predates it erases nothing.
      ...keptSetupParts(body.setup, current.setup),
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

  /** Every person, those who left too. Never a short list that looks whole: more than c-storage
   * returns, or a record that does not parse, is a 500 that names the kind and not the key. */
  async function everyone(tenantId: string) {
    const listed = await storage.listRecords(recordKeys.tenant(tenantId).employeePrefix);
    if (listed.more) throw new Error('the employee list is longer than c-storage returns');
    return listed.records.map((record) => {
      const parsed = employeeSchema.safeParse(record.data);
      if (!parsed.success) throw new Error('an employee record does not parse');
      return parsed.data;
    });
  }

  app.get(ROUTES.employees, forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canView');
    const employees = await everyone(request.tenantId);
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

  /** The last number given under a prefix, with the tag of the record that holds it. */
  async function numberingOf(tenantId: string) {
    const found = await storage.getRecord(recordKeys.tenant(tenantId).staffNumbering);
    if (!found) return { given: {} as Record<string, number>, tag: null };
    const parsed = storedNumberingSchema.safeParse(found.data);
    if (!parsed.success) throw new Error('the numbering record does not parse');
    return { given: parsed.data.given, tag: found.tag };
  }

  /** Raises the last number given under `prefix` to at least `number`, over the tag it was read at,
   * read again when it moved, a few times at most. A code the code route frees counts as given. */
  async function raiseGiven(tenantId: string, prefix: string, number: number) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await numberingOf(tenantId);
      if ((held.given[prefix] ?? 0) >= number) return;
      const given = { ...held.given, [prefix]: number };
      const saved = await storage.putRecord(
        recordKeys.tenant(tenantId).staffNumbering,
        { given },
        held.tag,
      );
      if (saved === 'saved') return;
    }
    throw new CStorageError(412, 'the numbering moved on every attempt to be raised');
  }

  /** The code after every code ever given, claimed as a sign-in name. A number is raised in the
   * numbering record, over the tag it was read at, before it is claimed: a number freed by a code
   * change, or lost to a claim that is taken or may be a running add's, is never given again. A
   * record that moved is read again; after `ATTEMPTS` tries the save fails (503). */
  async function claimNumbered(
    tenantId: string,
    numbering: Numbering,
    record: StoredUser,
    personWith: (code: string) => Employee,
  ) {
    const key = recordKeys.tenant(tenantId).staffNumbering;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await numberingOf(tenantId);
      const last = held.given[numbering.prefix] ?? 0;
      const code = nextCode(numbering, [
        ...(await everyone(tenantId)).map((person) => person.code),
        `${numbering.prefix}${last}`,
      ]);
      personWith(code);
      const given = {
        ...held.given,
        [numbering.prefix]: Number(code.slice(numbering.prefix.length)),
      };
      if ((await storage.putRecord(key, { given }, held.tag)) === 'moved') continue;
      try {
        await claimSignIn(tenantId, normaliseSignInName(code), record);
        return code;
      } catch (error) {
        // Taken (409) or maybe a running add's (503): the next number may be free.
        if (!(error instanceof HttpError)) throw error;
      }
    }
    throw new HttpError(503, 'Service unavailable');
  }

  app.post(ROUTES.employees, forClient, async (request, reply) => {
    const who = await signedIn(request);
    mustCan(who, 'staff.canCreate');
    const body = parse(addEmployeeRequestSchema, request.body);
    // Only the root gives a department, a position or a sign-in.
    if (!who.root && (body.departmentId != null || body.positionId != null)) {
      throw new HttpError(403, 'Forbidden');
    }
    const read = who.setup ?? (await setupDoc(request.tenantId));
    const department = linkTo(read.setup.departments, body.departmentId, 'department');
    const position = linkTo(read.setup.positions, body.positionId, 'position');

    const id = randomUUID();
    const password = who.root ? madePassword() : null;
    const claim: StoredUser = {
      passwordHash: password ? await hashPassword(password) : null,
      root: false,
      employeeId: id,
      passwordAt: now(),
      generation: randomUUID(),
    };
    /** The person as it will be stored, read by the schema every reader uses before any write, so
     * no record the list cannot read is ever stored. */
    const personWith = (code: string): Employee => {
      const person = employeeSchema.safeParse({
        id,
        code,
        name: body.name,
        department,
        position,
        permissions: {},
        archived: false,
        extra: body.extra,
      });
      if (!person.success) throw new HttpError(400, 'Bad request', { details: 'code' });
      return person.data;
    };
    let person: Employee;
    if (body.code === undefined) {
      const code = await claimNumbered(
        request.tenantId,
        staffConfig(read.setup).numbering,
        claim,
        personWith,
      );
      person = personWith(code);
    } else {
      const code = normaliseEmployeeCode(body.code);
      person = personWith(code);
      await claimSignIn(request.tenantId, normaliseSignInName(code), claim);
    }
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
      // A new generation, so every session issued before is refused whatever the clock reads.
      const changed: StoredUser = {
        ...signIn.user,
        passwordHash,
        passwordAt: now(),
        generation: randomUUID(),
      };
      if ((await storage.putRecord(key, changed, signIn.tag)) === 'saved') return { password };
    }
    throw new CStorageError(412, 'the sign-in moved on every attempt to give it a password');
  });

  /** A new code: a sign-in record under the new name, holding the password the person has, is
   * claimed first; the person is written with it last, the moment it takes effect; the old record
   * is removed after, so the old code is free again. A person written between the read and the write
   * gives the new name back. A password given before the old record is removed is carried onto
   * the new one. */
  app.put(employeeRoutes.code(':id'), forClient, async (request) => {
    mustBeRoot(await signedIn(request));
    const found = await mustFind(request.tenantId, idOf(request));
    const body = parse(changeCodeRequestSchema, request.body);
    // A person who left keeps their code taken, so it is never freed by a change.
    if (body.version !== found.tag || found.employee.archived) {
      throw conflict(await docOf(request.tenantId, found));
    }
    const code = normaliseEmployeeCode(body.code);
    if (code === found.employee.code) return await docOf(request.tenantId, found);
    const keys = recordKeys.tenant(request.tenantId);
    const oldName = normaliseSignInName(found.employee.code);
    const old = await readSignIn(storage, request.tenantId, oldName);
    if (!old || old.user.employeeId !== found.employee.id) throw new HttpError(409, 'Conflict');
    // The code about to be freed counts as given, so a numbered add never gives its number again,
    // whether it was typed or numbered: raised first, since a number burned is harmless.
    const { prefix } = staffConfig((await setupDoc(request.tenantId)).setup).numbering;
    const freed = new RegExp(`^${prefix}(\\d+)$`).exec(found.employee.code);
    if (freed) await raiseGiven(request.tenantId, prefix, Number(freed[1]));
    const name = normaliseSignInName(code);
    await claimSignIn(request.tenantId, name, {
      passwordHash: old.user.passwordHash,
      root: false,
      employeeId: found.employee.id,
      passwordAt: now(),
      generation: randomUUID(),
    });
    const saved = await storage.putRecord(
      keys.employee(found.employee.id),
      { ...found.employee, code },
      found.tag,
    );
    if (saved === 'moved') {
      const mine = await readSignIn(storage, request.tenantId, name);
      if (mine?.user.employeeId === found.employee.id) {
        await storage.removeRecord(keys.user(name), mine.tag);
      }
      throw conflict(await newest(request.tenantId, found.employee.id));
    }
    // The old record is removed over the tag it was read at. If it moved, a password may have been
    // given in between: carry its hash onto the new record under a fresh generation, then try the
    // removal again over the tag just read, a few times at most.
    let seen = old;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if ((await storage.removeRecord(keys.user(oldName), seen.tag)) === 'removed') {
        return await newest(request.tenantId, found.employee.id);
      }
      const again = await readSignIn(storage, request.tenantId, oldName);
      // Gone, or taken over by another person: nothing of this person's is left to free.
      if (!again || again.user.employeeId !== found.employee.id) {
        return await newest(request.tenantId, found.employee.id);
      }
      const mine = await readSignIn(storage, request.tenantId, name);
      if (mine?.user.employeeId === found.employee.id) {
        await storage.putRecord(
          keys.user(name),
          {
            ...mine.user,
            passwordHash: again.user.passwordHash,
            passwordAt: now(),
            generation: randomUUID(),
          },
          mine.tag,
        );
      }
      seen = again;
    }
    throw new CStorageError(412, 'the old sign-in moved on every attempt to be removed');
  });

  /** A person's photo as stored, with the version it is at; none yet is `null` and `''`. A record
   * that does not parse is a fault, a 500 naming its kind and never its key. */
  async function photoOf(tenantId: string, id: string): Promise<PhotoReply> {
    const found = await storage.getRecord(recordKeys.tenant(tenantId).employeePhoto(id));
    if (!found) return { photo: null, version: '' };
    const parsed = storedPhotoSchema.safeParse(found.data);
    if (!parsed.success) throw new Error('a photo record does not parse');
    return { photo: parsed.data.photo, version: found.tag };
  }

  app.get(employeeRoutes.photo(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canView');
    const found = await mustFind(request.tenantId, idOf(request));
    return await photoOf(request.tenantId, found.employee.id);
  });

  app.put(employeeRoutes.photo(':id'), forClient, async (request) => {
    mustCan(await signedIn(request), 'staff.canEdit');
    const found = await mustFind(request.tenantId, idOf(request));
    const body = parse(savePhotoRequestSchema, request.body);
    const key = recordKeys.tenant(request.tenantId).employeePhoto(found.employee.id);
    const stored: StoredPhoto = { photo: body.photo };
    const saved = await storage.putRecord(key, stored, body.version === '' ? null : body.version);
    if (saved === 'moved') throw conflict(await photoOf(request.tenantId, found.employee.id));
    return await photoOf(request.tenantId, found.employee.id);
  });
}
