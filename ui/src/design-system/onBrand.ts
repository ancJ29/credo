import type { MantineColorsTuple } from '@mantine/core';
import { NEUTRAL } from './palettes';

/** Where a client's colour carries text: Mantine's filled parts, the header's gradient, the side menu's. */
export type Surface = 'filled' | 'header' | 'menu';

/** The two inks: white, and the theme's darkest grey. */
type Ink = 'white' | 'dark';

/** The ratio small text needs against its ground. */
const MIN_RATIO = 4.5;

const WHITE = '#ffffff';

/** The shades each surface spans under each ink, in drawing order: the first is where a gradient starts, a filled part's second its hover. */
const SPANS: Record<Surface, Record<Ink, readonly number[]>> = {
  filled: { white: [6, 7], dark: [6, 5] },
  header: { white: [7, 8, 9], dark: [5, 6, 7] },
  menu: { white: [9, 8], dark: [9, 8] },
};

/** The ink's colour: white, or the theme's darkest grey, read from the theme's own list. */
const INKS: Record<Ink, string> = { white: WHITE, dark: NEUTRAL[9] };

/** The last shade a span can move to, and the first. */
const DARKEST = 9;
const LIGHTEST = 0;

/** What the rule picks for one surface of one colour. */
export type Pick = {
  /** The ink. */
  ink: Ink;
  /** The ink's colour. */
  colour: string;
  /** The shades the surface spans, as the ink needs them; a shade may repeat where the span met an end. */
  span: readonly number[];
  /** The ratio of the ink against each shade of the span. */
  ratios: readonly number[];
  /** The least of the ratios. */
  least: number;
  /** Whether the least reaches 4.5:1. */
  passes: boolean;
};

const channel = (hex: string, at: number) => {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

/** The WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export const contrast = (one: string, other: string) => {
  const [a, b] = [luminance(one), luminance(other)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** The surface's span under an ink, moved `by` shades toward the ink's end: darker under white, lighter under dark. */
function attempt(shades: MantineColorsTuple, surface: Surface, ink: Ink, by: number): Pick {
  const span = SPANS[surface][ink].map((shade) =>
    ink === 'white' ? Math.min(shade + by, DARKEST) : Math.max(shade - by, LIGHTEST),
  );
  const ratios = span.map((shade) => contrast(INKS[ink], shades[shade]));
  const least = Math.min(...ratios);
  return { ink, colour: INKS[ink], span, ratios, least, passes: least >= MIN_RATIO };
}

/** A gradient from the first shade of a span to its last, as the `--mantine-color-brand-<n>` variables name them. */
export const gradientOf = (deg: number, span: readonly number[]) =>
  `linear-gradient(${deg}deg, var(--mantine-color-brand-${span[0]}) 0%, var(--mantine-color-brand-${span[span.length - 1]}) 100%)`;

/** What the app drew before the rule (`main`'s state): white on the white span, whether it reads or not. */
export const beforeOf = (shades: MantineColorsTuple, surface: Surface) =>
  attempt(shades, surface, 'white', 0);

/**
 * The ink for a surface of a client's colour: white where it reaches 4.5:1 against every shade of the
 * surface's span, else dark where it does; else the span moves a shade at a time, darker under white,
 * lighter under dark, the nearer pass winning and white on a tie. A colour no ink can serve comes back
 * with `passes` false and the white it had before the rule.
 */
export function onBrand(shades: MantineColorsTuple, surface: Surface): Pick {
  for (let by = 0; by <= DARKEST; by++) {
    for (const ink of ['white', 'dark'] as const) {
      const found = attempt(shades, surface, ink, by);
      if (found.passes) return found;
    }
  }
  return beforeOf(shades, surface);
}

/** What a link's rule picks for one colour: a shade of it, or the theme's darkest grey where no shade reads. */
export type Link = {
  /** The shade taken, or `null` where the darkest grey is. */
  shade: number | null;
  /** The text's colour, `#rrggbb`. */
  colour: string;
  /** What was taken, in words: `shade 7`, or `dark`. */
  name: string;
  /** The text's ratio on white. */
  ratio: number;
  /** The text as a stylesheet reads it: the brand's shade variable, or the grey itself. */
  value: string;
};

/**
 * The text of a link, or any brand-coloured text, on white: the first shade from `from` that reaches
 * 4.5:1 on white, a shade darker at a time; where none does, the theme's darkest grey (amber's case).
 */
export function onWhite(shades: MantineColorsTuple, from: number): Link {
  for (let shade = from; shade <= DARKEST; shade++) {
    const ratio = contrast(WHITE, shades[shade]);
    if (ratio >= MIN_RATIO)
      return {
        shade,
        colour: shades[shade],
        name: `shade ${shade}`,
        ratio,
        value: `var(--mantine-color-brand-${shade})`,
      };
  }
  const colour = INKS.dark;
  return { shade: null, colour, name: 'dark', ratio: contrast(WHITE, colour), value: colour };
}
