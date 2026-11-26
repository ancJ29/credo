import { deflateSync, inflateSync, crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  drawIcon,
  ICON_KINDS,
  ICON_SIDES,
  isIconKind,
  glyphLines,
  ICON_LETTERS,
  iconLetter,
  manifestOf,
  pngOf,
  pictureIsValid,
  pngSides,
  SMALL_SIDE,
  storedDeflate,
  type Pixels,
} from './icons';

const COMPANY = { name: 'Ăn Đêm', code: 'an-dem', colour: '#3e618c' };
const pixel = ({ side, rgb }: Pixels, x: number, y: number) => [
  ...rgb.subarray((y * side + x) * 3, (y * side + x) * 3 + 3),
];
const whites = ({ rgb }: Pixels) => rgb.filter((byte, i) => i % 3 === 0 && byte > 200).length;

describe('the drawn icon', () => {
  it('Is a square of the colour with the first letter in white at 64, 192 and 512', () => {
    for (const side of [64, 192, 512]) {
      const icon = drawIcon(COMPANY, side);
      expect(icon.side).toBe(side);
      expect(icon.rgb.length).toBe(side * side * 3);
      // the corners are the colour; the letter is white, and the middle row of the letter is
      expect(pixel(icon, 0, 0)).toEqual([0x3e, 0x61, 0x8c]);
      expect(pixel(icon, side - 1, side - 1)).toEqual([0x3e, 0x61, 0x8c]);
      const mid = icon.rgb.length / 3 / 2;
      expect(whites(icon)).toBeGreaterThan(mid / 20);
      expect(whites(icon)).toBeLessThan(mid / 3);
    }
    // a stroke's centre is pure white: the A's bar, at the middle of the icon
    expect(pixel(drawIcon({ ...COMPANY, name: 'A' }, 64), 32, 32)).toEqual([255, 255, 255]);
  });

  it('Takes the first letter of the plain name, its marks dropped, Đ kept, else the code', () => {
    expect(iconLetter('Ăn Đêm', 'x')).toBe('A');
    expect(iconLetter('Ơ', 'x')).toBe('O');
    expect(iconLetter('đông', 'x')).toBe('Đ');
    expect(iconLetter('  -- 7 Hill', 'x')).toBe('7');
    expect(iconLetter('', 'zed')).toBe('Z');
    expect(iconLetter('--', '9lives')).toBe('9');
    expect(iconLetter('', '--')).toBe('C');
    // the marks make no pixel of difference; Đ is not D
    const same = (a: string, b: string) =>
      expect(drawIcon({ ...COMPANY, name: a }, 64).rgb).toEqual(
        drawIcon({ ...COMPANY, name: b }, 64).rgb,
      );
    same('Ăn', 'An');
    expect(drawIcon({ ...COMPANY, name: 'Đ' }, 64).rgb).not.toEqual(
      drawIcon({ ...COMPANY, name: 'D' }, 64).rgb,
    );
  });

  it('Holds a distinct glyph on the grid for each of A to Z, Đ and 0 to 9', () => {
    expect([...ICON_LETTERS].sort()).toEqual([...'ABCDEFGHIJKLMNOPQRSTUVWXYZĐ0123456789'].sort());
    const seen = new Set<string>();
    for (const letter of ICON_LETTERS) {
      const lines = glyphLines(letter);
      expect(lines.length, letter).toBeGreaterThan(0);
      for (const [x1, y1, x2, y2] of lines) {
        expect(
          [x1, x2].every((x) => x >= 0 && x <= 4),
          letter,
        ).toBe(true);
        expect(
          [y1, y2].every((y) => y >= 0 && y <= 6),
          letter,
        ).toBe(true);
        expect(x1 !== x2 || y1 !== y2, `${letter} has a point, not a line`).toBe(true);
      }
      seen.add(JSON.stringify(lines));
    }
    expect(seen.size).toBe(ICON_LETTERS.length);
  });
});

/** The pixels a PNG holds, read with zlib's inflate and the CRCs checked. */
function decode(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Record<string, Uint8Array> = {};
  let at = 8;
  while (at < png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    expect(view.getUint32(at + 8 + length), type).toBe(
      crc32(png.subarray(at + 4, at + 8 + length)),
    );
    chunks[type] = png.subarray(at + 8, at + 8 + length);
    at += 12 + length;
  }
  const side = new DataView(chunks['IHDR'].buffer, chunks['IHDR'].byteOffset).getUint32(0);
  const raw = inflateSync(chunks['IDAT']);
  const rgb = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y++) {
    expect(raw[y * (side * 3 + 1)]).toBe(0);
    rgb.set(raw.subarray(y * (side * 3 + 1) + 1, (y + 1) * (side * 3 + 1)), y * side * 3);
  }
  return { side, rgb, header: [...chunks['IHDR'].subarray(8)], end: chunks['IEND'].length };
}

