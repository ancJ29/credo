import {
  IconActivity,
  IconBuildingStore,
  IconChartBar,
  IconServer,
  IconUserShield,
} from '@tabler/icons-react';
import type { MenuPage } from './nav';

/** The operator's sections, top to bottom. Clients is built; the other four are one empty page
 * each ("coming soon") until a plan fills them. The BFF checks the operator's session on every
 * call, so this menu is a view, never the guard. */
export const OPERATOR_PAGES = [
  { id: 'clients', path: '/operator/clients', label: 'nav.clients', icon: IconBuildingStore },
  { id: 'operators', path: '/operator/operators', label: 'nav.operators', icon: IconUserShield },
  { id: 'services', path: '/operator/services', label: 'nav.services', icon: IconServer },
  { id: 'usage', path: '/operator/usage', label: 'nav.usage', icon: IconChartBar },
  { id: 'activity', path: '/operator/activity', label: 'nav.activity', icon: IconActivity },
] as const satisfies readonly MenuPage[];

/** The sections that have no page of their own yet. */
export const SOON_PAGES = OPERATOR_PAGES.filter((page) => page.id !== 'clients');
