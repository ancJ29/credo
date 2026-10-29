import { LANGUAGES, type Language } from '@credo/shared';
import type { Choice, Choices } from './choices';
import type { Report, ReportScreen, ReportWalk } from './report';
import type { Shown } from './states';
import { answerKey } from './walks';

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export const LANGUAGE_LABEL: Record<Language, string> = { vi: 'Tiếng Việt', en: 'English' };

/**
 * Where a screen stands in one language, as the rail and the ledger mark it: the choice on this
 * page if one is made, else the answer on record. A changed screen is asked again.
 */
export type Mark = 'open' | 'again' | 'yes' | 'no';

export const MARK_TEXT: Record<Mark, string> = {
  open: 'not answered',
  again: 'asked again',
  yes: 'yes',
  no: 'no',
};

export function markOf(shown: Shown, choice: Choice | undefined): Mark {
  if (choice && choice.answer !== '') return choice.answer;
  switch (shown.kind) {
    case 'waiting':
      return 'open';
    case 'changed':
      return 'again';
    default:
      return shown.kind;
  }
}

/** A walk's screens in the page's order: by number, a screen that goes wrong among the rest. */
export const inPageOrder = (walk: ReportWalk): ReportScreen[] =>
  [...walk.screens].sort((a, b) => a.number - b.number);

/** The id of a screen's section on the page, which the rail links to. */
export const screenId = (walk: ReportWalk, screen: ReportScreen) => `${walk.id}-${screen.id}`;

/**
 * Every screen in every language, in the page's order, with its mark; and how many hold a yes or a
 * no, chosen here or on record, of all there are to answer.
 */
export function progressOf(report: Report, choices: Choices) {
  const marks = report.walks.flatMap((walk) =>
    inPageOrder(walk).flatMap((screen) =>
      LANGUAGES.map((language) => {
        const key = answerKey(walk.id, screen.id, language);
        return { key, mark: markOf(screen.languages[language].shown, choices[key]) };
      }),
    ),
  );
  const answered = marks.filter(({ mark }) => mark === 'yes' || mark === 'no').length;
  return { marks, answered, total: marks.length };
}

/** A key as a person reads it, for a message: `screen 3 in English`. */
export function labelsOf(report: Report) {
  const labels = new Map<string, string>();
  for (const walk of report.walks) {
    for (const screen of walk.screens) {
      for (const language of LANGUAGES) {
        labels.set(
          answerKey(walk.id, screen.id, language),
          `screen ${screen.number} in ${LANGUAGE_LABEL[language]}`,
        );
      }
    }
  }
  return labels;
}
