import { describe, expect, it } from 'vitest';
import {
  can,
  differences,
  layersOf,
  PERMISSIONS,
  permissionLayerSchema,
  resolvePermissions,
} from './permissions';

describe('permissions', () => {
  it('Each department and each position carries what its staff may do, and each person may carry their own; the person’s beats the position’s, which beats the department’s, and what none of them allows is refused', () => {
    const department = { 'staff.canView': true, 'staff.canEdit': true };
    const position = { 'staff.canEdit': false, 'staff.canCreate': true };
    const person = { 'staff.canEdit': true };

    expect(resolvePermissions([])).toEqual({
      'staff.canView': false,
      'staff.canCreate': false,
      'staff.canEdit': false,
      'staff.canDelete': false,
      'settings.canEdit': false,
      'orders.canView': false,
      'orders.canEdit': false,
      'deliveries.canDeliver': false,
    });
    expect(resolvePermissions([department, position])).toEqual({
      'staff.canView': true,
      'staff.canCreate': true,
      'staff.canEdit': false,
      'staff.canDelete': false,
      'settings.canEdit': false,
      'orders.canView': false,
      'orders.canEdit': false,
      'deliveries.canDeliver': false,
    });
    expect(resolvePermissions([department, position, person])['staff.canEdit']).toBe(true);
    // a refusal at the person's layer beats an allowance above it
    expect(resolvePermissions([department, {}, { 'staff.canView': false }])['staff.canView']).toBe(
      false,
    );
  });

  it('gives a person’s layers in the order they apply, department then position then their own, a unit not in the setup adding nothing', () => {
    const department = { id: 'd1', permissions: { 'staff.canView': true } };
    const position = { id: 'p1', permissions: { 'staff.canView': false } };
    const setup = { departments: [department], positions: [position] };
    const own = { 'staff.canEdit': true };

    expect(layersOf(setup, { departmentId: 'd1', positionId: 'p1', own })).toEqual([
      department.permissions,
      position.permissions,
      own,
    ]);
    // none, and one since removed, add an empty layer in their place
    expect(layersOf(setup, { departmentId: null, positionId: 'gone', own })).toEqual([{}, {}, own]);
    expect(layersOf(setup, { own })).toEqual([{}, {}, own]);
  });

  it('The root sets three new permissions at a department, a position or a person, as piece 2’s: to see orders and delivery requests with the customer and product lists, to make and send orders, and to deliver goods; office staff do what theirs allow', () => {
    const office = { 'orders.canView': true, 'orders.canEdit': true };
    const driver = { 'deliveries.canDeliver': true };

    expect(PERMISSIONS.slice(-3)).toEqual([
      'orders.canView',
      'orders.canEdit',
      'deliveries.canDeliver',
    ]);
    // each level gives each one, and a later refusal takes it away
    for (const id of ['orders.canView', 'orders.canEdit', 'deliveries.canDeliver'] as const) {
      const given = { [id]: true };
      for (const layers of [
        [given, {}, {}],
        [{}, given, {}],
        [{}, {}, given],
      ]) {
        expect(can({ root: false, permissions: resolvePermissions(layers) }, id), id).toBe(true);
      }
      expect(resolvePermissions([given, { [id]: false }])[id], id).toBe(false);
      expect(can({ root: false, permissions: {} }, id), id).toBe(false);
    }
    // the office does what its layer allows: it sees and makes orders, and is no driver
    const staff = { root: false, permissions: resolvePermissions([office]) };
    expect(can(staff, 'orders.canView')).toBe(true);
    expect(can(staff, 'orders.canEdit')).toBe(true);
    expect(can(staff, 'deliveries.canDeliver')).toBe(false);
    expect(can({ root: false, permissions: resolvePermissions([driver]) }, 'orders.canView')).toBe(
      false,
    );
  });

  it('Piece 2’s permissions are to see the staff list, to add a person, to change a person’s name and details, and to archive a person; the root sets them at any of the three levels', () => {
    expect(PERMISSIONS).toEqual([
      'staff.canView',
      'staff.canCreate',
      'staff.canEdit',
      'staff.canDelete',
      'settings.canEdit',
      'orders.canView',
      'orders.canEdit',
      'deliveries.canDeliver',
    ]);
    // each of the three levels takes any of them, and nothing the catalogue lacks
    const everything = Object.fromEntries(PERMISSIONS.map((id) => [id, true]));
    expect(permissionLayerSchema.safeParse(everything).success).toBe(true);
    expect(permissionLayerSchema.safeParse({ 'staff.canFire': true }).success).toBe(false);
    expect(permissionLayerSchema.safeParse({ 'staff.canView': 'yes' }).success).toBe(false);
  });

  it('A department, a position or a person may be allowed to change the company’s settings', () => {
    const allowed = { 'settings.canEdit': true };
    const nobody = { root: false, permissions: {} };

    expect(can(nobody, 'settings.canEdit')).toBe(false);
    // each level on its own gives it, and a later refusal takes it away
    for (const layers of [
      [allowed, {}, {}],
      [{}, allowed, {}],
      [{}, {}, allowed],
    ]) {
      const permissions = resolvePermissions(layers);
      expect(can({ root: false, permissions }, 'settings.canEdit'), JSON.stringify(layers)).toBe(
        true,
      );
    }
    expect(resolvePermissions([allowed, { 'settings.canEdit': false }])['settings.canEdit']).toBe(
      false,
    );
    expect(permissionLayerSchema.safeParse(allowed).success).toBe(true);
  });

  it('One catalogue and one resolver, in `shared/`, serve the BFF’s check and the root’s editors; the editors list the catalogue in its order', () => {
    // the layer's fields are the catalogue's, in its order
    expect(Object.keys(permissionLayerSchema.shape)).toEqual([...PERMISSIONS]);
    // the resolver answers every permission of the catalogue, in its order
    expect(Object.keys(resolvePermissions([{}]))).toEqual([...PERMISSIONS]);
  });

  it('The root may do everything whatever they hold, and a permission not named is a refusal', () => {
    expect(resolvePermissions([{ 'staff.canView': false }], true)).toEqual(
      Object.fromEntries(PERMISSIONS.map((id) => [id, true])),
    );
    expect(can({ root: true, permissions: {} }, 'staff.canDelete')).toBe(true);
    expect(can({ root: false, permissions: { 'staff.canView': true } }, 'staff.canView')).toBe(
      true,
    );
    expect(can({ root: false, permissions: { 'staff.canView': true } }, 'staff.canEdit')).toBe(
      false,
    );
    expect(can({ root: false, permissions: {} }, 'staff.canView')).toBe(false);
  });

  it('A person’s own permissions store only what differs from their position’s and department’s', () => {
    const below = [{ 'staff.canView': true, 'staff.canEdit': true }, { 'staff.canEdit': false }];

    expect(
      differences(
        {
          'staff.canView': true,
          'staff.canEdit': false,
          'staff.canCreate': true,
          'staff.canDelete': false,
        },
        below,
      ),
    ).toEqual({ 'staff.canCreate': true });
    expect(differences({ 'staff.canEdit': true }, below)).toEqual({ 'staff.canEdit': true });
    expect(differences({}, below)).toEqual({});
  });
});
