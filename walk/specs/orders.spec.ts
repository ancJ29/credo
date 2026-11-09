import { addDays, type Language } from '@credo/shared';
import {
  DEMO_CUSTOMERS,
  DEMO_DELIVERIES,
  DEMO_EMPLOYEES,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_TODAY,
} from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * An order, sent to a driver: the office's walk of fourteen screens, each in Vietnamese and in English at
 * the three widths (14 × 2 × 3 = 84). The `orders-fake` project runs it on `pnpm fake -- …` and the
 * `orders-full` project on the stack (`pnpm stack -- …`); both write their pictures for `walk/run.sh`
 * to compare, raw. Each screen opens on a client of its own, signed in as the office's manager of the
 * data set, and the browser's clock is fixed at the data set's today, so the day an order is filed
 * under is the same on both. Words come from the app's own dictionaries.
 */

const FULL = () => test.info().project.name === 'orders-full';
const OFFICE = 'EMP-0001';
const DRIVER = 'EMP-0005 · Võ Thanh Tùng';
/** A customer or a product as the order form lists it in its choice. */
const customerChoice = (code: string) => {
  const one = DEMO_CUSTOMERS.find((candidate) => candidate.code === code)!;
  return `${one.code} · ${one.name}`;
};
const productChoice = (code: string) => {
  const one = DEMO_PRODUCTS.find((candidate) => candidate.code === code)!;
  return `${one.code} · ${one.name} · ${one.unit}`;
};
const draft = DEMO_ORDERS.find((one) => one.day === DEMO_TODAY && one.state === 'draft')!;
/** The draft taken yesterday, one of whose lines was priced before its product's price moved. */
const yesterdays = DEMO_ORDERS.find(
  (one) => one.day === addDays(DEMO_TODAY, -1) && one.state === 'draft',
)!;
const waiting = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === 'EMP-0006',
)!;
/** The request the data set delivered today, and the order it fulfilled. */
const delivered = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'delivered',
)!;
/** The data set's today at ten in the morning, in this Mac's time zone. */
const [YEAR, MONTH, DAY] = DEMO_TODAY.split('-').map(Number) as [number, number, number];
const CLOCK = new Date(YEAR, MONTH - 1, DAY, 10, 0, 0);

/** A field's whole label, the star Mantine adds to a required one allowed. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string; people: Record<string, string> };

async function seed(): Promise<Seeded> {
  const reply = await fetch(required('CREDO_SEED_URL'), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

type Opening = {
  path: string;
  /** The failure the fake answers once; the full run provokes it in its own way. */
  cue?: string;
  /** No one is allowed to deliver yet: the fake leaves the right out, the full run saves the setup so. */
  noDrivers?: true;
};

/** What the office person holds on a client of the stack: the headers of a call as they are. */
type Office = { code: string; authId: string };

/** Opens a screen as the office's manager. On the fake: the address with `?fake`, the cue, and the
 * language and the handle kept in the tab. On the stack: a client of its own, the person signed in
 * through the real API, the language and the handle kept on the device. The clock is the data set's
 * today on both. */
async function open(page: Page, language: Language, opening: Opening): Promise<Office | null> {
  await setups.get(page)?.dispose();
  await page.clock.setFixedTime(CLOCK);
  if (!FULL()) {
    const handle = `fake.session.${DEMO_EMPLOYEES.find((one) => one.code === OFFICE)!.id}`;
    setups.set(
      page,
      await page.addInitScript(
        ([chosen, kept]) => {
          sessionStorage.setItem('credo.language', chosen);
          sessionStorage.setItem('credo.session', kept);
        },
        [language, handle],
      ),
    );
    const { path, cue, noDrivers } = opening;
    const glue = path.includes('?') ? '&' : '?';
    await page.goto(
      `${path}${glue}fake${cue ? `&cue=${cue}` : ''}${noDrivers ? '&no-drivers' : ''}`,
    );
    return null;
  }
  const client = await seed();
  const root = await signIn(page, client.code, 'root', client.rootPassword);
  if (opening.noDrivers) await withoutDriversAllowed(page, client.code, root);
  const authId = await signIn(page, client.code, OFFICE, client.people[OFFICE]);
  setups.set(
    page,
    await page.addInitScript(
      ([chosen, code, kept]) => {
        localStorage.setItem('credo.language', chosen);
        localStorage.setItem('credo.client', code);
        localStorage.setItem('credo.session', kept);
      },
      [language, client.code, authId],
    ),
  );
  await page.goto(opening.path);
  return { code: client.code, authId };
}

