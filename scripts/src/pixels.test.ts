import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { comparePictures, decodePng, type Picture } from './pixels';

/** A PNG made here, so each case is exactly the bytes it names. Chunk checksums are written as
 * zero: the reader checks the signature, the header and the compressed data, which zlib sums. */
const chunk = (type: string, body: Uint8Array) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body, Buffer.alloc(4)]);
};
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const header = (width: number, height: number, depth = 8, colorType = 6, interlace = 0) => {
  const body = Buffer.alloc(13);
  body.writeUInt32BE(width, 0);
  body.writeUInt32BE(height, 4);
  body.set([depth, colorType, 0, 0, interlace], 8);
  return chunk('IHDR', body);
};

/** The forward filter of one row, the reverse of what the reader undoes. */
const filtered = (kind: number, row: Uint8Array, above: Uint8Array, bpp: number) =>
  Uint8Array.from(row, (value, i) => {
    const a = i >= bpp ? row[i - bpp] : 0;
    const b = above[i];
    const c = i >= bpp ? above[i - bpp] : 0;
    const p = a + b - c;
    const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
    const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    return (value - [0, a, b, (a + b) >> 1, paeth][kind]) & 255;
  });

function png(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number[],
  { colorType = 6, filter = (y: number) => y % 5, level = 6 } = {},
) {
  const channels = colorType === 6 ? 4 : 3;
  const rows = Array.from({ length: height }, (_, y) =>
    Uint8Array.from({ length: width * channels }, (_, i) => {
      const value = pixel(Math.floor(i / channels), y);
      return value[i % channels] ?? 255;
    }),
  );
  const raw = Buffer.concat(
    rows.map((row, y) => {
      const kind = filter(y);
      const above = y ? rows[y - 1] : new Uint8Array(row.length);
      return Buffer.concat([Buffer.from([kind]), filtered(kind, row, above, channels)]);
    }),
  );
  return Buffer.concat([
    SIGNATURE,
    header(width, height, 8, colorType),
    chunk('IDAT', deflateSync(raw, { level })),
    chunk('IEND', new Uint8Array()),
  ]);
}

const gradient = (x: number, y: number) => [x * 7, y * 11, (x * y) & 255, 255];

describe('the pictures the walk takes, read pixel by pixel', () => {
  it('two pictures equal pixel for pixel read as equal, whatever their files’ bytes', () => {
    const plain = png(9, 7, gradient, { filter: () => 0, level: 0 });
    const packed = png(9, 7, gradient, { level: 9 });
    const withoutAlpha = png(9, 7, gradient, { colorType: 2 });

    expect(plain.equals(packed)).toBe(false);
    expect(comparePictures(decodePng(plain), decodePng(packed))).toEqual({ kind: 'equal' });
    expect(comparePictures(decodePng(plain), decodePng(withoutAlpha))).toEqual({ kind: 'equal' });
  });

  it('reads every filter of a row back to the pixels that were filtered', () => {
    for (const kind of [0, 1, 2, 3, 4]) {
      const noisy = (x: number, y: number) => [
        (x * 97 + y * 31) % 251,
        (x * y * 13) % 241,
        (x ^ y) * 29,
        255,
      ];
      const read: Picture = decodePng(png(6, 5, noisy, { filter: () => kind }));

      expect(Array.from(read.rgba.slice(0, 8))).toEqual([0, 0, 0, 255, 97, 0, 29, 255]);
      expect(Array.from(read.rgba.slice(-4))).toEqual([...noisy(5, 4)]);
      expect(read.rgba.length).toBe(6 * 5 * 4);
    }
  });

  it('skips a chunk it has no use for, such as the picture’s physical size', () => {
    const plain = png(9, 7, gradient);
    const withSize = Buffer.concat([
      plain.subarray(0, 33),
      chunk('pHYs', Buffer.alloc(9)),
      plain.subarray(33),
    ]);

    expect(comparePictures(decodePng(plain), decodePng(withSize))).toEqual({ kind: 'equal' });
  });

  it('one channel moved by one on one pixel reads one pixel, shade 1, its box', () => {
    const moved = (x: number, y: number) => {
      const [r, g, b, a] = gradient(x, y);
      return x === 3 && y === 2 ? [r, g + 1, b, a] : [r, g, b, a];
    };

    expect(comparePictures(decodePng(png(9, 7, gradient)), decodePng(png(9, 7, moved)))).toEqual({
      kind: 'moved',
      pixels: 1,
      shade: 1,
      box: { x0: 3, y0: 2, x1: 3, y1: 2 },
    });
  });

  it('reads the largest shade and the box round every moved pixel', () => {
    const moved = (x: number, y: number) => {
      const [r, g, b, a] = gradient(x, y);
      if (x === 1 && y === 5) return [r - 1, g, b, a];
      return x === 6 && y === 1 ? [r, g, b, a - 20] : [r, g, b, a];
    };

    expect(comparePictures(decodePng(png(9, 7, gradient)), decodePng(png(9, 7, moved)))).toEqual({
      kind: 'moved',
      pixels: 2,
      shade: 20,
      box: { x0: 1, y0: 1, x1: 6, y1: 5 },
    });
  });

  it('two sizes read as moved, both sizes named', () => {
    expect(comparePictures(decodePng(png(9, 7, gradient)), decodePng(png(9, 8, gradient)))).toEqual(
      { kind: 'size', left: '9x7', right: '9x8' },
    );
  });

  it('a file it cannot read is named, never read as equal', () => {
    const cases: [string, Uint8Array, RegExp][] = [
      ['not a picture', Buffer.from('plain text, not a picture'), /not a PNG/],
      [
        'cut short',
        png(9, 7, gradient).subarray(0, 60),
        /cut short|inflate|incomplete|unexpected/i,
      ],
      ['a 16-bit picture', Buffer.concat([SIGNATURE, header(2, 2, 16, 6)]), /bit depth 16/],
      ['a palette picture', Buffer.concat([SIGNATURE, header(2, 2, 8, 3)]), /colour type 3/],
      ['an interlaced picture', Buffer.concat([SIGNATURE, header(2, 2, 8, 6, 1)]), /interlaced/],
      ['no header', Buffer.concat([SIGNATURE, chunk('IEND', new Uint8Array())]), /no header/],
      [
        'a data length that is not the picture’s',
        Buffer.concat([
          SIGNATURE,
          header(3, 3),
          chunk('IDAT', deflateSync(Buffer.alloc(5))),
          chunk('IEND', new Uint8Array()),
        ]),
        /data is 5 bytes, not 39/,
      ],
      [
        'a filter that does not exist',
        Buffer.concat([
          SIGNATURE,
          header(1, 1),
          chunk('IDAT', deflateSync(Buffer.from([9, 0, 0, 0, 0]))),
          chunk('IEND', new Uint8Array()),
        ]),
        /filter 9/,
      ],
    ];

    for (const [, bytes, why] of cases) {
      expect(() => decodePng(bytes)).toThrow(why);
    }
  });
});
