import { CREDO_COLOUR } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './palettes';
import { BRAND_GRADIENT, shadesOf, themeOf } from './theme';

describe('shadesOf', () => {
  it('gives ten shades, the lightest first, shade 7 the brand colour itself', () => {
    const shades = shadesOf('#2f7d6d');

    expect(shades).toHaveLength(10);
    expect(shades[7]).toBe('#2f7d6d');
    expect(shades[0]).toBe('#eef5f3');
    expect(shades[9]).toBe('#1d4e44');
  });
});

describe('the stock palettes', () => {
  const [terracotta, steel] = [PALETTES[0], PALETTES[6]];

  it('draw their own ten shades for a colour that is their shade 7, in any case', () => {
    for (const palette of PALETTES) {
      expect(shadesOf(palette.shades[7])).toEqual(palette.shades);
      expect(shadesOf(palette.shades[7].toUpperCase())).toEqual(palette.shades);
    }
    expect(shadesOf('#D97757')[0]).toBe(terracotta.shades[0]);
  });

  it('leave any other colour mixed as before, even one step from a stock shade', () => {
    expect(shadesOf('#2f7d6d')).toEqual([
      '#eef5f3',
      '#dae8e5',
      '#bcd5d0',
      '#97beb6',
      '#72a79c',
      '#509284',
      '#3b8576',
      '#2f7d6d',
      '#266457',
      '#1d4e44',
    ]);
    expect(shadesOf('#d97758')).not.toEqual(terracotta.shades);
    expect(shadesOf('#d97758')[7]).toBe('#d97758');
  });

  it('give credo’s own colour steel’s ten shades, before a company is known and in the console', () => {
    expect(shadesOf(CREDO_COLOUR)).toEqual(steel.shades);
    expect(themeOf(CREDO_COLOUR).colors?.brand).toEqual(steel.shades);
  });
});

describe('themeOf', () => {
  it('makes the brand colour the primary one, at shade 7', () => {
    const theme = themeOf('#2f7d6d');

    expect(theme.primaryColor).toBe('brand');
    expect(theme.primaryShade).toBe(7);
    expect(theme.colors?.brand?.[7]).toBe('#2f7d6d');
  });
});

describe('the page title', () => {
  it('is bold (700) at 22, while the other headings keep 600', () => {
    const { headings } = themeOf('#2f7d6d');

    expect(headings?.sizes?.h2).toMatchObject({ fontWeight: '700' });
    expect(headings?.fontWeight).toBe('600');
  });
});

describe('the old app’s fixed look', () => {
  it('keeps the greys, the font and the fields the same whatever the tenant’s colour', () => {
    const [teal, rust] = [themeOf('#2f7d6d'), themeOf('#b4532a')];

    expect(teal.colors?.brand?.[7]).not.toBe(rust.colors?.brand?.[7]);
    expect(teal.colors?.gray).toEqual(rust.colors?.gray);
    expect(teal.colors?.gray?.[5]).toBe('#6b7280');
    expect(teal.fontFamily).toBe('"Noto Sans Variable", sans-serif');
    expect(teal.components?.Input?.classNames).toHaveProperty('input');
  });

  it('draws the primary button’s gradient between the brand’s shades 7 and 9', () => {
    expect(BRAND_GRADIENT).toContain('--mantine-color-brand-7');
    expect(BRAND_GRADIENT).toContain('--mantine-color-brand-9');
  });
});
