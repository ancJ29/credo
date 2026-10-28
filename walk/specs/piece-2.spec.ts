import { type Language } from '@credo/shared';
import { DEMO_EMPLOYEES } from '@credo/shared/demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { shot, WIDTHS } from '../support';

/**
 * Piece 2's group A, three walks in one run: the staff setup and the staff list, the person's pages
 * and the office's, sixteen screens, each in Vietnamese and in English at the three widths
 * (16 × 2 × 3 = 96). The `fake` project runs it on `pnpm fake -- …`, the UI alone over the data set,
 * and keeps the pictures as the full run's reference; the `full` project runs it on the stack and
 * compares them with the bases. Each screen opens at an address of its own, so a screen never meets
 * what an earlier one changed. Words come from the app's own dictionaries.
 */

/** Where a screen opens: the address, the data-set person signed in (the root when none) and the
 * failure the fake answers once, which the full run provokes in its own way. */
type Opening = { path: string; as?: string; cue?: string };

/** The fake's handle for a data-set person, and the root's; a device keeps it in the tab. */
const handleOf = (code?: string) =>
  code === undefined
    ? 'fake.session'
    : `fake.session.${DEMO_EMPLOYEES.find((person) => person.code === code)!.id}`;

async function open(page: Page, language: Language, { path, as, cue }: Opening) {
  await page.addInitScript(
    ([chosen, handle]) => {
      sessionStorage.setItem('credo.language', chosen);
      sessionStorage.setItem('credo.session', handle);
    },
    [language, handleOf(as)],
  );
  await page.goto(`${path}?fake${cue ? `&cue=${cue}` : ''}`);
}

/** A person of the data set, by name, from the list. */
const personNamed = (page: Page, name: string) => page.getByRole('link', { name }).click();

async function walk(page: Page, language: Language, width: number) {
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const typed = (label: string, text: string) =>
    page.getByRole('textbox', { name: label }).fill(text);
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();

  // Group A of the staff setup, and the staff list.
  await open(page, language, { path: '/staff-setup' });
  await expect(title(words.setup.title)).toBeVisible();
  await at('setup-1-departments-positions');

  await open(page, language, { path: '/staff' });
  await expect(title(words.staff.title)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trần Văn Hùng' })).toBeVisible();
  await at('staff-1-list');

  // 2. Adding a person: the form filled.
  await open(page, language, { path: '/staff/new' });
  await typed(words.addPerson.name, 'Mai Linh');
  await typed(words.addPerson.code, 'EMP-0100');
  await typed(words.addPerson.phone, '0909 123 456');
  await typed(words.addPerson.note, 'Mới vào làm.');
  await page.getByLabel(words.addPerson.department).selectOption({ label: 'Kho' });
  await page.getByLabel(words.addPerson.position).selectOption({ label: 'Nhân viên' });
  await unfocus();
  await at('staff-2-add');

  // 3. Added: the sign-in name and a first password, shown once; the password is masked, since the
  // full run's is minted.
  await press(words.addPerson.submit);
  await expect(title(words.addPerson.madeTitle)).toBeVisible();
  await at('staff-3-added', [page.getByLabel(words.addPerson.firstPassword)]);

  // 4. A person's page.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Trần Văn Hùng');
  await expect(title('Trần Văn Hùng')).toBeVisible();
  await at('staff-4-person');

  // 5. A person's own permissions: one allowed over what their department and position give.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Phạm Quốc Bảo');
  await page
    .getByRole('radiogroup', {
      name: `${words.person.permissions}: ${words.permissions.staff_canDelete}`,
    })
    .getByText(words.permissions.allow)
    .click();
  await expect(page.getByText(words.permissions.custom, { exact: true })).toBeVisible();
  await at('staff-5-permissions');

  // 6. A password made, shown once.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Bùi Ngọc Anh');
  await press(words.person.passwordMake);
  await expect(page.getByLabel(words.person.passwordShown)).toBeVisible();
  await at('staff-6-password', [page.getByLabel(words.person.passwordShown)]);

  // 7. Archive, after a check.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Đặng Hoài Nam');
  await press(words.person.archive);
  await expect(
    page.getByRole('button', {
      name: words.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam'),
    }),
  ).toBeVisible();
  await at('staff-7-archive');

  // 8. People who left, shown by the filter.
  await open(page, language, { path: '/staff' });
  await page.getByLabel(words.staff.showLeft).check();
  await expect(page.getByRole('link', { name: 'Hoàng Gia Huy' })).toBeVisible();
  await at('staff-8-left');

  // 9. The code already taken: the data set holds EMP-0008, a person who left.
  await open(page, language, { path: '/staff/new' });
  await typed(words.addPerson.name, 'Mai Linh');
  await typed(words.addPerson.code, 'EMP-0008');
  await press(words.addPerson.submit);
  await expect(page.getByRole('alert')).toHaveText(words.addPerson.taken);
  await at('staff-9-code-taken');

  // 10. Someone else saved first: the fake answers the save with a conflict once.
  await open(page, language, { path: '/staff', cue: 'saveEmployee:409' });
  await personNamed(page, 'Trần Văn Hùng');
  await typed(words.person.name, 'Trần Hùng');
  await press(words.person.save);
  await expect(page.getByRole('alert')).toContainText(words.person.conflict);
  await at('staff-10-save-conflict');

  // 11. A save that failed: the fake answers it with a 503 once.
  await open(page, language, { path: '/staff', cue: 'saveEmployee:503' });
  await personNamed(page, 'Trần Văn Hùng');
  await typed(words.person.name, 'Trần Hùng');
  await press(words.person.save);
  await expect(page.getByRole('alert')).toHaveText(words.person.saveFailed);
  await expect(page.getByRole('textbox', { name: words.person.name })).toHaveValue('Trần Hùng');
  await at('staff-11-save-failed');

  // The office's walk: people signed in by their code, as their permissions allow.
  await open(page, language, { path: '/staff', as: 'EMP-0001' });
  await expect(title(words.staff.title)).toBeVisible();
  await expect(page.getByRole('navigation', { name: words.nav.menu })).toBeVisible();
  await at('office-1-menu');

  await open(page, language, { path: '/staff', as: 'EMP-0001' });
  await page.getByRole('link', { name: words.staff.add }).click();
  await typed(words.addPerson.name, 'Mai Linh');
  await typed(words.addPerson.code, 'EMP-0100');
  await typed(words.addPerson.phone, '0909 123 456');
  await typed(words.addPerson.note, 'Mới vào làm.');
  await press(words.addPerson.submit);
  await expect(page.getByText(words.person.signInNotYet)).toBeVisible();
  await at('office-2-add');

  await open(page, language, { path: '/staff-setup', as: 'EMP-0001' });
  await expect(title(words.forbidden.title)).toBeVisible();
  await at('office-3-forbidden');

  await open(page, language, { path: '/staff', as: 'EMP-0005' });
  await expect(title(words.nothing.title)).toBeVisible();
  await at('office-4-nothing');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`piece 2, group A: the staff, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all sixteen screens in ${name}`, async ({ page }) => {
        test.skip(
          test.info().project.name === 'full',
          'the full run waits for the BFF and the generator (steps 8 and 9): its sign-ins and failures are theirs',
        );
        await walk(page, language, width);
      });
    }
  });
}
