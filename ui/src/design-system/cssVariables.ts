import type { CSSVariablesResolver } from '@mantine/core';
import { beforeOf, gradientOf, onBrand, onWhite } from './onBrand';
import { ANGLES, FRAME_VALUES, HEADER_WASHES, MENU_WASHES, ROLES, TOKENS } from './tokens';

/** Where the frame's brand text starts looking for a shade that reads on white: the colour itself. */
const BRAND_TEXT_FROM = 7;

/** `#rrggbb` as `rgba(r, g, b, share)`, the share written as a decimal as the stylesheet's own were. */
const wash = (hex: string, percent: number) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${percent / 100})`;
};

/**
 * Writes the roles (`tokens.ts`) and the frame's values, which Mantine has no slot for, as
 * `--credo-<name>` variables; and what follows the client's colour: the text on the filled parts, the header and the
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
  const moved = filled.span.join() !== beforeOf(shades, 'filled').span.join();
  const follows: Record<string, string> = {
    'on-filled': filled.colour,
    'on-header': header.colour,
    'on-menu': menu.colour,
    'header-gradient': gradientOf(ANGLES.header, header.span),
    'menu-gradient': gradientOf(ANGLES.menu, menu.span),
  };
  for (const [role, share] of Object.entries(HEADER_WASHES))
    follows[role] = wash(header.colour, share);
  for (const [role, share] of Object.entries(MENU_WASHES)) follows[role] = wash(menu.colour, share);
  const light: Record<string, string> = moved
    ? {
        '--mantine-color-brand-filled': `var(--mantine-color-brand-${filled.span[0]})`,
        '--mantine-color-brand-filled-hover': `var(--mantine-color-brand-${filled.span[1]})`,
      }
    : {};
  // Brand-coloured text on white follows the rule: Mantine's links, its brand text and outline from
  // shade 6, the frame's brand text from 7 (`--credo-brand-text`).
  const link = onWhite(shades, TOKENS.primaryShade).value;
  follows['brand-text'] = onWhite(shades, BRAND_TEXT_FROM).value;
  return {
    variables: Object.fromEntries(
      Object.entries({ ...ROLES, ...FRAME_VALUES, ...follows }).map(([name, value]) => [
        `--credo-${name}`,
        value,
      ]),
    ),
    light: {
      ...light,
      '--mantine-color-anchor': link,
      '--mantine-color-brand-text': link,
      '--mantine-color-brand-outline': link,
    },
    dark: {},
  };
};
