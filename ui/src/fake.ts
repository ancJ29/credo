import {
  addCustomerRequestSchema,
  addProductRequestSchema,
  byCode,
  type ClientListItem,
  customerSchema,
  clientLinkPath,
  type Employee,
  type EmployeeDoc,
  type ImportResult,
  keptSetupParts,
  layersOf,
  newestFirst,
  nextCode,
  type PhotoReply,
  normaliseEmployeeCode,
  normaliseSignInName,
  passwordIsValid,
  productSchema,
  QR_MINUTES,
  qrLink,
  resolvePermissions,
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
  DEMO_PRODUCTS,
  DEMO_QR_SECRET,
  DEMO_EMPLOYEES,
  DEMO_PHOTOS,
  DEMO_ROOT_NAME,
  DEMO_STAFF_SETUP,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { type Api, ApiError, type ChangePasswordResult } from './api';
import { createDeviceStore } from './device';

/** The statuses the address may ask the fake to answer, once. */
const STATUSES = [403, 409, 503] as const;
type Status = (typeof STATUSES)[number];

/** One call and the status it answers once: `?cue=saveConfig:409`. */
export type Cue = { call: string; status: Status };

/** The cue an address names, or null for none or one the fake does not know. */
export function parseCue(raw: string | null): Cue | null {
  const [call, status] = (raw ?? '').split(':');
  const found = STATUSES.find((known) => String(known) === status);
  return call && found ? { call, status: found } : null;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
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
};

/**
 * The `Api` over the demo data set, held in memory and seeded afresh at each load: the same
 * methods, the same answers' shapes, no network. Any password signs the data set's root in. A
 * cue makes the call it names answer one status once, then the fake goes on from the data set.
 */
export function createFakeApi({ device, cue, signIns = false }: Options): Api {
  let config: TenantConfig = structuredClone(DEMO_CONFIG);
  let version = 1;
  let pending = cue;
  let setup: StaffSetup = structuredClone(DEMO_STAFF_SETUP);
  if (signIns) setup.fields = { ...staffConfig(setup).fields, email: true, qr: true };
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
  /** How many QR codes have been minted: each one's secret is its number. */
  let minted = 0;
  /** The QR code each person was last shown, by the secret it signs in with; spending one removes it.
   * The data set holds one, a warehouse member's, for the phone's walk. */
  const qrs = new Map<string, string>([
    [DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!.id, DEMO_QR_SECRET],
  ]);

  /** Runs `answer`, unless the cue names `call` and has not fired: then its status instead, as
   * the real call's own answer for it, or as the error every other call raises. */
  async function call<T>(
    name: string,
    answer: () => T | Promise<T>,
    onConflict?: () => T,
    onForbidden?: () => T,
  ) {
    if (pending?.call === name) {
      const { status } = pending;
      pending = null;
      if (status === 409 && onConflict) return onConflict();
      if (status === 403 && onForbidden) return onForbidden();
      throw new ApiError(status);
    }
    return await answer();
  }

  /** Every client the operator's list shows: the data set's, then any made since the page loaded. */
  const clients = new Map<string, ClientListItem>(
    DEMO_CLIENTS.map((client) => [client.code, { ...client, link: clientLinkPath(client.code) }]),
  );

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
  /** The two lists are the root's alone, as the BFF checks. */
  const rootOnly = () => {
    if (!isRoot()) throw new ApiError(403);
  };
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

    operatorSignIn: (name) =>
      call('operatorSignIn', () => {
        if (normaliseSignInName(name) !== OPERATOR_NAME) throw signedOut();
        return {
          authId: 'fake.operator',
          expiresAt: Date.now() + WEEK,
          operator: { name: OPERATOR_NAME },
        };
      }),

    operatorSignOut: () => call('operatorSignOut', () => undefined),

    operatorMe: () =>
      call('operatorMe', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return { operator: { name: OPERATOR_NAME } };
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
        rootOnly();
        return inOrder(customers);
      }),

    listProducts: () =>
      call('listProducts', () => {
        rootOnly();
        return inOrder(products);
      }),

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

    listClients: () =>
      call('listClients', () => {
        if (!device.operatorAuthId()) throw signedOut();
        return [...clients.values()].map((client) => ({ ...client })).sort(newestFirst);
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
 * email and by QR code. */
export function fakeParts(search: string, storage: Parameters<typeof createDeviceStore>[0]) {
  const params = new URLSearchParams(search);
  if (!params.has('fake') && storage.getItem(FAKE_KEY) === null) return null;
  storage.setItem(FAKE_KEY, '1');
  const device = createDeviceStore(storage);
  device.setClientCode(DEMO_CODE);
  return {
    api: createFakeApi({
      device,
      cue: parseCue(params.get('cue')),
      signIns: params.has('sign-ins'),
    }),
    device,
  };
}
