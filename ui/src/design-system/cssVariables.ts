import type { CSSVariablesResolver } from '@mantine/core';
import { gradientOf, onBrand, todayOf } from './onBrand';
import { FRAME_COLOURS, FRAME_VALUES, TOKENS } from './tokens';

/** The washes on the header's ground, as percent of the text: the hover, the user's chip, the avatar, the badge, the language switch and its choice. */
const HEADER_WASHES = [12, 18, 22, 55, 90] as const;
/** The washes on the menu's ground: the hover and the open page. */
const MENU_WASHES = ['05', '10'] as const;

/** `#rrggbb` as `rgba(r, g, b, share)`, the share written as a decimal as the stylesheet's own were. */
const wash = (hex: string, percent: number) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${percent / 100})`;
};

/**
 * Writes the frame's colours and values, which Mantine has no slot for, as `--credo-<name>`
 * variables; and what follows the client's colour: the text on the filled parts, the header and the
 * menu (`--credo-on-filled`, `-on-header`, `-on-menu`), the header's and menu's gradients over the
 * shades `onBrand` picks, and each wash at its share of the ground's text. Where the filled parts'
 * shades move, Mantine's own `filled` and `filled-hover` of the brand follow (the parts that read
 * them by name: a button without a colour, the check), and its `text` stays at the main shade.
 */
export const credoVariables: CSSVariablesResolver = (theme) => {
  const shades = theme.colors['brand'];
  const [filled, header, menu] = (['filled', 'header', 'menu'] as const).map((surface) =>
    onBrand(shades, surface),
  );
  const moved = filled.span.join() !== todayOf(shades, 'filled').span.join();
  const follows: Record<string, string> = {
    'on-filled': filled.colour,
    'on-header': header.colour,
    'on-menu': menu.colour,
    'header-gradient': gradientOf(135, header.span),
    'menu-gradient': gradientOf(180, menu.span),
  };
  for (const share of HEADER_WASHES) follows[`on-header-${share}`] = wash(header.colour, share);
  for (const share of MENU_WASHES) follows[`on-menu-${share}`] = wash(menu.colour, Number(share));
  const light: Record<string, string> = moved
    ? {
        '--mantine-color-brand-filled': `var(--mantine-color-brand-${filled.span[0]})`,
        '--mantine-color-brand-filled-hover': `var(--mantine-color-brand-${filled.span[1]})`,
        '--mantine-color-brand-text': `var(--mantine-color-brand-${TOKENS.primaryShade})`,
      }
    : {};
  return {
    variables: Object.fromEntries(
      Object.entries({ ...FRAME_COLOURS, ...FRAME_VALUES, ...follows }).map(([name, value]) => [
        `--credo-${name}`,
        value,
      ]),
    ),
    light,
    dark: {},
  };
};
