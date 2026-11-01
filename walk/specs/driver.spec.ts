import { type Language } from '@credo/shared';
import {
  DEMO_CODE,
  DEMO_DELIVERIES,
  DEMO_DRIVER_QR_SECRET,
  DEMO_EMPLOYEES,
  DEMO_TODAY,
  DEMO_WALK_PROOF,
} from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * The driver's phone: the walk of six screens, each in Vietnamese and in English at the three widths
 * (6 × 2 × 3 = 36). The `driver-fake` project runs it on `pnpm fake -- …` and the `driver-full`
 * project on the stack (`pnpm stack -- …`); both write their pictures for `walk/run.sh` to compare,
 * raw. Each screen opens on a client of its own, the driver signed in by the QR code the root issued
 * (screen 1) or by the handle the real API gave them, and the browser's clock is fixed at the data
 * set's today, so the phone lists the same day on both. The camera's file is the data set's drawn
 * picture. Words come from the app's own dictionaries.
 */

const FULL = () => test.info().project.name === 'driver-full';
const DRIVER = 'EMP-0005';
const OFFICE = 'EMP-0001';
const driverId = DEMO_EMPLOYEES.find((one) => one.code === DRIVER)!.id;
const waiting = DEMO_DELIVERIES.find(
  (one) => one.day === DEMO_TODAY && one.state === 'waiting' && one.driver.code === DRIVER,
)!;
/** The data set's today at ten in the morning, in this Mac's time zone. */
const [YEAR, MONTH, DAY] = DEMO_TODAY.split('-').map(Number) as [number, number, number];
const CLOCK = new Date(YEAR, MONTH - 1, DAY, 10, 0, 0);
/** The camera's file: the data set's first drawn picture. */
const PHOTO = {
  name: 'photo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(DEMO_WALK_PROOF.split(',')[1], 'base64'),
};

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string; people: Record<string, string> };

