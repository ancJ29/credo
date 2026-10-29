import type { Language } from '@credo/shared';

const LOCALE: Record<Language, string> = { vi: 'vi-VN', en: 'en-GB' };

/** A time as the day it names in the browser's time zone and the language shown: `29/10/2026` in
 * Vietnamese, `29 Oct 2026` in English; a dash for none. */
export function dayOf(time: number | null, language: Language) {
  if (time === null) return '—';
  return new Intl.DateTimeFormat(
    LOCALE[language],
    language === 'vi'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(time);
}
