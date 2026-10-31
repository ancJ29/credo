import { can, type PermissionLayer } from '@credo/shared';
import {
  IconAddressBook,
  IconPackage,
  IconSettings,
  IconSitemap,
  IconUsers,
} from '@tabler/icons-react';
import type { ParseKeys } from 'i18next';

/** What the shell's menu draws of a page: where it is, its words and its icon. */
export type MenuPage = {
  id: string;
  path: string;
  label: ParseKeys;
  icon: typeof IconUsers;
};

type Person = { root: boolean; permissions: PermissionLayer };

/** The menu's pages, one for each piece built, in the order the menu lists them. A page is in a
 * person's menu only when `allowed` says so; the BFF checks the same on every call, so this is a
 * view of it, never the guard. */
export const PAGES = [
  {
    id: 'settings',
    path: '/settings',
    label: 'nav.settings',
    icon: IconSettings,
    allowed: (user: Person) => can(user, 'settings.canEdit'),
  },
  {
    id: 'staff',
    path: '/staff',
    label: 'nav.staff',
    icon: IconUsers,
    allowed: (user: Person) => can(user, 'staff.canView'),
  },
  {
    id: 'staff-setup',
    path: '/staff-setup',
    label: 'nav.staffSetup',
    icon: IconSitemap,
    allowed: (user: Person) => user.root,
  },
  {
    id: 'customers',
    path: '/customers',
    label: 'nav.customers',
    icon: IconAddressBook,
    allowed: (user: Person) => user.root,
  },
  {
    id: 'products',
    path: '/products',
    label: 'nav.products',
    icon: IconPackage,
    allowed: (user: Person) => user.root,
  },
] as const;

export type Page = (typeof PAGES)[number];

/** The pages a person's menu lists. */
export const pagesOf = (user: Person): readonly Page[] =>
  PAGES.filter((page) => page.allowed(user));

/** Whether a page may be opened by a person: the one question the menu and every route ask, so a
 * page never opens by its address for someone whose menu lacks it. */
export const mayOpen = (user: Person, id: Page['id']) =>
  PAGES.some((page) => page.id === id && page.allowed(user));
