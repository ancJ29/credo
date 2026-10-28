import { type Language } from '@credo/shared';
import { expect, type Locator, type Page } from '@playwright/test';

/** The widths the visual report draws a screen at; every walk shoots the same three. */
export const WIDTHS = { pc: 1280, tablet: 768, phone: 390 } as const;

export const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run this through \`pnpm stack -- …\``);
  return value;
};

/** The pointer is parked in the corner first: a button under it is drawn hovered, and which one
 * depends on where the last click left it. `mask` paints over what differs on every run, such as
 * a password made for the walk. */
export async function shot(
  page: Page,
  screen: string,
  language: Language,
  width: number,
  mask: Locator[] = [],
) {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`${screen}-${language}-${width}.png`, {
    fullPage: true,
    mask,
  });
}
