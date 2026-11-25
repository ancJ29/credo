import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** A colour written as a literal: a hex value, or a function that makes one. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/;

/** A numbered shade: a quoted `brand.7`, or Mantine's `--mantine-color-brand-7`. */
const SHADE = /(["'`])[a-z]+\.[0-9]+\1|--mantine-color-[a-z]+-[0-9]/;

/** A weight or size written as a number: `fw={600}`, `fz={12}`, `fontWeight: 600`, `fontSize: 14`,
 * `font-weight: 600;`, `font-size: 14px;`. */
const TYPE_NUMBER =
  /\b(?:fw|fz)=\{?\s*[0-9]|\b(?:fontWeight|fontSize)['"]?\s*:\s*['"]?[0-9]|font-(?:weight|size)['"]?\s*:\s*['"]?[0-9]/;

/** Markup set from a string: the React prop, an assignment to either HTML property, or the insert call. */
const MARKUP =
  /dangerouslySetInnerHTML|\b(?:inner|outer)HTML\s*(?:\+|-|\*)?=(?!=)|insertAdjacentHTML/;

const SRC = `${import.meta.dirname}/..`;

/** A palette's name: Mantine's fourteen palettes, the client's `brand`, `white` and `black`. */
const PALETTE =
  '(?:dark|gray|red|pink|grape|violet|indigo|blue|cyan|teal|green|lime|yellow|orange|brand|white|black)';

/** A colour named by its palette: `c`, `color` or `bg` set by `=` or `:` to a quoted name, or to a
 * braced expression holding one, or a palette's Mantine variable. */
const COLOUR_NAME = new RegExp(
  `\\b(?:c|color|bg)\\s*[=:]\\s*(?:["'\`]|\\{[^}]*?["'\`])${PALETTE}\\b|--mantine-color-${PALETTE}\\b`,
);

/** `Intl` written as a formatter: `new Intl.NumberFormat(...)`, or called without `new`. */
const INTL = /\bIntl\.[A-Z]/;

/** The two places that write a number, a day or a time by `Intl`. */
const FORMAT_PLACES = ['day.ts', 'number.ts'];

describe('The stylesheets', () => {
  it('7: No stylesheet outside the design system writes a colour of its own', () => {
    const all = globSync('**/*.module.css', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.length).toBeGreaterThanOrEqual(4);
    const own = all.filter((path) => !path.startsWith('design-system/'));
    expect(own.length).toBeGreaterThanOrEqual(1);
    const written = own.filter((path) => COLOUR.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(written).toEqual([]);
  });
});

describe('The shades', () => {
  it('10: No stylesheet or script outside the design system names a numbered shade', () => {
    const all = globSync('**/*.{css,ts,tsx}', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.some((path) => path.endsWith('.module.css'))).toBe(true);
    expect(all.some((path) => path.endsWith('.tsx'))).toBe(true);
    const own = all.filter(
      (path) =>
        !path.startsWith('design-system/') &&
        !path.startsWith('mock/') &&
        !/\.test\.tsx?$/.test(path),
    );
    expect(own.length).toBeGreaterThanOrEqual(50);
    const named = own.filter((path) => SHADE.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(named).toEqual([]);
  });
});

describe('The colour names', () => {
  it('1: No screen names a colour by a palette; the design system, its parts and the mock may', () => {
    const all = globSync('**/*.{css,ts,tsx}', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.some((path) => path.endsWith('.module.css'))).toBe(true);
    expect(all.some((path) => path.endsWith('.tsx'))).toBe(true);
    const own = all.filter(
      (path) =>
        !path.startsWith('design-system/') &&
        !path.startsWith('mock/') &&
        !path.startsWith('components/') &&
        !/\.test\.tsx?$/.test(path),
    );
    expect(own.length).toBeGreaterThanOrEqual(50);
    const named = own.filter((path) => COLOUR_NAME.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(named).toEqual([]);
  });

  it('2: the pattern refuses an attribute, a braced condition, a style key and a variable, and passes a tone', () => {
    for (const form of [
      '<Text c="red">',
      "<Badge color='yellow'>",
      "<Badge color={row.odd ? 'green' : 'gray'}>",
      '<Text c={`orange`}>',
      "{ color: 'blue' }",
      "{ bg: 'brand' }",
      'color: var(--mantine-color-red);',
    ])
      expect(COLOUR_NAME.test(form), form).toBe(true);
    for (const form of [
      '<Text c={TONES.danger}>',
      '<Badge color={TONES[tone]}>',
      '<Text c="dimmed">',
      '<Text {...TYPE.caption}>',
      '<Avatar color="initials">',
      "head(classes.brand, 'brand')",
      'color: var(--mantine-color-body);',
    ])
      expect(COLOUR_NAME.test(form), form).toBe(false);
  });
});

describe('The weights and sizes', () => {
  it('13: No stylesheet or script outside the design system writes a weight or size as a number', () => {
    const all = globSync('**/*.{css,ts,tsx}', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.some((path) => path.endsWith('.module.css'))).toBe(true);
    expect(all.some((path) => path.endsWith('.tsx'))).toBe(true);
    const own = all.filter(
      (path) =>
        !path.startsWith('design-system/') &&
        !path.startsWith('mock/') &&
        !/\.test\.tsx?$/.test(path),
    );
    expect(own.length).toBeGreaterThanOrEqual(50);
    const written = own.filter((path) => TYPE_NUMBER.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(written).toEqual([]);
  });

  it('13: the pattern refuses each form, and not a name or a variable', () => {
    for (const form of [
      '<Text fw={600}>',
      '<Text fw={ 600 }>',
      '<Text fz={12}>',
      '{ fontWeight: 600 }',
      "{ fontSize: '14px' }",
      "{ 'fontSize': 14 }",
      'font-weight: 600;',
      'font-size: 14px;',
    ])
      expect(TYPE_NUMBER.test(form), form).toBe(true);
    for (const form of [
      '<Text fw={WEIGHTS.label}>',
      '<Text fz="xs">',
      'font-weight: var(--credo-weight-label);',
      'font-size: var(--credo-chip-size);',
      '{ fontWeight: WEIGHTS.title }',
    ])
      expect(TYPE_NUMBER.test(form), form).toBe(false);
  });
});

describe('The formats', () => {
  it('17: No screen writes `new Intl`; a number, a day and a time are written by `number.ts` and `day.ts`', () => {
    const all = globSync('**/*.{ts,tsx}', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.some((path) => path.endsWith('.tsx'))).toBe(true);
    expect(all).toContain('day.ts');
    expect(all).toContain('number.ts');
    const own = all.filter(
      (path) =>
        !path.startsWith('mock/') && !/\.test\.tsx?$/.test(path) && !FORMAT_PLACES.includes(path),
    );
    expect(own.length).toBeGreaterThanOrEqual(50);
    const written = own.filter((path) => INTL.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(written).toEqual([]);
  });

  it('17: the pattern refuses each form of `Intl`, and not a word that holds it', () => {
    for (const form of [
      'new Intl.NumberFormat(language)',
      'new Intl.DateTimeFormat(locale, {})',
      'new  Intl.PluralRules(language)',
      'Intl.NumberFormat(language)',
    ])
      expect(INTL.test(form), form).toBe(true);
    for (const form of ['Internal notes', 'an Intl-free word', 'const intl = 1'])
      expect(INTL.test(form), form).toBe(false);
  });
});

describe('The markup', () => {
  it('8: No app file sets markup from a string; the company name is built as elements by BrandName', () => {
    const all = globSync('**/*.{ts,tsx}', { cwd: SRC });
    // A glob that found nothing, or a folder moved, would quiet the check below.
    expect(all.some((path) => path.endsWith('.tsx'))).toBe(true);
    expect(all).toContain('components/atoms/BrandName.tsx');
    const own = all.filter((path) => !/\.test\.tsx?$/.test(path));
    expect(own.length).toBeGreaterThanOrEqual(50);
    const written = own.filter((path) => MARKUP.test(readFileSync(`${SRC}/${path}`, 'utf8')));
    expect(written).toEqual([]);
  });

  it('8: the pattern refuses each way to set markup, and not a read of it or a word that holds one', () => {
    for (const form of [
      '<div dangerouslySetInnerHTML={{ __html: x }} />',
      'node.innerHTML = x;',
      'node.innerHTML=x',
      'node.outerHTML = x',
      'node.innerHTML += x',
      'node.insertAdjacentHTML("beforeend", x)',
    ])
      expect(MARKUP.test(form), form).toBe(true);
    for (const form of [
      'expect(node.innerHTML).toBe(x)',
      'const html = node.innerHTML;',
      'if (node.innerHTML === x) return',
      'innerHtml',
    ])
      expect(MARKUP.test(form), form).toBe(false);
  });
});
