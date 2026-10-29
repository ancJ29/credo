import { staffSetupDocSchema } from '@credo/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { type RunningCStorage, startCStorage } from '../tests/c-storage';
import { staffTenant } from '../tests/staff';

let cs: RunningCStorage;
beforeAll(async () => {
  cs = await startCStorage(inject('cStorageBinary'));
});
afterAll(async () => {
  await cs.stop();
});

const unit = (name: string, extra: object = {}) => ({ name, permissions: {}, extra });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('The root keeps the company’s departments and positions, adding, renaming and removing them; a person names theirs by its id, so a rename follows them, and a removed one shows on them as it was saved', () => {
  it('reads an empty setup before any is saved, and mints an id for each unit sent without one', async () => {
    const t = await staffTenant(cs);
    const empty = staffSetupDocSchema.parse((await t.rootCall.get('/api/staff-setup')).json());
    expect(empty).toEqual({ setup: { departments: [], positions: [], extra: {} }, version: '' });

    const saved = await t.setup({ departments: [unit('Sales')], positions: [unit('Clerk')] });
    expect(saved.setup.departments[0]?.id).toMatch(UUID);
    expect(saved.setup.positions[0]?.id).toMatch(UUID);
    expect(saved.version).toMatch(/^[0-9a-f]{64}$/);
    const read = staffSetupDocSchema.parse((await t.rootCall.get('/api/staff-setup')).json());
    expect(read).toEqual(saved);
  });

  it('follows a rename by the id and keeps a removed unit’s name on the person as it was saved', async () => {
    const t = await staffTenant(cs);
    const first = await t.setup({ departments: [unit('Sales')] });
    const sales = first.setup.departments[0];
    const added = await t.rootCall.send('POST', '/api/employees', {
      name: 'Mai Linh',
      code: 'EMP-1',
      extra: {},
      departmentId: sales.id,
    });
    expect(added.statusCode).toBe(201);
    const personId = added.json<{ employee: { employee: { id: string } } }>().employee.employee.id;

    const renamed = await t.setup({ departments: [{ ...sales, name: 'Sales and shops' }] });
    expect(renamed.setup.departments[0]).toEqual({ ...sales, name: 'Sales and shops' });
    const kept = (await t.rootCall.get(`/api/employees/${personId}`)).json<{
      employee: { department: unknown };
    }>();
    expect(kept.employee.department).toEqual({ id: sales.id, name: 'Sales' });

    await t.setup({ departments: [] });
    const removed = (await t.rootCall.get(`/api/employees/${personId}`)).json<{
      employee: { department: unknown };
    }>();
    expect(removed.employee.department).toEqual({ id: sales.id, name: 'Sales' });
  });
});