async function seed(): Promise<Seeded> {
  const reply = await fetch(required('CREDO_SEED_URL'), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

/** Where a screen opens: an address, signed in as the driver, with the failure the fake answers once
 * (the full run provokes it in its own way); or the link of the driver's QR code, with nobody signed in. */
type Opening = { qr: true } | { path: string; cue?: string };

/** The client the stack made for a screen, with the first passwords of its people. */
type Client = Seeded;

async function signIn(page: Page, code: string, name: string, password: string) {
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': code, 'x-device-id': 'device-walk-seed' },
    data: { name, password },
  });
  expect(reply.ok(), `${name} signs in on ${code}`).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

/** The company turns on the QR sign-in and the root issues the driver's code, through the real API as
 * the root does; the link it answers is the address the phone opens. */
async function qrLink(page: Page, client: Seeded) {
  const root = await signIn(page, client.code, 'root', client.rootPassword);
  const headers = { 'x-client-code': client.code, 'x-auth-id': root };
  const { setup, version } = (await (
    await page.request.get('/api/staff-setup', { headers })
  ).json()) as { setup: { fields?: object }; version: string };
  const saved = await page.request.put('/api/staff-setup', {
    headers,
    data: { setup: { ...setup, fields: { ...setup.fields, email: true, qr: true } }, version },
  });
  expect(saved.ok(), 'the sign-in switches are saved').toBe(true);
  const listed = (await (await page.request.get('/api/employees', { headers })).json()) as {
    employees: { id: string; code: string }[];
  };
  const id = listed.employees.find((one) => one.code === DRIVER)!.id;
  const issued = await page.request.post(`/api/employees/${id}/qr`, { headers });
  return ((await issued.json()) as { link: string }).link;
}

/** Opens a screen as the driver. On the fake: the address with `?fake`, the cue, and the language and
 * the handle kept in the tab (none for the QR link, which signs the phone in). On the stack: a client
 * of its own, the driver signed in through the real API (or the QR link the root issued), the
 * language and the handle kept on the device. The clock is the data set's today on both. */
async function open(page: Page, language: Language, opening: Opening): Promise<Client | null> {
  await setups.get(page)?.dispose();
  await page.clock.setFixedTime(CLOCK);
  const out = 'qr' in opening;
  if (!FULL()) {
    const kept = out ? '' : `fake.session.${driverId}`;
    setups.set(
      page,
      await page.addInitScript(
        ([chosen, handle]) => {
          sessionStorage.setItem('credo.language', chosen);
          if (handle) sessionStorage.setItem('credo.session', handle);
          else sessionStorage.removeItem('credo.session');
        },
        [language, kept],
      ),
    );
    const path = out
      ? `/login?client-code=${DEMO_CODE}&qr=${driverId}.${DEMO_DRIVER_QR_SECRET}`
      : opening.path;
    const cue = 'cue' in opening && opening.cue ? `&cue=${opening.cue}` : '';
    await page.goto(`${path}${path.includes('?') ? '&' : '?'}fake&sign-ins${cue}`);
    return null;
  }
  const client = await seed();
  const address = 'qr' in opening ? await qrLink(page, client) : opening.path;
  const handle = out ? '' : await signIn(page, client.code, DRIVER, client.people[DRIVER]);
  setups.set(
    page,
    await page.addInitScript(
      ([chosen, code, kept]) => {
        localStorage.setItem('credo.language', chosen);
        localStorage.setItem('credo.client', code);
        if (kept) localStorage.setItem('credo.session', kept);
        else localStorage.removeItem('credo.session');
      },
      [language, client.code, handle],
    ),
  );
  await page.goto(address);
  return client;
}

/** The office cancels the driver's request before the send, through the real API: the order's cancel
 * takes its request with it, so the driver's own send then meets a request that is cancelled. */
async function officeCancels(page: Page, client: Client) {
  const office = await signIn(page, client.code, OFFICE, client.people[OFFICE]);
  const headers = { 'x-client-code': client.code, 'x-auth-id': office };
  const listed = (await (
    await page.request.get(`/api/orders?from=${waiting.order.day}&to=${waiting.order.day}`, {
      headers,
    })
  ).json()) as { orders: { id: string; day: string; number: string }[] };
  const order = listed.orders.find((one) => one.number === waiting.order.number)!;
  const read = (await (
    await page.request.get(`/api/orders/${order.day}/${order.id}`, { headers })
  ).json()) as { version: string };
  const cancelled = await page.request.post(`/api/orders/${order.day}/${order.id}/cancel`, {
    headers,
    data: { version: read.version },
  });
  expect(cancelled.ok(), 'the office cancels the order, and so its request').toBe(true);
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  const request = () => page.getByRole('link', { name: waiting.number });
  const listed = async (opening: Opening) => {
    const client = await open(page, language, opening);
    await expect(title(words.nav.myDeliveries)).toBeVisible();
    await expect(request()).toBeVisible();
    return client;
  };
  /** Delivered, then the camera's file: the preview is the picture made small, shown with Send. */
  const takePhoto = async () => {
    const chosen = page.waitForEvent('filechooser');
    await press(words.myDeliveries.deliver);
    await (await chosen).setFiles(PHOTO);
    const preview = page.getByRole('img', { name: words.myDeliveries.photoAlt });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveJSProperty('complete', true);
  };
  const opened = async (opening: Opening) => {
    const client = await listed(opening);
    await request().click();
    await expect(
      title(words.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeVisible();
    return client;
  };

  // 1. Signed in by the QR code: my deliveries today, waiting first.
  await open(page, language, { qr: true });
  await expect(title(words.nav.myDeliveries)).toBeVisible();
  await expect(request()).toBeVisible();
  await at('driver-1-today');

  // 2. A request opened: customer, phone, address, goods, money to collect.
  await opened({ path: '/my-deliveries' });
  await at('driver-2-request');

  // 3. The photo taken, before it is sent.
  await opened({ path: '/my-deliveries' });
  await takePhoto();
  await at('driver-3-photo');

  // 4. Delivered: the request with its photo.
  await opened({ path: '/my-deliveries' });
  await takePhoto();
  await press(words.myDeliveries.send);
  await expect(page.getByRole('alert')).toContainText(words.myDeliveries.done);
  const proof = page.getByRole('img', { name: words.orders.proofAlt });
  await expect(proof).toBeVisible();
  await expect(proof).toHaveJSProperty('complete', true);
  await at('driver-4-delivered');

  // 5. A send that failed, the photo kept. On the stack the BFF's answer is a stubbed 503.
  if (FULL()) {
    await page.route('**/api/deliveries/*/*/deliver', (route) =>
      route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
    );
  }
  await opened({ path: '/my-deliveries', cue: 'deliver:503' });
  await takePhoto();
  await press(words.myDeliveries.send);
  await expect(page.getByRole('alert')).toContainText(words.myDeliveries.sendFailed);
  await at('driver-5-send-failed');
  await page.unroute('**/api/deliveries/*/*/deliver');

  // 6. The office cancelled it first. On the stack the cancel is the real API's own, made after the
  // photo is taken and before it is sent.
  const client = await opened({ path: '/my-deliveries', cue: 'deliver:409' });
  await takePhoto();
  if (client) await officeCancels(page, client);
  await press(words.myDeliveries.send);
  await expect(page.getByRole('alert')).toContainText(words.myDeliveries.cancelled);
  await at('driver-6-cancelled');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`a driver delivering with a photo, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all six screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
