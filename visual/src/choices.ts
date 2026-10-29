import { LANGUAGES } from '@credo/shared';
import { LANGUAGE_LABEL } from './marks';
import { blockText, LABEL } from './block';
import type { Report } from './report';
import { normalizeLabel, type ShareItem, shareText } from './share';
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

/** A choice is kept this long without being touched. */
const KEEP_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** What the browser holds for one choice: the answer and reason, the words they were given on, the day. */
type Kept = { answer: Choice['answer']; reason: string; fingerprint: string; at?: number };

const isKept = (one: unknown): one is Kept => {
  const kept = one as Record<string, unknown> | null;
  return (
    typeof kept === 'object' &&
    kept !== null &&
    typeof kept['fingerprint'] === 'string' &&
    (kept['answer'] === 'yes' || kept['answer'] === 'no' || kept['answer'] === '') &&
    typeof kept['reason'] === 'string' &&
    (kept['at'] === undefined || typeof kept['at'] === 'number')
  );
};

/**
 * What the browser holds, by a choice's key and the fingerprint it was given on, so the choices of
 * one build's page sit beside another's. A form without the fingerprint in its name (the key
 * alone) reads too. Storage that refuses, or holds something else under the key, gives nothing.
 */
function keptChoices(): Map<string, Kept & { key: string }> {
  const kept = new Map<string, Kept & { key: string }>();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    for (const [name, one] of Object.entries(stored as object)) {
      const key = name.split('@')[0];
      if (isKept(one)) kept.set(`${key}@${one.fingerprint}`, { ...one, key });
    }
  } catch {
    // The page works without it.
  }
  return kept;
}

/**
 * The unsent choices kept in the browser for these words, less any given on words that have since
 * changed. The page works without storage: a browser that refuses it, or holds something else
 * under the key, gives no choices.
 */
export function loadChoices(report: Report): Choices {
  const prints = fingerprintsOf(report);
  const choices: Choices = {};
  for (const one of keptChoices().values()) {
    if (prints.get(one.key) === one.fingerprint) {
      choices[one.key] = { answer: one.answer, reason: one.reason };
    }
  }
  return choices;
}

/**
 * Keeps the choices, each with the fingerprint it was given on and the day it was made or last
 * changed. What another build's page kept stays, and what is older than a fortnight goes; this
 * page's own are rewritten whole, so a cleared choice is gone. A browser that refuses is ignored.
 */
export function saveChoices(report: Report, choices: Choices, now = Date.now()) {
  try {
    const prints = fingerprintsOf(report);
    const before = keptChoices();
    const next: Record<string, Kept> = {};
    for (const [id, one] of before) {
      const at = one.at ?? now;
      const mine = prints.get(one.key) === one.fingerprint;
      if (mine || now - at > KEEP_DAYS * DAY) continue;
      next[id] = { answer: one.answer, reason: one.reason, fingerprint: one.fingerprint, at };
    }
    for (const [key, choice] of Object.entries(choices)) {
      const fingerprint = prints.get(key)!;
      const same = before.get(`${key}@${fingerprint}`);
      const unchanged = same?.answer === choice.answer && same.reason === choice.reason;
      next[`${key}@${fingerprint}`] = {
        ...choice,
        fingerprint,
        at: unchanged ? (same.at ?? now) : now,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The page works without it.
  }
}

/**
 * The answered screens in the walks' order, each with what a message names it by; and the keys of
 * the "no" answers that still lack their reason.
 */
function chosenOf(report: Report, choices: Choices) {
  const prints = fingerprintsOf(report);
  const items: ShareItem[] = [];
  const missing: string[] = [];
  for (const walk of report.walks) {
    for (const screen of walk.screens) {
      for (const language of LANGUAGES) {
        const key = answerKey(walk.id, screen.id, language);
        const choice = choices[key];
        if (!choice || choice.answer === '') continue;
        if (choice.answer === 'no' && choice.reason.trim() === '') missing.push(key);
        items.push({
          key,
          answer: choice.answer,
          fingerprint: prints.get(key)!,
          reason: choice.reason,
          number: screen.number,
          sentence: screen.sentence.en,
          language: LANGUAGE_LABEL[language],
        });
      }
    }
  }
  return { items, missing };
}

/**
 * The block to paste into the chat, from the answered screens in the walks' order; or the keys of
 * the "no" answers that still lack their reason, and no block.
 */
export function blockOf(report: Report, choices: Choices) {
  const { items, missing } = chosenOf(report, choices);
  return { text: blockText(report.build, items), answered: items.length, missing };
}

/** The Slack message a partner posts under their label, from the same choices. */
export function shareOf(report: Report, choices: Choices, label: string) {
  const { items, missing } = chosenOf(report, choices);
  return { text: shareText(report.build, label, items), answered: items.length, missing };
}

const LABEL_KEY = 'credo-walks-label';

/** The partner's label kept in the browser, or none: the page works without storage. */
export function loadLabel() {
  try {
    const kept = normalizeLabel(localStorage.getItem(LABEL_KEY) ?? '');
    return LABEL.test(kept) ? kept : '';
  } catch {
    return '';
  }
}

export function saveLabel(label: string) {
  try {
    localStorage.setItem(LABEL_KEY, normalizeLabel(label));
  } catch {
    // The page works without it.
  }
}

const ONLY_KEY = 'credo-walks-only-unanswered';

/** Whether the person asked to see only the unanswered; the page works without storage. */
export function loadOnly() {
  try {
    return localStorage.getItem(ONLY_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function saveOnly(only: boolean) {
  try {
    localStorage.setItem(ONLY_KEY, only ? 'yes' : 'no');
  } catch {
    // The page works without it.
  }
}
