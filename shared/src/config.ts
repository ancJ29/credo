export const LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The tenant's settings, the one record the root edits. */
export type TenantConfig = {
  name: string;
  /** An inline image (`data:image/…`), or none. */
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
