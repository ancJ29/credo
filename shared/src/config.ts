import { z } from 'zod';

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The tenant's settings, the one record the root edits. */
export type TenantConfig = {
  name: string;
  /** An inline image (`data:image/…`) of at most `MAX_LOGO_BYTES`, or none. */
  logo: string | null;
  /** The brand colour, `#rrggbb`. */
  colour: string;
  /** The languages offered, each once. */
  languages: Language[];
  defaultLanguage: Language;
};

export const isHexColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** At least one language, each once, and the default among them. */
export function languagesAreValid({
  languages,
  defaultLanguage,
}: Pick<TenantConfig, 'languages' | 'defaultLanguage'>) {
  return (
    languages.length > 0 &&
    new Set(languages).size === languages.length &&
    languages.includes(defaultLanguage)
  );
}

/** Credo's own colour, a new client's until its root changes it. */
export const CREDO_COLOUR = '#3e618c';

export const MAX_LOGO_BYTES = 200 * 1024;

const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]*)(={0,2})$/;

/** An image data URL whose decoded bytes are at most `MAX_LOGO_BYTES`. */
export function logoIsValid(logo: string) {
  const match = IMAGE_DATA_URL.exec(logo);
  const payload = match?.[1] ?? '';
  const padding = match?.[2] ?? '';
  if (!match || payload.length === 0 || (payload.length + padding.length) % 4 !== 0) return false;
  return ((payload.length + padding.length) / 4) * 3 - padding.length <= MAX_LOGO_BYTES;
}

export const tenantConfigSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    logo: z.string().refine(logoIsValid, 'an image of at most 200 KB').nullable(),
    colour: z.string().refine(isHexColour, '#rrggbb'),
    languages: z.array(z.enum(LANGUAGES)),
    defaultLanguage: z.enum(LANGUAGES),
  })
  .refine(languagesAreValid, {
    path: ['languages'],
    error: 'at least one language, each once, the default among them',
  }) satisfies z.ZodType<TenantConfig>;
