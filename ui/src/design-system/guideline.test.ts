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

const rulesOf = () => Object.values(GUIDELINE).flatMap((page) => page.rules);

describe('The guideline’s rules', () => {
  it('6: each says what holds it, a check whose file exists or review, and whether the app follows it or the open item that moves it', () => {
    // A set that found nothing would quiet the check below.
    expect(rulesOf().length).toBeGreaterThan(3);
    expect(ITEMS.length).toBeGreaterThan(100);
    expect(rulesOf().some((rule) => rule.heldBy !== 'review')).toBe(true);
    expect(rulesOf().some((rule) => rule.heldBy === 'review')).toBe(true);
    expect(problems(rulesOf(), (path) => existsSync(`${ROOT}/${path}`), ITEMS)).toEqual([]);
  });

  it('6: a check whose file is gone and an item that is not listed are each found by name', () => {
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
});
