/**
 * The legacy app's values that the new app's theme lacks, and the gallery reads. The greys, green,
 * red, font, gaps and shadows are `ui/src/theme.ts`'s already and are not copied here.
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
  /** The brand's own gradient, from its shade 7 to its shade 9: the primary button, the card's top bar. */
  brandGradient:
    'linear-gradient(135deg, var(--mantine-color-brand-7) 0%, var(--mantine-color-brand-9) 100%)',
  /** The side menu's ground, from the brand's shade 9 down to its shade 8. */
  menuGradient:
    'linear-gradient(180deg, var(--mantine-color-brand-9) 0%, var(--mantine-color-brand-8) 100%)',
  /** A section title's grey icon tile, in px. */
  iconTile: 24,
} as const;

/** The colours the frame's stylesheets and the shell draw that Mantine has no slot for, written as
 * `--credo-<name>` variables by the theme's resolver. */
export const FRAME_COLOURS = {
  white: '#fff',
  'ink-04': 'rgba(0, 0, 0, 0.04)',
  'white-05': 'rgba(255, 255, 255, 0.05)',
  'white-06': 'rgba(255, 255, 255, 0.06)',
  'white-08': 'rgba(255, 255, 255, 0.08)',
  'white-10': 'rgba(255, 255, 255, 0.1)',
  'white-12': 'rgba(255, 255, 255, 0.12)',
  'white-18': 'rgba(255, 255, 255, 0.18)',
  'white-90': 'rgba(255, 255, 255, 0.9)',
  'grey-9a': '#9a9a9a',
  'dark-surface': '#2e2e2e',
  'dark-text': '#e9ecef',
  'dark-edge': '#424242',
  'dark-icon': '#b8b8b8',
  'white-22': 'rgba(255, 255, 255, 0.22)',
  'white-55': 'rgba(255, 255, 255, 0.55)',
} as const;
