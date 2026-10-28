import { describe, expect, it } from 'vitest';
import { can, PERMISSIONS, permissionLayerSchema, resolvePermissions } from './permissions';

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
    });
    expect(resolvePermissions([department, position])).toEqual({
      'staff.canView': true,
      'staff.canCreate': true,
      'staff.canEdit': false,
      'staff.canDelete': false,
    });
    expect(resolvePermissions([department, position, person])['staff.canEdit']).toBe(true);
    // a refusal at the person's layer beats an allowance above it
    expect(resolvePermissions([department, {}, { 'staff.canView': false }])['staff.canView']).toBe(
      false,
    );
  });

  it('Piece 2’s permissions are to see the staff list, to add a person, to change a person’s name and details, and to archive a person; the root sets them at any of the three levels', () => {
    expect(PERMISSIONS).toEqual([
      'staff.canView',
      'staff.canCreate',
      'staff.canEdit',
      'staff.canDelete',
    ]);
    // each of the three levels takes any of them, and nothing the catalogue lacks
    const everything = Object.fromEntries(PERMISSIONS.map((id) => [id, true]));
    expect(permissionLayerSchema.safeParse(everything).success).toBe(true);
    expect(permissionLayerSchema.safeParse({ 'staff.canFire': true }).success).toBe(false);
    expect(permissionLayerSchema.safeParse({ 'staff.canView': 'yes' }).success).toBe(false);
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
});
