import { deflateSync } from 'node:zlib';
import {
  AUTH_HEADER,
  CLIENT_HEADER,
  type ConfigDoc,
  DEVICE_HEADER,
  drawIcon,
  type Language,
  pngOf,
  ROUTES,
  type TenantConfig,
  STACK_ENV,
} from '@credo/shared';
import { DICTIONARIES, LANGUAGE_NAMES } from '@credo/ui/words';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * Piece 1's walk, the client's admin: eighteen screens, each in Vietnamese and in English, each at
 * the PC, tablet and phone widths the visual report draws, each saved with Playwright's own
 * screenshot check against its committed base image (18 × 2 × 3 = 108). The stack
 * (`pnpm stack -- …`) gives the address, the demo client's code and the root's sign-in in the
 * environment, and the walk opens the client's link, as its root would. Words come from the app's
 * own dictionaries, so a renamed label turns this red where it was renamed.
 */

const CODE = required(STACK_ENV.CREDO_CLIENT_CODE);
const LINK = `/login?client-code=${CODE}`;
/** A code no client holds, for screen 9. */
const NO_SUCH_COMPANY = 'no-such-company';
const ROOT = {
  name: required(STACK_ENV.CREDO_ROOT_NAME),
  password: required(STACK_ENV.CREDO_ROOT_PASSWORD),
};
const SCOPE = { [CLIENT_HEADER]: CODE };

const NEW_NAME = 'Minh Phát Sài Gòn';
/** The formatted name and the description the root types: a bold part, a second colour, a break. */
const NEW_FORMATTED = '<b>Minh Phát</b><br><span style="color:#1d3557">Sài Gòn</span>';
const NEW_DESCRIPTION = 'Vật liệu xây dựng, giao tận công trình';
/** What the other save, made through the API, calls the company. */
const THEIR_NAME = 'Minh Phát Bình Dương';
/** The white mark the root uploads as the logo for the coloured header: bytes from here, no file. */
const LIGHT_MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>';
/** The icons the root uploads, drawn by `shared`'s drawer in another colour than the company's, as
 * PNG bytes from here, no file: a phone-app icon of 512 pixels is the least the field takes. */
const ICON_OF = (side: number) =>
  Buffer.from(
    pngOf(drawIcon({ name: NEW_NAME, code: CODE, colour: '#6a4c93' }, side), (raw) =>
      deflateSync(raw),
    ),
  );
const TAB_ICON_PNG = ICON_OF(64);
const APP_ICON_PNG = ICON_OF(512);

/** The settings as the stack made them, to put back after a walk saved over them. */
let original: TenantConfig;

