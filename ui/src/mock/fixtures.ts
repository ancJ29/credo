import type { TenantConfig } from '@credo/shared';

/** An invented logo for the mock's companies, drawn in a fill. */
const logo = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="${fill}"/><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`,
  )}`;

/** The logo an invented company holds, as the data URL itself: its picture. */
export const LOGO = logo('#2f7d6d');

/** An invented white mark, the logo for the coloured header of the company that has one. */
export const LIGHT_LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>',
)}`;

/** An invented company, never a client's. */
export const FILLED: TenantConfig = {
  name: 'Minh Phát',
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
  formattedName: '',
  description: '',
};

/** A company just made: no logo, one language, credo's own colour. */
export const FRESH: TenantConfig = {
  name: 'Minh Phát',
  colour: '#3e618c',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi'],
  defaultLanguage: 'vi',
  formattedName: '',
  description: '',
};

/** What the root typed before a save failed. */
export const TYPED: TenantConfig = {
  ...FILLED,
  name: 'Minh Phát Sài Gòn',
  colour: '#9e2d20',
};

/** A company that set a formatted name and a description, as the walk's root types them. */
export const FORMATTED: TenantConfig = {
  ...FILLED,
  formattedName: '<b>Minh Phát</b><br><span style="color:#1d3557">Sài Gòn</span>',
  description: 'Vật liệu xây dựng, giao tận công trình',
};

/** What the root typed with the header and the menu on white. */
export const WHITE: TenantConfig = { ...TYPED, whiteHeader: true, whiteMenu: true };

/** The same with the hidden menu kept as a strip of icons. */
export const WHITE_ICONS: TenantConfig = { ...WHITE, menuIcons: true };

/** The root's sign-in name, and the password typed in the half-filled form. */
export const ROOT = { username: 'root', password: 'correct horse' };
