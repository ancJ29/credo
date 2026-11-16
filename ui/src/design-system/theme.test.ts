import { describe, expect, it } from 'vitest';
import { shadesOf } from '../theme';
import { designThemeOf } from './theme';

const COLOUR = '#2f7d6d';

describe('designThemeOf', () => {
  it('draws the main colour at shade 6 while shade 7 stays the colour itself', () => {
    const theme = designThemeOf(COLOUR);

    expect(theme.primaryShade).toBe(6);
    expect(theme.colors?.brand).toEqual(shadesOf(COLOUR));
    expect(theme.colors?.brand?.[7]).toBe(COLOUR);
  });

  it('gives a badge 4-px corners and a table row the brand’s shade 0 under the pointer', () => {
    const { components } = designThemeOf(COLOUR);

    expect(components?.Badge?.defaultProps).toMatchObject({ radius: '4px' });
    expect(components?.Table?.defaultProps).toMatchObject({
      highlightOnHoverColor: 'var(--mantine-color-brand-0)',
    });
  });

  it('centres a dialog and draws its title large at 550', () => {
    const { components } = designThemeOf(COLOUR);

    expect(components?.Modal?.defaultProps).toMatchObject({ centered: true });
    expect(components?.Modal?.styles).toEqual({
      title: { fontSize: 'var(--mantine-font-size-lg)', fontWeight: 550 },
    });
  });

  it('keeps the app’s own entries, the fields’ line included', () => {
    expect(designThemeOf(COLOUR).components?.Input).toBeDefined();
    expect(designThemeOf(COLOUR).fontFamily).toContain('Noto Sans Variable');
  });
});
