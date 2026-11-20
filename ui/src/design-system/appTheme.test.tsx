import { readFileSync } from 'node:fs';
import { CREDO_COLOUR } from '@credo/shared';
import { Badge, Button, Checkbox, Divider, MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { credoVariables } from './cssVariables';
import { PALETTES } from './palettes';
import { BRAND_GRADIENT, shadesOf, themeOf } from './appTheme';
import { RADII, SPACING, TOKENS } from './tokens';

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
  const [steel, brick] = [PALETTES[0], PALETTES[2]];

  it('draw their own ten shades for a colour that is their shade 7, in any case', () => {
    for (const palette of PALETTES) {
      expect(shadesOf(palette.shades[7])).toEqual(palette.shades);
      expect(shadesOf(palette.shades[7].toUpperCase())).toEqual(palette.shades);
    }
    expect(shadesOf('#9E2D20')[0]).toBe(brick.shades[0]);
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
    expect(shadesOf('#9e2d21')).not.toEqual(brick.shades);
    expect(shadesOf('#d97758')[7]).toBe('#d97758');
  });

  it('give credo’s own colour steel’s ten shades, before a company is known and in the console', () => {
    expect(shadesOf(CREDO_COLOUR)).toEqual(steel.shades);
    expect(themeOf(CREDO_COLOUR).colors?.brand).toEqual(steel.shades);
  });
});

describe('themeOf', () => {
  it('makes the brand colour the primary one, at shade 6, shade 7 the colour itself', () => {
    const theme = themeOf('#2f7d6d');

    expect(theme.primaryColor).toBe('brand');
    expect(theme.primaryShade).toBe(6);
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
    expect(BRAND_GRADIENT).toBe('var(--credo-header-gradient)');
  });
});

describe('11: the app’s theme is the design system’s, for every company’s colour', () => {
  // A mixed colour and a stock palette's shade 7: case 1 holds over both.
  it.each(['#2f7d6d', '#9E2D20'])(
    'draws %s at shade 6, a 4-px badge, a pale row hover and a centred dialog',
    (colour) => {
      const { primaryShade, colors, components, defaultGradient } = themeOf(colour);

      expect(primaryShade).toBe(6);
      expect(colors?.brand).toEqual(shadesOf(colour));
      expect(colors?.brand?.[7]?.toLowerCase()).toBe(colour.toLowerCase());
      expect(defaultGradient).toEqual({ from: 'brand.7', to: 'brand.9', deg: 135 });
      expect(components?.Badge?.defaultProps).toMatchObject({ radius: '4px' });
      expect(components?.Table?.defaultProps).toMatchObject({
        highlightOnHoverColor: 'var(--credo-brand-tint)',
      });
      expect(components?.Modal?.defaultProps).toMatchObject({ centered: true });
      expect(components?.Modal?.styles).toEqual({
        header: { padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)' },
        title: { fontSize: 'var(--mantine-font-size-lg)', fontWeight: 550 },
      });
      expect(components?.Input).toBeDefined();
    },
  );
});

describe('the filled parts take the rule’s pick', () => {
  const drawn = (colour: string) => {
    const { container } = render(
      <MantineProvider theme={themeOf(colour)} cssVariablesResolver={credoVariables} env="test">
        <Button>Go</Button>
        <Badge>New</Badge>
        <Checkbox label="Tick" defaultChecked />
      </MantineProvider>,
    );
    const of = (selector: string) => container.querySelector(selector)?.getAttribute('style') ?? '';
    const css = [...document.querySelectorAll('style')].map((el) => el.textContent).join('');
    return {
      css,
      button: of('button'),
      badge: of('.mantine-Badge-root'),
      check: of('.mantine-Checkbox-root'),
    };
  };

  it('6: a light colour’s buttons, badge and check wear dark text on shade 6, hover 5', () => {
    const { css, button, badge, check } = drawn('#d97757');

    expect(button).toContain('--button-color: #111827');
    expect(badge).toContain('--badge-color: #111827');
    expect(check).toContain('--checkbox-icon-color: #111827');
    expect(css).toContain('--mantine-color-brand-filled: var(--mantine-color-brand-6)');
    expect(css).toContain('--mantine-color-brand-filled-hover: var(--mantine-color-brand-5)');
  });

  it('6: a colour that reads neither text at shade 6 moves its buttons, badge and check to shade 7, hover 8, in white', () => {
    const { css, button, badge, check } = drawn('#2f7d6d');

    expect(button).toContain('--button-color: var(--mantine-color-white)');
    expect(badge).toContain('--badge-bg: var(--mantine-color-brand-7)');
    expect(check).not.toContain('#111827');
    expect(css).toContain('--mantine-color-brand-filled: var(--mantine-color-brand-7)');
    expect(css).toContain('--mantine-color-brand-filled-hover: var(--mantine-color-brand-8)');
    expect(css).toContain('--mantine-color-brand-text: var(--mantine-color-brand-6)');
  });

  it('6: a colour where white passes at today’s shades draws Mantine’s own parts', () => {
    const { css, button, badge } = drawn('#9E2D20');

    expect(button).toContain('--button-color: var(--mantine-color-white)');
    expect(badge).not.toContain('--badge-bg');
    expect(css).toContain('--mantine-color-brand-filled: var(--mantine-color-brand-6)');
    expect(css).toContain('--mantine-color-brand-filled-hover: var(--mantine-color-brand-7)');
    expect(css).toContain('--mantine-color-brand-text: var(--mantine-color-brand-filled)');
  });
});

