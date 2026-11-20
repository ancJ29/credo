// Mantine's own rules first: the theme's classes below must come after them in any build, and
// where the theme is shared with a lazy chunk (the gallery) a bundler may hoist it ahead of the entry.
import '@mantine/core/styles.css';
import {
  Badge,
  Checkbox,
  createTheme,
  Divider,
  Input,
  type MantineColorsTuple,
  Modal,
  PasswordInput,
  rem,
  Table,
  defaultVariantColorsResolver,
  type VariantColorsResolver,
} from '@mantine/core';
import { gradientOf, onBrand, type Pick, beforeOf } from './onBrand';
import { NEUTRAL, paletteOfColour } from './palettes';
import classes from './theme.module.css';
import { RADII, SPACING, TOKENS } from './tokens';

const FONT = '"Noto Sans Variable", sans-serif';

/** The old app's own grey, green and red, in place of Mantine's. They stay fixed: no tenant sets them. */
const GRAY: MantineColorsTuple = [
  '#f9fafb',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
  '#9ca3af',
  '#6b7280',
  '#4b5563',
  '#374151',
  '#1f2937',
  '#111827',
];
const GREEN: MantineColorsTuple = [
  '#f0fdf4',
  '#dcfce7',
  '#bbf7d0',
  '#86efac',
  '#4ade80',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#166534',
  '#14532d',
];
const RED: MantineColorsTuple = [
  '#fef2f2',
  '#fee2e2',
  '#fecaca',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d',
];

/** The header's ground, the brand's gradient over the shades the rule picks (`--credo-header-gradient`, written by `credoVariables`): the header, the sign-in band and the buttons beside it. */
export const BRAND_GRADIENT = 'var(--credo-header-gradient)';

/** The side menu's ground, over the shades the rule picks (`--credo-menu-gradient`). */
export const MENU_GRADIENT = 'var(--credo-menu-gradient)';

type Rgb = [number, number, number];

const mix = (from: Rgb, to: Rgb, share: number) =>
  from.map((value, i) => Math.round(value + (to[i] - value) * share)) as Rgb;

const hexOf = (rgb: Rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;

/** How far shades 0 to 6 sit toward white, and shades 8 and 9 toward black. */
const TOWARD_WHITE = [0.92, 0.82, 0.68, 0.5, 0.32, 0.16, 0.06];
const TOWARD_BLACK = [0.2, 0.38];

/**
 * Ten shades of a brand colour, the lightest first; shade 7 is the colour itself. A colour that is
 * a stock palette's shade 7, in any case, draws that palette's own ten (the old app's lookup); any
 * other is mixed.
 */
export function shadesOf(colour: string) {
  const stock = paletteOfColour(colour);
  if (stock) return [...stock.shades] as unknown as MantineColorsTuple;
  const base = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16)) as Rgb;
  return [
    ...TOWARD_WHITE.map((share) => hexOf(mix(base, [255, 255, 255], share))),
    hexOf(base),
    ...TOWARD_BLACK.map((share) => hexOf(mix(base, [0, 0, 0], share))),
  ] as unknown as MantineColorsTuple;
}

/** The pick's text as Mantine names it: its own white, or the dark grey itself. */
const textOf = (pick: Pick) => (pick.ink === 'white' ? 'var(--mantine-color-white)' : pick.colour);

/**
 * Mantine's filled and gradient parts of the brand, with the text the rule picks for the colour: the
 * filled parts' ground and hover at the shades it names, the gradient button over the header's.
 * Where the rule keeps white at the shades before the rule the result is Mantine's own.
 */
const variantColorResolver: VariantColorsResolver = (input) => {
  const base = defaultVariantColorsResolver(input);
  if (input.color !== 'brand') return base;
  const shades = input.theme.colors['brand'];
  const surface =
    input.variant === 'filled' ? 'filled' : input.variant === 'gradient' ? 'header' : null;
  if (!surface) return base;
  const pick = onBrand(shades, surface);
  const before = beforeOf(shades, surface);
  if (pick.ink === before.ink && pick.span.join() === before.span.join()) return base;
  if (surface === 'header')
    return {
      ...base,
      background: gradientOf(TOKENS.buttonGradient.deg, pick.span),
      color: textOf(pick),
    };
  return {
    ...base,
    background: `var(--mantine-color-brand-${pick.span[0]})`,
    hover: `var(--mantine-color-brand-${pick.span[1]})`,
    color: textOf(pick),
  };
};

/**
 * The old app's look, coloured by the tenant's brand: only `brand` follows the tenant; the greys,
 * the green, the red, the font, the radii, the shadows and the underlined fields are fixed. Also the
 * design system's own entries: the main shade, a small-cornered badge, a table row's pale hover, a
 * centred dialog with a large title, the gradient button and a labelled divider. Light only.
 */
export const themeOf = (colour: string) => {
  const shades = shadesOf(colour);
  const filled = onBrand(shades, 'filled');
  const before = beforeOf(shades, 'filled');
  const changes = filled.ink !== before.ink || filled.span.join() !== before.span.join();
  return createTheme({
    colors: { brand: shades, neutral: NEUTRAL, gray: GRAY, green: GREEN, red: RED },
    primaryColor: 'brand',
    // The main colour at shade 6; shade 7 stays the company's colour itself.
    primaryShade: TOKENS.primaryShade,
    defaultGradient: TOKENS.buttonGradient,
    variantColorResolver,
    fontFamily: FONT,
    // A page's title is its level-2 heading, drawn at the old app's h3, in bold (700).
    headings: {
      fontFamily: FONT,
      fontWeight: '600',
      sizes: { h2: { fontSize: rem(22), lineHeight: '1.4', fontWeight: '700' } },
    },
    defaultRadius: 'md',
    radius: RADII,
    spacing: SPACING,
    shadows: {
      xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
      sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
      md: '0 4px 6px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
    },
    cursorType: 'pointer',
    components: {
      // Mantine's Checkbox sets its own `sm`, past the theme's default radius.
      // The mark follows the filled parts' text; their ground follows by the variables (`credoVariables`).
      Checkbox: Checkbox.extend({
        defaultProps: {
          radius: 'md',
          iconColor: filled.ink === 'dark' ? filled.colour : undefined,
        },
      }),
      Input: Input.extend({ classNames: { input: classes.input, wrapper: classes.wrapper } }),
      PasswordInput: PasswordInput.extend({
        classNames: { root: classes.passwordRoot, input: classes.password },
      }),
      InputWrapper: Input.Wrapper.extend({ styles: { label: { fontWeight: 500 } } }),
      // A plain badge reads its text from Mantine's stylesheet, white; named filled, it reads the rule.
      Badge: Badge.extend({
        defaultProps: { radius: TOKENS.badgeRadius, variant: changes ? 'filled' : undefined },
      }),
      Divider: Divider.extend({
        defaultProps: { labelPosition: 'center' },
        styles: { label: TOKENS.dividerLabel },
      }),
      Table: Table.extend({ defaultProps: { highlightOnHoverColor: TOKENS.rowHover } }),
      Modal: Modal.extend({
        defaultProps: { centered: true },
        styles: { header: TOKENS.dialogHeader, title: TOKENS.dialogTitle },
      }),
    },
  });
};
