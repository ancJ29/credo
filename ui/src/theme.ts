import {
  Checkbox,
  createTheme,
  Input,
  type MantineColorsTuple,
  PasswordInput,
  rem,
} from '@mantine/core';
import classes from './theme.module.css';

const FONT = '"Noto Sans Variable", sans-serif';

/** The old app's greys: the guest screens' ground and the card's edge. */
const NEUTRAL: MantineColorsTuple = [
  '#fafafa',
  '#f5f5f5',
  '#e5e5e5',
  '#d4d4d4',
  '#9ca3af',
  '#6b7280',
  '#4b5563',
  '#374151',
  '#1f2937',
  '#111827',
];

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

/** The brand's own gradient, from its shade 7 to its shade 9: the primary button, the card's top bar. */
export const BRAND_GRADIENT =
  'linear-gradient(135deg, var(--mantine-color-brand-7) 0%, var(--mantine-color-brand-9) 100%)';

type Rgb = [number, number, number];

const mix = (from: Rgb, to: Rgb, share: number) =>
  from.map((value, i) => Math.round(value + (to[i] - value) * share)) as Rgb;

const hexOf = (rgb: Rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;

/** How far shades 0 to 6 sit toward white, and shades 8 and 9 toward black. */
const TOWARD_WHITE = [0.92, 0.82, 0.68, 0.5, 0.32, 0.16, 0.06];
const TOWARD_BLACK = [0.2, 0.38];

/** Ten shades of a brand colour, the lightest first; shade 7 is the colour itself. */
export function shadesOf(colour: string) {
  const base = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16)) as Rgb;
  return [
    ...TOWARD_WHITE.map((share) => hexOf(mix(base, [255, 255, 255], share))),
    hexOf(base),
    ...TOWARD_BLACK.map((share) => hexOf(mix(base, [0, 0, 0], share))),
  ] as unknown as MantineColorsTuple;
}

/**
 * The old app's look, coloured by the tenant's brand: only `brand` follows the tenant; the greys,
 * the green, the red, the font, the radii, the shadows and the underlined fields are fixed.
 */
export const themeOf = (colour: string) =>
  createTheme({
    colors: { brand: shadesOf(colour), neutral: NEUTRAL, gray: GRAY, green: GREEN, red: RED },
    primaryColor: 'brand',
    primaryShade: 7,
    fontFamily: FONT,
    // A page's title is its level-2 heading, drawn at the old app's h3.
    headings: {
      fontFamily: FONT,
      fontWeight: '600',
      sizes: { h2: { fontSize: rem(22), lineHeight: '1.4' } },
    },
    defaultRadius: 'md',
    radius: { xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px' },
    spacing: { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' },
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
      Checkbox: Checkbox.extend({ defaultProps: { radius: 'md' } }),
      Input: Input.extend({ classNames: { input: classes.input, wrapper: classes.wrapper } }),
      PasswordInput: PasswordInput.extend({
        classNames: { root: classes.passwordRoot, input: classes.password },
      }),
      InputWrapper: Input.Wrapper.extend({ styles: { label: { fontWeight: 500 } } }),
    },
  });
