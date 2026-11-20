/** The brand's gradient button and the header's ground: shade 7 to shade 9, at 135 degrees. */
const BRAND_SHADES = { from: 7, to: 9, deg: 135 } as const;

/**
 * The legacy app's values that the new app's theme lacks, and the gallery reads. The greys, green,
 * red, font, gaps and shadows are `appTheme.ts`'s `themeOf` already and are not copied here.
 */
export const TOKENS = {
  /** The main colour's depth: Mantine's default light shade, which the legacy draws. */
  primaryShade: 6,
  /** A badge's corners: 4 px, not Mantine's pill. */
  badgeRadius: '4px',
  /** A table row under the pointer: the brand's palest shade. */
  rowHover: 'var(--mantine-color-brand-0)',
  /** A dialog's title: large, at 550. */
  dialogTitle: { fontSize: 'var(--mantine-font-size-lg)', fontWeight: 550 },
  /** A dialog's header: the legacy's padding, 12 above and below, 16 at the sides. */
  dialogHeader: { padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)' },
  /** A field's label: small capitals, the legacy's default weight and spacing, in grey. */
  fieldLabel: { fw: 600, lts: 0.3 },
  /** A section's title: the same small capitals, bolder and wider. */
  sectionTitle: { fw: 700, lts: 0.5 },
  /** A section card's padding, in px. */
  cardPadding: 24,
  /** The company logo's tile, in px: 44 square, corners of 10 (the legacy's card head). */
  logoTile: { size: 44, radius: 10 },
  /** The brand's gradient button: from shade 7 to shade 9, at 135 degrees, as Mantine's gradient variant reads it. */
  buttonGradient: {
    from: `brand.${BRAND_SHADES.from}`,
    to: `brand.${BRAND_SHADES.to}`,
    deg: BRAND_SHADES.deg,
  },
  /** A labelled divider's word: small and dimmed. */
  dividerLabel: { fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' },
  /** A band's padding above and below, then at the sides, in px: the legacy's 28 over 40. */
  doorPadding: '28px 40px',
  /** A door card's bar: 4 px high, in the brand's gradient at 90°. */
  doorBar: 4,
  doorBarGradient:
    'linear-gradient(90deg, var(--mantine-color-brand-7) 0%, var(--mantine-color-brand-9) 100%)',
  /** A door card's body padding: 28 under the band, 40 at the sides and below. */
  doorBody: '28px 40px 40px',
  /** The gap under a door's subtitle, in px. */
  doorSubtitleGap: 32,
  /** A section title's grey icon tile, in px. */
  iconTile: 24,
} as const;

/** The colours the frame's stylesheets and the shell draw that Mantine has no slot for, written as
 * `--credo-<name>` variables by the theme's resolver. The text on the client's colour, its washes and
 * the header's and menu's gradients follow the colour, so `credoVariables` writes them (`onBrand.ts`). */
export const FRAME_COLOURS = {
  white: '#fff',
  'ink-04': 'rgba(0, 0, 0, 0.04)',
} as const;

/** The frame's sizes, weights, lines and shadows that Mantine has no slot for, written as
 * `--credo-<name>` variables by the theme's resolver beside the colours. */
export const FRAME_VALUES = {
  /** The menu's labels: 14 px at 600. */
  'menu-size': '14px',
  'menu-weight': '600',
  /** The phone bar's line above and its soft shadow cast upward: the legacy's `base/src/components/app/MobileAppLayout.tsx#L268-L269`. */
  'bar-line': '1px solid var(--mantine-color-default-border)',
  'bar-shadow': '0 -2px 8px rgba(0, 0, 0, 0.06)',
  /** The header's soft shadow below: the legacy's `base/src/components/app/MobileAppLayout.tsx#L167`. */
  'header-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
} as const;
