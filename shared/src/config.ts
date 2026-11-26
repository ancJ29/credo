import { z } from 'zod';

export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The tenant's settings, the one record the root edits. */
export type TenantConfig = {
  name: string;
  /** The brand colour, `#rrggbb`. */
  colour: string;
  /** The header on white instead of the brand's colour. */
  whiteHeader: boolean;
  /** The side menu on white instead of the brand's colour. */
  whiteMenu: boolean;
  /** A PC's hidden menu leaves a strip of icons instead of hiding whole. */
  menuIcons: boolean;
  /** The languages offered, each once. */
  languages: Language[];
  defaultLanguage: Language;
  /** The name as typed, HTML, at most `MAX_FORMATTED_NAME` characters; empty where none. */
  formattedName: string;
  /** A short line under the name on the sign-in card, trimmed, at most `MAX_DESCRIPTION`; empty where none. */
  description: string;
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

/** The company's pictures, each a record of its own: the logo, the logo for the coloured header, the tab icon and the phone-app icon. */
export const PICTURE_KINDS = ['logo', 'logo-on-colour', 'tab-icon', 'app-icon'] as const;
export type PictureKind = (typeof PICTURE_KINDS)[number];
export const pictureKindSchema = z.enum(PICTURE_KINDS);

/** The longest formatted name, in characters, as the legacy app held it. */
export const MAX_FORMATTED_NAME = 1000;

/** The longest description, in characters, once trimmed. */
export const MAX_DESCRIPTION = 200;

const IMAGE_DATA_URL = /^data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/]*)(={0,2})$/;

/** The image type and the decoded size in bytes of an image data URL, or null when it is not a
 * well-formed one with a payload. */
export function imageDataUrl(url: string) {
  const match = IMAGE_DATA_URL.exec(url);
  const payload = match?.[2] ?? '';
  const padding = match?.[3] ?? '';
  if (!match || payload.length === 0 || (payload.length + padding.length) % 4 !== 0) return null;
  return {
    type: match[1],
    bytes: ((payload.length + padding.length) / 4) * 3 - padding.length,
  };
}

/** An image data URL whose decoded bytes are at most `MAX_LOGO_BYTES`. */
export function logoIsValid(logo: string) {
  const image = imageDataUrl(logo);
  return image !== null && image.bytes <= MAX_LOGO_BYTES;
}

/** A picture as stored: an image data URL within the bound, in a record of its own. */
export const storedPictureSchema = z.strictObject({
  picture: z.string().refine(logoIsValid, 'an image of at most 200 KB'),
  /** The phone-app icon's smaller size, which an iPhone is served: no other kind holds one. */
  small: z.string().refine(logoIsValid, 'an image of at most 200 KB').optional(),
});
export type StoredPicture = z.infer<typeof storedPictureSchema>;

const configShape = {
  name: z.string().trim().min(1),
  colour: z.string().refine(isHexColour, '#rrggbb'),
  whiteHeader: z.boolean().default(false),
  whiteMenu: z.boolean().default(false),
  menuIcons: z.boolean().default(false),
  languages: z.array(z.enum(LANGUAGES)),
  defaultLanguage: z.enum(LANGUAGES),
  formattedName: z.string().max(MAX_FORMATTED_NAME).default(''),
  description: z.string().trim().max(MAX_DESCRIPTION).default(''),
};
const languagesRule = {
  path: ['languages'],
  error: 'at least one language, each once, the default among them',
};

/** The settings as a save sends them and a reply names them: no logo, which is a picture of its own. */
export const tenantConfigSchema = z
  .strictObject(configShape)
  .refine(languagesAreValid, languagesRule) satisfies z.ZodType<TenantConfig>;

/** The settings as an older company stored them: the inline logo still there, a data URL or null.
 * Read by the move of that logo to a picture and by the seed's freshness check alone. */
export const storedConfigSchema = z
  .strictObject({
    ...configShape,
    logo: z.string().refine(logoIsValid, 'an image of at most 200 KB').nullable().optional(),
  })
  .refine(languagesAreValid, languagesRule);
export type StoredConfig = z.infer<typeof storedConfigSchema>;
