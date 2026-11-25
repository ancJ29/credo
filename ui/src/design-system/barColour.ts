import { shadesOf } from './appTheme';
import { onBrand } from './onBrand';

/** What the browser's bar shows for a white header. */
const WHITE = '#ffffff';

/** The colour of the browser's bar: white for a white header, else the shade the header's gradient starts at. */
export function barColour(colour: string, whiteHeader: boolean) {
  if (whiteHeader) return WHITE;
  const shades = shadesOf(colour);
  return shades[onBrand(shades, 'header').span[0]];
}
