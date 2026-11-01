import type { PermissionId } from '@credo/shared';

/** Each permission's words, by their key in the dictionaries. */
export const PERMISSION_LABEL = {
  'staff.canView': 'permissions.staff_canView',
  'staff.canCreate': 'permissions.staff_canCreate',
  'staff.canEdit': 'permissions.staff_canEdit',
  'staff.canDelete': 'permissions.staff_canDelete',
  'settings.canEdit': 'permissions.settings_canEdit',
  'orders.canView': 'permissions.orders_canView',
  'orders.canEdit': 'permissions.orders_canEdit',
  'deliveries.canDeliver': 'permissions.deliveries_canDeliver',
} as const satisfies Record<PermissionId, string>;

/** The permissions that act on a page only someone who sees it can open, each with the one it
 * needs: granted without it, they have no page to work on. */
export const NEEDS: Partial<Record<PermissionId, PermissionId>> = {
  'staff.canCreate': 'staff.canView',
  'staff.canEdit': 'staff.canView',
  'staff.canDelete': 'staff.canView',
  'orders.canEdit': 'orders.canView',
};
