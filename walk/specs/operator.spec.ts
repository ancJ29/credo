import { type Language } from '@credo/shared';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * The operator's walk, on a PC's browser at the three widths: four screens, each in Vietnamese and
 * in English, each against its committed base image (4 × 2 × 3 = 24). The stack
 * (`pnpm stack -- …`) gives the address and the operator's sign-in in the environment. The walk
 * makes a client of its own, whose root then signs in by the link it was shown; the first password
 * and the link's address are different on every run, so those two fields are masked in the
 * picture and read from the page instead.
 */

const OPERATOR = {
  name: required('CREDO_OPERATOR_NAME'),
  password: required('CREDO_OPERATOR_PASSWORD'),
};
const NAME = 'Minh Phát';

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  /** One code for each walk of the run, so none meets another's client; fixed, so its picture is. */
  const code = `walk-${language}-${width}`;
  const choose = (on: Page) =>
    on.addInitScript((chosen) => localStorage.setItem('credo.language', chosen), language);
  await choose(page);

  // 1. The operator's own door, in credo's name.
  await page.goto('/operator');
  await expect(page.getByRole('heading', { level: 1, name: 'Credo' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: words.operator.signIn })).toBeVisible();
  await at('op-1-sign-in');

  // 2. A new client: its code and the company's name.
  await page.getByLabel(words.auth.username, { exact: true }).fill(OPERATOR.name);
  await page.getByLabel(words.auth.password, { exact: true }).fill(OPERATOR.password);
  await page.getByRole('button', { name: words.auth.submit }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: words.operator.newTitle }),
  ).toBeVisible();
  await page.getByLabel(words.operator.code).fill(code);
  await page.getByLabel(words.operator.companyName).fill(NAME);
  await page.getByRole('heading', { level: 2 }).click();
  await at('op-2-new-client');

  // 3. Made: the link, the root's name and its first password, once.
  await page.getByRole('button', { name: words.operator.make }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: words.operator.madeTitle }),
  ).toBeVisible();
  const link = page.getByLabel(words.operator.link);
  const password = page.getByLabel(words.operator.firstPassword);
  await expect(page.getByLabel(words.operator.rootName)).toHaveValue('root');
  await at('op-3-made', [link, password]);

  // The link and the password it was shown are the client's way in: its root signs in by them.
  const client = await page.context().newPage();
  await choose(client);
  await client.goto(await link.inputValue());
  await expect(client.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await client.getByLabel(words.auth.username, { exact: true }).fill('root');
  await client.getByLabel(words.auth.password, { exact: true }).fill(await password.inputValue());
  await client.getByRole('button', { name: words.auth.submit }).click();
  await expect(client.getByRole('heading', { level: 2, name: words.settings.title })).toBeVisible();
  await client.close();

  // 4. The same code again: refused, and the client that holds it unchanged.
  await page.getByRole('button', { name: words.operator.another }).click();
  await page.getByLabel(words.operator.code).fill(code);
  await page.getByLabel(words.operator.companyName).fill(NAME);
  await page.getByRole('button', { name: words.operator.make }).click();
  await expect(page.getByRole('alert')).toHaveText(words.operator.taken);
  await page.getByRole('heading', { level: 2 }).click();
  await at('op-4-code-taken');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('walks all four screens in Vietnamese', async ({ page }) => {
      await walk(page, 'vi', width);
    });

    test('walks all four screens in English', async ({ page }) => {
      await walk(page, 'en', width);
    });
  });
}
