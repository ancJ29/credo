import { z } from 'zod';
import { imageDataUrl } from './config';
import { tagSchema } from './wire';

/** A person's photo is one square image the browser made small: at most this many bytes, kept as a
 * record of its own beside the person. */
export const MAX_PHOTO_BYTES = 50 * 1024;
/** The side, in pixels, the browser shrinks a photo to. */
export const PHOTO_SIDE = 256;

const PHOTO_TYPES = ['jpeg', 'png', 'webp'];

/** A JPEG, PNG or WebP data URL of at most `MAX_PHOTO_BYTES`. */
export function photoIsValid(photo: string) {
  const image = imageDataUrl(photo);
  return image !== null && PHOTO_TYPES.includes(image.type) && image.bytes <= MAX_PHOTO_BYTES;
}

const photoSchema = z.string().refine(photoIsValid, 'an image of at most 50 KB');

/** A person's photo and the version it was read at; none yet is `null` and `''`. */
export const photoReplySchema = z.strictObject({
  photo: photoSchema.nullable(),
  version: z.string(),
});
export type PhotoReply = z.infer<typeof photoReplySchema>;

/** Saving a photo over the version read; `''` names a person who has none. */
export const savePhotoRequestSchema = z.strictObject({
  photo: photoSchema,
  version: tagSchema.or(z.literal('')),
});
export type SavePhotoRequest = z.infer<typeof savePhotoRequestSchema>;
