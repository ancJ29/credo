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

/** The office's calendar day at this browser: today as `YYYY-MM-DD`, the day a new order is filed
 * under. The walk fixes the browser's clock, and the fake build takes the data set's. */
export function localToday() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A `YYYY-MM-DD` day as the language writes it, the same everywhere: `04/11/2026` in Vietnamese,
 * `4 Nov 2026` in English. */
export function shownDay(day: string, language: Language) {
  return new Intl.DateTimeFormat(
    LOCALE[language],
    language === 'vi'
      ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  ).format(Date.parse(`${day}T00:00:00Z`));
}
