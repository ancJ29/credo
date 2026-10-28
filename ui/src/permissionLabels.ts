import type { PermissionId } from '@credo/shared';

/** Each permission's words, by their key in the dictionaries. */
export const PERMISSION_LABEL = {
  'staff.canView': 'permissions.staff_canView',
  'staff.canCreate': 'permissions.staff_canCreate',
  'staff.canEdit': 'permissions.staff_canEdit',
  'staff.canDelete': 'permissions.staff_canDelete',
} as const satisfies Record<PermissionId, string>;
