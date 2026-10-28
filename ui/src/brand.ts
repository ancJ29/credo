import { CREDO_COLOUR, type Language, type TenantConfig } from '@credo/shared';

/** What every screen shows of the company, sign-in included. */
export type Brand = Pick<TenantConfig, 'name' | 'logo'>;

/** What the app draws in before it knows the company: credo's own colour and, on a device that
 * has never booted and chose nothing, the market's language. */
export const BEFORE_CONFIG: { colour: string; language: Language } = {
  colour: CREDO_COLOUR,
  language: 'vi',
};

/** The operator belongs to no company, so its pages wear credo's own name and no logo. */
export const CREDO_BRAND: Brand = { name: 'Credo', logo: null };
