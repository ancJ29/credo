import { addDays, driverDay, type Language, STACK_ENV } from '@credo/shared';
import { DEMO_DELIVERIES, DEMO_EMPLOYEES, DEMO_TODAY, DEMO_WALK_PROOF } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * Each driver's day settled: the office's walk of eight screens, each in Vietnamese and in English at
 * the three widths (8 × 2 × 3 = 48). The `reconcile-fake` project runs it on `pnpm fake -- …` and the
 * `reconcile-full` project on the stack (`pnpm stack -- …`); both write their pictures for
 * `walk/run.sh` to compare, raw. Each screen opens on a client of its own, signed in as the office's
 * manager of the data set, and the browser's clock is fixed at the data set's today, so the page's day
 * is the same on both. The driver's day is `EMP-0005`'s. Words come from the app's own dictionaries.
 */

const FULL = () => test.info().project.name === 'reconcile-full';
const OFFICE = 'EMP-0001';
const DRIVER = 'EMP-0005';
const driver = DEMO_EMPLOYEES.find((one) => one.code === DRIVER)!;
const today = DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY);
const waiting = today.find((one) => one.driver.id === driver.id && one.state === 'waiting')!;
/** The cash typed: what the driver's delivered requests come to, less 20,000 đồng. */
const CASH = String(driverDay(today, driver.id).toCollect - 20_000);
const DAY_PATH = `/deliveries/${DEMO_TODAY}/drivers/${driver.id}`;
const YESTERDAY = addDays(DEMO_TODAY, -1);
/** The data set's today at ten in the morning, in this Mac's time zone. */
const [YEAR, MONTH, DAY] = DEMO_TODAY.split('-').map(Number) as [number, number, number];
const CLOCK = new Date(YEAR, MONTH - 1, DAY, 10, 0, 0);

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string; people: Record<string, string> };

async function seed(): Promise<Seeded> {
  const reply = await fetch(required(STACK_ENV.CREDO_SEED_URL), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

type Opening = {
  path: string;
  /** The failure the fake answers once; the full run provokes it in its own way. */
  cue?: string;
};

async function signIn(page: Page, code: string, name: string, password: string) {
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': code, 'x-device-id': 'device-walk-seed' },
    data: { name, password },
  });
  expect(reply.ok(), `${name} signs in on ${code}`).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

/** Opens a screen as the office's manager. On the fake: the address with `?fake`, the cue, and the
 * language and the handle kept in the tab. On the stack: a client of its own, the person signed in
 * through the real API, the language and the handle kept on the device. The clock is the data set's
 * today on both. */
async function open(page: Page, language: Language, opening: Opening): Promise<Seeded | null> {
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
    const { path, cue } = opening;
    await page.goto(`${path}${path.includes('?') ? '&' : '?'}fake${cue ? `&cue=${cue}` : ''}`);
    return null;
  }
  const client = await seed();
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
  await page.goto(await onStack(page, client, authId, opening.path));
  return client;
}

/** The address as the stack knows it: the BFF mints every employee id, so the data set's id of the
 * driver in a path is replaced by the one the office reads from the BFF's list of drivers. */
async function onStack(page: Page, client: Seeded, authId: string, path: string) {
  if (!path.includes(driver.id)) return path;
  const headers = { 'x-client-code': client.code, 'x-auth-id': authId };
  const listed = (await (await page.request.get('/api/drivers', { headers })).json()) as {
    drivers: { id: string; code: string }[];
  };
  const minted = listed.drivers.find((one) => one.code === DRIVER)?.id;
  expect(minted, `the stack's drivers hold ${DRIVER}`).toBeDefined();
  return path.replace(driver.id, minted!);
}

/** The driver delivers the waiting request, through the real API as the phone does, while the office
 * holds the day as it was read: the office's close then meets a day that moved. */
