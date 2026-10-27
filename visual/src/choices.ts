import { LANGUAGES } from '@credo/shared';
import { type BlockEntry, blockText } from './block';
import type { Report } from './report';
import { answerKey } from './walks';

/** What the human has picked for one screen in one language, not yet sent. */
export type Choice = { answer: 'yes' | 'no' | ''; reason: string };
export type Choices = Record<string, Choice>;

const STORAGE_KEY = 'credo-walks-choices';

/** The fingerprint of each screen's words now, under its answer's key. */
export function fingerprintsOf(report: Report) {
  const prints = new Map<string, string>();
  for (const walk of report.walks) {
    for (const screen of walk.screens) {
      for (const language of LANGUAGES) {
        prints.set(answerKey(walk.id, screen.id, language), screen.languages[language].fingerprint);
      }
    }
  }
  return prints;
}

/**
 * The unsent choices kept in the browser, less any given on words that have since changed. The
 * page works without storage: a browser that refuses it, or holds something else under the key,
 * gives no choices.
 */
export function loadChoices(report: Report): Choices {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const prints = fingerprintsOf(report);
    const choices: Choices = {};
    for (const [key, one] of Object.entries(kept as Record<string, Record<string, unknown>>)) {
      if (
        prints.get(key) === one['fingerprint'] &&
        (one['answer'] === 'yes' || one['answer'] === 'no' || one['answer'] === '') &&
        typeof one['reason'] === 'string'
      ) {
        choices[key] = { answer: one['answer'], reason: one['reason'] };
      }
    }
    return choices;
  } catch {
    return {};
  }
}

/** Keeps the choices, each with the fingerprint it was given on; a browser that refuses is ignored. */
export function saveChoices(report: Report, choices: Choices) {
  try {
    const prints = fingerprintsOf(report);
    const kept = Object.fromEntries(
      Object.entries(choices).map(([key, choice]) => [
        key,
        { ...choice, fingerprint: prints.get(key) },
      ]),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // The page works without it.
  }
}

/**
 * The block to paste into the chat, from the answered screens in the walks' order; or the keys of
 * the "no" answers that still lack their reason, and no block.
 */
export function blockOf(report: Report, choices: Choices) {
  const prints = fingerprintsOf(report);
  const entries: BlockEntry[] = [];
  const missing: string[] = [];
  for (const [key, fingerprint] of prints) {
    const choice = choices[key];
    if (!choice || choice.answer === '') continue;
    if (choice.answer === 'no' && choice.reason.trim() === '') missing.push(key);
    entries.push({ key, answer: choice.answer, fingerprint, reason: choice.reason });
  }
  return { text: blockText(report.build, entries), answered: entries.length, missing };
}
