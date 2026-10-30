import { z } from 'zod';

/** The catalogue: what a person may do on each page built, in the order the editors list it.
 * Setting a password, issuing a QR code and keeping the staff setup are the root's alone and in no
 * catalogue. `settings.canEdit` lets someone who is not the root keep the company's settings. */
export const PERMISSIONS = [
  'staff.canView',
  'staff.canCreate',
  'staff.canEdit',
  'staff.canDelete',
  'settings.canEdit',
] as const;
export type PermissionId = (typeof PERMISSIONS)[number];

/** A sparse layer: a permission it does not name takes the layer before's value. */
export const permissionLayerSchema = z.strictObject(
  Object.fromEntries(PERMISSIONS.map((id) => [id, z.boolean().optional()])) as Record<
    PermissionId,
    z.ZodOptional<z.ZodBoolean>
  >,
);
export type PermissionLayer = Partial<Record<PermissionId, boolean>>;

type Unit = { id: string; permissions: PermissionLayer };

/** A person's layers in the order they apply, the one place that order is written: the
 * department's, the position's, then the person's own. A unit that is not in the setup (none, or
 * since removed) adds nothing. The BFF resolves with it, the fake as the BFF does, and the person's
 * page to show what a permission left alone would give. */
export function layersOf(
  setup: { departments: readonly Unit[]; positions: readonly Unit[] },
  held: { departmentId?: string | null; positionId?: string | null; own: PermissionLayer },
): PermissionLayer[] {
  const of = (units: readonly Unit[], id: string | null | undefined) =>
    units.find((unit) => unit.id === id)?.permissions ?? {};
  return [of(setup.departments, held.departmentId), of(setup.positions, held.positionId), held.own];
}

/** What a person may do, whole: the base allows nothing, then each layer in turn (department,
 * position, person), the later one winning where it names a permission. The root may do everything
 * and holds no layer. */
export function resolvePermissions(
  layers: readonly PermissionLayer[],
  root = false,
): Record<PermissionId, boolean> {
  return Object.fromEntries(
    PERMISSIONS.map((id) => [
      id,
      root || layers.reduce<boolean>((allowed, layer) => layer[id] ?? allowed, false),
    ]),
  ) as Record<PermissionId, boolean>;
}

/** The one question the menu, a page and a button ask. The root may do everything whatever it
 * holds; anything the permissions do not name is a refusal. */
export const can = (
  user: { root: boolean; permissions: PermissionLayer },
  id: PermissionId,
): boolean => user.root || user.permissions[id] === true;

/** What `own` changes over `below`, the layers beneath it: a permission that matches what they
 * already give is dropped, so a layer stores only its differences. */
export function differences(
  own: PermissionLayer,
  below: readonly PermissionLayer[],
): PermissionLayer {
  const inherited = resolvePermissions(below);
  return Object.fromEntries(
    PERMISSIONS.flatMap((id) =>
      own[id] === undefined || own[id] === inherited[id] ? [] : [[id, own[id]]],
    ),
  );
}