describe('the gradient button follows the header’s pick', () => {
  const gradient = (colour: string) => {
    render(
      <MantineProvider theme={themeOf(colour)} env="test">
        <Button variant="gradient">Go</Button>
      </MantineProvider>,
    );
    return screen.getByRole('button', { name: 'Go' }).getAttribute('style') ?? '';
  };

  it('6: a light colour’s gradient button wears dark text over shades 5 to 7', () => {
    const style = gradient('#d97757');

    expect(style).toContain(
      '135deg, var(--mantine-color-brand-5) 0%, var(--mantine-color-brand-7)',
    );
    expect(style).toContain('--button-color: #111827');
  });

  it('6: a colour that keeps white on the header keeps Mantine’s own gradient', () => {
    const style = gradient('#2f7d6d');

    expect(style).toContain('var(--mantine-color-brand-7)');
    expect(style).toContain('--button-color: var(--mantine-color-white)');
  });
});

describe('the design system’s gradient button and divider', () => {
  it('6: draws a gradient button from the brand’s shade 7 to shade 9 at 135°, with no colour of its own', () => {
    expect(themeOf('#2f7d6d').defaultGradient).toEqual({
      from: 'brand.7',
      to: 'brand.9',
      deg: 135,
    });
    render(
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
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
        <MantineProvider theme={themeOf('#2f7d6d')} env="test">
          <Divider label={label} />
        </MantineProvider>,
      );
    const { unmount } = draw('hoặc');

    const word = screen.getByText('hoặc');
    expect(word.style.fontSize).toBe('var(--mantine-font-size-sm)');
    expect(word.style.color).toBe('var(--mantine-color-dimmed)');
    expect(screen.getByRole('separator').getAttribute('data-with-label')).toBe('true');
    expect(screen.getByRole('separator').className).toContain('Divider');
    expect(themeOf('#2f7d6d').components?.Divider?.defaultProps).toEqual({
      labelPosition: 'center',
    });
    unmount();
    draw();

    expect(screen.getByRole('separator').textContent).toBe('');
  });

  it('keeps the app’s own entries, the fields’ line included', () => {
    expect(themeOf('#2f7d6d').components?.Input).toBeDefined();
    expect(themeOf('#2f7d6d').fontFamily).toContain('Noto Sans Variable');
  });
});

describe('12: the badge’s corners and the card’s padding are written once, read from the theme', () => {
  it('are the theme’s own sm radius and lg spacing, handed to Mantine as the one table', () => {
    const theme = themeOf('#2f7d6d');
    expect(theme.radius).toBe(RADII);
    expect(theme.spacing).toBe(SPACING);
    expect(TOKENS.badgeRadius).toBe(RADII.sm);
    expect(TOKENS.cardPadding).toBe(SPACING.lg);
    expect(theme.components?.Badge?.defaultProps).toMatchObject({ radius: theme.radius?.sm });
  });

  it('are not written again in the tokens’ own text', () => {
    const text = readFileSync(`${import.meta.dirname}/tokens.ts`, 'utf8');
    const values = text.slice(text.indexOf('export const TOKENS'));
    expect(values).not.toMatch(/badgeRadius: '|cardPadding: \d/);
  });
});
