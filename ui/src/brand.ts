import { CREDO_COLOUR, type Language, type TenantConfig } from '@credo/shared';

/** What every screen shows of the company, sign-in included, its pictures as addresses; the formatted name and the description, empty where not given. */
export type Brand = Pick<TenantConfig, 'name'> &
  Partial<Pick<TenantConfig, 'formattedName' | 'description'>> & {
    /** The address of the company's logo, which the card and the header draw; none draws none. */
    logo: string | null;
    /** The address of the logo for the coloured header, which only the header draws. */
    logoOnColour?: string | null;
    /** The address of the company's tab icon, and of its phone-app icon at 192 pixels: the drawn ones where none is uploaded. */
    tabIcon?: string | null;
    appIcon?: string | null;
  };

/** What the app draws in before it knows the company: credo's own colour and, on a device that
 * has never booted and chose nothing, the market's language. */
export const BEFORE_CONFIG: { colour: string; language: Language } = {
  colour: CREDO_COLOUR,
  language: 'vi',
};

/** The operator belongs to no company, so its pages wear credo's own name and no logo. */
export const CREDO_BRAND: Brand = { name: 'Credo', logo: null };
