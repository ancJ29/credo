import { type Language } from '@credo/shared';
import { type DemoFile, demoImportFile } from '@credo/ui/import-demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * The customers and products from Excel, one walk of eight screens, each in Vietnamese and in
 * English at the three widths (8 × 2 × 3 = 48). The `fake` project runs it on `pnpm fake -- …` and
 * keeps the pictures as the full run's reference; the `full` project runs it on the stack
 * (`pnpm stack -- …`) and compares them. Each screen opens at an address of its own, signed in as
 * the root, on a client of its own on the stack, so an import never meets what an earlier one
 * added. Words come from the app's own dictionaries.
 */

const FULL = () => test.info().project.name === 'full';

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string };

/** A client of its own, made by the stack from the data set. */
async function seed(): Promise<Seeded> {
  const reply = await fetch(required('CREDO_SEED_URL'), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

/** Opens a screen as the root. On the fake: the address with `?fake` and the language kept in the
 * tab. On the stack: a client of its own, the root signed in through the real API, the language and
 * the handle kept on the device. */
async function open(page: Page, language: Language, path: string) {
  // Only this opening's setup may run: an earlier one would run again on every navigation.
  await setups.get(page)?.dispose();
  if (!FULL()) {
    setups.set(
      page,
      await page.addInitScript(
        ([chosen, handle]) => {
          sessionStorage.setItem('credo.language', chosen);
          sessionStorage.setItem('credo.session', handle);
        },
        [language, 'fake.session'],
      ),
    );
    await page.goto(`${path}?fake`);
    return;
  }
  const client = await seed();
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': client.code, 'x-device-id': 'device-walk-seed' },
    data: { name: 'root', password: client.rootPassword },
  });
  expect(reply.ok(), `root signs in on ${client.code}`).toBe(true);
  const handle = ((await reply.json()) as { authId: string }).authId;
  setups.set(
    page,
    await page.addInitScript(
      ([chosen, code, kept]) => {
        localStorage.setItem('credo.language', chosen);
        localStorage.setItem('credo.client', code);
        localStorage.setItem('credo.session', kept);
      },
      [language, client.code, handle],
    ),
  );
  await page.goto(path);
}

/** A label as a whole, the star of a required one allowed. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** Chooses one of the data set's files in the import page's file field, as a person does, and waits
 * for the page to show it chosen: the page hears the choice a moment after it is set. */
async function chooseFile(page: Page, language: Language, which: DemoFile) {
  const words = DICTIONARIES[language];
  const file = await demoImportFile(language, which);
  await page.getByLabel(exactly(words.import.file)).setInputFiles({
    name: file.name,
    mimeType: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await expect(page.getByText(words.import.chosen.replace('{{name}}', file.name))).toBeVisible();
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** By the keyboard: the pointer stays parked, so the hover scrollbar of the table never shows. */
  const read = () =>
    page.getByRole('button', { name: words.import.read, exact: true }).press('Enter');

  // 1. The customer list.
  await open(page, language, '/customers');
  await expect(title(words.nav.customers)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'KH-001', exact: true })).toBeVisible();
  await at('lists-1-customers');

  // 2. Import: the template is handed over, and the file chosen.
  await open(page, language, '/customers/import');
  await expect(title(words.lists.customers.importTitle)).toBeVisible();
  const template = page.waitForEvent('download');
  await press(words.import.template);
  expect((await template).suggestedFilename()).toBe(`customers-${language}.xlsx`);
  await chooseFile(page, language, 'customers');
  await at('lists-2-customers-import');

  // 3. Before saving: each row read, with the reasons for the refused.
  await open(page, language, '/customers/import');
  await chooseFile(page, language, 'customers');
  await read();
  await expect(title(words.import.previewTitle)).toBeVisible();
  await expect(page.getByText(words.import.willAdd, { exact: true })).toHaveCount(3);
  await at('lists-3-customers-preview');

  // 4. Imported: the customers added.
  await press(words.lists.customers.add.replace('{{count}}', '3'));
  await expect(title(words.lists.customers.doneTitle)).toBeVisible();
  await expect(
    page.getByText(words.lists.customers.doneAdded.replace('{{count}}', '3')),
  ).toBeVisible();
  await at('lists-4-customers-added');

  // 5. A file without the code column.
  await open(page, language, '/customers/import');
  await chooseFile(page, language, 'customers-no-code');
  await press(words.import.read);
  await expect(page.getByRole('alert')).toHaveText(
    words.lists.noColumn.replaceAll('{{name}}', words.lists.columns.code),
  );
  await at('lists-5-no-code');

  // 6. The product list.
  await open(page, language, '/products');
  await expect(title(words.nav.products)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'VT-001', exact: true })).toBeVisible();
  await at('lists-6-products');

  // 7. Before saving: a price that is no price, refused.
  await open(page, language, '/products/import');
  await chooseFile(page, language, 'products');
  await read();
  await expect(title(words.import.previewTitle)).toBeVisible();
  await expect(page.getByText(words.import.willAdd, { exact: true })).toHaveCount(3);
  await at('lists-7-products-preview');

  // 8. Imported: the products added.
  await press(words.lists.products.add.replace('{{count}}', '3'));
  await expect(title(words.lists.products.doneTitle)).toBeVisible();
  await expect(
    page.getByText(words.lists.products.doneAdded.replace('{{count}}', '3')),
  ).toBeVisible();
  await at('lists-8-products-added');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`customers and products from Excel, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all eight screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