describe('The staff setup saves with its tag; a department or position sent without an id gets one minted; a permission the catalogue lacks is a 400', () => {
  it('refuses a save over a setup that moved, 409 with the current one, and stores nothing of it', async () => {
    const t = await staffTenant(cs);
    const first = await t.setup({ departments: [unit('Sales')] });
    const second = await t.setup({ departments: [unit('Shops')] });
    const stale = await t.rootCall.send('PUT', '/api/staff-setup', {
      setup: { departments: [unit('From the old page')], positions: [], extra: {} },
      version: first.version,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<{ current: unknown }>().current).toEqual(second);
    expect((await t.rootCall.get('/api/staff-setup')).json()).toEqual(second);

    const firstEver = await staffTenant(cs);
    await firstEver.setup({ departments: [unit('Sales')] });
    const again = await firstEver.rootCall.send('PUT', '/api/staff-setup', {
      setup: { departments: [], positions: [], extra: {} },
      version: '',
    });
    expect(again.statusCode).toBe(409);
  });

  it('answers 409 with the current setup, not 400, for a stale save that names a unit since removed', async () => {
    const t = await staffTenant(cs);
    const first = await t.setup({ departments: [unit('Sales'), unit('Shops')] });
    const [sales, shops] = first.setup.departments;
    // Save 1 removes Shops; save 2, made over the old version, still names it.
    const second = await t.setup({ departments: [sales] });
    const stale = await t.rootCall.send('PUT', '/api/staff-setup', {
      setup: { departments: [sales, shops], positions: [], extra: {} },
      version: first.version,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<{ current: unknown }>().current).toEqual(second);
  });

  it('refuses a unit or a setup that leaves out its permissions or `extra`, 400, and stores nothing', async () => {
    const t = await staffTenant(cs);
    const saved = await t.setup({
      departments: [unit('Sales', { colour: 'red' })],
      extra: { note: 'kept' },
    });
    const sales = saved.setup.departments[0];
    const { permissions: _p, ...noPermissions } = sales;
    const { extra: _e, ...noExtra } = sales;
    const { extra: _s, ...setupNoExtra } = saved.setup;
    for (const setup of [
      { ...saved.setup, departments: [noPermissions] },
      { ...saved.setup, departments: [noExtra] },
      { ...saved.setup, positions: [{ name: 'New', extra: {} }] },
      setupNoExtra,
    ]) {
      const refused = await t.rootCall.send('PUT', '/api/staff-setup', {
        setup,
        version: saved.version,
      });
      expect(refused.statusCode, JSON.stringify(setup)).toBe(400);
    }
    expect((await t.rootCall.get('/api/staff-setup')).json()).toEqual(saved);
  });

  it('refuses a permission the catalogue lacks, a version that is no tag, and an id repeated or never saved, 400, and stores nothing', async () => {
    const t = await staffTenant(cs);
    const saved = await t.setup({ departments: [unit('Sales')] });
    const sales = saved.setup.departments[0];
    const bodies = [
      {
        ...saved,
        setup: {
          ...saved.setup,
          departments: [{ ...sales, permissions: { 'staff.canFly': true } }],
        },
      },
      { ...saved, version: 'v1' },
      { ...saved, setup: { ...saved.setup, departments: [sales, sales] } },
      {
        ...saved,
        setup: {
          ...saved.setup,
          departments: [{ ...sales, id: '3f2a91bc-0000-4000-8000-000000000001' }],
        },
      },
      { ...saved, setup: { ...saved.setup, positions: [{ ...sales, id: sales.id }] } },
    ];
    for (const body of bodies) {
      const refused = await t.rootCall.send('PUT', '/api/staff-setup', body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await t.rootCall.get('/api/staff-setup')).json()).toEqual(saved);
  });

  it('stores a unit’s extra as it was sent and returns it untouched', async () => {
    const t = await staffTenant(cs);
    const extra = { colour: '#fa0', nested: { a: [1, 'two', null, true] } };
    const saved = await t.setup({ departments: [unit('Sales', extra)], extra: { note: 'kept' } });
    expect(saved.setup.departments[0]?.extra).toEqual(extra);
    expect(saved.setup.extra).toEqual({ note: 'kept' });
  });
});

describe('The root chooses which optional fields the company keeps on a person, an email, a second phone, a photo, all off until turned on; a field turned off is hidden everywhere, and what was stored in it stays', () => {
  const licence = {
    key: 'licence',
    label: { vi: 'Bằng lái', en: 'Licence' },
    kind: 'choice',
    options: [{ value: 'b2', label: { vi: 'B2', en: 'B2' } }],
    inList: true,
  };

  it('stores the field switches, the company’s own fields and the numbering, and returns them as saved', async () => {
    const t = await staffTenant(cs);
    const sent = {
      fields: { personalPhone: true, photo: false },
      customFields: [licence],
      numbering: { prefix: 'NV', digits: 3 },
    };

    const saved = await t.setup(sent);

    expect(saved.setup).toMatchObject(sent);
    const read = staffSetupDocSchema.parse((await t.rootCall.get('/api/staff-setup')).json());
    expect(read).toEqual(saved);
  });

  it('keeps what a save leaves out, so a caller that predates a part erases nothing, and replaces what it sends', async () => {
    const t = await staffTenant(cs);
    const first = await t.setup({
      fields: { personalPhone: true, photo: true },
      customFields: [licence],
      numbering: { prefix: 'NV', digits: 3 },
    });

    const renamed = await t.setup({ departments: [unit('Sales')] });
    const replaced = await t.setup({
      fields: { personalPhone: false, photo: true },
      customFields: [],
      numbering: { prefix: 'A', digits: 2 },
    });

    expect(renamed.setup).toMatchObject({
      fields: first.setup.fields,
      customFields: first.setup.customFields,
      numbering: first.setup.numbering,
    });
    expect(replaced.setup).toMatchObject({
      fields: { personalPhone: false, photo: true },
      customFields: [],
      numbering: { prefix: 'A', digits: 2 },
    });
  });

  it('leaves a setup that never held them without them, as `staffConfig` reads it', async () => {
    const t = await staffTenant(cs);

    const saved = await t.setup({ departments: [unit('Sales')] });

    expect(saved.setup).not.toHaveProperty('fields');
    expect(saved.setup).not.toHaveProperty('customFields');
    expect(saved.setup).not.toHaveProperty('numbering');
  });

  it('refuses a field of no known kind, a key a built-in field holds or one used twice, a choice with no options, and a numbering that makes no code, 400, and stores nothing', async () => {
    const t = await staffTenant(cs);
    const saved = await t.setup({ customFields: [licence] });
    const send = (setup: object) =>
      t.rootCall.send('PUT', '/api/staff-setup', {
        setup: { departments: [], positions: [], extra: {}, ...setup },
        version: saved.version,
      });
    const text = (key: string) => ({ ...licence, key, kind: 'text', options: [] });
    const bad = [
      { customFields: [{ ...licence, kind: 'photo' }] },
      { customFields: [text('phone')] },
      { customFields: [text('personalPhone')] },
      { customFields: [text('note')] },
      { customFields: [text('a'), text('a')] },
      { customFields: [text('1a')] },
      { customFields: [{ ...licence, options: [] }] },
      { numbering: { prefix: 'nv', digits: 3 } },
      { numbering: { prefix: '', digits: 1 } },
      { numbering: { prefix: 'NV', digits: 9 } },
      { fields: { email: true } },
    ];

    for (const setup of bad) {
      const refused = await send(setup);
      expect(refused.statusCode, JSON.stringify(setup)).toBe(400);
    }
    expect((await t.rootCall.get('/api/staff-setup')).json()).toEqual(saved);
  });
});
