import { ICON_SIDES, type IconKind, SMALL_SIDE, smallAddress } from '@credo/shared';

/** What an icon's file becomes: the picture of its kind's side, with the phone-app icon's
 * 192-pixel size beside it, or a refusal where the file is too small for the phone-app icon. */
export type MadeIcon = { picture: string; small?: string } | 'tooSmall';

/** An icon's 192-pixel address, where the icon is served from the back end; an icon the fake keeps
 * as a data URL is its own. */
export const smallIcon = (address: string) =>
  address.startsWith('data:') ? address : smallAddress(address);

/* v8 ignore start -- untested: they draw on a canvas, which jsdom does not have, and the settings' tests put a stand-in for them; the walk's browser and the human's phone hold them */
/** The middle square of a picture, `side` pixels wide as a PNG, drawn on white where asked: an
 * iPhone fills a transparent part black. */
function square(picture: ImageBitmap, side: number, onWhite: boolean) {
  const shorter = Math.min(picture.width, picture.height);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (context && onWhite) {
    context.fillStyle = 'white';
    context.fillRect(0, 0, side, side);
  }
  context?.drawImage(
    picture,
    (picture.width - shorter) / 2,
    (picture.height - shorter) / 2,
    shorter,
    shorter,
    0,
    0,
    side,
    side,
  );
  return canvas.toDataURL('image/png');
}

/**
 * An icon's file made the sides its kind asks, as the browser makes a photo: the tab icon's middle
 * square at 64; the phone-app icon's at 512 and 192, each on white, refused under 512 on its shorter
 * side. Throws when the file is no picture the browser reads.
 */
export async function makeIcon(file: File, kind: IconKind): Promise<MadeIcon> {
  const picture = await createImageBitmap(file);
  if (kind === 'tab-icon') return { picture: square(picture, ICON_SIDES[kind], false) };
  if (Math.min(picture.width, picture.height) < ICON_SIDES[kind]) return 'tooSmall';
  return {
    picture: square(picture, ICON_SIDES[kind], true),
    small: square(picture, SMALL_SIDE, true),
  };
}
/* v8 ignore stop */
