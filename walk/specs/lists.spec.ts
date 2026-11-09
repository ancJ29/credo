import { type Language, STACK_ENV } from '@credo/shared';
import { DEMO_CUSTOMERS, DEMO_PRODUCTS } from '@credo/shared/demo';
import { type DemoFile, demoImportFile } from '@credo/ui/import-demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * The customers and products from Excel, one walk of twenty-one screens, each in Vietnamese and in
 * English at the three widths (21 × 2 × 3 = 126). The `lists-fake` project runs it on `pnpm fake -- …`
 * and the `lists-full` project on the stack (`pnpm stack -- …`); both write their pictures for
 * `walk/run.sh` to compare, raw. Each screen opens at an address of its own, signed in as
 * the root, on a client of its own on the stack, so an import never meets what an earlier one
 * added. Words come from the app's own dictionaries.
 */

/** Whether a record has a note the page draws: the page's own rule, a text that is not empty. */
const hasNote = (one: { extra: Record<string, unknown> }) =>
  typeof one.extra['note'] === 'string' && one.extra['note'] !== '';

/** The customers' and products' pages: the first of each with a note and the first without. */
const NOTED_CUSTOMER = DEMO_CUSTOMERS.find(hasNote)!;
const PLAIN_CUSTOMER = DEMO_CUSTOMERS.find((one) => !hasNote(one))!;
const NOTED_PRODUCT = DEMO_PRODUCTS.find(hasNote)!;
const PLAIN_PRODUCT = DEMO_PRODUCTS.find((one) => !hasNote(one))!;

/** The note written on screen 14 and the phone retyped on screen 15: the same as the walk's steps. */
const NOTE_WRITTEN = 'Giao hàng buổi sáng, gọi trước khi đến.';
const NEW_PHONE = '0903 111 999';
/** The price typed on screens 16 and 17: the same as the walk's steps. */
const NEW_PRICE = '175000';
/** The customer typed on screens 19 and 21, the same as the walk's steps; screen 19 types the code
 * the list already holds. */
const ADDED_CODE = 'KH-090';
const ADDED_NAME = 'Cửa hàng Hải Âu';
const ADDED_PHONE = '0903 555 123';

const FULL = () => test.info().project.name === 'lists-full';

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string };

