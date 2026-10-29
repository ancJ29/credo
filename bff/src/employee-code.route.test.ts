import { CStorageError, type CStorageClient, nextCode, storedUserSchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { personCalls, staffTenant } from '../tests/staff';
import { seedEmployee, signIn } from '../tests/tenant';
import { ADD_MAX_MS } from './staff';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const { add, added, doc, codes, me } = personCalls;

describe('A code left empty is the next number under the company’s prefix and length (`EMP-` and 4 digits until the root sets them), counted past every code ever given, people who left included', () => {
  it('numbers an add with no code `EMP-0001`, then past the highest under the default prefix', async () => {
    const t = await staffTenant(cs);

    const first = await added(t.rootCall, { code: undefined });
    await added(t.rootCall, { code: 'EMP-0007' });
    const next = await added(t.rootCall, { code: undefined });

    expect(first.employee.employee.code).toBe('EMP-0001');
    expect(next.employee.employee.code).toBe('EMP-0008');
    expect(
      (await signIn(t.app, { name: 'emp-0008', password: next.password as string })).response
        .statusCode,
    ).toBe(200);
  });

  it('numbers under the prefix and digits the root set, and past a person who left', async () => {
    const t = await staffTenant(cs);
    await t.setup({ numbering: { prefix: 'NV', digits: 3 } });
    const first = await added(t.rootCall, { code: 'NV009' });
    await t.rootCall.send('POST', `/api/employees/${first.employee.employee.id}/archive`, {
      version: first.employee.version,
    });

    const numbered = await added(t.rootCall, { code: undefined });

    expect(numbered.employee.employee.code).toBe('NV010');
  });

  it('numbers an add by someone allowed to add people, from the setup they were read with', async () => {
    const t = await staffTenant(cs);
    await t.setup({ numbering: { prefix: 'A-', digits: 2 } });
    const office = await t.staff('OFFICE', { own: { 'staff.canCreate': true } });

    const numbered = await added(office.call, { code: undefined });

    expect(numbered.employee.employee.code).toBe('A-01');
    expect(numbered.password).toBeNull();
  });

  it('takes the next number when the one it counted is taken in between, and says 503 after three tries', async () => {
    let hook: (codes: string[]) => Promise<unknown> = () => Promise.resolve();
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async listRecords(prefix) {
          const listed = await client.listRecords(prefix);
          await hook(listed.records.map((record) => (record.data as { code: string }).code));
          return listed;
        },
      }),
    });
    const takeNext = (codes: string[]) =>
      seedEmployee(t.client, t.id, {
        code: nextCode({ prefix: 'EMP-', digits: 4 }, codes),
      });

    let races = 1;
    hook = async (codes) => {
      if (races-- > 0) await takeNext(codes);
    };
    const once = await added(t.rootCall, { code: undefined });
    expect(once.employee.employee.code).toBe('EMP-0002');

    races = 3;
    const stuck = await add(t.rootCall, { code: undefined });
    expect(stuck.statusCode).toBe(503);
    expect(await codes(t.rootCall)).toEqual([
      'EMP-0001',
      'EMP-0002',
      'EMP-0003',
      'EMP-0004',
      'EMP-0005',
    ]);
  });
});

describe('A numbered code lost to a store that cannot answer', () => {
  it('answers 503 and writes no person when c-storage fails on the claim', async () => {
    let fail = false;
    let tries = 0;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (fail && key.includes('.user.')) {
            tries++;
            throw new CStorageError(503, 'down');
          }
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });
    fail = true;

    const failed = await add(t.rootCall, { code: undefined });
    fail = false;

    expect(failed.statusCode).toBe(503);
    // A store that does not answer is not a lost race: no other number is tried.
    expect(tries).toBe(1);
    expect(await codes(t.rootCall)).toEqual([]);
  });

  it('answers 500, never a short list to count from, when the list is longer than c-storage returns', async () => {
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        listRecords: async (prefix) => ({ ...(await client.listRecords(prefix)), more: true }),
      }),
    });

    expect((await add(t.rootCall, { code: undefined })).statusCode).toBe(500);
    expect(await t.client.getRecord(t.keys.user('emp-0001'))).toBeNull();
  });
});

