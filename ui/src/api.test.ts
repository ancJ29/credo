import { type TenantConfig } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from './api';

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
  });
  return { calls, api };
}

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
      json({ authId: 'a.b', expiresAt: 1, operator: { name: 'operator' } }),
      json({ operator: { name: 'operator' } }),
      json({ link: '/login?client-code=minh-phat', rootName: 'root', password: 'x' }, 201),
      new Response(null, { status: 204 }),
      json({ user: { name: 'root', root: true } }),
    );

    await api.operatorSignIn('operator', 'pw');
    await api.operatorMe();
    await api.makeClient('minh-phat', 'Minh Phát');
    await api.operatorSignOut();
    await api.me();

    expect(calls.map((call) => call.path)).toEqual([
      '/api/operator/sign-in',
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
    await expect(api.operatorSignIn('a', 'b')).rejects.toMatchObject({ status: 401 });
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
});
