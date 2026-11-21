import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from './entries';
import { GUIDELINE, type Contract, type Rule } from './guideline';
import { ICON_SIZES, RADII, ROLES, SIZES, SPACING, TONES, TYPE, WEIGHTS, WIDTHS } from './tokens';

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

/** Every screen's source, the design system's own and the tests left out. */
const SCREENS = import.meta.glob<string>(
  ['../**/*.tsx', '!../**/*.test.tsx', '!../design-system/**'],
  { query: '?raw', import: 'default', eager: true },
);

/** The looks a source draws its `Button`s in: the variants its tag names (filled where none), `red` added where its colour is red. */
function drawnButtons(source: string) {
  const looks: string[] = [];
  for (const start of source.matchAll(/<Button\b/g)) {
    let depth = 0;
    let quote = '';
    let end = start.index + 7;
    for (; end < source.length; end += 1) {
      const c = source[end];
      if (quote) quote = c === quote ? '' : quote;
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    const tag = source.slice(start.index, end);
    const variant = /variant=(?:"([^"]+)"|\{([^}]+)\})/.exec(tag);
    const colour = /color=(?:"([^"]+)"|\{([^}]+)\})/.exec(tag);
    const red = /\bred\b/.test(colour?.[1] ?? colour?.[2] ?? '') ? ' red' : '';
    const named = variant ? [...(variant[1] ?? variant[2]).matchAll(/'([^']+)'|^([a-z]+)$/g)] : [];
    const variants = named.map((m) => m[1] ?? m[2]);
    for (const each of variants.length > 0 ? variants : variant ? ['?'] : ['filled'])
      looks.push(`${each}${red}`);
  }
  return looks;
}

/** The looks drawn that no meaning of `ActionButton` takes. */
const unmapped = (looks: string[], map: Record<string, string>) =>
  [...new Set(looks)].filter((look) => !(look in map));

const rulesOf = () => GUIDELINE.charter.rules;
const contractsOf = () => GUIDELINE.contracts;

/** The theme's tables by the name a contract gives them. */
const TABLES: Record<string, object> = {
  TONES,
  TYPE,
  WEIGHTS,
  SIZES,
  SPACING,
  WIDTHS,
  ICON_SIZES,
  RADII,
  ROLES,
};

/** A prop that is a style a screen would choose: a colour, size, gap, weight, width, variant or corner. */
const STYLE =
  /^(c|color|colour|bg|size|fz|gap|fw|weight|w|h|mih|width|height|variant|radius|corner)$/i;

/** The takes of contracts that take a style, by part and prop. */
const styled = (contracts: Pick<Contract, 'part' | 'takes'>[]) =>
  contracts.flatMap(({ part, takes }) =>
    takes.filter(({ prop }) => STYLE.test(prop)).map(({ prop }) => `${part} takes ${prop}`),
  );

/** The decisions that read nothing, or a key its table does not have. */
const unkeyed = (contracts: Pick<Contract, 'part' | 'decides'>[]) =>
  contracts.flatMap(({ part, decides }) =>
    decides
      .filter(
        ({ from }) =>
          from.length === 0 || from.some(({ table, key }) => !(key in (TABLES[table] ?? {}))),
      )
      .map(({ what }) => `${part}: ${what}`),
  );

/** The contracts that serve no rule of the charter, by the words they open with. */
const serving = (contracts: Pick<Contract, 'part' | 'serves'>[], rules: Pick<Rule, 'says'>[]) =>
  contracts
    .filter(({ serves }) => !rules.some(({ says }) => says.startsWith(`${serves}`)))
    .map(({ part }) => part);

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
    ...GUIDELINE.contracts.flatMap((contract) => [
      ...contract.takes.map((take) => take.line),
      ...contract.decides.map((decision) => decision.what),
      ...contract.fixes,
      ...contract.states.map((state) => state.line),
    ]),
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

