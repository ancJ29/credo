import { describe, expect, it } from 'vitest';
import { shadesOf, themeOf } from './theme';

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
