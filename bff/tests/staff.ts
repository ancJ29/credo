import {
  addEmployeeReplySchema,
  employeeDocSchema,
  employeeListReplySchema,
  type Employee,
  type PermissionLayer,
  recordKeys,
  type StaffSetup,
} from '@credo/shared';
import { expect } from 'vitest';
import { type RunningCStorage } from './c-storage';
import { ROOT, seedEmployee, signIn, tenantWithRoot, withAuth } from './tenant';

type TenantOptions = Parameters<typeof tenantWithRoot>[1];

/** A tenant with its root signed in, and the calls a staff test makes as anyone. */
export async function staffTenant(cs: RunningCStorage, options: TenantOptions = {}) {
  const t = await tenantWithRoot(cs, options);
  const root = (await signIn(t.app)).body.authId;
  const as = (authId: string) => ({
    get: (url: string) => t.app.inject({ method: 'GET', url, headers: withAuth(authId) }),
    send: (method: 'POST' | 'PUT', url: string, payload?: unknown) =>
      t.app.inject({ method, url, headers: withAuth(authId), payload: payload as object }),
  });
  /** The root saves a setup over the one stored, and answers the stored one back. */
  const setup = async (next: {
    departments?: object[];
    positions?: object[];
    extra?: object;
    fields?: object;
    customFields?: object[];
    numbering?: object;
  }) => {
    const read = (await as(root).get('/api/staff-setup')).json<{ version: string }>();
    const saved = await as(root).send('PUT', '/api/staff-setup', {
      setup: { departments: [], positions: [], extra: {}, ...next },
      version: read.version,
    });
    return saved.json<{ setup: StaffSetup; version: string }>();
  };
  /** A person who may sign in with `password`, holding `permissions` of their own and a unit each
   * in the setup, signed in. */
  const staff = async (
    code: string,
    layers: {
      department?: PermissionLayer;
      position?: PermissionLayer;
      own?: PermissionLayer;
    } = {},
    extra: Partial<Employee> = {},
  ) => {
    const before = (await as(root).get('/api/staff-setup')).json<{ setup: StaffSetup }>().setup;
    const seeded = await setup({
      departments: [
        ...before.departments,
        { name: `Dept ${code}`, permissions: layers.department ?? {}, extra: {} },
      ],
      positions: [
        ...before.positions,
        { name: `Position ${code}`, permissions: layers.position ?? {}, extra: {} },
      ],
    });
    const department = seeded.setup.departments.at(-1);
    const position = seeded.setup.positions.at(-1);
    const person = await seedEmployee(t.client, t.id, {
      code,
      department: { id: department!.id, name: department!.name },
      position: { id: position!.id, name: position!.name },
      permissions: layers.own ?? {},
      ...extra,
    });
    const session = await signIn(t.app, { name: code, password: person.password as string });
    return { ...person, authId: session.body.authId, call: as(session.body.authId) };
  };
  return { ...t, root, rootCall: as(root), as, setup, staff, ROOT, keys: recordKeys.tenant(t.id) };
}

type Tenant = Awaited<ReturnType<typeof staffTenant>>;
type Call = Tenant['rootCall'];

/** The calls a staff test makes on a person, as the app's routes answer them. */
export const personCalls = {
  body: (over: object = {}) => ({ name: 'Mai Linh', code: 'EMP-1', extra: {}, ...over }),
  add: (call: Call, over: object = {}) =>
    call.send('POST', '/api/employees', personCalls.body(over)),
  /** A person added; an add that is not a 201 fails on its status. */
  added: async (call: Call, over: object = {}) => {
    const reply = await personCalls.add(call, over);
    expect(reply.statusCode).toBe(201);
    return addEmployeeReplySchema.parse(reply.json());
  },
  doc: async (call: Call, id: string) => {
    const reply = await call.get(`/api/employees/${id}`);
    expect(reply.statusCode).toBe(200);
    return employeeDocSchema.parse(reply.json());
  },
  codes: async (call: Call) => {
    const reply = await call.get('/api/employees');
    expect(reply.statusCode).toBe(200);
    return employeeListReplySchema.parse(reply.json()).employees.map((person) => person.code);
  },
  me: (t: Tenant, authId: string) =>
    t.app.inject({ method: 'GET', url: '/api/auth/me', headers: withAuth(authId) }),
};
