import type { TenantConfig } from '@credo/shared';

const logo = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="${fill}"/><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`,
  )}`;

/** An invented company, never a client's. */
export const FILLED: TenantConfig = {
  name: 'Minh Phát',
  logo: logo('#2f7d6d'),
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

/** A company just made: no logo, one language, credo's own colour. */
export const FRESH: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#3e618c',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi'],
  defaultLanguage: 'vi',
};

/** What the root typed before a save failed. */
export const TYPED: TenantConfig = {
  ...FILLED,
  name: 'Minh Phát Sài Gòn',
  colour: '#d97757',
};

/** What the root typed with the header and the menu on white. */
export const WHITE: TenantConfig = { ...TYPED, whiteHeader: true, whiteMenu: true };

/** The same with the hidden menu kept as a strip of icons. */
export const WHITE_ICONS: TenantConfig = { ...WHITE, menuIcons: true };

/** The root's sign-in name, and the password typed in the half-filled form. */
export const ROOT = { username: 'root', password: 'correct horse' };
