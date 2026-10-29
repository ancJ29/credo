import { join } from 'node:path';
import { type Language } from '@credo/shared';
import { expect, type Locator, type Page, test } from '@playwright/test';

/** The widths the visual report draws a screen at; every walk shoots the same three. */
export const WIDTHS = { pc: 1280, tablet: 768, phone: 390 } as const;

export const required = (name: string, how = 'run this through `pnpm stack -- …`') => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: ${how}`);
  return value;
};

/** The pointer is parked in the corner first: a button under it is drawn hovered, and which one
 * depends on where the last click left it. `mask` paints over what differs on every run, such as
 * a password made for the walk. The `fake` project only takes the picture, into `CREDO_FAKE_DIR`:
 * its pictures are what the full run is compared with, never bases, so nothing is compared. With
 * `CREDO_REFERENCE_DIR` set (the config then points the base images at that folder) a screen that
 * differs is a soft failure, so one walk names every screen that differs, not only the first. */
export async function shot(
  page: Page,
  screen: string,
  language: Language,
  width: number,
  mask: Locator[] = [],
) {
  await page.mouse.move(0, 0);
  const name = `${screen}-${language}-${width}.png`;
  if (['fake', 'operator-fake'].includes(test.info().project.name)) {
    await page.screenshot({
      path: join(
        required('CREDO_FAKE_DIR', 'the fake run’s script gives it the folder for the pictures'),
        name,
      ),
      fullPage: true,
      mask,
      animations: 'disabled',
      caret: 'hide',
    });
    return;
  }
  if (process.env['CREDO_REFERENCE_DIR']) {
    await expect.soft(page).toHaveScreenshot(name, { fullPage: true, mask });
    return;
  }
  await expect(page).toHaveScreenshot(name, { fullPage: true, mask });
}