describe('The root changes a person’s code: from then on they sign in with the new one, they are signed out everywhere, and nothing that names the person changes', () => {
  const change = (call: Parameters<typeof add>[0], id: string, version: string, code: string) =>
    call.send('PUT', `/api/employees/${id}/code`, { version, code });

  it('gives the person the new code, the same password and the same id, and frees the old code', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    const password = reply.password as string;

    const changed = await change(t.rootCall, id, reply.employee.version, 'new-1');

    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      employee: { id, code: 'NEW-1' },
      signIn: { name: 'NEW-1', ready: true },
    });
    expect((await signIn(t.app, { name: 'new-1', password })).response.statusCode).toBe(200);
    expect((await signIn(t.app, { name: 'EMP-1', password })).response.statusCode).toBe(401);
    expect(await t.client.getRecord(t.keys.user('emp-1'))).toBeNull();
    expect((await doc(t.rootCall, id)).employee.code).toBe('NEW-1');
    // The old code is free again.
    expect((await add(t.rootCall, { code: 'EMP-1', name: 'Another' })).statusCode).toBe(201);
  });

  it('signs the person out on every device, at their next step', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const pc = await signIn(t.app, { name: 'EMP-1', password: reply.password as string });
    const phone = await signIn(
      t.app,
      { name: 'EMP-1', password: reply.password as string },
      'device-bbbb-0002',
    );
    expect((await me(t, pc.body.authId)).statusCode).toBe(200);

    await change(t.rootCall, reply.employee.employee.id, reply.employee.version, 'NEW-1');

    expect((await me(t, pc.body.authId)).statusCode).toBe(401);
    expect((await me(t, phone.body.authId)).statusCode).toBe(401);
  });

  it('refuses a code taken in any case, by a person who left too, 409 with no newer person, and changes nothing', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const other = await added(t.rootCall, { code: 'EMP-2' });
    await t.rootCall.send('POST', `/api/employees/${other.employee.employee.id}/archive`, {
      version: other.employee.version,
    });

    const refused = await change(
      t.rootCall,
      reply.employee.employee.id,
      reply.employee.version,
      'emp-2',
    );

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).not.toHaveProperty('current');
    expect((await doc(t.rootCall, reply.employee.employee.id)).employee.code).toBe('EMP-1');
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(200);
  });

  it('answers a version that moved 409 with the newer person, and claims nothing', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    await t.rootCall.send('PUT', `/api/employees/${id}`, {
      version: reply.employee.version,
      name: 'Renamed',
      extra: {},
    });

    const stale = await change(t.rootCall, id, reply.employee.version, 'NEW-1');

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ current: { employee: { id, name: 'Renamed' } } });
    expect(await t.client.getRecord(t.keys.user('new-1'))).toBeNull();
  });

  it('gives the code back when the person moves between the read and the write: 409 with the newer person, and the new code is free at once', async () => {
    let move: () => Promise<unknown> = () => Promise.resolve();
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async getRecord(key) {
          const found = await client.getRecord(key);
          if (key.includes('.employee.')) await move();
          return found;
        },
      }),
    });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    move = async () => {
      move = () => Promise.resolve();
      const found = await t.client.getRecord(t.keys.employee(id));
      await t.client.putRecord(
        t.keys.employee(id),
        { ...(found!.data as object), name: 'Moved' },
        found!.tag,
      );
    };

    const lost = await change(t.rootCall, id, reply.employee.version, 'NEW-1');

    expect(lost.statusCode).toBe(409);
    expect(lost.json()).toMatchObject({ current: { employee: { name: 'Moved', code: 'EMP-1' } } });
    expect(await t.client.getRecord(t.keys.user('new-1'))).toBeNull();
  });

  it('leaves a claim that another person has since taken over alone when the person moves', async () => {
    let move: () => Promise<unknown> = () => Promise.resolve();
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (key.includes('.employee.')) await move();
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    const other = '3f2a91bc-0000-4000-8000-000000000001';
    move = async () => {
      move = () => Promise.resolve();
      const found = await t.client.getRecord(t.keys.employee(id));
      await t.client.putRecord(
        t.keys.employee(id),
        { ...(found!.data as object), name: 'Moved' },
        found!.tag,
      );
      const claim = await t.client.getRecord(t.keys.user('new-1'));
      await t.client.putRecord(
        t.keys.user('new-1'),
        { ...(claim!.data as object), employeeId: other },
        claim!.tag,
      );
    };

    const lost = await change(t.rootCall, id, reply.employee.version, 'NEW-1');

    expect(lost.statusCode).toBe(409);
    expect(
      storedUserSchema.parse((await t.client.getRecord(t.keys.user('new-1')))?.data).employeeId,
    ).toBe(other);
  });

  it('answers 409 and changes nothing for a person whose sign-in record is not theirs', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const found = await t.client.getRecord(t.keys.user('emp-1'));
    await t.client.putRecord(
      t.keys.user('emp-1'),
      { ...(found!.data as object), employeeId: '3f2a91bc-0000-4000-8000-000000000001' },
      found!.tag,
    );

    const refused = await change(
      t.rootCall,
      reply.employee.employee.id,
      reply.employee.version,
      'NEW-1',
    );

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).not.toHaveProperty('current');
    expect(await t.client.getRecord(t.keys.user('new-1'))).toBeNull();
  });

  it('is the root’s alone, 403 to someone with every permission, and a person who left, no one, a version that is no tag and a code that is no code are refused', async () => {
    const t = await staffTenant(cs);
    const boss = await t.staff('BOSS', {
      own: {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'staff.canDelete': true,
      },
    });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    const id = reply.employee.employee.id;
    const gone = await added(t.rootCall, { code: 'EMP-2' });
    const archived = await t.rootCall.send(
      'POST',
      `/api/employees/${gone.employee.employee.id}/archive`,
      {
        version: gone.employee.version,
      },
    );

    expect((await change(boss.call, id, reply.employee.version, 'NEW-1')).statusCode).toBe(403);
    expect(
      (
        await change(
          t.rootCall,
          gone.employee.employee.id,
          archived.json<{ version: string }>().version,
          'NEW-2',
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await change(
          t.rootCall,
          '3f2a91bc-0000-4000-8000-000000000001',
          reply.employee.version,
          'NEW-1',
        )
      ).statusCode,
    ).toBe(404);
    expect((await change(t.rootCall, id, 'not a tag', 'NEW-1')).statusCode).toBe(400);
    expect((await change(t.rootCall, id, reply.employee.version, 'no code!')).statusCode).toBe(400);
    expect((await doc(t.rootCall, id)).employee.code).toBe('EMP-1');
    expect(await t.client.getRecord(t.keys.user('new-1'))).toBeNull();
  });

  it('answers the person as they are, writing nothing, when the code is the one they hold', async () => {
    const t = await staffTenant(cs);
    const reply = await added(t.rootCall, { code: 'EMP-1' });

    const same = await change(
      t.rootCall,
      reply.employee.employee.id,
      reply.employee.version,
      'emp-1',
    );

    expect(same.statusCode).toBe(200);
    expect(same.json()).toMatchObject({ version: reply.employee.version });
  });

  it('keeps a code taken for a minute when the person’s write fails, as a failed add does, and leaves the old code signing in', async () => {
    let fail = false;
    const t = await staffTenant(cs, {
      wrap: (client): CStorageClient => ({
        ...client,
        async putRecord(key, data, ifTag) {
          if (fail && key.includes('.employee.')) throw new CStorageError(503, 'down');
          return await client.putRecord(key, data, ifTag);
        },
      }),
    });
    const reply = await added(t.rootCall, { code: 'EMP-1' });
    fail = true;

    const failed = await change(
      t.rootCall,
      reply.employee.employee.id,
      reply.employee.version,
      'NEW-1',
    );
    fail = false;

    expect(failed.statusCode).toBe(503);
    expect(
      (await signIn(t.app, { name: 'EMP-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(200);
    expect(
      (await signIn(t.app, { name: 'NEW-1', password: reply.password as string })).response
        .statusCode,
    ).toBe(401);
    t.time.advance(ADD_MAX_MS + 1);
    expect(
      (await change(t.rootCall, reply.employee.employee.id, reply.employee.version, 'NEW-1'))
        .statusCode,
    ).toBe(200);
  });
});

describe('A session ends with its code, and no session of a code that was freed meets the person who takes it next', () => {
  it('refuses the old session of a freed code when another person is added under it in the same instant', async () => {
    const t = await staffTenant(cs);
    const first = await added(t.rootCall, { code: 'EMP-1', name: 'First' });
    const session = await signIn(t.app, { name: 'EMP-1', password: first.password as string });
    expect((await me(t, session.body.authId)).statusCode).toBe(200);

    await t.rootCall.send('PUT', `/api/employees/${first.employee.employee.id}/code`, {
      version: first.employee.version,
      code: 'EMP-9',
    });
    // The clock has not moved: the next claim of the freed code reads the same time.
    const second = await added(t.rootCall, { code: 'EMP-1', name: 'Second' });

    expect((await me(t, session.body.authId)).statusCode).toBe(401);
    const fresh = await signIn(t.app, { name: 'EMP-1', password: second.password as string });
    expect((await me(t, fresh.body.authId)).json()).toMatchObject({ user: { name: 'Second' } });
    const record = storedUserSchema.parse((await t.client.getRecord(t.keys.user('emp-1')))?.data);
    expect(record.employeeId).toBe(second.employee.employee.id);
  });

  it('refuses the old session of a code a code change claimed, once that code is freed and claimed by a change again', async () => {
    const t = await staffTenant(cs);
    const one = await added(t.rootCall, { code: 'EMP-1', name: 'One' });
    const two = await added(t.rootCall, { code: 'EMP-2', name: 'Two' });
    const change = (reply: typeof one, code: string, version = reply.employee.version) =>
      t.rootCall.send('PUT', `/api/employees/${reply.employee.employee.id}/code`, {
        version,
        code,
      });
    const moved = await change(one, 'EMP-9');
    const session = await signIn(t.app, { name: 'EMP-9', password: one.password as string });
    expect((await me(t, session.body.authId)).statusCode).toBe(200);

    await change(one, 'EMP-8', moved.json<{ version: string }>().version);
    expect((await change(two, 'EMP-9')).statusCode).toBe(200);

    expect((await me(t, session.body.authId)).statusCode).toBe(401);
  });
});
