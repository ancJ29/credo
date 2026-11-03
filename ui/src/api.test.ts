import { type TenantConfig } from '@credo/shared';
import {
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_ORDERS,
  DEMO_RECONCILIATIONS,
} from '@credo/shared/demo';
import { describe, expect, it } from 'vitest';
import { ApiError, createApi, hopOf } from './api';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};
const doc = { config, version: 'v1' };

type Call = { path: string; init: RequestInit };

/** A fetch that answers each call in turn and records what was sent. */
function fake(...answers: (Response | Error)[]) {
  return fakeAt(undefined, ...answers);
}

/** The same with a clock of the test's own, for the calls that time themselves. */
function fakeAt(now: (() => number) | undefined, ...answers: (Response | Error)[]) {
  const calls: Call[] = [];
  const call: typeof fetch = (path, init) => {
    calls.push({ path: path instanceof Request ? path.url : path.toString(), init: init ?? {} });
    const answer = answers.shift() ?? new Response('{}', { status: 500 });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const api = createApi({
    deviceId: 'device-0001',
    clientCode: () => 'minh-phat',
    authId: () => 'device-0001.secret',
    operatorAuthId: () => 'device-0001.operator',
    fetch: call,
    ...(now ? { now } : {}),
  });
  return { calls, api };
}

const credential = {
  id: 'k',
  rawId: 'k',
  type: 'public-key' as const,
  response: { clientDataJSON: 'x' },
  clientExtensionResults: {},
};
const options = { challenge: 'Zm9v' };
const confirm = { token: 'c.s', response: credential };
const session = { authId: 'a.b', expiresAt: 1, operator: { id: 'o1', name: 'operator' } };
const link = 'l'.repeat(43);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const headersOf = (call: Call | undefined) => new Headers(call?.init.headers);

describe('the API client', () => {
  it('A write carries its body as sent and no hash of it: the edge asks for none', async () => {
    const { calls, api } = fake(
      json({ authId: 'a.b', expiresAt: 1, user: { name: 'root', root: true } }),
      new Response(null, { status: 204 }),
      json(doc),
    );

    await api.signIn('root', 'pw');
    await api.signOut();
    await api.saveConfig(config, 'v1');

    expect(calls[0]?.init.body).toBe('{"name":"root","password":"pw"}');
    expect(calls[1]?.init.body).toBeNull();
    for (const call of calls) expect(headersOf(call).has('x-amz-content-sha256')).toBe(false);
  });

  it('Every call of a client’s carries its code, and a code is sent exactly as the device keeps it', async () => {
    const { calls, api } = fake(
      json(doc),
      json({ authId: 'a.b', expiresAt: 1, user: { name: 'root', root: true } }),
      new Response(null, { status: 204 }),
      json({ user: { name: 'root', root: true } }),
      json(doc),
    );

    await api.getConfig();
    await api.signIn('root', 'pw');
    await api.signOut();
    await api.me();
    await api.saveConfig(config, 'v1');

    expect(calls.map((call) => headersOf(call).get('x-client-code'))).toEqual(
      Array(5).fill('minh-phat'),
    );
  });

  it('sends no client code before the device has one', async () => {
    const call: typeof fetch = (_path, init) => {
      expect(new Headers(init?.headers).has('x-client-code')).toBe(false);
      return Promise.resolve(json(doc));
    };
    await createApi({
      deviceId: 'device-0001',
      clientCode: () => null,
      authId: () => null,
      operatorAuthId: () => null,
      fetch: call,
    }).getConfig();
  });

  it('The operator’s calls carry the operator’s handle and no client code, and a client’s carry its own handle', async () => {
    const { calls, api } = fake(
      json({ authId: 'a.b', expiresAt: 1, operator: { id: 'o1', name: 'operator' } }),
      json({ operator: { id: 'o1', name: 'operator' } }),
      json({ link: '/login?client-code=minh-phat', rootName: 'root', password: 'x' }, 201),
      new Response(null, { status: 204 }),
      json({ user: { name: 'root', root: true } }),
    );

    await api.operatorPasskeySignIn({ token: 't.s', response: credential });
    await api.operatorMe();
    await api.makeClient('minh-phat', 'Minh Phát');
    await api.operatorSignOut();
    await api.me();

    expect(calls.map((call) => call.path)).toEqual([
      '/api/operator/passkey/sign-in',
      '/api/operator/me',
      '/api/operator/clients',
      '/api/operator/sign-out',
      '/api/auth/me',
    ]);
    for (const call of calls.slice(0, 4)) {
      expect(headersOf(call).has('x-client-code')).toBe(false);
    }
    expect(headersOf(calls[1]).get('x-auth-id')).toBe('device-0001.operator');
    expect(headersOf(calls[4]).get('x-auth-id')).toBe('device-0001.secret');
    expect(calls[2]?.init.body).toBe('{"code":"minh-phat","name":"Minh Phát"}');
  });

  it('A client made is returned whole, a code taken is a result and any other refusal an error', async () => {
    const made = { link: '/login?client-code=minh-phat', rootName: 'root', password: 'x' };
    const { api } = fake(
      json(made, 201),
      json({ error: 'That code is taken' }, 409),
      json({}, 400),
      json({ link: 1 }, 201),
      json({}, 401),
      json({}, 503),
      json({}, 401),
    );

    expect(await api.makeClient('minh-phat', 'A')).toEqual({ kind: 'made', client: made });
    expect(await api.makeClient('minh-phat', 'A')).toEqual({ kind: 'taken' });
    await expect(api.makeClient('x', 'A')).rejects.toMatchObject({ status: 400 });
    await expect(api.makeClient('minh-phat', 'A')).rejects.toMatchObject({ status: null });
    await expect(api.operatorMe()).rejects.toMatchObject({ status: 401 });
    await expect(api.operatorSignOut()).rejects.toMatchObject({ status: 503 });
    await expect(
      api.operatorPasskeySignIn({ token: 't.s', response: credential }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('A root’s password is set by POST with the operator’s handle and no client code, the touch in the body; the made one is returned, and a refusal or a wrong shape is an error', async () => {
    const { calls, api } = fake(
      json({ made: 'Abcdef1!' }),
      json({ made: null }),
      json({}, 403),
      json({ password: 'x' }),
    );

    expect(await api.setRootPassword('binh-an', { password: null, confirm })).toEqual({
      made: 'Abcdef1!',
    });
    expect(await api.setRootPassword('binh-an', { password: 'Abcdef1!', confirm })).toEqual({
      made: null,
    });
    await expect(api.setRootPassword('binh-an', { password: null, confirm })).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(api.setRootPassword('binh-an', { password: null, confirm })).rejects.toMatchObject(
      { status: null },
    );
    expect(calls[0]?.path).toBe('/api/operator/clients/binh-an/root-password');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({ password: 'Abcdef1!', confirm });
    expect(headersOf(calls[0]).has('x-client-code')).toBe(false);
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.operator');
  });

  it('B1: The operators are read with the operator’s handle and no client code, as answered; a refusal or a reply of the wrong shape is an error', async () => {
    const operators = [
      {
        id: '00000000-0000-4000-8000-000000000201',
        name: 'operator',
        state: 'active',
        addedBy: null,
        addedByTerminal: true,
        addedAt: 5,
        passkeys: 2,
        signedInAt: null,
        you: true,
      },
    ];
    const { calls, api } = fake(
      json({ operators }),
      json({}, 401),
      json({ operators: [{ name: 1 }] }),
    );

    expect(await api.listOperators()).toEqual(operators);
    await expect(api.listOperators()).rejects.toMatchObject({ status: 401 });
    await expect(api.listOperators()).rejects.toMatchObject({ status: null });
    expect(calls[0]?.path).toBe('/api/operator/operators');
    expect(calls[0]?.init.method).toBe('GET');
    expect(headersOf(calls[0]).has('x-client-code')).toBe(false);
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.operator');
  });

  it('B1: An operator is added by POST of a name and the touch; the id and link come back, a 409 is a result, any other refusal or a wrong shape an error', async () => {
    const id = '00000000-0000-4000-8000-000000000301';
    const { calls, api } = fake(
      json({ id, link: '/operator/join#abc' }, 201),
      json({ error: 'Conflict' }, 409),
      json({}, 403),
      json({ id: 'x' }, 201),
    );
    const request = { name: 'Thu Hà', confirm };

    expect(await api.addOperator(request)).toEqual({
      kind: 'made',
      id,
      link: '/operator/join#abc',
    });
    expect(await api.addOperator(request)).toEqual({ kind: 'taken' });
    await expect(api.addOperator(request)).rejects.toMatchObject({ status: 403 });
    await expect(api.addOperator(request)).rejects.toMatchObject({ status: null });
    expect(calls[0]?.path).toBe('/api/operator/operators');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual(request);
    expect(headersOf(calls[0]).has('x-client-code')).toBe(false);
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.operator');
  });

  it('The operator’s list is read with the operator’s handle and no client code, and returns the clients as answered; a refusal or a reply of the wrong shape is an error', async () => {
    const clients = [
      { code: 'binh-an', name: 'Bình An', madeAt: 5, link: '/login?client-code=binh-an' },
      { code: 'old-one', name: 'Old One', madeAt: null, link: '/login?client-code=old-one' },
    ];
    const { calls, api } = fake(json({ clients }), json({}, 401), json({ clients: [{ code: 1 }] }));

    expect(await api.listClients()).toEqual(clients);
    await expect(api.listClients()).rejects.toMatchObject({ status: 401 });
    await expect(api.listClients()).rejects.toMatchObject({ status: null });
    expect(calls[0]?.path).toBe('/api/operator/clients');
    expect(calls[0]?.init.method).toBe('GET');
    expect(headersOf(calls[0]).has('x-client-code')).toBe(false);
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.operator');
  });

  it('sends the device id and the session handle on every call', async () => {
    const { calls, api } = fake(json({ user: { name: 'root', root: true } }));

    await api.me();

    expect(calls[0]?.path).toBe('/api/auth/me');
    expect(headersOf(calls[0]).get('x-device-id')).toBe('device-0001');
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.secret');
  });

  it('sends no handle before sign-in', async () => {
    const call: typeof fetch = (_path, init) => {
      expect(new Headers(init?.headers).get('x-auth-id')).toBeNull();
      return Promise.resolve(json(doc));
    };
    await createApi({
      deviceId: 'device-0001',
      clientCode: () => 'minh-phat',
      authId: () => null,
      operatorAuthId: () => null,
      fetch: call,
    }).getConfig();
  });

  it('A config that does not parse stops the boot', async () => {
    const { api } = fake(json({ config: { ...config, colour: 'red' }, version: 'v1' }));

    await expect(api.getConfig()).rejects.toMatchObject({ status: null });
  });

  it('reads a refusal by its status, and a call with no answer or no JSON as null', async () => {
    const { api } = fake(
      json({}, 404),
      json({}, 401),
      json({}, 503),
      new Response(null, { status: 500 }),
      new TypeError('fetch failed'),
      new Response('not json', { status: 200 }),
    );

    await expect(api.getConfig()).rejects.toMatchObject({ status: 404 });
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ status: 401 });
    await expect(api.me()).rejects.toMatchObject({ status: 503 });
    await expect(api.signOut()).rejects.toMatchObject({ status: 500 });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ status: null });
  });

  it('A save over a newer one is a conflict, not an error', async () => {
    const { api } = fake(json({ error: 'Conflict', current: doc }, 409), json({}, 403));

    expect(await api.saveConfig(config, 'old')).toEqual({ kind: 'conflict' });
    await expect(api.saveConfig(config, 'old')).rejects.toMatchObject({ status: 403 });
  });

  it('returns the settings a save stored, with their new version', async () => {
    const { api } = fake(json({ config, version: 'v2' }));

    expect(await api.saveConfig(config, 'v1')).toEqual({
      kind: 'saved',
      doc: { config, version: 'v2' },
    });
  });

  it('Sign-in and `me` answer the person’s resolved permissions; the UI’s parse defaults them to none', async () => {
    const { api } = fake(
      json({ user: { name: 'lan', root: false } }),
      json({ user: { name: 'lan', root: false, permissions: { 'staff.canView': true } } }),
    );

    expect((await api.me()).user.permissions).toEqual({});
    expect((await api.me()).user.permissions).toEqual({ 'staff.canView': true });
  });

  describe('the staff calls', () => {
    const id = '00000000-0000-4000-8000-000000000101';
    const person = { id, code: 'EMP-0001', name: 'Lan', department: null, position: null };
    const personDoc = {
      employee: person,
      version: 'e1',
      signIn: { name: 'EMP-0001', ready: true },
    };
    const setupDoc = { setup: { departments: [], positions: [], extra: {} }, version: 's1' };

    it('reads and writes the staff setup, a save over a newer one being a conflict', async () => {
      const { calls, api } = fake(json(setupDoc), json(setupDoc), json({}, 409), json({}, 403));

      expect(await api.getStaffSetup()).toEqual(setupDoc);
      expect(await api.saveStaffSetup(setupDoc.setup, 's1')).toEqual({
        kind: 'saved',
        doc: setupDoc,
      });
      expect(await api.saveStaffSetup(setupDoc.setup, 's0')).toEqual({ kind: 'conflict' });
      await expect(api.saveStaffSetup(setupDoc.setup, 's1')).rejects.toMatchObject({ status: 403 });
      expect(calls.map((call) => [call.init.method, call.path])).toEqual([
        ['GET', '/api/staff-setup'],
        ['PUT', '/api/staff-setup'],
        ['PUT', '/api/staff-setup'],
        ['PUT', '/api/staff-setup'],
      ]);
      expect(JSON.parse(calls[1]?.init.body as string)).toEqual({
        setup: setupDoc.setup,
        version: 's1',
      });
    });

    it('a staff setup or a list that cannot be read is an error with the BFF’s status', async () => {
      const { api } = fake(json({}, 403), json({}, 503));

      await expect(api.getStaffSetup()).rejects.toMatchObject({ status: 403 });
      await expect(api.listEmployees()).rejects.toMatchObject({ status: 503 });
    });

    it('lists the people, defaults what an older record lacks, and reads one person with their version', async () => {
      const { calls, api } = fake(json({ employees: [person] }), json(personDoc), json({}, 404));

      const [listed] = await api.listEmployees();
      expect(listed).toMatchObject({
        code: 'EMP-0001',
        permissions: {},
        archived: false,
        extra: {},
      });
      expect(await api.getEmployee(id)).toMatchObject({ version: 'e1' });
      await expect(api.getEmployee(id)).rejects.toMatchObject({ status: 404 });
      expect(calls.map((call) => call.path)).toEqual([
        '/api/employees',
        `/api/employees/${id}`,
        `/api/employees/${id}`,
      ]);
    });

    it('adds a person, a code already taken being a result, and reads the first password the root is given', async () => {
      const added = { employee: personDoc, password: 'Abcdef1!' };
      const { calls, api } = fake(json(added, 201), json({}, 409), json({}, 503));
      const request = { name: 'Lan', code: 'EMP-0001', extra: {} };

      expect(await api.addEmployee(request)).toMatchObject({
        kind: 'added',
        reply: { password: 'Abcdef1!' },
      });
      expect(await api.addEmployee(request)).toEqual({ kind: 'taken' });
      await expect(api.addEmployee(request)).rejects.toMatchObject({ status: 503 });
      expect(JSON.parse(calls[0]?.init.body as string)).toEqual(request);
    });

    it('sends the rows to the import and reads one result for each; a refused row is a result, a refused call an error', async () => {
      const results = [
        { kind: 'added', employee: personDoc.employee },
        { kind: 'refused', reason: 'taken' },
      ];
      const { calls, api } = fake(json({ results }), json({}, 403), json({ results: 1 }));
      const rows = [
        { name: 'Lan', extra: {} },
        { name: 'Hà', code: 'EMP-0002', extra: {} },
      ];

      expect(await api.importEmployees(rows)).toMatchObject({ results });
      await expect(api.importEmployees(rows)).rejects.toMatchObject({ status: 403 });
      await expect(api.importEmployees(rows)).rejects.toMatchObject({ status: null });
      expect(calls[0]?.init.method).toBe('POST');
      expect(calls[0]?.path).toBe('/api/employees/import');
      expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ rows });
    });

    it('lists the customers and the products, and sends each list’s import rows to its own route as JSON', async () => {
      const customer = { id, code: 'KH-1', name: 'Một', extra: {} };
      const product = {
        id,
        code: 'VT-1',
        name: 'Một',
        unit: 'bao',
        price: 5000,
        stocked: true,
        extra: {},
      };
      const { calls, api } = fake(
        json({ customers: [customer] }),
        json({ products: [product] }),
        json({ results: [{ kind: 'added', record: customer }] }),
        json({ results: [{ kind: 'refused', reason: 'taken' }] }),
        json({}, 403),
        json({}, 403),
        json({}, 403),
        json({}, 403),
      );
      const rows = [{ code: 'KH-1', name: 'Một', extra: {} }];
      const items = [
        { code: 'VT-1', name: 'Một', unit: 'bao', price: 5000, stocked: true, extra: {} },
      ];

      expect(await api.listCustomers()).toEqual([customer]);
      expect(await api.listProducts()).toEqual([product]);
      expect(await api.importCustomers(rows)).toMatchObject({ results: [{ kind: 'added' }] });
      expect(await api.importProducts(items)).toMatchObject({
        results: [{ kind: 'refused', reason: 'taken' }],
      });
      await expect(api.listCustomers()).rejects.toMatchObject({ status: 403 });
      await expect(api.listProducts()).rejects.toMatchObject({ status: 403 });
      await expect(api.importCustomers(rows)).rejects.toMatchObject({ status: 403 });
      await expect(api.importProducts(items)).rejects.toMatchObject({ status: 403 });
      expect(calls.slice(0, 4).map((call) => [call.init.method, call.path])).toEqual([
        ['GET', '/api/customers'],
        ['GET', '/api/products'],
        ['POST', '/api/customers/import'],
        ['POST', '/api/products/import'],
      ]);
      expect(JSON.parse(calls[2]?.init.body as string)).toEqual({ rows });
    });

    it('saves a person over the version read, and a moved record is a conflict, not an error', async () => {
      const { calls, api } = fake(json(personDoc), json({}, 409), json({}, 400));
      const request = { version: 'e1', name: 'Lan', extra: {} };

      expect(await api.saveEmployee(id, request)).toMatchObject({
        kind: 'saved',
        doc: { version: 'e1' },
      });
      expect(await api.saveEmployee(id, request)).toEqual({ kind: 'conflict' });
      await expect(api.saveEmployee(id, request)).rejects.toMatchObject({ status: 400 });
      expect(calls[0]?.init.method).toBe('PUT');
      expect(calls[0]?.path).toBe(`/api/employees/${id}`);
    });

    it('gives a password typed or asked for, and reads the password shown once', async () => {
      const { calls, api } = fake(
        json({ password: 'Abcdef1!' }),
        json({ password: 'Made-1a!' }),
        json({}, 403),
      );

      expect(await api.setPassword(id, 'Abcdef1!')).toEqual({ password: 'Abcdef1!' });
      expect(await api.setPassword(id, null)).toEqual({ password: 'Made-1a!' });
      await expect(api.setPassword(id, null)).rejects.toMatchObject({ status: 403 });
      expect(calls.map((call) => call.init.body)).toEqual([
        '{"password":"Abcdef1!"}',
        '{"password":null}',
        '{"password":null}',
      ]);
      expect(calls[0]?.path).toBe(`/api/employees/${id}/password`);
    });

    it('archives a person over the version read, and a moved record is a conflict', async () => {
      const { calls, api } = fake(json(personDoc), json({}, 409), json({}, 500));

      expect(await api.archiveEmployee(id, 'e1')).toMatchObject({
        kind: 'archived',
        doc: { version: 'e1' },
      });
      expect(await api.archiveEmployee(id, 'e0')).toEqual({ kind: 'conflict' });
      await expect(api.archiveEmployee(id, 'e1')).rejects.toMatchObject({ status: 500 });
      expect(calls[0]?.init).toMatchObject({ method: 'POST', body: '{"version":"e1"}' });
      expect(calls[0]?.path).toBe(`/api/employees/${id}/archive`);
    });

    it('changes a person’s code over the version read, a 409 with the newer person being a moved version and any other 409 a code taken', async () => {
      const { calls, api } = fake(
        json(personDoc),
        json({ current: personDoc }, 409),
        json({ error: 'That code is taken' }, 409),
        new Response('not json', { status: 409 }),
        json({}, 403),
      );
      const request = { version: 'e1', code: 'NV-1' };

      expect(await api.changeCode(id, request)).toMatchObject({
        kind: 'changed',
        doc: { version: 'e1' },
      });
      expect(await api.changeCode(id, request)).toEqual({ kind: 'conflict' });
      expect(await api.changeCode(id, request)).toEqual({ kind: 'taken' });
      expect(await api.changeCode(id, request)).toEqual({ kind: 'taken' });
      await expect(api.changeCode(id, request)).rejects.toMatchObject({ status: 403 });
      expect(calls[0]?.init).toMatchObject({ method: 'PUT', body: JSON.stringify(request) });
      expect(calls[0]?.path).toBe(`/api/employees/${id}/code`);
    });

    it('C: gives a person an email over the version read, a 409 with the newer person being a moved version and any other 409 an email taken', async () => {
      const { calls, api } = fake(
        json({ ...personDoc, employee: { ...person, email: 'lan@minh-phat.example' } }),
        json({ current: personDoc }, 409),
        json({ error: 'That email is taken' }, 409),
        new Response('not json', { status: 409 }),
        json({}, 403),
      );
      const request = { version: 'e1', email: 'Lan@Minh-Phat.Example' };

      expect(await api.setEmail(id, request)).toMatchObject({
        kind: 'set',
        doc: { employee: { email: 'lan@minh-phat.example' } },
      });
      expect(await api.setEmail(id, request)).toEqual({ kind: 'conflict' });
      expect(await api.setEmail(id, request)).toEqual({ kind: 'taken' });
      expect(await api.setEmail(id, request)).toEqual({ kind: 'taken' });
      await expect(api.setEmail(id, request)).rejects.toMatchObject({ status: 403 });
      expect(calls[0]?.init).toMatchObject({ method: 'PUT', body: JSON.stringify(request) });
      expect(calls[0]?.path).toBe(`/api/employees/${id}/email`);
    });

    it('C: asks for a QR code for one person and reads its link and end; signs a phone in by it, a refusal being a 401 for the page to say', async () => {
      const issued = {
        link: `/login?client-code=minh-phat&qr=${id}.${'a'.repeat(32)}`,
        expiresAt: 5,
      };
      const session = {
        authId: 'device-0001.secret',
        expiresAt: 9,
        user: { name: 'Lan', root: false, permissions: {} },
      };
      const { calls, api } = fake(json(issued), json({}, 403), json(session), json({}, 401));

      expect(await api.issueQr(id)).toEqual(issued);
      await expect(api.issueQr(id)).rejects.toMatchObject({ status: 403 });
      expect(await api.signInQr(id, 'a'.repeat(32))).toEqual(session);
      await expect(api.signInQr(id, 'b'.repeat(32))).rejects.toMatchObject({ status: 401 });
      expect(calls.map((call) => [call.init.method, call.path])).toEqual([
        ['POST', `/api/employees/${id}/qr`],
        ['POST', `/api/employees/${id}/qr`],
        ['POST', '/api/auth/sign-in-qr'],
        ['POST', '/api/auth/sign-in-qr'],
      ]);
      expect(calls[2]?.init.body).toBe(JSON.stringify({ id, secret: 'a'.repeat(32) }));
    });

    it('C: changes one’s own password giving the current one, a 403 being a current password that is wrong and any other failure an error', async () => {
      const session = {
        authId: 'device-0001.fresh',
        expiresAt: 9,
        user: { name: 'Lan', root: false, permissions: {} },
      };
      const { calls, api } = fake(json(session), json({}, 403), json({}, 400));

      expect(await api.changePassword('Old-password-1!', 'New-password-2@')).toEqual({
        kind: 'changed',
        session,
      });
      expect(await api.changePassword('Wrong-1!', 'New-password-2@')).toEqual({ kind: 'wrong' });
      await expect(api.changePassword('Old-password-1!', 'weak')).rejects.toMatchObject({
        status: 400,
      });
      expect(calls[0]?.init).toMatchObject({
        method: 'PUT',
        body: JSON.stringify({ current: 'Old-password-1!', password: 'New-password-2@' }),
      });
      expect(calls[0]?.path).toBe('/api/auth/password');
    });

    it('reads a person’s photo with its version and saves one over the version read, a moved version being a conflict', async () => {
      const photo = 'data:image/png;base64,AAAA';
      const { calls, api } = fake(
        json({ photo, version: 'p1' }),
        json({ photo: null, version: '' }),
        json({ photo, version: 'p2' }),
        json({ current: { photo, version: 'p3' } }, 409),
        json({}, 409),
        new Response('not json', { status: 409 }),
        json({}, 413),
        json({ photo: 'not an image', version: 'p3' }),
        json({}, 404),
      );

      expect(await api.getPhoto(id)).toEqual({ photo, version: 'p1' });
      expect(await api.getPhoto(id)).toEqual({ photo: null, version: '' });
      expect(await api.savePhoto(id, { photo, version: 'p1' })).toEqual({
        kind: 'saved',
        reply: { photo, version: 'p2' },
      });
      // a 409 carries the photo as it is now; one with none leaves the page to read it again
      expect(await api.savePhoto(id, { photo, version: 'p1' })).toEqual({
        kind: 'conflict',
        current: { photo, version: 'p3' },
      });
      for (let answer = 0; answer < 2; answer++) {
        expect(await api.savePhoto(id, { photo, version: 'p1' })).toEqual({
          kind: 'conflict',
          current: null,
        });
      }
      await expect(api.savePhoto(id, { photo, version: 'p1' })).rejects.toMatchObject({
        status: 413,
      });
      // a photo the schema refuses is no usable answer
      await expect(api.savePhoto(id, { photo, version: 'p2' })).rejects.toMatchObject({
        status: null,
      });
      await expect(api.getPhoto(id)).rejects.toMatchObject({ status: 404 });
      expect(calls[0]?.path).toBe(`/api/employees/${id}/photo`);
      expect(calls[2]?.init).toMatchObject({ method: 'PUT' });
    });
  });

  describe('the orders’ and the delivery requests’ calls', () => {
    const order = DEMO_ORDERS[0];
    const request = DEMO_DELIVERIES[0];
    const orderDoc = { order, version: 'o1' };
    const requestDoc = { request, version: 'g1' };
    const version = 'a'.repeat(64);
    const save = {
      day: order.day,
      customerId: order.customer.id,
      lines: [{ productId: order.lines[0].productId, quantity: 1 }],
      extra: {},
    };
    const send = { version, driverId: request.driver.id, day: request.day };

    it('lists a range of orders and reads one by its day and id; a refusal is an error with the BFF’s status', async () => {
      const { calls, api } = fake(
        json({ orders: [order] }),
        json(orderDoc),
        json({}, 404),
        json({}, 403),
        json({}, 404),
        json({}, 403),
      );

      expect(await api.listOrders('2026-10-29', '2026-11-04')).toEqual([order]);
      expect(await api.getOrder(order.day, order.id)).toEqual(orderDoc);
      await expect(api.getOrder(order.day, order.id)).rejects.toMatchObject({ status: 404 });
      await expect(api.listOrders('2026-10-29', '2026-11-04')).rejects.toMatchObject({
        status: 403,
      });
      await expect(api.getDelivery(request.day, request.id)).rejects.toMatchObject({ status: 404 });
      await expect(api.listDeliveries(request.day)).rejects.toMatchObject({ status: 403 });
      expect(calls.slice(0, 3).map((call) => [call.init.method, call.path])).toEqual([
        ['GET', '/api/orders?from=2026-10-29&to=2026-11-04'],
        ['GET', `/api/orders/${order.day}/${order.id}`],
        ['GET', `/api/orders/${order.day}/${order.id}`],
      ]);
    });

    it('makes an order with a POST, and saves, confirms, sends again and cancels one over the version read, each to its own route', async () => {
      const { calls, api } = fake(
        json(orderDoc, 201),
        json(orderDoc),
        json(orderDoc),
        json(orderDoc),
        json(orderDoc),
        json({}, 400),
        json({}, 403),
      );

      expect(await api.createOrder(save)).toEqual(orderDoc);
      expect(await api.saveOrder(order.day, order.id, { ...save, version })).toEqual({
        kind: 'done',
        doc: orderDoc,
      });
      expect((await api.confirmOrder(order.day, order.id, send)).kind).toBe('done');
      expect((await api.sendOrder(order.day, order.id, send)).kind).toBe('done');
      expect((await api.cancelOrder(order.day, order.id, { version })).kind).toBe('done');
      await expect(api.createOrder(save)).rejects.toMatchObject({ status: 400 });
      await expect(api.cancelOrder(order.day, order.id, { version })).rejects.toMatchObject({
        status: 403,
      });
      const path = `/api/orders/${order.day}/${order.id}`;
      expect(calls.slice(0, 5).map((call) => [call.init.method, call.path])).toEqual([
        ['POST', '/api/orders'],
        ['PUT', path],
        ['POST', `${path}/confirm`],
        ['POST', `${path}/send`],
        ['POST', `${path}/cancel`],
      ]);
      expect(JSON.parse(calls[1]?.init.body as string)).toEqual({ ...save, version });
    });

    it('a 409 on an order is a conflict that carries the order as it is now when the answer holds one the schema reads, and none otherwise', async () => {
      const { api } = fake(
        json({ error: 'moved', current: orderDoc }, 409),
        json({ error: 'moved', current: { order: 'nope' } }, 409),
        new Response('not json', { status: 409 }),
      );

      expect(await api.saveOrder(order.day, order.id, { ...save, version })).toEqual({
        kind: 'conflict',
        current: orderDoc,
      });
      expect(await api.confirmOrder(order.day, order.id, send)).toEqual({
        kind: 'conflict',
        current: null,
      });
      expect(await api.sendOrder(order.day, order.id, send)).toEqual({
        kind: 'conflict',
        current: null,
      });
    });

    it('lists a day’s requests, reads one, cancels one over the version read (a 409 being a conflict) and lists the drivers', async () => {
      const driver = request.driver;
      const { calls, api } = fake(
        json({ deliveries: [request] }),
        json(requestDoc),
        json(requestDoc),
        json({ error: 'moved', current: requestDoc }, 409),
        json({}, 500),
        json({ drivers: [driver] }),
        json({}, 403),
      );

      expect(await api.listDeliveries(request.day)).toEqual([request]);
      expect(await api.getDelivery(request.day, request.id)).toEqual(requestDoc);
      expect(await api.cancelDelivery(request.day, request.id, { version })).toEqual({
        kind: 'done',
        doc: requestDoc,
      });
      expect(await api.cancelDelivery(request.day, request.id, { version })).toEqual({
        kind: 'conflict',
        current: requestDoc,
      });
      await expect(api.cancelDelivery(request.day, request.id, { version })).rejects.toMatchObject({
        status: 500,
      });
      expect(await api.listDrivers()).toEqual([driver]);
      await expect(api.listDrivers()).rejects.toMatchObject({ status: 403 });
      expect(calls.slice(0, 3).map((call) => [call.init.method, call.path])).toEqual([
        ['GET', `/api/deliveries?day=${request.day}`],
        ['GET', `/api/deliveries/${request.day}/${request.id}`],
        ['POST', `/api/deliveries/${request.day}/${request.id}/cancel`],
      ]);
      expect(calls[5]?.path).toBe('/api/drivers');
    });

    it('lists a day’s closed days and closes a driver’s day with the requests the page showed and the cash (a 409 being a day that moved, any other refusal an error), and reads nothing that is not a closed day', async () => {
      const closed = DEMO_RECONCILIATIONS[0];
      const ask = { delivered: [request.id], waiting: [], handedIn: closed.handedIn };
      const { calls, api } = fake(
        json({ reconciliations: [closed] }),
        json({}, 403),
        json({ reconciliations: [{ day: 'nope' }] }),
        json(closed),
        json({ error: 'moved' }, 409),
        json({}, 503),
        json({ nope: true }),
      );

      expect(await api.listReconciliations(closed.day)).toEqual([closed]);
      await expect(api.listReconciliations(closed.day)).rejects.toMatchObject({ status: 403 });
      await expect(api.listReconciliations(closed.day)).rejects.toMatchObject({ status: null });
      expect(await api.closeDay(closed.day, closed.driver.id, ask)).toEqual({
        kind: 'closed',
        reconciliation: closed,
      });
      expect(await api.closeDay(closed.day, closed.driver.id, ask)).toEqual({ kind: 'moved' });
      await expect(api.closeDay(closed.day, closed.driver.id, ask)).rejects.toMatchObject({
        status: 503,
      });
      await expect(api.closeDay(closed.day, closed.driver.id, ask)).rejects.toMatchObject({
        status: null,
      });
      expect(calls.map((call) => [call.init.method, call.path])).toEqual([
        ['GET', `/api/reconciliations?day=${closed.day}`],
        ['GET', `/api/reconciliations?day=${closed.day}`],
        ['GET', `/api/reconciliations?day=${closed.day}`],
        ['POST', `/api/reconciliations/${closed.day}/${closed.driver.id}/close`],
        ['POST', `/api/reconciliations/${closed.day}/${closed.driver.id}/close`],
        ['POST', `/api/reconciliations/${closed.day}/${closed.driver.id}/close`],
        ['POST', `/api/reconciliations/${closed.day}/${closed.driver.id}/close`],
      ]);
      expect(JSON.parse(calls[3]?.init.body as string)).toEqual(ask);
    });

    it('lists the driver’s own requests of a day, delivers one over the version read with its photo (a 409 being a conflict, with the request as it is now when the answer holds one) and reads its photo', async () => {
      const photo =
        DEMO_DELIVERY_PHOTOS[DEMO_DELIVERIES.find((one) => one.state === 'delivered')!.id];
      const { calls, api } = fake(
        json({ deliveries: [request] }),
        json({}, 403),
        json(requestDoc),
        json({ error: 'moved', current: requestDoc }, 409),
        json({ error: 'moved' }, 409),
        json({}, 403),
        json({ photo }),
        json({}, 404),
      );

      expect(await api.myDeliveries(request.day)).toEqual([request]);
      await expect(api.myDeliveries(request.day)).rejects.toMatchObject({ status: 403 });
      expect(await api.deliver(request.day, request.id, { version, photo })).toEqual({
        kind: 'done',
        doc: requestDoc,
      });
      expect(await api.deliver(request.day, request.id, { version, photo })).toEqual({
        kind: 'conflict',
        current: requestDoc,
      });
      expect(await api.deliver(request.day, request.id, { version, photo })).toEqual({
        kind: 'conflict',
        current: null,
      });
      await expect(api.deliver(request.day, request.id, { version, photo })).rejects.toMatchObject({
        status: 403,
      });
      expect(await api.getDeliveryPhoto(request.day, request.id)).toEqual({ photo });
      await expect(api.getDeliveryPhoto(request.day, request.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(calls.map((call) => [call.init.method, call.path])).toEqual([
        ['GET', `/api/my-deliveries?day=${request.day}`],
        ['GET', `/api/my-deliveries?day=${request.day}`],
        ['POST', `/api/deliveries/${request.day}/${request.id}/deliver`],
        ['POST', `/api/deliveries/${request.day}/${request.id}/deliver`],
        ['POST', `/api/deliveries/${request.day}/${request.id}/deliver`],
        ['POST', `/api/deliveries/${request.day}/${request.id}/deliver`],
        ['GET', `/api/deliveries/${request.day}/${request.id}/photo`],
        ['GET', `/api/deliveries/${request.day}/${request.id}/photo`],
      ]);
      expect(calls[2]?.init.body).toBe(JSON.stringify({ version, photo }));
    });
  });
});

describe('the API client’s passkey calls', () => {
  it('The sign-in asks for options and sends the device’s answer with the token, with no client code, and returns the session with the operator’s id', async () => {
    const { calls, api } = fake(json({ options, token: 't.s' }), json(session));

    expect(await api.operatorPasskeyOptions()).toEqual({ options, token: 't.s' });
    expect(await api.operatorPasskeySignIn({ token: 't.s', response: credential })).toEqual(
      session,
    );

    expect(calls.map((call) => [call.init.method, call.path])).toEqual([
      ['POST', '/api/operator/passkey/options'],
      ['POST', '/api/operator/passkey/sign-in'],
    ]);
    expect(calls[0]?.init.body).toBeNull();
    expect(JSON.parse(calls[1]?.init.body as string)).toEqual({
      token: 't.s',
      response: credential,
    });
    for (const call of calls) expect(headersOf(call).has('x-client-code')).toBe(false);
  });

  it('A join opens a link by its token in the body, never the path or query, then sends the passkey made', async () => {
    const { calls, api } = fake(
      json({ options, token: 't.s', name: 'Lan Anh', madeBy: null }),
      json(session),
    );

    expect(await api.operatorJoinOptions(link)).toMatchObject({ name: 'Lan Anh', madeBy: null });
    await api.operatorJoin({ link, token: 't.s', response: credential });

    expect(calls.map((call) => call.path)).toEqual([
      '/api/operator/join/options',
      '/api/operator/join',
    ]);
    expect(calls.map((call) => call.path.includes(link))).toEqual([false, false]);
    expect(calls[0]?.init.body).toBe(JSON.stringify({ link }));
    expect(JSON.parse(calls[1]?.init.body as string)).toMatchObject({ link, token: 't.s' });
  });

  it('The operator’s own passkeys are listed, added with a token and removed by id, each with the operator’s handle', async () => {
    const list = { passkeys: [{ id: 'a', addedAt: 1, lastUsedAt: null }] };
    const { calls, api } = fake(
      json(list),
      json({ options, token: 't.s' }),
      json({ options, token: 'c.s' }),
      json(list, 201),
      json(list),
    );

    expect(await api.operatorPasskeys()).toEqual(list.passkeys);
    expect(await api.operatorPasskeyAddOptions()).toEqual({ options, token: 't.s' });
    expect(await api.operatorPasskeyConfirmOptions('add')).toEqual({ options, token: 'c.s' });
    expect(await api.operatorPasskeyAdd({ token: 't.s', response: credential, confirm })).toEqual(
      list.passkeys,
    );
    expect(await api.operatorPasskeyRemove('a b', confirm)).toEqual({
      kind: 'removed',
      passkeys: list.passkeys,
    });

    expect(calls.map((call) => [call.init.method, call.path])).toEqual([
      ['GET', '/api/operator/passkeys'],
      ['POST', '/api/operator/passkeys/options'],
      ['POST', '/api/operator/passkeys/confirm-options'],
      ['POST', '/api/operator/passkeys'],
      ['DELETE', '/api/operator/passkeys/a%20b'],
    ]);
    expect(JSON.parse(calls[2]?.init.body as string)).toEqual({ act: 'add' });
    expect(JSON.parse(calls[3]?.init.body as string)).toMatchObject({ confirm });
    expect(JSON.parse(calls[4]?.init.body as string)).toEqual({ confirm });
    for (const call of calls) {
      expect(headersOf(call).get('x-auth-id')).toBe('device-0001.operator');
      expect(headersOf(call).has('x-client-code')).toBe(false);
    }
  });

  it('Removing the last passkey is a result, not an error; any other refusal, or a wrong shape, is an error', async () => {
    const { api } = fake(
      json({ error: 'last' }, 409),
      json({}, 401),
      json({ passkeys: 1 }),
      json({}, 503),
      json({ options: {}, token: 't' }),
      json({}, 404),
      json({}, 503),
      json({}, 401),
      json({}, 503),
      json({}, 503),
      json({}, 401),
    );

    expect(await api.operatorPasskeyRemove('a', confirm)).toEqual({ kind: 'last' });
    await expect(api.operatorPasskeyRemove('a', confirm)).rejects.toMatchObject({ status: 401 });
    await expect(api.operatorPasskeys()).rejects.toMatchObject({ status: null });
    await expect(
      api.operatorPasskeyAdd({ token: 't', response: credential, confirm }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(api.operatorPasskeyOptions()).rejects.toMatchObject({ status: null });
    await expect(api.operatorJoinOptions(link)).rejects.toMatchObject({ status: 404 });
    await expect(api.operatorPasskeyAddOptions()).rejects.toMatchObject({ status: 503 });
    await expect(
      api.operatorJoin({ link, token: 't', response: credential }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(api.operatorPasskeyOptions()).rejects.toMatchObject({ status: 503 });
    await expect(api.operatorPasskeys()).rejects.toMatchObject({ status: 503 });
    await expect(api.operatorPasskeyConfirmOptions('add')).rejects.toMatchObject({ status: 401 });
  });

  it('C: A services check is a read marked as no use of the sign-in, with the operator’s handle and no client code; the BFF’s round trip and the moment are timed by the page’s clock, and c-storage’s time is the BFF’s own', async () => {
    const reply = { build: '4e1a9c7', storage: { build: '4e1a9c7', ms: 7 } };
    const clock = [1_000, 1_042];
    const { calls, api } = fakeAt(() => clock.shift()!, json(reply));

    expect(await api.operatorServices()).toEqual({ ...reply, bffMs: 42, checkedAt: 1_042 });
    expect(calls[0]?.path).toBe('/api/operator/services?renew=0');
    expect(calls[0]?.init.method).toBe('GET');
    expect(headersOf(calls[0]).get('x-auth-id')).toBe('device-0001.operator');
    expect(headersOf(calls[0]).has('x-client-code')).toBe(false);
  });

  it('C: A services check uses the real clock when none is given', async () => {
    const { api } = fake(json({ build: 'b', storage: { build: 'b', ms: 1 } }));
    const before = Date.now();

    const check = await api.operatorServices();

    expect(check.checkedAt).toBeGreaterThanOrEqual(before);
    expect(check.bffMs).toBeGreaterThanOrEqual(0);
  });

  it('C: A failure is the BFF’s only in the BFF’s own error shape: a 503 of that shape is c-storage silent; the edge’s own error, a failed request or a reply of the wrong shape is the BFF silent', async () => {
    const { api } = fake(
      json({ error: 'Service unavailable' }, 503),
      new Response('<html>Bad gateway</html>', { status: 503 }),
      json({ message: 'Service Unavailable' }, 503),
      new Error('offline'),
      json({ build: 'x' }),
      json({ error: 'Unauthorized' }, 401),
    );
    const failure = async () => await api.operatorServices().catch((error: unknown) => error);

    const storage = await failure();
    expect(storage).toMatchObject({ status: 503, bff: true });
    expect(hopOf(storage)).toBe('storage');
    for (const [name, error] of [
      ['edge html', await failure()],
      ['edge json', await failure()],
      ['no request', await failure()],
      ['wrong shape', await failure()],
    ] as const) {
      expect(hopOf(error), name).toBe('bff');
    }
    const signedOut = await failure();
    expect(signedOut).toMatchObject({ status: 401, bff: true });
    expect(hopOf(signedOut)).toBe('bff');
    expect(hopOf(new Error('not an ApiError'))).toBe('bff');
  });

  it('C: The calls a console meets before it is signed in keep whether the BFF answered, so a failure names its hop', async () => {
    const { api } = fake(
      json({ error: 'Service unavailable' }, 503),
      json({ error: 'Service unavailable' }, 503),
      new Response('Bad gateway', { status: 502 }),
    );

    await expect(api.operatorPasskeyOptions()).rejects.toMatchObject({ status: 503, bff: true });
    await expect(api.operatorMe()).rejects.toMatchObject({ status: 503, bff: true });
    await expect(
      api.operatorPasskeySignIn({ token: 't.s', response: credential }),
    ).rejects.toMatchObject({ status: 502, bff: false });
  });
});
