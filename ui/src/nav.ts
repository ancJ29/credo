import { IconSettings } from '@tabler/icons-react';

/** The menu's pages, one for each piece built: piece 1 has Settings. */
export const PAGES = [
  { id: 'settings', path: '/settings', label: 'nav.settings', icon: IconSettings },
] as const;