async function signIn(page: Page, code: string, name: string, password: string) {
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': code, 'x-device-id': 'device-walk-seed' },
    data: { name, password },
  });
  expect(reply.ok(), `${name} signs in on ${code}`).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

/** The root saves the staff setup with the right to deliver taken from every department, through
 * the real API: the screen then meets the BFF's own empty list of drivers. */
async function withoutDriversAllowed(page: Page, code: string, authId: string) {
  const headers = { 'x-client-code': code, 'x-auth-id': authId };
  const { setup, version } = (await (
    await page.request.get('/api/staff-setup', { headers })
  ).json()) as {
    setup: { departments: { permissions: Record<string, boolean> }[] };
    version: string;
  };
  const departments = setup.departments.map((unit) => ({
    ...unit,
    permissions: { ...unit.permissions, 'deliveries.canDeliver': false },
  }));
  const saved = await page.request.put('/api/staff-setup', {
    headers,
    data: { setup: { ...setup, departments }, version },
  });
  expect(saved.ok(), 'the setup is saved without the right to deliver').toBe(true);
}

/** Someone else's save of the draft, made through the real API while the page holds the version it
 * read: the page's own save then meets the BFF's 409. */
async function theirSave(page: Page, office: Office) {
  const headers = { 'x-client-code': office.code, 'x-auth-id': office.authId };
  const found = (await (
    await page.request.get(`/api/orders/${draft.day}/${await idOf(page, headers)}`, { headers })
  ).json()) as {
    order: { id: string; customer: { id: string }; lines: { productId: string }[] };
    version: string;
  };
  const saved = await page.request.put(`/api/orders/${draft.day}/${found.order.id}`, {
    headers,
    data: {
      day: draft.day,
      customerId: found.order.customer.id,
      lines: found.order.lines.map(({ productId }) => ({ productId, quantity: 7 })),
      extra: {},
      version: found.version,
    },
  });
  expect(saved.ok(), 'their save goes through').toBe(true);
}

