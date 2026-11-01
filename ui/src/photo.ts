import { photoIsValid, PHOTO_SIDE, proofIsValid, PROOF_SIDE } from '@credo/shared';

/** JPEG qualities tried in turn, the first that keeps the picture within the photo's limit wins. */
const QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.25];
/** The qualities a delivery's photo is tried at, from the best down to the lowest that is still a picture. */
const PROOF_QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4];

/* v8 ignore start -- untested: they draw on a canvas, which jsdom does not have, and the walks page and the page's tests put a stand-in for them; the walk's browser and the human's phone hold them */
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

/**
 * A delivery's photo: the whole picture, upright by its own orientation, at most `PROOF_SIDE` pixels
 * on its long side and kept as a JPEG at the first quality that holds it within the proof's limit.
 * Throws when the file is no picture the browser reads, or stays too large at the lowest quality.
 */
export async function shrinkToProof(file: File): Promise<string> {
  const picture = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, PROOF_SIDE / Math.max(picture.width, picture.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(picture.width * scale);
  canvas.height = Math.round(picture.height * scale);
  canvas.getContext('2d')?.drawImage(picture, 0, 0, canvas.width, canvas.height);
  for (const quality of PROOF_QUALITIES) {
    const photo = canvas.toDataURL('image/jpeg', quality);
    if (proofIsValid(photo)) return photo;
  }
  throw new Error('the picture stays larger than a delivery’s photo may be');
}
/* v8 ignore stop */