/** A client of its own, made by the stack from the data set. */
async function seed(): Promise<Seeded> {
  const reply = await fetch(required(STACK_ENV.CREDO_SEED_URL), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The client the page's latest opening made on the stack, for a save that goes in beside it. */
const clients = new WeakMap<Page, Seeded & { handle: string }>();

/** Someone else saves a data-set customer or product first, through the real API, so the page's
 * own save meets the BFF's 409: no stub, the refusal and its wording are the product's. The fake
 * answers the same save with a cue. The other's save changes one thing in `extra`, which the page's
 * own never touches, and sends the rest as read. */
async function someoneSavesFirst(page: Page, list: 'customers' | 'products', code: string) {
  const client = clients.get(page)!;
  const headers = { 'x-client-code': client.code, 'x-auth-id': client.handle };
  const listed = (await (await page.request.get(`/api/${list}`, { headers })).json()) as Record<
    string,
    { id: string; code: string }[]
  >;
  const id = listed[list].find((one) => one.code === code)!.id;
  const read = (await (await page.request.get(`/api/${list}/${id}`, { headers })).json()) as Record<
    string,
    unknown
  >;
  const {
    id: _id,
    code: _code,
    ...fields
  } = read[list === 'customers' ? 'customer' : 'product'] as {
    id: string;
    code: string;
    extra: object;
  };
  const theirs = await page.request.put(`/api/${list}/${id}`, {
    headers,
    data: {
      ...fields,
      version: read['version'],
      extra: { ...fields.extra, [list === 'customers' ? 'phone' : 'tier']: '0900 000 111' },
    },
  });
  expect(theirs.ok()).toBe(true);
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

/** Opens a screen as the root. On the fake: the address with `?fake` and the language kept in the
 * tab. On the stack: a client of its own, the root signed in through the real API, the language and
 * the handle kept on the device. */
async function open(page: Page, language: Language, path: string, cue?: string) {
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
    await page.goto(`${path}?fake${cue ? `&cue=${cue}` : ''}`);
    return;
  }
  const client = await seed();
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': client.code, 'x-device-id': 'device-walk-seed' },
    data: { name: 'root', password: client.rootPassword },
  });
  expect(reply.ok(), `root signs in on ${client.code}`).toBe(true);
  const handle = ((await reply.json()) as { authId: string }).authId;
  clients.set(page, { ...client, handle });
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

  // 9. More: the pages the phone's bar leaves out, then the password and sign-out.
  await open(page, language, '/more');
  await expect(title(words.nav.more)).toBeVisible();
  await at('lists-9-more');

  /** A customer's page opened from the list by the name's link, as the office does: on the stack
   * the BFF minted the id, so no address can name it. */
  const openCustomer = async (name: string, cue?: string) => {
    await open(page, language, '/customers', cue);
    await page.getByRole('link', { name, exact: true }).click();
  };

  // 10. A customer's page, one with a note: two columns from 992.
  await openCustomer(NOTED_CUSTOMER.name);
  await expect(title(NOTED_CUSTOMER.name)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: words.lists.customers.note }),
  ).toBeVisible();
  await at('lists-10-customer');

  // 11. A customer with no note: the Note card is there, empty, to write one into.
  await openCustomer(PLAIN_CUSTOMER.name);
  await expect(title(PLAIN_CUSTOMER.name)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: words.lists.customers.note }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: words.lists.customers.note })).toHaveValue('');
  await at('lists-11-customer-no-note');

  /** The price box, named by its label alone: its description is a separate text. */
  const priceLabel = exactly(words.lists.columns.price);

  /** A product's page opened from the list by the name's link, for the same reason. */
  const openProduct = async (name: string, cue?: string) => {
    await open(page, language, '/products', cue);
    await page.getByRole('link', { name, exact: true }).click();
  };

  // 12. A product's page, one with a note: two columns from 992.
  await openProduct(NOTED_PRODUCT.name);
  await expect(title(NOTED_PRODUCT.name)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: words.lists.products.note }),
  ).toBeVisible();
  await at('lists-12-product');

  // 13. A product with no note: the Note card is there, empty, to write one into.
  await openProduct(PLAIN_PRODUCT.name);
  await expect(title(PLAIN_PRODUCT.name)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: words.lists.products.note }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: words.lists.products.note })).toHaveValue('');
  await at('lists-13-product-no-note');

  // 14. A note written into the empty card and saved: the green notice.
  await openCustomer(PLAIN_CUSTOMER.name);
  await expect(title(PLAIN_CUSTOMER.name)).toBeVisible();
  await page.getByRole('textbox', { name: words.lists.customers.note }).fill(NOTE_WRITTEN);
  await press(words.lists.customers.save);
  await expect(page.getByRole('alert')).toHaveText(words.lists.customers.saved);
  await at('lists-14-customer-saved');

  // 15. Someone else saved first: the fake answers the save with a conflict once; on the stack
  // another save goes in through the real API, so the page's own save meets the BFF's 409.
  await openCustomer(NOTED_CUSTOMER.name, 'saveCustomer:409');
  await expect(title(NOTED_CUSTOMER.name)).toBeVisible();
  await page.getByRole('textbox', { name: exactly(words.lists.columns.phone) }).fill(NEW_PHONE);
  if (FULL()) await someoneSavesFirst(page, 'customers', NOTED_CUSTOMER.code);
  await press(words.lists.customers.save);
  await expect(page.getByRole('alert')).toContainText(words.lists.customers.conflict);
  await at('lists-15-customer-conflict');

  // 16. A new price typed into the product with no note and saved: the green notice.
  await openProduct(PLAIN_PRODUCT.name);
  await expect(title(PLAIN_PRODUCT.name)).toBeVisible();
  await page.getByRole('textbox', { name: priceLabel }).fill(NEW_PRICE);
  await press(words.lists.products.save);
  await expect(page.getByRole('alert')).toHaveText(words.lists.products.saved);
  await at('lists-16-product-saved');

  // 17. Someone else saved the product first, as on screen 15.
  await openProduct(NOTED_PRODUCT.name, 'saveProduct:409');
  await expect(title(NOTED_PRODUCT.name)).toBeVisible();
  await page.getByRole('textbox', { name: priceLabel }).fill(NEW_PRICE);
  if (FULL()) await someoneSavesFirst(page, 'products', NOTED_PRODUCT.code);
  await press(words.lists.products.save);
  await expect(page.getByRole('alert')).toContainText(words.lists.products.conflict);
  await at('lists-17-product-conflict');

  /** The add form's boxes typed as the walk's steps do, then the press. */
  const typeCustomer = async (code: string) => {
    await page.getByRole('textbox', { name: exactly(words.lists.columns.code) }).fill(code);
    await page.getByRole('textbox', { name: exactly(words.lists.columns.name) }).fill(ADDED_NAME);
    await page.getByRole('textbox', { name: exactly(words.lists.columns.phone) }).fill(ADDED_PHONE);
    await press(words.lists.customers.create);
  };

  // 18. Adding a customer: the customer's cards, and a code box to type in.
  await open(page, language, '/customers/new');
  await expect(title(words.lists.customers.newTitle)).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: exactly(words.lists.columns.code) }),
  ).toBeEditable();
  await at('lists-18-customer-new');

  // 19. A code the list already holds: the fake answers the add with a refusal once, and on the
  // stack the code typed is the data set's own, so the BFF refuses it for real.
  await open(page, language, '/customers/new', 'addCustomer:409');
  await expect(title(words.lists.customers.newTitle)).toBeVisible();
  await typeCustomer(NOTED_CUSTOMER.code);
  await expect(page.getByRole('alert')).toHaveText(words.lists.customers.codeTaken);
  await at('lists-19-code-taken');

  // 20. Adding a product: the code, name, unit and price to type in, the stock switch on, as an import's
  // blank stock cell reads, so a product nobody says anything about is the same either way in.
  await open(page, language, '/products/new');
  await expect(title(words.lists.products.newTitle)).toBeVisible();
  await expect(page.getByRole('switch')).toBeChecked();
  await at('lists-20-product-new');

  // 21. A customer added: it opens on its own page.
  await open(page, language, '/customers/new');
  await expect(title(words.lists.customers.newTitle)).toBeVisible();
  await typeCustomer(ADDED_CODE);
  await expect(title(ADDED_NAME)).toBeVisible();
  await expect(page.getByText(ADDED_CODE, { exact: true })).toBeVisible();
  await at('lists-21-customer-added');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`customers and products from Excel, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all twenty-one screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
