/** A picture's pixels as a canvas gives them: four bytes a pixel, red, green, blue, alpha. */
export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/** The text of the QR code in `pixels`, or null where there is none. The reader (jsQR) is fetched
 * on the first call, so only the page that reads a code, camera or picture, ever loads it. */
export async function readQr({ data, width, height }: Pixels): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  return jsQR(data, width, height)?.data ?? null;
}
