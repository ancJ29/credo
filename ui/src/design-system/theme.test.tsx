import { MantineProvider, Button, Divider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { shadesOf } from './appTheme';
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

  it('6: draws a gradient button from the brand’s shade 7 to shade 9 at 135°, with no colour of its own', () => {
    expect(designThemeOf(COLOUR).defaultGradient).toEqual({
      from: 'brand.7',
      to: 'brand.9',
      deg: 135,
    });
    render(
      <MantineProvider theme={designThemeOf(COLOUR)} env="test">
        <Button variant="gradient">Go</Button>
      </MantineProvider>,
    );

    const style = screen.getByRole('button', { name: 'Go' }).getAttribute('style') ?? '';
    expect(style).toContain('135deg');
    expect(style).toContain('var(--mantine-color-brand-7)');
    expect(style).toContain('var(--mantine-color-brand-9)');
    expect(style).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('7: draws a divider’s word centred, small and dimmed, and none when given no word', () => {
    const draw = (label?: string) =>
      render(
        <MantineProvider theme={designThemeOf(COLOUR)} env="test">
          <Divider label={label} />
        </MantineProvider>,
      );
    const { unmount } = draw('hoặc');

    const word = screen.getByText('hoặc');
    expect(word.style.fontSize).toBe('var(--mantine-font-size-sm)');
    expect(word.style.color).toBe('var(--mantine-color-dimmed)');
    expect(screen.getByRole('separator').getAttribute('data-with-label')).toBe('true');
    expect(screen.getByRole('separator').className).toContain('Divider');
    expect(designThemeOf(COLOUR).components?.Divider?.defaultProps).toEqual({
      labelPosition: 'center',
    });
    unmount();
    draw();

    expect(screen.getByRole('separator').textContent).toBe('');
  });

  it('keeps the app’s own entries, the fields’ line included', () => {
    expect(designThemeOf(COLOUR).components?.Input).toBeDefined();
    expect(designThemeOf(COLOUR).fontFamily).toContain('Noto Sans Variable');
  });
});
