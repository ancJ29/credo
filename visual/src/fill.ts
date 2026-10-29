import { LANGUAGES } from '@credo/shared';
import { parseBlock } from './block';
import { type Choices, fingerprintsOf } from './choices';
import type { Whose } from './marks';
import { openToBulk } from './bulk';
import { placesOf } from './nav';
import type { Report } from './report';
import { answerKey } from './walks';

/** What a pasted block or Share message would do to this page's choices. */
export type Fill = {
  /** Why the paste is refused whole, saying whose it is. */
  whole?: string;
  fills: Choices;
  /** The answer lines the reader took. */
  total: number;
  filled: number;
  changed: number;
  absent: number;
  already: number;
  unreadable: { line: number; why: string }[];
  /** A partner's page with no label kept: the paste's own. */
  label?: string;
};

const NOTHING: Omit<Fill, 'whole'> = {
  fills: {},
  total: 0,
  filled: 0,
  changed: 0,
  absent: 0,
  already: 0,
  unreadable: [],
};

/**
 * Reads a pasted block or Share message with the same reader as `pnpm answers`, and says what
 * it fills: a line fills when its key and its fingerprint are this page's, whatever build its
 * Build line names. A line is left when its words changed since, its screen is not on this page,
 * or a bulk action may not answer it. The human's page fills from a block with no By: line alone;
 * a partner's page from its own Share message alone.
 */
export function fillFrom(text: string, report: Report, choices: Choices, whose: Whose): Fill {
  let parsed: ReturnType<typeof parseBlock>;
  try {
    parsed = parseBlock(text, { partners: whose.partner });
  } catch {
    return { ...NOTHING, whole: 'That is not an answers block: no “Credo walks answers” line.' };
  }
  const { entries, refused } = parsed;
  if (entries.length === 0 && refused.some(({ why }) => why.startsWith('a By: line'))) {
    return { ...NOTHING, whole: 'That is a partner’s post, so it cannot fill the human’s page.' };
  }
  if (entries.length === 0 && refused.some(({ why }) => why.includes('no By: line'))) {
    return {
      ...NOTHING,
      whole: 'That is the human’s block, with no By: line, so it cannot fill a partner’s page.',
    };
  }
  const labels = [...new Set(entries.map(({ by }) => by))];
  if (whose.partner && whose.label !== '' && labels.some((by) => by !== whose.label)) {
    const other = labels.find((by) => by !== whose.label)!;
    return { ...NOTHING, whole: `That is ${other}’s post, not ${whose.label}’s.` };
  }
  if (whose.partner && whose.label === '' && labels.length > 1) {
    return { ...NOTHING, whole: 'That holds the posts of several people.' };
  }

  const prints = fingerprintsOf(report);
  const entryOf = new Map(
    placesOf(report).flatMap((place) =>
      LANGUAGES.map(
        (language) =>
          [
            answerKey(place.walk.id, place.screen.id, language),
            place.screen.languages[language],
          ] as const,
      ),
    ),
  );
  const unreadable = [...refused];
  const fills: Choices = {};
  let changed = 0;
  let absent = 0;
  let already = 0;
  for (const entry of entries) {
    const mine = entryOf.get(entry.key);
    if (!mine) absent += 1;
    else if (prints.get(entry.key) !== entry.fingerprint) changed += 1;
    else if (entry.answer === 'no' && entry.reason === '') {
      unreadable.push({ line: entry.line, why: `“${entry.key}”: a no needs its reason` });
    } else if (!openToBulk(mine, choices[entry.key], whose)) already += 1;
    else fills[entry.key] = { answer: entry.answer, reason: entry.reason };
  }
  return {
    fills,
    total: entries.length,
    filled: Object.keys(fills).length,
    changed,
    absent,
    already,
    unreadable: unreadable.sort((a, b) => a.line - b.line),
    ...(whose.partner && whose.label === '' && labels.length === 1 ? { label: labels[0] } : {}),
  };
}

/** What the page says it will do before it does it. */
export function fillSays(fill: Fill) {
  if (fill.whole) return fill.whole;
  return [
    `Fills ${fill.filled} of ${fill.total}`,
    ...(fill.changed > 0 ? [`${fill.changed} changed since`] : []),
    ...(fill.absent > 0 ? [`${fill.absent} not on this page`] : []),
    ...(fill.already > 0 ? [`${fill.already} already answered`] : []),
    ...fill.unreadable.map(({ line, why }) => `line ${line}: ${why}`),
  ].join('; ');
}
