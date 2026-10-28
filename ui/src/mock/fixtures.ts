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
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

/** A company just made: no logo, one language, credo's own colour. */
export const FRESH: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#3e618c',
  languages: ['vi'],
  defaultLanguage: 'vi',
};

/** What the root typed before a save failed. */
export const TYPED: TenantConfig = {
  ...FILLED,
  name: 'Minh Phát Sài Gòn',
  colour: '#b4532a',
};

/** The root's sign-in name, and the password typed in the half-filled form. */
export const ROOT = { username: 'root', password: 'correct horse' };

/** The operator's sign-in name, and the password typed in the half-filled form. */
export const OPERATOR = { username: 'operator', password: 'correct horse' };

/** A client's code and name as the operator typed them into the form. */
export const NEW_CLIENT = { code: 'minh-phat', name: 'Minh Phát' };

/** What the operator is shown once a client is made: invented, like the company. */
export const MADE = {
  link: 'https://credo.example/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};
