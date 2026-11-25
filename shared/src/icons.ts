import { clientLinkPath } from './wire';
import type { TenantConfig } from './config';

/** The drawn icon of a company with none uploaded: a square of its colour with its first letter in
 * white, drawn as pixels because an iPhone takes only a PNG. Nothing here reads a font, an image
 * library or the machine: the BFF and the fake draw the same pixels. */

/** The letter grid: x from 0 to 4, y from 0 to 6, y down. Each stroke is a line through points
 * written `xy`; a glyph is its strokes. */
const GLYPHS: Record<string, string[]> = {
  A: ['06 20 46', '13 33'],
  B: ['00 06 36 45 44 33 03 33 42 41 30 00'],
  C: ['41 30 10 01 05 16 36 45'],
  D: ['00 06 36 45 41 30 00'],
  E: ['40 00 06 46', '03 33'],
  F: ['40 00 06', '03 33'],
  G: ['41 30 10 01 05 16 36 45 43 23'],
  H: ['00 06', '40 46', '03 43'],
  I: ['10 30', '20 26', '16 36'],
  J: ['20 40', '30 35 26 16 05'],
  K: ['00 06', '40 03 46'],
  L: ['00 06 46'],
  M: ['06 00 23 40 46'],
  N: ['06 00 46 40'],
  O: ['10 30 41 45 36 16 05 01 10'],
  P: ['06 00 30 41 42 33 03'],
  Q: ['10 30 41 45 36 16 05 01 10', '24 46'],
  R: ['06 00 30 41 42 33 03', '23 46'],
  S: ['41 30 10 01 02 13 33 44 45 36 16 05'],
  T: ['00 40', '20 26'],
  U: ['00 05 16 36 45 40'],
  V: ['00 26 40'],
  W: ['00 16 22 36 40'],
  X: ['00 46', '40 06'],
  Y: ['00 23 40', '23 26'],
  Z: ['00 40 06 46'],
  Đ: ['10 16 36 45 41 30 10', '03 33'],
  '0': ['10 30 41 45 36 16 05 01 10', '15 31'],
  '1': ['10 20 26', '16 36'],
  '2': ['01 10 30 41 42 06 46'],
  '3': ['00 40 22 33 44 45 36 06'],
  '4': ['30 03 43', '30 36'],
  '5': ['40 00 02 32 43 45 36 06'],
  '6': ['40 10 01 05 16 36 45 43 32 02'],
  '7': ['00 40 16'],
  '8': ['10 30 41 42 33 13 02 01 10', '13 04 05 16 36 45 44 33'],
  '9': ['10 30 41 42 33 13 02 01 10', '42 45 36 16 05'],
};

/** The glyph's strokes as lines, each `[x1, y1, x2, y2]` on the letter grid. */
export const glyphLines = (letter: string): number[][] =>
  GLYPHS[letter].flatMap((stroke) => {
    const points = stroke.split(' ').map((point) => [Number(point[0]), Number(point[1])]);
    return points.slice(1).map((to, i) => [...points[i], ...to]);
  });

/** The letters the drawer holds a glyph for. */
export const ICON_LETTERS = Object.keys(GLYPHS);

/** The first letter or digit of the plain name, its marks dropped (`Ă` gives `A`) and `Đ` kept,
 * else of the code; `C` where neither has one. */
export const iconLetter = (name: string, code: string): string =>
  [...`${name}${code}`]
    .map((char) => char.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase())
    .find((char) => char in GLYPHS) ?? 'C';

/** A square of RGB pixels, three bytes each, row by row. */
export type Pixels = { side: number; rgb: Uint8Array };

const distanceToLine = (px: number, py: number, [x1, y1, x2, y2]: number[]) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const along = Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - x1 - along * dx, py - y1 - along * dy);
};

/** The company's icon, `side` pixels square: its colour, and its first letter in white at half the
 * height, each pixel shaded by its distance to the nearest stroke. */
export function drawIcon(
  { name, code, colour }: { name: string; code: string; colour: string },
  side: number,
): Pixels {
  const ground = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
  const unit = side / 12;
  const left = (side - 4 * unit) / 2;
  const top = (side - 6 * unit) / 2;
  const lines = glyphLines(iconLetter(name, code)).map(([x1, y1, x2, y2]) => [
    left + x1 * unit,
    top + y1 * unit,
    left + x2 * unit,
    top + y2 * unit,
  ]);
  const half = side * 0.04;
  const rgb = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const near = Math.min(...lines.map((line) => distanceToLine(x + 0.5, y + 0.5, line)));
      const white = Math.min(1, Math.max(0, half + 0.5 - near));
      ground.forEach((channel, i) => {
        rgb[(y * side + x) * 3 + i] = Math.round(channel + (255 - channel) * white);
      });
    }
  return { side, rgb };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const word = (value: number) => [
  value >>> 24,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];

const chunk = (type: string, data: Uint8Array) => {
  const body = new Uint8Array([...[...type].map((c) => c.charCodeAt(0)), ...data]);
  return [...word(data.length), ...body, ...word(crc32(body))];
};

/** A zlib stream of `raw` in stored blocks, with no compression: the fake's deflate, which needs
 * no library. zlib's own, in the BFF, makes the same picture in fewer bytes. */
export function storedDeflate(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = [0x78, 0x01];
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 65535, (i + 1) * 65535);
    const length = part.length;
    out.push(
      i === blocks - 1 ? 1 : 0,
      length & 255,
      length >>> 8,
      ~length & 255,
      (~length >>> 8) & 255,
    );
    for (const byte of part) out.push(byte);
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return new Uint8Array([...out, ...word(((b << 16) | a) >>> 0)]);
}

/** The PNG of `pixels`: 8-bit RGB, no filter, its image data made by `deflate` (a zlib stream). */
export function pngOf({ side, rgb }: Pixels, deflate: (raw: Uint8Array) => Uint8Array): Uint8Array {
  const raw = new Uint8Array(side * (side * 3 + 1));
  for (let y = 0; y < side; y++)
    raw.set(rgb.subarray(y * side * 3, (y + 1) * side * 3), y * (side * 3 + 1) + 1);
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk('IHDR', new Uint8Array([...word(side), ...word(side), 8, 2, 0, 0, 0])),
    ...chunk('IDAT', deflate(raw)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

/** The width and height a PNG's header names, or null for anything that is not one. */
export function pngSides(bytes: Uint8Array): { width: number; height: number } | null {
  const signed = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
  if (bytes.length < 24 || signed.some((byte, i) => bytes[i] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** The phone-app description of a company, from its settings and the addresses of its two icons. */
export function manifestOf(
  code: string,
  config: Pick<TenantConfig, 'name' | 'description' | 'colour' | 'whiteHeader' | 'defaultLanguage'>,
  icons: { small: string; large: string },
) {
  return {
    name: config.name,
    short_name: config.name,
    ...(config.description === '' ? {} : { description: config.description }),
    start_url: clientLinkPath(code),
    scope: '/',
    display: 'standalone',
    theme_color: config.whiteHeader ? '#ffffff' : config.colour,
    background_color: '#ffffff',
    lang: config.defaultLanguage,
    icons: [
      { src: icons.small, sizes: '192x192', type: 'image/png' },
      { src: icons.large, sizes: '512x512', type: 'image/png' },
    ],
  };
}
