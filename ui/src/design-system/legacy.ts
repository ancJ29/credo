import defaultButton from './legacy/default-button.png';
import divider from './legacy/divider.png';
import gradientButton from './legacy/gradient-button.png';
import logoTile from './legacy/logo-tile.png';

/**
 * The legacy app's picture of a part, by the part's name in the gallery: cut from the 2026-11-16
 * capture of its sign-in pages at the PC width, one pixel a pixel. The gallery alone imports it, so
 * no bundle holds a picture. A part with no picture here has no "Legacy" pane.
 */
export const LEGACY: Record<string, string> = {
  LogoTile: logoTile,
  'Gradient button': gradientButton,
  'Default button': defaultButton,
  'Labelled divider': divider,
};
