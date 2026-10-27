import { describe, expect, it } from 'vitest';
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

describe('themeOf', () => {
  it('makes the brand colour the primary one, at shade 7', () => {
    const theme = themeOf('#2f7d6d');

    expect(theme.primaryColor).toBe('brand');
    expect(theme.primaryShade).toBe(7);
    expect(theme.colors?.brand?.[7]).toBe('#2f7d6d');
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
