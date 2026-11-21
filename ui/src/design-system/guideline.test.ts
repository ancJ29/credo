import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDELINE, type Rule } from './guideline';

/** The repository's root, from this file's folder. */
const ROOT = `${import.meta.dirname}/../../..`;

/** The open items' headings, which a rule's `followed` item must be one of. */
const ITEMS = [
  ...readFileSync(`${ROOT}/docs/open-items.md`, 'utf8').matchAll(/^## (\d+)\. /gm),
].map((heading) => Number(heading[1]));

/** What is wrong with a rule's two claims: a check whose file is not there, an item not listed. */
function problems(rules: Rule[], exists: (path: string) => boolean, items: number[]) {
  const found: string[] = [];
  for (const { says, heldBy, followed } of rules) {
    if (heldBy !== 'review' && !exists(heldBy.check))
      found.push(`${says} | no file ${heldBy.check}`);
    if (followed !== 'yes' && !items.includes(followed.item))
      found.push(`${says} | no open item ${followed.item}`);
  }
  return found;
}

const rulesOf = () => GUIDELINE.charter.rules;

/** A text that says "not yet" and names no open item that is listed, by the text's start. */
function unnamed(texts: string[], items: number[]) {
  return texts
    .filter((text) => /not yet/i.test(text))
    .filter((text) => {
      const named = [...text.matchAll(/open items? (\d+)/gi)].map((m) => Number(m[1]));
      return named.length === 0 || named.some((item) => !items.includes(item));
    })
    .map((text) => text.slice(0, 40));
}

/** Every sentence of the guideline that can say "not yet". */
const wordsOf = () => {
  const { goal, credo, readers, lookHere, rules } = GUIDELINE.charter;
  const { notes, ...tables } = GUIDELINE.values;
  return [
    goal,
    credo,
    ...readers.flatMap((r) => [r.reader, r.does]),
    ...lookHere.flatMap((l) => [l.need, l.where]),
    ...rules.flatMap((r) => [r.says, r.why]),
    ...notes.map((note) => note.text),
    ...Object.values(tables).flatMap((table) => Object.values(table)),
  ];
};

describe('The guideline’s rules', () => {
  it('213 case 6: each says what holds it, a check whose file exists or review, and whether the app follows it or the open item that moves it', () => {
    // A set that found nothing would quiet the check below.
    expect(rulesOf().length).toBeGreaterThan(3);
    expect(ITEMS.length).toBeGreaterThan(100);
    expect(rulesOf().some((rule) => rule.heldBy !== 'review')).toBe(true);
    expect(rulesOf().some((rule) => rule.heldBy === 'review')).toBe(true);
    expect(problems(rulesOf(), (path) => existsSync(`${ROOT}/${path}`), ITEMS)).toEqual([]);
  });

  it('213 case 6: a check whose file is gone and an item that is not listed are each found by name', () => {
    const rule = (heldBy: Rule['heldBy'], followed: Rule['followed']): Rule => ({
      says: 'r',
      why: 'w',
      heldBy,
      followed,
    });
    const none = () => false;
    expect(problems([rule({ check: 'a/b.test.ts' }, 'yes')], none, [1])).toEqual([
      'r | no file a/b.test.ts',
    ]);
    expect(problems([rule('review', { item: 9 })], none, [1])).toEqual(['r | no open item 9']);
    expect(problems([rule('review', { item: 1 })], none, [1])).toEqual([]);
  });

  it('213 case 6: each “not yet” the guideline says names an open item that is listed', () => {
    // A set that found no note, or no "not yet", would quiet the check below.
    expect(wordsOf().filter((text) => /not yet/i.test(text)).length).toBeGreaterThan(3);
    expect(unnamed(wordsOf(), ITEMS)).toEqual([]);
    expect(unnamed(['Not yet: the screens write it.'], [1])).toEqual([
      'Not yet: the screens write it.',
    ]);
    expect(unnamed(['Not yet: open item 9 moves it.'], [1])).toEqual([
      'Not yet: open item 9 moves it.',
    ]);
    expect(unnamed(['Not yet: open item 1 moves it.'], [1])).toEqual([]);
  });
});