describe('the drawn icon as a PNG', () => {
  it('Decodes to the pixels drawn, with zlib deflate and the stored one alike', () => {
    for (const side of [64, 192, 512]) {
      const icon = drawIcon(COMPANY, side);
      const packed = pngOf(icon, (raw) => deflateSync(raw));
      const stored = pngOf(icon, storedDeflate);
      for (const png of [packed, stored]) {
        const back = decode(png);
        expect(back.side).toBe(side);
        expect(back.header).toEqual([8, 2, 0, 0, 0]);
        expect(back.end).toBe(0);
        // byte for byte; toEqual on 786,432 typed-array elements cost 1.8 s of the test
        expect(Buffer.from(back.rgb).equals(Buffer.from(icon.rgb)), 'the pixels drawn').toBe(true);
        expect(pngSides(png)).toEqual({ width: side, height: side });
      }
      expect(packed.length).toBeLessThan(stored.length);
    }
  });

  it('Stores nothing as one empty final block and a long run as several', () => {
    expect([...inflateSync(storedDeflate(new Uint8Array()))]).toEqual([]);
    const long = new Uint8Array(70_000).map((_, i) => i % 251);
    expect(inflateSync(storedDeflate(long))).toEqual(Buffer.from(long));
  });

  it('Reads the sides from a PNG header and nothing from anything else', () => {
    const png = pngOf(drawIcon(COMPANY, 64), storedDeflate);
    expect(pngSides(png)).toEqual({ width: 64, height: 64 });
    // a view into a larger buffer reads at its own offset
    const padded = new Uint8Array([9, 9, ...png]);
    expect(pngSides(padded.subarray(2))).toEqual({ width: 64, height: 64 });
    // the two sides are read each from its own place
    const tall = png.slice();
    new DataView(tall.buffer).setUint32(20, 100);
    expect(pngSides(tall)).toEqual({ width: 64, height: 100 });
    expect(pngSides(png.subarray(0, 23))).toBeNull();
    expect(pngSides(new Uint8Array(40))).toBeNull();
    expect(
      pngSides(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    ).toBeNull();
    const wrongChunk = png.slice();
    wrongChunk[12] = 0x58;
    expect(pngSides(wrongChunk)).toBeNull();
  });
});

describe('the manifest', () => {
  const config = {
    name: 'Ăn Đêm',
    description: 'Cơm tối',
    colour: '#3e618c',
    whiteHeader: false,
    defaultLanguage: 'vi' as const,
  };
  const icons = {
    small: '/api/pictures/an-dem/app-icon?size=192&v=a',
    large: '/api/pictures/an-dem/app-icon?v=a',
  };

  it('Holds the fields of the phone-app description', () => {
    expect(manifestOf('an-dem', config, icons)).toEqual({
      name: 'Ăn Đêm',
      short_name: 'Ăn Đêm',
      description: 'Cơm tối',
      start_url: '/login?client-code=an-dem',
      scope: '/',
      display: 'standalone',
      theme_color: '#3e618c',
      background_color: '#ffffff',
      lang: 'vi',
      icons: [
        { src: icons.small, sizes: '192x192', type: 'image/png' },
        { src: icons.large, sizes: '512x512', type: 'image/png' },
      ],
    });
  });

  it('Leaves the description out when empty, and is white for a white header', () => {
    const plain = manifestOf(
      'an-dem',
      { ...config, description: '', whiteHeader: true, defaultLanguage: 'en' },
      icons,
    );
    expect('description' in plain).toBe(false);
    expect(plain.theme_color).toBe('#ffffff');
    expect(plain.lang).toBe('en');
  });
});

describe('a picture a kind accepts', () => {
  const url = (side: number, type = 'png') =>
    `data:image/${type};base64,${Buffer.from(pngOf(drawIcon(COMPANY, side), storedDeflate)).toString('base64')}`;

  it('Is a PNG of the kind’s side, the phone-app icon with its 192, and no other kind has two sizes', () => {
    expect(pictureIsValid('tab-icon', url(64))).toBe(true);
    expect(pictureIsValid('tab-icon', url(64), url(64))).toBe(false);
    expect(pictureIsValid('tab-icon', url(192))).toBe(false);
    expect(pictureIsValid('tab-icon', url(64, 'jpeg'))).toBe(false);
    expect(pictureIsValid('app-icon', url(512), url(192))).toBe(true);
    expect(pictureIsValid('app-icon', url(512))).toBe(false);
    expect(pictureIsValid('app-icon', url(512), url(512))).toBe(false);
    expect(pictureIsValid('app-icon', url(192), url(192))).toBe(false);
    expect(pictureIsValid('app-icon', url(512), 'data:image/png;base64,AAAA')).toBe(false);
    // a picture that is not a PNG, a PNG too short to have a header, a non-square one
    const tall = Buffer.from(pngOf(drawIcon(COMPANY, 64), storedDeflate));
    tall.writeUInt32BE(100, 20);
    expect(pictureIsValid('tab-icon', `data:image/png;base64,${tall.toString('base64')}`)).toBe(
      false,
    );
    expect(pictureIsValid('tab-icon', 'data:image/png;base64,iVBORw0KGgo=')).toBe(false);
    expect(pictureIsValid('logo', url(64))).toBe(true);
    expect(pictureIsValid('logo-on-colour', url(64), url(64))).toBe(false);
    expect(ICON_KINDS).toEqual(['tab-icon', 'app-icon']);
    expect(ICON_KINDS.every(isIconKind)).toBe(true);
    expect(['logo', 'logo-on-colour'].some((kind) => isIconKind(kind as 'logo'))).toBe(false);
    expect(ICON_SIDES).toEqual({ 'tab-icon': 64, 'app-icon': 512 });
    expect(SMALL_SIDE).toBe(192);
  });
});
