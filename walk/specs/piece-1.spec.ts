import {
  AUTH_HEADER,
  CLIENT_HEADER,
  type ConfigDoc,
  DEVICE_HEADER,
  type Language,
  ROUTES,
  type TenantConfig,
} from '@credo/shared';
import { DICTIONARIES, LANGUAGE_NAMES } from '@credo/ui/words';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * Piece 1's walk, the client's admin: nine screens, each in Vietnamese and in English, each at
 * the PC, tablet and phone widths the visual report draws, each saved with Playwright's own
 * screenshot check against its committed base image (9 × 2 × 3 = 54). The stack
 * (`pnpm stack -- …`) gives the address, the demo client's code and the root's sign-in in the
 * environment, and the walk opens the client's link, as its root would. Words come from the app's
 * own dictionaries, so a renamed label turns this red where it was renamed.
 */

const CODE = required('CREDO_CLIENT_CODE');
const LINK = `/login?client-code=${CODE}`;
/** A code no client holds, for screen 9. */
const NO_SUCH_COMPANY = 'no-such-company';
const ROOT = { name: required('CREDO_ROOT_NAME'), password: required('CREDO_ROOT_PASSWORD') };
const SCOPE = { [CLIENT_HEADER]: CODE };

const NEW_NAME = 'Minh Phát Sài Gòn';
const NEW_COLOUR = '#b4532a';
/** What the other save, made through the API, calls the company. */
const THEIR_NAME = 'Minh Phát Bình Dương';

/** The settings as the stack made them, to put back after a walk saved over them. */
let original: TenantConfig;

async function write(request: APIRequestContext, route: string, body: unknown, authId?: string) {
  return await request.fetch(route, {
    method: route === ROUTES.config ? 'PUT' : 'POST',
    headers: {
      'content-type': 'application/json',
      [DEVICE_HEADER]: 'device-walk-restore',
      ...SCOPE,
      ...(authId ? { [AUTH_HEADER]: authId } : {}),
    },
    data: JSON.stringify(body),
  });
}

async function signedInAsRoot(request: APIRequestContext) {
  const reply = await write(request, ROUTES.signIn, ROOT);
  expect(reply.ok()).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: required('CREDO_URL') });
  original = ((await (await request.get(ROUTES.config, { headers: SCOPE })).json()) as ConfigDoc)
    .config;
  await request.dispose();
});

test.afterEach(async ({ request }) => {
  const authId = await signedInAsRoot(request);
  const current = (await (
    await request.get(ROUTES.config, { headers: SCOPE })
  ).json()) as ConfigDoc;
  const restored = await write(
    request,
    ROUTES.config,
    { config: original, version: current.version },
    authId,
  );
  expect(restored.ok()).toBe(true);
});

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  await page.addInitScript((chosen) => localStorage.setItem('credo.language', chosen), language);

  // 1. Sign in, in the company's name and colours, from the client's own link.
  await page.goto(LINK);
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
  const stored = (await (
    await page.request.get(ROUTES.config, { headers: SCOPE })
  ).json()) as ConfigDoc;
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
  await page.unroute(ROUTES.config);

  // 9. A link that names no company: the BFF's own 404, and credo's colour, never the client's.
  await page.goto(`/login?client-code=${NO_SUCH_COMPANY}`);
  await expect(
    page.getByRole('heading', { level: 1, name: words.unknownClient.title }),
  ).toBeVisible();
  await at('9-unknown-company');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`piece 1: the client's admin, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('walks all nine screens in Vietnamese', async ({ page }) => {
      await walk(page, 'vi', width);
    });

    test('walks all nine screens in English', async ({ page }) => {
      await walk(page, 'en', width);
    });
  });
}
