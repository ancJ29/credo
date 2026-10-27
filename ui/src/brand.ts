import type { Language, TenantConfig } from '@credo/shared';

/** What every screen shows of the company, sign-in included. */
export type Brand = Pick<TenantConfig, 'name' | 'logo'>;

/** What the app draws in before it knows the company: credo's own colour and the market's
 * language. */
export const BEFORE_CONFIG: { colour: string; language: Language } = {
  colour: '#3e618c',
  language: 'vi',
};
