import { type Language } from '@credo/shared';
import i18next from 'i18next';
import { en } from './en';
import { vi } from './vi';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

/** Each language by its own name, as a chooser lists it. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', vi: 'Tiếng Việt' };

export const DICTIONARIES = { en, vi };

/**
 * One instance per tree, started in `language` with both dictionaries in the bundle, so the first
 * render already speaks. A missing key shows as the key, never as another language's words.
 */
export function createI18n(language: Language) {
  const instance = i18next.createInstance();
  void instance.init({
    resources: { en: { translation: en }, vi: { translation: vi } },
    lng: language,
    fallbackLng: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}
