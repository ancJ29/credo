import type { PermissionId } from '@credo/shared';

/** Each permission's words, by their key in the dictionaries. */
export const PERMISSION_LABEL = {
  'staff.canView': 'permissions.staff_canView',
  'staff.canCreate': 'permissions.staff_canCreate',
  'staff.canEdit': 'permissions.staff_canEdit',
  'staff.canDelete': 'permissions.staff_canDelete',
  'settings.canEdit': 'permissions.settings_canEdit',
} as const satisfies Record<PermissionId, string>;

/** The permissions that act on the staff list's pages, which only someone who sees the list can
 * open: granted without it, they have no page to work on. */
export const NEEDS_SEEING: readonly PermissionId[] = [
  'staff.canCreate',
  'staff.canEdit',
  'staff.canDelete',
];
