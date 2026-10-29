import type { Choice, Choices } from './choices';
import { shownIn, type Whose } from './marks';
import type { Place } from './nav';
import type { ReportScreen } from './report';
import type { Language } from '@credo/shared';
import { LANGUAGES } from '@credo/shared';
import { answerKey } from './walks';

/** What a bulk action, or a paste, does: the choices after it, the choices to put back, and how many it touched. */
export type Bulk = { next: Choices; undo: Choices; count: number };

/**
 * Whether a bulk action may answer a language of a screen: nothing chosen here for it, and on
 * record for this page's reader either nothing or a yes the words have since moved from. A choice
 * made here, an answer on record, and a screen asked again after a No are left as they are: a No
 * is closed by looking.
 */
export function openToBulk(
  entry: ReportScreen['languages'][Language],
  choice: Choice | undefined,
  whose: Whose,
) {
  if (choice && choice.answer !== '') return false;
  const shown = shownIn(entry, whose);
  return shown.kind === 'waiting' || (shown.kind === 'changed' && shown.answer === 'yes');
}

/** Yes to every language of the given screens that a bulk action may answer. */
export function yesTo(places: readonly Place[], choices: Choices, whose: Whose): Bulk {
  const next = { ...choices };
  let count = 0;
  for (const place of places) {
    for (const language of LANGUAGES) {
      const key = answerKey(place.walk.id, place.screen.id, language);
      if (openToBulk(place.screen.languages[language], choices[key], whose)) {
        next[key] = { answer: 'yes', reason: '' };
        count += 1;
      }
    }
  }
  return { next, undo: choices, count };
}

/** Takes back the choices made here for the given screens, and no answer on record. */
export function clearIn(places: readonly Place[], choices: Choices): Bulk {
  const next = { ...choices };
  let count = 0;
  for (const place of places) {
    for (const language of LANGUAGES) {
      const key = answerKey(place.walk.id, place.screen.id, language);
      if (choices[key] && choices[key].answer !== '') {
        delete next[key];
        count += 1;
      }
    }
  }
  return { next, undo: choices, count };
}

/** Puts the given choices in, as one action that can be undone. */
export function fillIn(fills: Choices, choices: Choices): Bulk {
  return { next: { ...choices, ...fills }, undo: choices, count: Object.keys(fills).length };
}
