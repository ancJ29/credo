import { AUTH_HEADER, CLIENT_HEADER, type Language, STACK_ENV } from '@credo/shared';
import { DEMO_CLIENTS, DEMO_CODE } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { required, shot, virtualAuthenticator, WIDTHS } from '../support';

/**
 * The walk of a client's root password set anew: four screens, each in Vietnamese and in English at
 * the three widths (4 × 2 × 3 = 24). The `root-password-fake` project runs it on `pnpm fake -- …`,
 * the UI alone over the data set, whose fake authenticator and fake made password are invented, and
 * keeps the pictures as the full run's reference. Each screen opens at an address of its own. The
 * words come from the app's own dictionaries.
 *
 * The `root-password-full` project runs it on a stack of its own for each test (`pnpm stack -- …`),
 * with Chromium's virtual authenticator holding the passkey the stack hands over, so the touch the
 * act asks for is a real one that the BFF checks. After screens 1 and 3, no picture: the spec reads
 * by the API that a root session from before is refused, that the old password signs in no more
 * and that the new one does. The stack's made password is masked on screen 3 (held by
 * bff/src/calling/password.test.ts: "a made password is 12 characters that pass the typed rule"); the
 * failure of screen 4 is stubbed at the browser.
 */

type Opening = { operator?: true; cue?: string };

const FULL = () => test.info().project.name === 'root-password-full';
const PATH = `/operator/clients/${DEMO_CODE}/root-password`;
const TYPED = 'Mat-khau-moi-1!';
const WEAK = 'weak';

/** A label as a whole, the star of a required one allowed. */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** Opens the page. On the fake: the address with `?fake` and the cue, the language and the
 * operator's handle kept in the tab. On the stack: the language and the handle kept on the device. */
async function open(page: Page, language: Language, { operator, cue }: Opening) {
  if (!FULL()) {
    await page.addInitScript(
      ([chosen, handle]) => {
        sessionStorage.setItem('credo.language', chosen);
        if (handle) sessionStorage.setItem('credo.operator', handle);
        else sessionStorage.removeItem('credo.operator');
      },
      [language, operator ? 'fake.operator' : ''],
    );
    await page.goto(`${PATH}?fake${cue ? `&cue=${cue}` : ''}`);
    return;
  }
  // A failure stubbed for an earlier screen is not this one's.
  await page.unrouteAll();
  const handle = operator ? required(STACK_ENV.CREDO_OPERATOR_HANDLE) : '';
  await page.addInitScript(
    ([chosen, kept]) => {
      localStorage.setItem('credo.language', chosen);
      if (kept) localStorage.setItem('credo.operator', kept);
      else localStorage.removeItem('credo.operator');
    },
    [language, handle],
  );
  if (cue) {
    await page.route(`**/api/operator/clients/${DEMO_CODE}/root-password`, (route) =>
      route.fulfill({ status: 503, json: { error: 'Service unavailable' } }),
    );
  }
  await page.goto(PATH);
}

async function walk(page: Page, language: Language, width: number) {
  const words = DICTIONARIES[language];
  const company = DEMO_CLIENTS.find((client) => client.code === DEMO_CODE)!.name;
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const form = title(words.operator.rootTitle.replace('{{name}}', company));
  const code = () => page.getByRole('textbox', { name: exactly(words.operator.rootCodeLabel) });
  const password = (label: string) => page.getByLabel(label, { exact: true });
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const typeAll = async (first: string, again: string) => {
    await code().fill(DEMO_CODE);
    await password(words.person.passwordNew).fill(first);
    await password(words.person.passwordAgain).fill(again);
  };

  // The stack's passkey is on the authenticator before the first touch.
  const authenticator = FULL() ? await virtualAuthenticator(page) : null;
  if (authenticator) {
    await authenticator.hold(
      JSON.parse(required(STACK_ENV.CREDO_OPERATOR_PASSKEY)) as Parameters<
        typeof authenticator.hold
      >[0],
    );
  }
  /** What the BFF says to a client's call, by status alone: a failed call is rethrown without
   * Playwright's call log, which prints every request header and body, a password among them. */
  const call = async (path: string, data: object | null, handle?: string) => {
    const response = await page.request
      .fetch(path, {
        method: data ? 'POST' : 'GET',
        headers: {
          [CLIENT_HEADER]: required(STACK_ENV.CREDO_CLIENT_CODE),
          'x-device-id': 'walk-device-0001',
          ...(handle ? { [AUTH_HEADER]: handle } : {}),
        },
        ...(data ? { data } : {}),
      })
      .catch(() => {
        throw new Error('the call failed (its headers and body are left out of the log)');
      });
    return {
      status: response.status(),
      authId: ((await response.json().catch(() => null)) as { authId?: string } | null)?.authId,
    };
  };
  const signIn = (current: string) =>
    call('/api/auth/sign-in', { name: required(STACK_ENV.CREDO_ROOT_NAME), password: current });
  /** A root session from before is refused, the old password signs in no more, the new one does. */
  async function endsOldAndOpensNew(before: string, old: string, now: string) {
    expect((await call('/api/auth/me', null, before)).status, 'the old session').toBe(401);
    expect((await signIn(old)).status, 'the old password').toBe(401);
    expect((await signIn(now)).status, 'the new password').toBe(200);
  }
  let current = FULL() ? required(STACK_ENV.CREDO_ROOT_PASSWORD) : '';
  const sessionBefore = async () => (await signIn(current)).authId!;

  // 1. The page, a password typed: the company, its code typed, the password twice, what it ends.
  await open(page, language, { operator: true });
  await expect(form).toBeVisible();
  await typeAll(TYPED, TYPED);
  await unfocus();
  await at('rp-1-form');
  if (FULL()) {
    const before = await sessionBefore();
    await press(words.operator.rootSet);
    await expect(title(words.operator.rootDoneTitle)).toBeVisible();
    await endsOldAndOpensNew(before, current, TYPED);
    current = TYPED;
  }

  // 2. A typed password refused on the form, the rule said.
  await open(page, language, { operator: true });
  await expect(form).toBeVisible();
  await typeAll(WEAK, WEAK);
  await press(words.operator.rootSet);
  await expect(page.getByRole('alert')).toHaveText(words.person.passwordInvalid);
  await unfocus();
  await at('rp-2-rule');

  // 3. Left empty, made: the new password, once, to copy and send. The stack's is masked (minted).
  await open(page, language, { operator: true });
  await expect(form).toBeVisible();
  await code().fill(DEMO_CODE);
  const before = FULL() ? await sessionBefore() : '';
  await press(words.operator.rootSet);
  await expect(title(words.operator.rootMadeTitle)).toBeVisible();
  const made = page.getByRole('textbox', { name: exactly(words.operator.rootMadePassword) });
  await at('rp-3-made', [made]);
  if (FULL()) {
    await endsOldAndOpensNew(before, current, await made.inputValue());
  }

  // 4. Not set: the service failed, the password as it was.
  await open(page, language, { operator: true, cue: 'setRootPassword:503' });
  await expect(form).toBeVisible();
  await typeAll(TYPED, TYPED);
  await press(words.operator.rootSet);
  await expect(page.getByRole('alert')).toHaveText(words.operator.rootFailed);
  await expect(code()).toHaveValue(DEMO_CODE);
  await unfocus();
  await at('rp-4-failed');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`the operator's root password, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all four screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
