import type { Answer, Answers } from './answers';
import { allKeys, type Walk } from './walks';

/** What a screen shows beside its picture, in one language. */
export type Shown =
  | { kind: 'waiting' }
  | { kind: 'yes'; on: string }
  | { kind: 'no'; on: string; reason: string }
  /** Asked again: the words moved since the answer, so the answer is shown with both. */
  | { kind: 'changed'; answer: Answer['answer']; on: string; before: string[]; now: string[] };

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

/**
 * A yes holds while the screen's words stay the same; a changed word asks again, with the words
 * before and now. A "no" is read the same way, so a fix that changes words asks again.
 */
export function shownFor(answer: Answer | undefined, words: readonly string[]): Shown {
  if (!answer) return { kind: 'waiting' };
  if (!sameLines(answer.words, words)) {
    return {
      kind: 'changed',
      answer: answer.answer,
      on: answer.on,
      before: answer.words,
      now: [...words],
    };
  }
  return answer.answer === 'yes'
    ? { kind: 'yes', on: answer.on }
    : { kind: 'no', on: answer.on, reason: answer.reason };
}

/** A row whose screen is no longer in the walks. */
export type Orphan = { key: string } & Answer;

export type Tally = { waiting: number; yes: number; no: number; changed: number };

/** How many screens-in-a-language stand in each state; an orphan's open "no" is counted too. */
export const tallyOf = (shown: readonly Shown[], orphans: readonly Orphan[] = []): Tally => {
  const tally: Tally = { waiting: 0, yes: 0, no: 0, changed: 0 };
  for (const one of shown) tally[one.kind] += 1;
  // A "no" whose screen left the walks is still open, so it is still counted.
  for (const orphan of orphans) if (orphan.answer === 'no') tally.no += 1;
  return tally;
};

/** The answers no screen of the walks answers to, in the file's order. */
export function orphansOf(answers: Answers, walks: readonly Walk[]): Orphan[] {
  const known = new Set(allKeys(walks));
  return Object.entries(answers)
    .filter(([key]) => !known.has(key))
    .map(([key, answer]) => ({ key, ...answer }));
}