async function write(request: APIRequestContext, route: string, body: unknown, authId?: string) {
  return await request.fetch(route, {
    method: route === ROUTES.config || route.startsWith(ROUTES.pictures) ? 'PUT' : 'POST',
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
  const request = await playwright.request.newContext({ baseURL: required(STACK_ENV.CREDO_URL) });
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
  // The pictures the walk saved are taken away, so the next walk starts with the one logo alone and
  // the drawn icons: an icon none is stored for has the version ''.
  for (const kind of ['logo-on-colour', 'tab-icon', 'app-icon'] as const) {
    const held = current.pictures[kind];
    if (held?.version) {
      const removed = await write(
        request,
        `${ROUTES.pictures}/${kind}`,
        { picture: null, version: held.version },
        authId,
      );
      expect(removed.ok()).toBe(true);
    }
  }
});

/** The address a head link of the page names. */
const linked = async (page: Page, rel: string) =>
  (await page.locator(`head link[rel="${rel}"]`).getAttribute('href'))!;

/** A picture field of the settings page by its label, the label's own box. */
const fieldOf = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=..');

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string) => shot(page, screen, language, width);
  const words = DICTIONARIES[language];
  await page.addInitScript((chosen) => localStorage.setItem('credo.language', chosen), language);

  // 1. Sign in, in the company's name and colours, from the client's own link.
  await page.goto(LINK);
  await expect(page.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeVisible();
  // The head, before any picture: the tab's and the home screen's icons answer PNGs, the manifest
  // the company's name and the start that names it.
  for (const rel of ['icon', 'apple-touch-icon']) {
    await expect(page.locator(`head link[rel="${rel}"]`)).toHaveAttribute(
      'href',
      /\/api\/pictures\//,
    );
    const answer = await page.request.get(await linked(page, rel));
    expect(answer.ok(), rel).toBe(true);
    expect(answer.headers()['content-type'], rel).toMatch(/^image\/png/);
  }
  const manifest = await page.request.get(await linked(page, 'manifest'));
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({ name: original.name, start_url: LINK });
  await at('1-sign-in');

  // 2. Sign-in refused.
  await page.getByLabel(words.auth.username, { exact: true }).fill(ROOT.name);
  await page.getByLabel(words.auth.password, { exact: true }).fill('not the password');
  await page.getByRole('button', { name: words.auth.submit, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(words.auth.refused);
  await at('2-sign-in-refused');

  // 12. Sign-in after six wrong passwords: a name nobody holds, one for each language and width
  // (a pass's six tests share one stack, and the wait is kept per name), six wrong passwords, the
  // sixth answered with the wait. Taken here while the settings are as the stack made them; the
  // root's name goes back in, since screen 3 types only the password.
  await page.getByLabel(words.auth.username, { exact: true }).fill(`nobody-${language}-${width}`);
  for (let wrong = 1; wrong <= 5; wrong++) {
    await page.getByLabel(words.auth.password, { exact: true }).fill(`not the password ${wrong}`);
    await page.getByRole('button', { name: words.auth.submit, exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(words.auth.refused);
  }
  await page.getByLabel(words.auth.password, { exact: true }).fill('not the password 6');
  await page.getByRole('button', { name: words.auth.submit, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(words.wait.seconds.replace('{{count}}', '30'));
  await at('12-sign-in-wait');
  await page.getByLabel(words.auth.username, { exact: true }).fill(ROOT.name);

  // 3. Settings: name, logo, colour, languages.
  await page.getByLabel(words.auth.password, { exact: true }).fill(ROOT.password);
  await page.getByRole('button', { name: words.auth.submit, exact: true }).click();
  // Signing in lands on the first page of the menu, the orders: Settings is opened from the menu.
  await expect(page.getByRole('heading', { level: 2, name: words.nav.orders })).toBeVisible();
  await page
    .getByRole('navigation', { name: words.nav.menu })
    .getByRole('link', { name: words.nav.settings })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: words.settings.title })).toBeVisible();
  await at('3-settings');

  // 7. A save that failed, what was typed kept.
  await page.getByLabel(words.settings.name).fill(NEW_NAME);
  await page.getByRole('radio', { name: words.settings.palettes.brick }).check();
  await page.getByRole('heading', { level: 2 }).click();
  // 13. The preview wears the typed name and Brick before any save, the header still the saved one.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Minh Phát', exact: true }),
  ).toBeVisible();
  await at('13-preview');
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
  await page.getByRole('radio', { name: words.settings.palettes.brick }).check();
  await page.getByRole('heading', { level: 2 }).click();

  // 4. Saved: the app shows the new name and colour.
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('status')).toHaveText(words.settings.saved);
  await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
  await at('4-saved');

  // 14. The formatted name and the description typed: their preview, and the preview's header and
  // card, show them before the save.
  await page.getByLabel(words.settings.formattedName, { exact: true }).fill(NEW_FORMATTED);
  await page.getByLabel(words.settings.description, { exact: true }).fill(NEW_DESCRIPTION);
  await page.getByRole('heading', { level: 2 }).click();
  await expect(page.locator('[data-preview="card"]')).toContainText(NEW_DESCRIPTION);
  await at('14-formatted-typed');

  // 15. Saved: the header shows the formatted name, read by the plain one.
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('status')).toHaveText(words.settings.saved);
  await expect(page.getByRole('heading', { level: 1, name: NEW_NAME, exact: true })).toBeVisible();
  await expect(page.locator('header [aria-hidden="true"] b')).toBeVisible();
  await at('15-formatted-saved');

  // 17. The logo for the coloured header chosen: saved at once, and the header and the preview's
  // header wear it. Its screen follows 15 here and is numbered last.
  const light = page.getByText(words.settings.logoOnColour, { exact: true }).locator('xpath=..');
  await light.locator('input[type="file"]').setInputFiles({
    name: 'light.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(LIGHT_MARK),
  });
  await expect(light.getByRole('status')).toHaveText(words.settings.saved);
  await expect(page.locator('header img')).toHaveAttribute('src', /logo-on-colour/);
  await expect(page.locator('[data-preview="header"] img')).toHaveAttribute(
    'src',
    /logo-on-colour/,
  );
  await at('17-logo-on-colour');

  // 18. Both icons chosen: each made by the browser and saved at once; the fields and the preview's
  // tab and home-screen tile wear them, and the head's links name their new tags.
  const tabField = fieldOf(page, words.settings.tabIcon);
  await tabField.locator('input[type="file"]').setInputFiles({
    name: 'tab.png',
    mimeType: 'image/png',
    buffer: TAB_ICON_PNG,
  });
  await expect(tabField.getByRole('status')).toHaveText(words.settings.saved);
  const appField = fieldOf(page, words.settings.appIcon);
  await appField.locator('input[type="file"]').setInputFiles({
    name: 'app.png',
    mimeType: 'image/png',
    buffer: APP_ICON_PNG,
  });
  await expect(appField.getByRole('status')).toHaveText(words.settings.saved);
  const kept = (await (
    await page.request.get(ROUTES.config, { headers: SCOPE })
  ).json()) as ConfigDoc;
  const tabTag = kept.pictures['tab-icon']?.version ?? '';
  const appTag = kept.pictures['app-icon']?.version ?? '';
  expect(tabTag).not.toBe('');
  expect(appTag).not.toBe('');
  await expect(page.locator('[data-preview="tab"] img')).toHaveAttribute(
    'src',
    new RegExp(`/tab-icon\\?v=${tabTag}$`),
  );
  await expect(page.locator('[data-preview="home"] img')).toHaveAttribute(
    'src',
    new RegExp(`/app-icon\\?v=${appTag}&size=192$`),
  );
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    'href',
    new RegExp(`/tab-icon\\?v=${tabTag}$`),
  );
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    new RegExp(`/app-icon\\?v=${appTag}&size=192$`),
  );
  await at('18-icons');

  // 16. Signed out: the card shows the formatted name and the description. Signing in again
  // returns to Settings, for the screens after.
  await page.getByRole('button', { name: ROOT.name, exact: true }).click();
  await page.getByRole('menuitem', { name: words.user.signOut }).click();
  await expect(page.getByText(NEW_DESCRIPTION)).toBeVisible();
  await at('16-formatted-card');
  await page.getByLabel(words.auth.username, { exact: true }).fill(ROOT.name);
  await page.getByLabel(words.auth.password, { exact: true }).fill(ROOT.password);
  await page.getByRole('button', { name: words.auth.submit, exact: true }).click();
  // Signing out leaves the address at /settings, so the page signed in again is Settings itself.
  await expect(page.getByRole('heading', { level: 2, name: words.settings.title })).toBeVisible();

  // 5. The language switched, from the header's button: its picture is taken here, while every
  // switch is off, so screens 1 to 9 keep the coloured frame; the menu is closed and the switch made
  // after screen 11.
  await page.getByRole('button', { name: words.user.language, exact: true }).click();
  await expect(
    page.getByRole('menuitem', { name: LANGUAGE_NAMES[language === 'vi' ? 'en' : 'vi'] }),
  ).toBeVisible();
  await at('5-language-menu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);

  // 10. Saved: the header and the menu in white.
  await page.getByRole('switch', { name: words.settings.whiteHeader }).check();
  await page.getByRole('switch', { name: words.settings.whiteMenu }).check();
  await page.getByRole('heading', { level: 2 }).click();
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('status')).toHaveText(words.settings.saved);
  await expect(page.locator('header')).toHaveAttribute('data-white', 'true');
  await at('10-saved-white');

  // 11. The menu hidden to its icons: a PC's strip; a phone has its bar and no menu to hide.
  await page.getByRole('switch', { name: words.settings.menuIcons }).check();
  await page.getByRole('heading', { level: 2 }).click();
  await page.getByRole('button', { name: words.settings.save }).click();
  await expect(page.getByRole('status')).toHaveText(words.settings.saved);
  if (width >= WIDTHS.tablet) {
    await page.getByRole('button', { name: words.nav.hideMenu }).click();
    await expect(
      page
        .getByRole('navigation', { name: words.nav.menu })
        .first()
        .getByRole('link', { name: words.nav.settings }),
    ).toBeVisible();
  }
  await at('11-menu-icons');

  // 5, finished: the language switched, from the header's button (its picture is taken above).
  const other: Language = language === 'vi' ? 'en' : 'vi';
  await page.getByRole('button', { name: words.user.language, exact: true }).click();
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

    test('walks all eighteen screens in Vietnamese', async ({ page }) => {
      await walk(page, 'vi', width);
    });

    test('walks all eighteen screens in English', async ({ page }) => {
      await walk(page, 'en', width);
    });
  });
}
