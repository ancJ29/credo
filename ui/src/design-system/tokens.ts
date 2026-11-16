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
  /** A section card's padding, in px. */
  cardPadding: 24,
  /** A section title's grey icon tile, in px. */
  iconTile: 24,
} as const;
