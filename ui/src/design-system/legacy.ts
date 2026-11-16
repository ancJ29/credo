import logoTile from './legacy/logo-tile.png';

/**
 * The legacy app's picture of a part, by the part's name in the gallery: cut from the 2026-11-16
 * capture of its sign-in page at the PC width, one pixel a pixel. The gallery alone imports it, so
 * no bundle holds a picture. A part with no picture here has no "Legacy" pane.
 */
export const LEGACY: Record<string, string> = {
  LogoTile: logoTile,
};
