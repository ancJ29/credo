import { describe, expect, it } from 'vitest';
import {
  deliverSentRequestSchema,
  deliveryPhotoRecordSchema,
  MAX_PHOTO_BYTES,
  MAX_PROOF_BYTES,
  photoAddressReplySchema,
  photoAddressRequestOf,
  photoAddressRequestSchema,
  photoIsValid,
  photoReplySchema,
  PROOF_SIDE,
  proofIsValid,
  savePhotoRequestSchema,
  storedPhotoSchema,
} from './photo';

/** A data URL whose payload decodes to exactly `bytes` bytes. */
const image = (bytes: number, type = 'png') =>
  `data:image/${type};base64,${Buffer.alloc(bytes, 1).toString('base64')}`;

describe('a photo', () => {
  it('A photo is an image of at most 50 KB in its own record; anything else is a 400', () => {
    expect(MAX_PHOTO_BYTES).toBe(51_200);
    expect(photoIsValid(image(MAX_PHOTO_BYTES))).toBe(true);
    expect(photoIsValid(image(MAX_PHOTO_BYTES + 1))).toBe(false);
    for (const type of ['jpeg', 'png', 'webp'])
      expect(photoIsValid(image(10, type)), type).toBe(true);
    // not an image of a kind a browser makes, not base64, no payload
    for (const bad of [
      image(10, 'svg+xml'),
      image(10, 'gif'),
      'data:text/plain;base64,AAAA',
      'data:image/png;base64,',
      'data:image/png;base64,@@@@',
      'data:image/png;base64,AAA',
      'https://example.com/x.png',
      '',
    ]) {
      expect(photoIsValid(bad), bad).toBe(false);
    }
  });

  it('is read with the version it was at, none yet being null and an empty version, and saved over the version read', () => {
    const photo = image(10);

    expect(photoReplySchema.parse({ photo: null, version: '' })).toEqual({
      photo: null,
      version: '',
    });
    expect(
      photoReplySchema.safeParse({ photo: image(MAX_PHOTO_BYTES + 1), version: 'v' }).success,
    ).toBe(false);
    const tag = 'a'.repeat(64);
    expect(savePhotoRequestSchema.safeParse({ photo, version: tag }).success).toBe(true);
    expect(savePhotoRequestSchema.safeParse({ photo, version: '' }).success).toBe(true);
    expect(savePhotoRequestSchema.safeParse({ photo, version: 'nope' }).success).toBe(false);
    expect(savePhotoRequestSchema.safeParse({ photo: null, version: tag }).success).toBe(false);
  });

  it('is kept in a record that holds the photo and nothing else', () => {
    expect(storedPhotoSchema.safeParse({ photo: image(10) }).success).toBe(true);
    expect(storedPhotoSchema.safeParse({ photo: image(MAX_PHOTO_BYTES + 1) }).success).toBe(false);
    expect(storedPhotoSchema.safeParse({ photo: image(10), version: 'x' }).success).toBe(false);
  });
});

describe('a delivery’s photo', () => {
  it('A delivery’s photo is a JPEG, PNG or WebP of at most 200 KB shrunk to 1280 px on its long side, and the photo’s record holds an object’s name alone', () => {
    expect(MAX_PROOF_BYTES).toBe(204_800);
    expect(PROOF_SIDE).toBe(1280);
    expect(proofIsValid(image(MAX_PROOF_BYTES))).toBe(true);
    expect(proofIsValid(image(MAX_PROOF_BYTES + 1))).toBe(false);
    expect(proofIsValid(image(MAX_PHOTO_BYTES + 1))).toBe(true);
    expect(proofIsValid(image(10, 'gif'))).toBe(false);
    expect(proofIsValid('')).toBe(false);
    expect(deliveryPhotoRecordSchema.safeParse({ name: 'a/b/c.jpg' }).success).toBe(true);
    expect(deliveryPhotoRecordSchema.safeParse({ name: '' }).success).toBe(false);
    expect(deliveryPhotoRecordSchema.safeParse({ name: 'x', photo: image(10) }).success).toBe(
      false,
    );
  });
});

describe('a delivery’s photo, sent by address', () => {
  it('Asking where to send a delivery’s photo names its type and exact length (at most 200 KB), the reply is an address and never the picture, and delivering after it takes the version alone', () => {
    const tag = 'a'.repeat(64);
    const ask = photoAddressRequestOf(image(1234, 'jpeg'));
    expect(ask).toEqual({ type: 'image/jpeg', bytes: 1234 });
    expect(photoAddressRequestSchema.safeParse(ask).success).toBe(true);
    expect(
      photoAddressRequestSchema.safeParse({ type: 'image/jpeg', bytes: MAX_PROOF_BYTES }).success,
    ).toBe(true);
    expect(
      photoAddressRequestSchema.safeParse({ type: 'image/jpeg', bytes: MAX_PROOF_BYTES + 1 })
        .success,
    ).toBe(false);
    expect(photoAddressRequestSchema.safeParse({ type: 'image/jpeg', bytes: 0 }).success).toBe(
      false,
    );
    expect(photoAddressRequestSchema.safeParse({ type: 'image/gif', bytes: 5 }).success).toBe(
      false,
    );
    expect(
      photoAddressReplySchema.safeParse({ url: 'https://photos.example/a?sig=1' }).success,
    ).toBe(true);
    expect(photoAddressReplySchema.safeParse({ url: 'not an address' }).success).toBe(false);
    expect(
      photoAddressReplySchema.safeParse({ url: 'https://photos.example/a', photo: image(5) })
        .success,
    ).toBe(false);
    expect(deliverSentRequestSchema.safeParse({ version: tag }).success).toBe(true);
    expect(deliverSentRequestSchema.safeParse({ version: tag, photo: image(5) }).success).toBe(
      false,
    );
    expect(deliverSentRequestSchema.safeParse({ version: 'nope' }).success).toBe(false);
  });
});
