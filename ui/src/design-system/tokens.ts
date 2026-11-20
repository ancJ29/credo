/** The brand's gradient button and the header's ground: shade 7 to shade 9, at 135 degrees. */
const BRAND_SHADES = { from: 7, to: 9, deg: 135 } as const;

/** The theme's corner steps and gaps, written once here: `appTheme.ts`'s `themeOf` hands them to
 * Mantine, and the badge's corners and the card's padding below name a step of them. (They live in
 * this file and not the theme's because the theme reads the tokens, so the other way round would loop.) */
export const RADII = { xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px' } as const;
export const SPACING = { xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px' } as const;

/** The gradients' angles: the header's and the buttons' (the brand's), the side menu's. */
export const ANGLES = { header: BRAND_SHADES.deg, menu: 180 } as const;

/**
 * The legacy app's values that the new app's theme lacks, and the gallery reads. The greys, green,
 * red, font, gaps and shadows are `appTheme.ts`'s `themeOf` already and are not copied here.
 */
export const TOKENS = {
  /** The main colour's depth: Mantine's default light shade, which the legacy draws. */
  primaryShade: 6,
  /** A badge's corners: the theme's `sm` (4 px), not Mantine's pill. */
  badgeRadius: RADII.sm,
  /** A table row under the pointer: the brand's palest shade. */
  rowHover: 'var(--credo-brand-tint)',
  /** A dialog's title: large, at 550. */
  dialogTitle: { fontSize: 'var(--mantine-font-size-lg)', fontWeight: 550 },
  /** A dialog's header: the legacy's padding, 12 above and below, 16 at the sides. */
  dialogHeader: { padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)' },
  /** A field's label: small capitals, the legacy's default weight and spacing, in grey. */
  fieldLabel: { fw: 600, lts: 0.3 },
  /** A section's title: the same small capitals, bolder and wider. */
  sectionTitle: { fw: 700, lts: 0.5 },
  /** A section card's padding: the theme's `lg` (24 px). */
  cardPadding: SPACING.lg,
  /** The company logo's tile, in px: 44 square, corners of 10 (the legacy's card head). Like the
   * door's padding and body below, a component's own setting, not a theme step. */
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

/**
 * The colours the screens and the frame's stylesheets draw, each named by what it is for and written
 * once as a `--credo-<role>` variable by the theme's resolver (`cssVariables.ts`). A stylesheet or a
 * component reads the role, never a shade. The text on the client's colour, its washes and the
 * header's and menu's gradients follow the colour, so `credoVariables` writes them (`onBrand.ts`).
 */
export const ROLES = {
  surface: 'var(--mantine-color-neutral-0)',
  'surface-sunken': 'var(--mantine-color-neutral-1)',
  text: 'var(--mantine-color-neutral-8)',
  'text-muted': 'var(--mantine-color-neutral-7)',
  border: 'var(--mantine-color-neutral-2)',
  'border-strong': 'var(--mantine-color-neutral-3)',
  'hover-ink': 'rgba(0, 0, 0, 0.04)',
  /** The start; `credoVariables` moves it a shade darker where 7 does not read on white (`onWhite`). */
  'brand-text': 'var(--mantine-color-brand-7)',
  'brand-tint': 'var(--mantine-color-brand-0)',
  'brand-tint-strong': 'var(--mantine-color-brand-1)',
  'brand-line': 'var(--mantine-color-brand-2)',
  'on-brand-tint': 'var(--mantine-color-brand-9)',
  tip: 'var(--mantine-color-neutral-8)',
  'on-tip': '#fff',
  'warning-text': 'var(--mantine-color-orange-9)',
} as const;

/** The washes on the header's ground, as percent of the text on it, by role. */
export const HEADER_WASHES = {
  'header-hover': 12,
  'header-chip': 12,
  'header-avatar': 18,
  'header-avatar-edge': 90,
  'header-badge': 18,
  'language-edge': 55,
  'language-picked': 22,
} as const;

/** The washes on the menu's ground, as percent of the text on it, by role. */
export const MENU_WASHES = { 'menu-hover': 5, 'menu-current': 10 } as const;

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
