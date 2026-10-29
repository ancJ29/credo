import { photoIsValid, PHOTO_SIDE } from '@credo/shared';

/** JPEG qualities tried in turn, the first that keeps the picture within the photo's limit wins. */
const QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.25];

/* v8 ignore start -- untested: it draws on a canvas, which jsdom does not have, and no screen of the walks chooses a file; the page's tests put a stand-in for it */
/**
 * The middle square of a picture, made `PHOTO_SIDE` pixels wide and kept as a JPEG within the
 * photo's limit. Throws when the file is no picture the browser reads, or stays too large at the
 * lowest quality.
 */
export async function shrinkToPhoto(file: File): Promise<string> {
  const picture = await createImageBitmap(file);
  const side = Math.min(picture.width, picture.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIDE;
  canvas.height = PHOTO_SIDE;
  const context = canvas.getContext('2d');
  context?.drawImage(
    picture,
    (picture.width - side) / 2,
    (picture.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIDE,
    PHOTO_SIDE,
  );
  for (const quality of QUALITIES) {
    const photo = canvas.toDataURL('image/jpeg', quality);
    if (photoIsValid(photo)) return photo;
  }
  throw new Error('the picture stays larger than a photo may be');
}
/* v8 ignore stop */
