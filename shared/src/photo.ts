import { z } from 'zod';
import { imageDataUrl } from './config';
import { tagSchema } from './wire';

/** A person's photo is one square image the browser made small: at most this many bytes, kept as a
 * record of its own beside the person. */
export const MAX_PHOTO_BYTES = 50 * 1024;
/** The side, in pixels, the browser shrinks a photo to. */
export const PHOTO_SIDE = 256;

/** A delivery's photo is the same kind of picture, at most this many bytes. */
export const MAX_PROOF_BYTES = 200 * 1024;
/** The long side, in pixels, the phone shrinks a delivery's photo to. */
export const PROOF_SIDE = 1280;

const PHOTO_TYPES = ['jpeg', 'png', 'webp'];

/** A JPEG, PNG or WebP data URL of at most `MAX_PHOTO_BYTES`. */
export function photoIsValid(photo: string) {
  const image = imageDataUrl(photo);
  return image !== null && PHOTO_TYPES.includes(image.type) && image.bytes <= MAX_PHOTO_BYTES;
}

/** A JPEG, PNG or WebP data URL of at most `MAX_PROOF_BYTES`: the photo of a delivery. */
export function proofIsValid(photo: string) {
  const image = imageDataUrl(photo);
  return image !== null && PHOTO_TYPES.includes(image.type) && image.bytes <= MAX_PROOF_BYTES;
}

const proofSchema = z.string().refine(proofIsValid, 'an image of at most 200 KB');

/** Marking a request delivered: the version read and the photo taken. */
export const deliverRequestSchema = z.strictObject({ version: tagSchema, photo: proofSchema });
export type DeliverRequest = z.infer<typeof deliverRequestSchema>;

/** A delivery's photo, as its own record keeps it and its route answers it. */
export const deliveryPhotoReplySchema = z.strictObject({ photo: proofSchema });
export type DeliveryPhotoReply = z.infer<typeof deliveryPhotoReplySchema>;

/** The picture types a delivery's photo may be sent as; the back end takes the JPEG alone. */
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Asking where one delivery's photo may be sent: the picture's type and exact length in bytes. */
export const photoAddressRequestSchema = z.strictObject({
  type: z.enum(PROOF_TYPES),
  bytes: z.int().min(1).max(MAX_PROOF_BYTES),
});
export type PhotoAddressRequest = z.infer<typeof photoAddressRequestSchema>;

/** The ask of a photo `proofIsValid` holds: its type and the length it will be sent at. */
export function photoAddressRequestOf(photo: string): PhotoAddressRequest {
  const image = imageDataUrl(photo)!;
  return { type: `image/${image.type}` as PhotoAddressRequest['type'], bytes: image.bytes };
}

/** An address for one picture, to send it to or to read it from: it lives five minutes. It is an
 * address, never the picture. */
export const photoAddressReplySchema = z.strictObject({ url: z.url() });
export type PhotoAddressReply = z.infer<typeof photoAddressReplySchema>;

/** Marking a request delivered once its photo was sent: the version read, no picture. */
export const deliverSentRequestSchema = z.strictObject({ version: tagSchema });
export type DeliverSentRequest = z.infer<typeof deliverSentRequestSchema>;

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

/** What the record of a person's photo holds. */
export const storedPhotoSchema = z.strictObject({ photo: photoSchema });
export type StoredPhoto = z.infer<typeof storedPhotoSchema>;
