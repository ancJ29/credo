import {
  AUTH_HEADER,
  type ConfigDoc,
  DEVICE_HEADER,
  HASH_HEADER,
  type Language,
  ROUTES,
  sha256Hex,
  type TenantConfig,
} from '@credo/shared';
import { DICTIONARIES, LANGUAGE_NAMES } from '@credo/ui/words';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

/**
 * Piece 1's walk, the client's admin: eight screens, each in Vietnamese and in English, each at
 * the PC, tablet and phone widths the visual report draws, each saved with Playwright's own
 * screenshot check against its committed base image (8 × 2 × 3 = 48). The stack
 * (`pnpm stack -- …`) gives the address and the root's sign-in in the environment. Words come from
 * the app's own dictionaries, so a renamed label turns this red where it was renamed.
 */

/** The widths the visual report draws a screen at; the walk shoots the same three. */
const WIDTHS = { pc: 1280, tablet: 768, phone: 390 } as const;

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run this through \`pnpm stack -- …\``);
  return value;
};
const ROOT = { name: required('CREDO_ROOT_NAME'), password: required('CREDO_ROOT_PASSWORD') };

const NEW_NAME = 'Minh Phát Sài Gòn';
const NEW_COLOUR = '#b4532a';
/** What the other save, made through the API, calls the company. */
const THEIR_NAME = 'Minh Phát Bình Dương';

/** The settings as the stack made them, to put back after a walk saved over them. */
let original: TenantConfig;

async function write(request: APIRequestContext, route: string, body: unknown, authId?: string) {
  const text = JSON.stringify(body);
  return await request.fetch(route, {
    method: route === ROUTES.config ? 'PUT' : 'POST',
    headers: {
      'content-type': 'application/json',
      [DEVICE_HEADER]: 'device-walk-restore',
      [HASH_HEADER]: await sha256Hex(text),
      ...(authId ? { [AUTH_HEADER]: authId } : {}),
    },
    data: text,
  });
}

async function signedInAsRoot(request: APIRequestContext) {
  const reply = await write(request, ROUTES.signIn, ROOT);
  expect(reply.ok()).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: required('CREDO_URL') });
  original = ((await (await request.get(ROUTES.config)).json()) as ConfigDoc).config;
  await request.dispose();
});

test.afterEach(async ({ request }) => {
  const authId = await signedInAsRoot(request);
  const current = (await (await request.get(ROUTES.config)).json()) as ConfigDoc;
  const restored = await write(
    request,
    ROUTES.config,
    { config: original, version: current.version },
    authId,
  );
  expect(restored.ok()).toBe(true);
});

/** The pointer is parked in the corner first: a button under it is drawn hovered, and which one
 * depends on where the last click left it. */
async function shot(page: Page, screen: string, language: Language, width: number) {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`${screen}-${language}-${width}.png`, { fullPage: true });
}

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  await page.addInitScript((chosen) => localStorage.setItem('credo.language', chosen), language);

  // 1. Sign in, in the company's name and colours.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeVisible();
  await at('1-sign-in');

  // 2. Sign-in refused.
  await page.getByLabel(words.auth.username, { exact: true }).fill(ROOT.name);
  await page.getByLabel(words.auth.password, { exact: true }).fill('not the password');
  await page.getByRole('button', { name: words.auth.submit }).click();
  await expect(page.getByRole('alert')).toHaveText(words.auth.refused);
  await at('2-sign-in-refused');

  // 3. Settings: name, logo, colour, languages.
  await page.getByLabel(words.auth.password, { exact: true }).fill(ROOT.password);
  await page.getByRole('button', { name: words.auth.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: words.settings.title })).toBeVisible();
  await at('3-settings');

  // 7. A save that failed, what was typed kept.
  await page.getByLabel(words.settings.name).fill(NEW_NAME);
  await page.getByLabel(words.settings.colour).fill(NEW_COLOUR);
  await page.getByRole('heading', { level: 2 }).click();
  await page.route(ROUTES.config, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, json: { error: 'Service unavailable' } })
      : route.fallback(),
  );
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('alert')).toHaveText(words.settings.saveFailed);
  await expect(page.getByLabel(words.settings.name)).toHaveValue(NEW_NAME);
  await at('7-save-failed');
  await page.unroute(ROUTES.config);

  // 8. Someone else saved first: a second save through the real API moves the version on while
  // this page still holds the one it read, so the page's own save meets the BFF's 409. No stub:
  // the refusal is the product's own, and so is the conflict's wording.
  const authId = await signedInAsRoot(page.request);
  const stored = (await (await page.request.get(ROUTES.config)).json()) as ConfigDoc;
  const theirs = await write(
    page.request,
    ROUTES.config,
    { config: { ...original, name: THEIR_NAME }, version: stored.version },
    authId,
  );
  expect(theirs.ok()).toBe(true);
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('alert')).toContainText(words.settings.conflict);
  await at('8-save-conflict');

  // The newer settings are read, and the walk types its own again over them.
  await page.getByRole('button', { name: words.settings.conflictReload }).click();
  await expect(page.getByLabel(words.settings.name)).toHaveValue(THEIR_NAME);
  await page.getByLabel(words.settings.name).fill(NEW_NAME);
  await page.getByLabel(words.settings.colour).fill(NEW_COLOUR);
  await page.getByRole('heading', { level: 2 }).click();

  // 4. Saved: the app shows the new name and colour.
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('alert')).toHaveText(words.settings.saved);
  await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
  await at('4-saved');

  // 5. The language switched, from the user menu.
  await page.getByRole('button', { name: ROOT.name }).click();
  await expect(page.getByRole('menuitem', { name: words.user.signOut })).toBeVisible();
  await at('5-language-menu');
  const other: Language = language === 'vi' ? 'en' : 'vi';
  await page.getByRole('menuitem', { name: LANGUAGE_NAMES[other] }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: DICTIONARIES[other].settings.title }),
  ).toBeVisible();

  // 6. The service down at start.
  await page.route(ROUTES.config, (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(words.common.unavailable);
  await at('6-service-down');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`piece 1: the client's admin, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('walks all eight screens in Vietnamese', async ({ page }) => {
      await walk(page, 'vi', width);
    });

    test('walks all eight screens in English', async ({ page }) => {
      await walk(page, 'en', width);
    });
  });
}