/** The id the BFF minted for the draft, found by its number in the day's orders. */
async function idOf(page: Page, headers: Record<string, string>) {
  const listed = (await (
    await page.request.get(`/api/orders?from=${DEMO_TODAY}&to=${DEMO_TODAY}`, { headers })
  ).json()) as { orders: { id: string; number: string }[] };
  return listed.orders.find((one) => one.number === draft.number)!.id;
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  // By role: the phone bar's link to Customers carries the same label, in the page at every width.
  const choose = (label: string, option: string) =>
    page.getByRole('combobox', { name: exactly(label) }).selectOption({ label: option });
  /** The order form's product line: the product chosen, its quantity typed, and the line added. */
  const line = async (option: string, quantity: string) => {
    await choose(words.orders.product, option);
    await page.getByLabel(words.orders.quantity, { exact: true }).fill(quantity);
    await press(words.orders.addLine);
  };
  /** Today's draft opened from the list of orders, as the office does: the BFF minted its id. */
  const openDraft = async () => {
    await page.getByRole('link', { name: draft.number, exact: true }).click();
    await expect(title(words.orders.orderTitle.replace('{{number}}', draft.number))).toBeVisible();
    await expect(page.getByRole('button', { name: words.orders.saveDraft })).toBeVisible();
  };
  const listed = async (opening: Opening = { path: '/orders' }) => {
    const office = await open(page, language, opening);
    await expect(page.getByRole('link', { name: draft.number, exact: true })).toBeVisible();
    return office;
  };

  // 1. Orders: the last 7 days'.
  await listed();
  await at('orders-1-list');

  // 2. A new order: a customer, two products at their prices, the total.
  await open(page, language, { path: '/orders/new' });
  await expect(title(words.orders.newTitle)).toBeVisible();
  await expect(page.getByRole('option', { name: /^KH-001/ })).toBeAttached();
  await choose(words.orders.customer, customerChoice('KH-001'));
  await line(productChoice('VT-001'), '40');
  await line(productChoice('VT-002'), '3');
  await expect(page.getByRole('row', { name: /VT-002/ })).toBeVisible();
  await at('orders-2-new');

  // 3. Confirm: the driver and the day, today chosen.
  await listed();
  await openDraft();
  await choose(words.orders.driver, DRIVER);
  await at('orders-3-confirm');

  // 4. Confirmed: the order's number and its request's.
  await press(words.orders.confirmSubmit);
  await expect(page.getByRole('alert')).toContainText(
    words.orders.done.confirmed.replace('{{number}}', 'GH-00015'),
  );
  await at('orders-4-confirmed');

  // 5. Delivery requests: today's, by driver.
  await open(page, language, { path: '/deliveries' });
  await expect(page.getByRole('link', { name: waiting.number, exact: true })).toBeVisible();
  await at('orders-5-requests');

  // 6. A delivery request opened.
  await page.getByRole('link', { name: waiting.number, exact: true }).click();
  await expect(
    title(words.orders.requestTitle.replace('{{number}}', waiting.number)),
  ).toBeVisible();
  await at('orders-6-request');

  // 7. A request cancelled; its order offers to send it again.
  await press(words.orders.cancelRequest);
  await press(words.orders.cancelRequestConfirm.replace('{{number}}', waiting.number));
  await expect(page.getByRole('alert')).toContainText(words.orders.requestCancelled);
  await page.getByRole('link', { name: words.orders.openOrder }).click();
  await expect(page.getByRole('heading', { level: 3, name: words.orders.sendAgain })).toBeVisible();
  await at('orders-7-cancelled');

  // 8. Someone else saved the draft first. On the stack the second save is the real API's own.
  const office = await listed({ path: '/orders', cue: 'saveOrder:409' });
  await openDraft();
  if (office) await theirSave(page, office);
  await page
    .getByRole('button', {
      name: words.orders.removeLine.replace('{{name}}', draft.lines[0].name),
    })
    .click();
  await line(productChoice('VT-001'), '1');
  await press(words.orders.saveDraft);
  await expect(page.getByRole('alert')).toContainText(words.orders.conflict);
  await at('orders-8-conflict');

  // 9. A confirm that failed. On the stack the BFF's answer is a stubbed 503.
  if (FULL()) {
    await page.route('**/api/orders/*/*/confirm', (route) =>
      route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
    );
  }
  await listed({ path: '/orders', cue: 'confirmOrder:503' });
  await openDraft();
  await choose(words.orders.driver, DRIVER);
  await press(words.orders.confirmSubmit);
  await expect(page.getByRole('alert')).toContainText(words.orders.stepFailed);
  await at('orders-9-confirm-failed');
  await page.unroute('**/api/orders/*/*/confirm');

  // 10. No one allowed to deliver yet: the root's setup was saved without the right, through the real API.
  await listed({ path: '/orders', noDrivers: true });
  await openDraft();
  await expect(page.getByRole('alert')).toContainText(words.orders.noDrivers);
  await at('orders-10-no-drivers');

  // 11. An order fulfilled, its request delivered.
  await open(page, language, { path: '/orders' });
  await page.getByRole('link', { name: delivered.order.number, exact: true }).click();
  await expect(
    title(words.orders.orderTitle.replace('{{number}}', delivered.order.number)),
  ).toBeVisible();
  await expect(page.getByText(words.orders.state.fulfilled, { exact: true })).toBeVisible();
  await at('orders-11-fulfilled');

  // 12. A delivered request, with its photo.
  await open(page, language, { path: '/deliveries' });
  await page.getByRole('link', { name: delivered.number, exact: true }).click();
  await expect(
    title(words.orders.requestTitle.replace('{{number}}', delivered.number)),
  ).toBeVisible();
  const proof = page.getByRole('img', { name: words.orders.proofAlt });
  await expect(proof).toBeVisible();
  await expect(proof).toHaveJSProperty('complete', true);
  await at('orders-12-proof');

  // the whole mark, its number a figure of any grouping: not the template's first word, which
  // Playwright trims to a substring that any later word of the page could match
  const moved = page.getByText(
    new RegExp(
      words.orders.priceMoved
        .split('{{price}}')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\d[\\d.,\u00a0\u202f]*'),
    ),
  );
  // 13. A draft taken before a price changed: its own prices, and the line that has moved.
  await open(page, language, { path: '/orders' });
  await page.getByRole('link', { name: yesterdays.number, exact: true }).click();
  await expect(
    title(words.orders.orderTitle.replace('{{number}}', yesterdays.number)),
  ).toBeVisible();
  await expect(moved).toBeVisible();
  await at('orders-13-moved-price');

  // 14. The draft saved again: the moved line repriced, and a new total.
  await press(words.orders.saveDraft);
  await expect(page.getByRole('alert')).toContainText(words.orders.done.saved);
  await expect(moved).toHaveCount(0);
  await at('orders-14-repriced');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`an order sent to a driver, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all fourteen screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
