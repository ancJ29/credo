import { createTheme, type MantineColorsTuple } from '@mantine/core';

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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

/** The look, coloured by the tenant's brand: every page takes its colours from `brand`. */
export const themeOf = (colour: string) =>
  createTheme({
    colors: { brand: shadesOf(colour) },
    primaryColor: 'brand',
    primaryShade: 7,
    fontFamily: FONT,
    headings: { fontFamily: FONT, fontWeight: '600' },
    defaultRadius: 'md',
  });
