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
  /** A field's label: small capitals, the legacy's default weight and spacing, in grey. */
  fieldLabel: { fw: 600, lts: 0.3 },
  /** A section's title: the same small capitals, bolder and wider. */
  sectionTitle: { fw: 700, lts: 0.5 },
  /** A section card's padding, in px. */
  cardPadding: 24,
  /** The brand's own gradient, from its shade 7 to its shade 9: the header and the primary button. The door card's bar has its own, at 90°. */
  brandGradient: `linear-gradient(${BRAND_SHADES.deg}deg, var(--mantine-color-brand-${BRAND_SHADES.from}) 0%, var(--mantine-color-brand-${BRAND_SHADES.to}) 100%)`,
  /** The side menu's ground, from the brand's shade 9 down to its shade 8. */
  menuGradient:
    'linear-gradient(180deg, var(--mantine-color-brand-9) 0%, var(--mantine-color-brand-8) 100%)',
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
 * `--credo-<name>` variables by the theme's resolver. */
export const FRAME_COLOURS = {
  white: '#fff',
  'ink-04': 'rgba(0, 0, 0, 0.04)',
  'white-05': 'rgba(255, 255, 255, 0.05)',
  'white-10': 'rgba(255, 255, 255, 0.1)',
  'white-12': 'rgba(255, 255, 255, 0.12)',
  'white-18': 'rgba(255, 255, 255, 0.18)',
  'white-90': 'rgba(255, 255, 255, 0.9)',
  'white-22': 'rgba(255, 255, 255, 0.22)',
  'white-55': 'rgba(255, 255, 255, 0.55)',
} as const;
