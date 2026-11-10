import { inflateSync } from 'node:zlib';

export type Picture = { width: number; height: number; rgba: Uint8Array };
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Difference =
  | { kind: 'equal' }
  | { kind: 'moved'; pixels: number; shade: number; box: Box }
  | { kind: 'size'; left: string; right: string };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Colour types 2 (RGB) and 6 (RGBA) at 8 bits, not interlaced: what Chromium writes. Anything
 * else is refused by name, so a picture this reader cannot read is never read as equal. */
const CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The picture a PNG file holds, as RGBA (an RGB one gets full alpha). The chunks' own checksums are
 * not read: the signature, the header and the compressed data (which zlib sums) must all hold. */
export function decodePng(bytes: Uint8Array): Picture {
  const file = Buffer.from(bytes);
  if (file.length < 8 || SIGNATURE.some((value, i) => file[i] !== value)) {
    throw new Error('not a PNG: its first bytes are not the PNG signature');
  }
  let header: { width: number; height: number; channels: number } | undefined;
  const data: Buffer[] = [];
  for (let at = 8; at + 8 <= file.length;) {
    const length = file.readUInt32BE(at);
    const type = file.toString('latin1', at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (body.length < length) throw new Error(`cut short: the ${type} chunk ends past the file`);
    if (type === 'IHDR') {
      const [depth, colorType, , , interlace] = body.subarray(8, 13);
      if (depth !== 8) throw new Error(`unsupported: bit depth ${depth}, only 8`);
      const channels = CHANNELS[colorType];
      if (channels === undefined) {
        throw new Error(`unsupported: colour type ${colorType}, only 2 and 6`);
      }
      if (interlace !== 0) throw new Error('unsupported: an interlaced picture');
      header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), channels };
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (!header) throw new Error('not readable: no header chunk');
  const { width, height, channels } = header;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  if (raw.length !== height * (stride + 1)) {
    throw new Error(`not readable: its data is ${raw.length} bytes, not ${height * (stride + 1)}`);
  }
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const kind = raw[y * (stride + 1)];
    if (kind > 4) throw new Error(`not readable: row ${y} has filter ${kind}`);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? pixels[y * stride + i - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      const predicted = [0, a, b, (a + b) >> 1, paeth(a, b, c)][kind];
      pixels[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + predicted) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4).fill(255);
  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < channels; c++) rgba[p * 4 + c] = pixels[p * channels + c]!;
  }
  return { width, height, rgba };
}

/** Every pixel whose colour moved by any amount in any channel, alpha included: how many, the
 * largest shade and the box round them. Two sizes are one difference of their own. */
export function comparePictures(left: Picture, right: Picture): Difference {
  if (left.width !== right.width || left.height !== right.height) {
    return {
      kind: 'size',
      left: `${left.width}x${left.height}`,
      right: `${right.width}x${right.height}`,
    };
  }
  let pixels = 0;
  let shade = 0;
  const box: Box = { x0: left.width, y0: left.height, x1: -1, y1: -1 };
  for (let p = 0; p < left.width * left.height; p++) {
    let moved = 0;
    for (let c = 0; c < 4; c++) {
      moved = Math.max(moved, Math.abs(left.rgba[p * 4 + c] - right.rgba[p * 4 + c]));
    }
    if (moved === 0) continue;
    const [x, y] = [p % left.width, Math.floor(p / left.width)];
    pixels++;
    shade = Math.max(shade, moved);
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
  }
  return pixels === 0 ? { kind: 'equal' } : { kind: 'moved', pixels, shade, box };
}