async function driverDelivers(page: Page, client: Seeded) {
  const authId = await signIn(page, client.code, DRIVER, client.people[DRIVER]);
  const headers = { 'x-client-code': client.code, 'x-auth-id': authId };
  const mine = (await (
    await page.request.get(`/api/my-deliveries?day=${DEMO_TODAY}`, { headers })
  ).json()) as { deliveries: { id: string; number: string }[] };
  const request = mine.deliveries.find((one) => one.number === waiting.number)!;
  const read = (await (
    await page.request.get(`/api/deliveries/${DEMO_TODAY}/${request.id}`, { headers })
  ).json()) as { version: string };
  const delivered = await page.request.post(`/api/deliveries/${DEMO_TODAY}/${request.id}/deliver`, {
    headers,
    data: { version: read.version, photo: DEMO_WALK_PROOF },
  });
  expect(delivered.ok(), 'the driver delivers the waiting request').toBe(true);
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const reconcileLink = page.getByRole('link', {
    name: words.reconcile.openFor.replace('{{name}}', driver.name),
    exact: true,
  });
  const dayTitle = words.reconcile.title.replace('{{name}}', driver.name);
  /** A driver's day opened, with the cash typed: the field takes the digits as a person types them. */
  const typed = async (opening: Opening) => {
    const client = await open(page, language, opening);
    await expect(title(dayTitle)).toBeVisible();
    await page.getByLabel(words.reconcile.cash, { exact: true }).fill(CASH);
    await expect(page.getByRole('status')).toBeVisible();
    return client;
  };
  /** The close asked: Close the day pressed, the check naming the cash. */
  const asked = async (opening: Opening) => {
    const client = await typed(opening);
    await press(words.reconcile.close);
    await expect(
      page.getByText(words.reconcile.closeAsk.replace('{{name}}', driver.name), { exact: true }),
    ).toBeVisible();
    return client;
  };

  // 1. Delivery requests: each driver's cash to bring back, the day open.
  await open(page, language, { path: '/deliveries' });
  await expect(reconcileLink).toBeVisible();
  await at('reconcile-1-requests');

  // 2. A driver's day: the delivered and their sum, the one waiting apart.
  await reconcileLink.click();
  await expect(title(dayTitle)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: words.reconcile.waitingTitle }),
  ).toBeVisible();
  await at('reconcile-2-day');

  // 3. The cash typed: short by 20,000 đồng.
  await typed({ path: DAY_PATH });
  await at('reconcile-3-cash');

  // 4. The close's check.
  await asked({ path: DAY_PATH });
  await at('reconcile-4-check');

  // 5. Closed: to collect, handed in, the gap, who closed it.
  await asked({ path: DAY_PATH });
  await press(words.reconcile.closeConfirm);
  await expect(page.getByRole('alert')).toContainText(words.reconcile.closedNow);
  await expect(page.getByRole('table', { name: words.reconcile.closedTitle })).toBeVisible();
  await at('reconcile-5-closed');

  // 6. Yesterday: every driver's day closed, one short.
  await open(page, language, { path: `/deliveries?day=${YESTERDAY}` });
  await expect(
    page.getByRole('link', {
      name: words.reconcile.openFor.replace('{{name}}', 'Đặng Hoài Nam'),
      exact: true,
    }),
  ).toBeVisible();
  await at('reconcile-6-yesterday');

  // 7. A delivery made meanwhile. On the stack the driver's delivery is the real API's own, made after
  // the check is asked and before it is confirmed.
  const client = await asked({ path: DAY_PATH, cue: 'closeDay:409' });
  if (client) await driverDelivers(page, client);
  await press(words.reconcile.closeConfirm);
  await expect(page.getByRole('alert')).toContainText(words.reconcile.moved);
  await expect(page.getByRole('status')).toBeVisible();
  await at('reconcile-7-moved');

  // 8. A close that failed, the cash kept. On the stack the BFF's answer is a stubbed 503.
  if (FULL()) {
    await page.route('**/api/reconciliations/*/*/close', (route) =>
      route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
    );
  }
  await asked({ path: DAY_PATH, cue: 'closeDay:503' });
  await press(words.reconcile.closeConfirm);
  await expect(page.getByRole('alert')).toContainText(words.reconcile.failed);
  await at('reconcile-8-failed');
  await page.unroute('**/api/reconciliations/*/*/close');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`each driver's day settled, on a ${device} (${width})`, () => {
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