describe('The guideline’s contracts', () => {
  it('213 case 19: each names an existing entry, a part to come’s entry too, and a rule of the charter it serves', () => {
    // A set that found nothing would quiet the checks below.
    expect(contractsOf().length).toBeGreaterThan(1);
    const names = ENTRIES.map((entry) => entry.name);
    for (const { part } of contractsOf()) expect(names, part).toContain(part);
    expect(new Set(contractsOf().map((c) => c.part)).size).toBe(contractsOf().length);
    expect(serving(contractsOf(), rulesOf())).toEqual([]);
    expect(serving([{ part: 'X', serves: 'A rule nobody wrote' }], rulesOf())).toEqual(['X']);
    // A part to come has its contract, and its `followed` names the item that builds it.
    const coming = ENTRIES.filter((entry) => entry.toCome).map((entry) => entry.name);
    expect(coming).toEqual(['ActionButton', 'FormMessage', 'PageState']);
    for (const part of coming)
      expect(contractsOf().find((c) => c.part === part)?.followed, part).toEqual({
        item: part === 'ActionButton' ? 655 : 651,
      });
    const held = contractsOf().map(({ part, heldBy, followed }) => ({
      says: part,
      why: '',
      heldBy,
      followed,
    }));
    expect(problems(held, (path) => existsSync(`${ROOT}/${path}`), ITEMS)).toEqual([]);
  });

  it('213 case 20: no contract takes a style, and each take is a content or a meaning', () => {
    expect(contractsOf().flatMap((c) => c.takes).length).toBeGreaterThan(3);
    expect(styled(contractsOf())).toEqual([]);
    expect(styled([{ part: 'X', takes: [{ prop: 'variant', is: 'meaning', line: 'l' }] }])).toEqual(
      ['X takes variant'],
    );
    for (const { part, takes } of contractsOf())
      for (const take of takes) {
        expect(['content', 'meaning'], part).toContain(take.is);
        expect(take.line.length, part).toBeGreaterThan(8);
      }
  });

  it('213 case 21: each decision reads keys that are in a theme table, and WEIGHTS and SIZES each have a use line', () => {
    expect(contractsOf().flatMap((c) => c.decides).length).toBeGreaterThan(5);
    expect(unkeyed(contractsOf())).toEqual([]);
    const decision = (from: Contract['decides'][number]['from']) => ({
      part: 'X',
      decides: [{ what: 'w', from }],
    });
    expect(unkeyed([decision([])])).toEqual(['X: w']);
    expect(unkeyed([decision([{ table: 'TONES', key: 'purple' as 'danger' }])])).toEqual(['X: w']);
    expect(unkeyed([decision([{ table: 'TONES', key: 'danger' }])])).toEqual([]);
    const { weights, sizes } = GUIDELINE.values;
    expect(Object.keys(weights)).toEqual(Object.keys(WEIGHTS));
    expect(Object.keys(sizes)).toEqual(Object.keys(SIZES));
    for (const line of [...Object.values(weights), ...Object.values(sizes)])
      expect(line.length).toBeGreaterThan(20);
  });
});

describe('The guideline’s buttons', () => {
  it('213 case 15: every look a screen draws a Button in maps to one of ActionButton’s four meanings', () => {
    const looks = Object.values(SCREENS).flatMap(drawnButtons);
    // A set that found nothing would quiet the check below: the plan counts 109 on its tree.
    expect(Object.keys(SCREENS).length).toBeGreaterThan(50);
    expect(looks.length).toBeGreaterThan(100);
    expect(new Set(looks).size).toBeGreaterThan(4);
    const map: Record<string, string> = GUIDELINE.buttons;
    expect(unmapped(looks, map)).toEqual([]);
    expect(new Set(Object.values(map))).toEqual(new Set(['main', 'other', 'quiet', 'danger']));
    const meanings = contractsOf()
      .find((c) => c.part === 'ActionButton')!
      .states.map((state) => state.name);
    expect(meanings).toEqual(['Main', 'Other', 'Quiet', 'Danger']);
  });

  it('213 case 15: a variant the table does not name is found, whether a word, a conditional or a red one', () => {
    const map: Record<string, string> = GUIDELINE.buttons;
    expect(drawnButtons('<Button>Save</Button>')).toEqual(['filled']);
    expect(drawnButtons('<Button variant="outline" color="red" loading={a}>x</Button>')).toEqual([
      'outline red',
    ]);
    expect(
      drawnButtons("<Button variant={rest > 0 ? 'default' : 'filled'} onClick={() => go(a > 1)}>"),
    ).toEqual(['default', 'filled']);
    expect(drawnButtons('<ActionIcon variant="light"><Button color="red">x</Button>')).toEqual([
      'filled red',
    ]);
    expect(unmapped(['light', 'subtle red', 'filled'], map)).toEqual(['light']);
    expect(unmapped(drawnButtons('<Button variant="transparent">x</Button>'), map)).toEqual([
      'transparent',
    ]);
    expect(unmapped(drawnButtons('<Button variant={pick}>x</Button>'), map)).toEqual(['pick']);
  });
});
