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

const SRC = `${import.meta.dirname}/..`;

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
