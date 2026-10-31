import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Language } from '@credo/shared';
import { comparePictures, decodePng, type Difference } from '@credo/scripts/pixels';
import { type Locator, type Page } from '@playwright/test';

/** The widths the visual report draws a screen at; every walk shoots the same three. */
export const WIDTHS = { pc: 1280, tablet: 768, phone: 390 } as const;

export const required = (name: string, how = 'run this through `pnpm stack -- …`') => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: ${how}`);
  return value;
};

/** At most this many shots of one screen before it is called unsteady. */
const MAX_SHOTS = 10;
/** The wait between two shots, for a transition or a repaint still under way. */
const BETWEEN_SHOTS_MS = 100;

const describeMove = (difference: Exclude<Difference, { kind: 'equal' }>) =>
  difference.kind === 'size'
    ? `sizes ${difference.left} and ${difference.right}`
    : `${difference.pixels} pixels, largest shade ${difference.shade}`;

/** The one way a picture is taken. The pointer is parked in the corner first (a button under it is
 * drawn hovered, and which one depends on where the last click left it) and the page is scrolled to
 * the top (a fixed bar is drawn where the scroll left it). Then full-page shots, animations off and
 * the caret hidden, until two in a row are equal pixel for pixel by the raw reader, at most ten, or a
 * red naming the pixels between the last two. The picture is written to
 * `CREDO_SHOTS_DIR/<screen>-<language>-<width>.png`; `walk/run.sh` compares folders and bases, this
 * compares nothing with a base. `mask` paints over what is minted on every run and the human need not
 * judge: each call names the unit test that holds what it covers (QA rule 7). */
export async function shot(
  page: Page,
  screen: string,
  language: Language,
  width: number,
  mask: Locator[] = [],
) {
  await page.mouse.move(0, 0);
  await page.evaluate('window.scrollTo(0, 0)');
  const name = `${screen}-${language}-${width}.png`;
  const dir = required('CREDO_SHOTS_DIR', 'walk/run.sh gives it the folder for the pictures');
  const take = () =>
    page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask });
  let last = await take();
  let moved = 'no second shot';
  for (let taken = 1; taken < MAX_SHOTS; taken++) {
    await page.waitForTimeout(BETWEEN_SHOTS_MS);
    const next = await take();
    const difference = comparePictures(decodePng(last), decodePng(next));
    if (difference.kind === 'equal') {
      await writeFile(join(dir, name), next);
      return;
    }
    moved = describeMove(difference);
    last = next;
  }
  throw new Error(`${name} did not settle in ${MAX_SHOTS} shots: the last two differ by ${moved}`);
}
