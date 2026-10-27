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
 * Piece 1's walk, the client's admin on a PC: seven screens, each in Vietnamese and in English,
 * each saved with Playwright's own screenshot check against its committed base image. The stack
 * (`pnpm stack -- …`) gives the address and the root's sign-in in the environment. Words come from
 * the app's own dictionaries, so a renamed label turns this red where it was renamed.
 */

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run this through \`pnpm stack -- …\``);
  return value;
};
const ROOT = { name: required('CREDO_ROOT_NAME'), password: required('CREDO_ROOT_PASSWORD') };

const NEW_NAME = 'Minh Phát Sài Gòn';
const NEW_COLOUR = '#b4532a';

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

const shot = async (page: Page, screen: string, language: Language) =>
  await expect(page).toHaveScreenshot(`${screen}-${language}.png`, { fullPage: true });

async function walk(page: Page, language: Language) {
  const words = DICTIONARIES[language];
  await page.addInitScript((chosen) => localStorage.setItem('credo.language', chosen), language);

  // 1. Sign in, in the company's name and colours.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeVisible();
  await shot(page, '1-sign-in', language);

  // 2. Sign-in refused.
  await page.getByLabel(words.auth.username, { exact: true }).fill(ROOT.name);
  await page.getByLabel(words.auth.password, { exact: true }).fill('not the password');
  await page.getByRole('button', { name: words.auth.submit }).click();
  await expect(page.getByRole('alert')).toHaveText(words.auth.refused);
  await shot(page, '2-sign-in-refused', language);

  // 3. Settings: name, logo, colour, languages.
  await page.getByLabel(words.auth.password, { exact: true }).fill(ROOT.password);
  await page.getByRole('button', { name: words.auth.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: words.settings.title })).toBeVisible();
  await shot(page, '3-settings', language);

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
  await shot(page, '7-save-failed', language);
  await page.unroute(ROUTES.config);

  // 4. Saved: the app shows the new name and colour.
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('alert')).toHaveText(words.settings.saved);
  await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
  await shot(page, '4-saved', language);

  // 5. The language switched, from the user menu.
  await page.getByRole('button', { name: ROOT.name }).click();
  await expect(page.getByRole('menuitem', { name: words.user.signOut })).toBeVisible();
  await shot(page, '5-language-menu', language);
  const other: Language = language === 'vi' ? 'en' : 'vi';
  await page.getByRole('menuitem', { name: LANGUAGE_NAMES[other] }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: DICTIONARIES[other].settings.title }),
  ).toBeVisible();

  // 6. The service down at start.
  await page.route(ROUTES.config, (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(words.common.unavailable);
  await shot(page, '6-service-down', language);
}

test.describe("piece 1: the client's admin", () => {
  test('walks all seven screens in Vietnamese', async ({ page }) => {
    await walk(page, 'vi');
  });

  test('walks all seven screens in English', async ({ page }) => {
    await walk(page, 'en');
  });
});
