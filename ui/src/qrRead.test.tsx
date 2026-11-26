import { render } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
import { describe, expect, it } from 'vitest';
import { readQr } from './qrRead';

/** Each module is drawn this many pixels wide. */
const SCALE = 4;
const LINK =
  'https://an-phat.example/login?client-code=an-phat&qr=7f0c9a52.q3Zk9d1Xw0pL7mTnB2vC8rYh5sGjA4eF';

/** A picture's pixels as a canvas gives them: a QR code of `value` drawn as the SVG draws it, black on white, the modules read off its path. */
function pixelsOf(value: string) {
  const { container, unmount } = render(
    <QRCodeSVG value={value} level="M" marginSize={4} size={100} />,
  );
  const cells = Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2]);
  const modules = [...container.querySelectorAll('path')].at(-1)!.getAttribute('d')!;
  unmount();
  const side = cells * SCALE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [, x, y, run] of modules.matchAll(/M(\d+)[ ,](\d+) ?h(\d+)v1H\d+z/g)) {
    for (let row = 0; row < SCALE; row++) {
      for (let column = 0; column < Number(run) * SCALE; column++) {
        const at = ((Number(y) * SCALE + row) * side + Number(x) * SCALE + column) * 4;
        data.fill(0, at, at + 3);
      }
    }
  }
  return { data, width: side, height: side };
}

describe('readQr', () => {
  it('4: reads a code’s text from a picture’s pixels, and none from a picture without one', async () => {
    expect(await readQr(pixelsOf(LINK))).toBe(LINK);

    const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 };
    expect(await readQr(blank)).toBeNull();
  });
});
