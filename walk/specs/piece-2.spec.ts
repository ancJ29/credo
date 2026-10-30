import { type Language } from '@credo/shared';
import { DEMO_CODE, DEMO_CUSTOM_FIELDS, DEMO_EMPLOYEES, DEMO_QR_SECRET } from '@credo/shared/demo';
import { demoImportFile } from '@credo/ui/import-demo';
import { DICTIONARIES } from '@credo/ui/words';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { required, shot, WIDTHS } from '../support';

/**
 * Piece 2's groups A, B, C and D, four walks in one run: the staff setup and the staff list, the person's
 * pages, the import, the office's and the phone's, thirty-three screens (A's sixteen, B's seven, C's six
 * and D's four), each in Vietnamese and in English at the three widths (33 × 2 × 3 = 198). The `fake` project runs it on `pnpm fake -- …`, the UI alone over the data set,
 * and keeps the pictures as the full run's reference; the `full` project runs it on the stack
 * (`pnpm stack -- …`) and compares them with the bases, or with the fake run's pictures. Each screen opens at an address of its own, so a screen never meets
 * what an earlier one changed. Words come from the app's own dictionaries.
 */

/** Where a screen opens: the address, the data-set person signed in (the root when none, or nobody
 * for a phone that opens a QR code's link) and the failure the fake answers once, which the full run
 * provokes in its own way. `signIns` has the company use sign-in by email and by QR code. The address
 * of a QR code's link is made once the client is, since the full run issues its own. */
type Opening = {
  path: string | ((client: Seeded | null) => Promise<string>);
  as?: string;
  cue?: string;
  signIns?: true;
  out?: true;
};

/** What the stack's seed door answers: a client made from the data set, with its first passwords. */
type Seeded = { code: string; rootPassword: string; people: Record<string, string> };

const FULL = () => test.info().project.name === 'full';

/** The fake's handle for a data-set person, and the root's; a device keeps it in the tab. */
const handleOf = (code?: string) =>
  code === undefined
    ? 'fake.session'
    : `fake.session.${DEMO_EMPLOYEES.find((person) => person.code === code)!.id}`;

/** A client of its own, made by the stack from the data set: an add or an archive cannot be undone,
 * so no screen opens on a client an earlier one changed. */
async function seed(): Promise<Seeded> {
  const reply = await fetch(required('CREDO_SEED_URL'), { method: 'POST' });
  if (!reply.ok) throw new Error(`the stack's seed door answered ${reply.status}`);
  return (await reply.json()) as Seeded;
}

/** The session handle the BFF gives a data-set person (the root when none), on a device of the
 * walk's own, so a screen opens signed in without typing the sign-in. */
async function signedIn(page: Page, client: Seeded, as?: string) {
  const [name, password] =
    as === undefined ? ['root', client.rootPassword] : [as, client.people[as]];
  const reply = await page.request.post('/api/auth/sign-in', {
    headers: { 'x-client-code': client.code, 'x-device-id': 'device-walk-seed' },
    data: { name, password },
  });
  expect(reply.ok(), `${name} signs in on ${client.code}`).toBe(true);
  return ((await reply.json()) as { authId: string }).authId;
}

/** The init script of each page's latest opening, to be removed by the next. */
const setups = new WeakMap<Page, Awaited<ReturnType<Page['addInitScript']>>>();

/** Opens a screen. On the fake: the address with `?fake`, the cue and the sign-in switches. On the
 * stack: a client of its own with those switches saved through the real API, the language and the
 * person's handle kept on the device (none for a phone that is signed out), and the address as it is. */
async function open(page: Page, language: Language, opening: Opening) {
  const { as, cue, signIns, out } = opening;
  // Only this opening's setup may run: an earlier one would run again on every navigation, in no set order.
  await setups.get(page)?.dispose();
  if (!FULL()) {
    const setup = await page.addInitScript(
      ([chosen, handle]) => {
        sessionStorage.setItem('credo.language', chosen);
        if (handle) sessionStorage.setItem('credo.session', handle);
        else sessionStorage.removeItem('credo.session');
      },
      [language, out ? '' : handleOf(as)],
    );
    setups.set(page, setup);
    const path = typeof opening.path === 'string' ? opening.path : await opening.path(null);
    const glue = path.includes('?') ? '&' : '?';
    await page.goto(`${path}${glue}fake${cue ? `&cue=${cue}` : ''}${signIns ? '&sign-ins' : ''}`);
    return null;
  }
  const client = await seed();
  if (signIns) await switchSignInsOn(page, client);
  const handle = out ? '' : await signedIn(page, client, as);
  const setup = await page.addInitScript(
    ([chosen, code, kept]) => {
      localStorage.setItem('credo.language', chosen);
      localStorage.setItem('credo.client', code);
      if (kept) localStorage.setItem('credo.session', kept);
      else localStorage.removeItem('credo.session');
    },
    [language, client.code, handle],
  );
  setups.set(page, setup);
  await page.goto(typeof opening.path === 'string' ? opening.path : await opening.path(client));
  return client;
}

/** The company turns on the email and the QR sign-in, through the real API as the root does. */
async function switchSignInsOn(page: Page, client: Seeded) {
  const root = await signedIn(page, client);
  const headers = { 'x-client-code': client.code, 'x-auth-id': root };
  const { setup, version } = (await (
    await page.request.get('/api/staff-setup', { headers })
  ).json()) as { setup: { fields?: object }; version: string };
  const saved = await page.request.put('/api/staff-setup', {
    headers,
    data: { setup: { ...setup, fields: { ...setup.fields, email: true, qr: true } }, version },
  });
  expect(saved.ok(), 'the sign-in switches are saved').toBe(true);
}

/** The address of a QR code's link for a warehouse member of the data set: on the fake its stand-in
 * (or a secret no one holds, for a code used before); on the stack one issued by the root, and for a
 * code used before, opened once by a phone that is not the page's. */
const qrAddress = (page: Page, used: boolean) => async (client: Seeded | null) => {
  const bao = DEMO_EMPLOYEES.find((person) => person.code === 'EMP-0004')!;
  if (!client) {
    return `/login?client-code=${DEMO_CODE}&qr=${bao.id}.${used ? 'used-before-qr-code' : DEMO_QR_SECRET}`;
  }
  const headers = { 'x-client-code': client.code, 'x-auth-id': await signedIn(page, client) };
  const listed = (await (await page.request.get('/api/employees', { headers })).json()) as {
    employees: { id: string; code: string }[];
  };
  const id = listed.employees.find((person) => person.code === 'EMP-0004')!.id;
  const issued = (await (
    await page.request.post(`/api/employees/${id}/qr`, { headers })
  ).json()) as {
    link: string;
  };
  if (used) {
    const secret = new URL(issued.link, 'http://x').searchParams.get('qr')!.split('.')[1];
    await page.request.post('/api/auth/sign-in-qr', {
      headers: { 'x-client-code': client.code, 'x-device-id': 'device-walk-other' },
      data: { id, secret },
    });
  }
  return issued.link;
};

/** Someone else saves a data-set person first, through the real API, so the page's own save meets
 * the BFF's 409: no stub, the refusal and its wording are the product's. The fake answers the same
 * save with a cue. */
async function someoneSavesFirst(page: Page, client: Seeded, code: string) {
  const root = await signedIn(page, client);
  const headers = { 'x-client-code': client.code, 'x-auth-id': root };
  const listed = (await (await page.request.get('/api/employees', { headers })).json()) as {
    employees: { id: string; code: string }[];
  };
  const id = listed.employees.find((person) => person.code === code)!.id;
  const { employee, version } = (await (
    await page.request.get(`/api/employees/${id}`, { headers })
  ).json()) as { employee: { name: string; extra: object }; version: string };
  const theirs = await page.request.put(`/api/employees/${id}`, {
    headers,
    data: { version, name: employee.name, extra: { ...employee.extra, phone: '0903 111 999' } },
  });
  expect(theirs.ok()).toBe(true);
}

/** The name of one of the data set's own fields, in the language shown. */
const fieldName = (key: string, language: Language) =>
  DEMO_CUSTOM_FIELDS.find((field) => field.key === key)!.label[language];

/** A label as a whole, the star of a required one allowed: a bare string matches any label that
 * holds it (`Phone` also names `Personal phone`, `Key` also `Option key` and `Remove Key`). */
const exactly = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`);

/** A person of the data set, by name, from the list. */
const personNamed = async (page: Page, name: string) => {
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
};

/** Chooses the data set's staff file in the import page's file field, as a person does, and waits
 * for the page to show it chosen: the page hears the choice a moment after it is set. */
async function chooseFile(page: Page, language: Language, which: 'import' | 'import-no-name') {
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
  const at = (screen: string, mask: Locator[] = []) => shot(page, screen, language, width, mask);
  const words = DICTIONARIES[language];
  const title = (heading: string) => page.getByRole('heading', { level: 2, name: heading });
  const typed = (label: string, text: string) =>
    page.getByRole('textbox', { name: exactly(label) }).fill(text);
  const press = (name: string) => page.getByRole('button', { name, exact: true }).click();
  /** A form's heading is clicked, so no field is left focused for the picture. */
  const unfocus = () => page.getByRole('heading', { level: 2 }).click();

  // Group A of the staff setup, and the staff list.
  await open(page, language, { path: '/staff-setup' });
  await expect(title(words.setup.title)).toBeVisible();
  await at('setup-1-departments-positions');

  // B2. The person's fields, the company's own fields and the numbering: one more field added.
  await open(page, language, { path: '/staff-setup' });
  await expect(title(words.setup.title)).toBeVisible();
  await press(words.setup.ownAdd);
  await expect(page.getByLabel(exactly(words.setup.ownKey))).toHaveCount(
    DEMO_CUSTOM_FIELDS.length + 1,
  );
  await unfocus();
  await at('setup-2-fields');

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
  // Not `check()`: it reads the box at once, and the address writes the box's state a moment
  // after the click, so it would call a box that is about to tick unchanged.
  await page.getByLabel(words.staff.showLeft).click();
  await expect(page.getByLabel(words.staff.showLeft)).toBeChecked();
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
  const client = await open(page, language, { path: '/staff', cue: 'saveEmployee:409' });
  await personNamed(page, 'Trần Văn Hùng');
  await typed(words.person.name, 'Trần Hùng');
  if (client) await someoneSavesFirst(page, client, 'EMP-0002');
  await press(words.person.save);
  await expect(page.getByRole('alert')).toContainText(words.person.conflict);
  await at('staff-10-save-conflict');

  // 11. A save that failed: the fake answers it with a 503 once; on the stack the save is stubbed
  // to a 503, as piece 1's screen 7 is.
  await open(page, language, { path: '/staff', cue: 'saveEmployee:503' });
  await personNamed(page, 'Trần Văn Hùng');
  await typed(words.person.name, 'Trần Hùng');
  if (FULL()) {
    await page.route('**/api/employees/*', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 503, json: { error: 'Service unavailable' } })
        : route.fallback(),
    );
  }
  await press(words.person.save);
  await expect(page.getByRole('alert')).toHaveText(words.person.saveFailed);
  await expect(page.getByRole('textbox', { name: words.person.name })).toHaveValue('Trần Hùng');
  await at('staff-11-save-failed');

  // 12. Adding a person with the company's own fields and a second phone; the code left empty.
  await open(page, language, { path: '/staff/new' });
  await typed(words.addPerson.name, 'Mai Linh');
  await typed(words.addPerson.phone, '0909 123 456');
  await typed(words.addPerson.personalPhone, '0909 555 666');
  await page.getByLabel(fieldName('plate', language)).fill('51C-999.99');
  await page.getByLabel(fieldName('dependants', language)).fill('1');
  await page.getByLabel(fieldName('started', language)).fill('2026-10-01');
  await page.getByLabel(words.addPerson.department).selectOption({ label: 'Kho' });
  await page.getByLabel(words.addPerson.position).selectOption({ label: 'Nhân viên' });
  await unfocus();
  await at('staff-12-own-fields');

  // 13. A person's photo.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Lê Minh Châu');
  await expect(title('Lê Minh Châu')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Lê Minh Châu' })).toBeVisible();
  await at('staff-13-photo');

  // 14. The list searched and filtered.
  await open(page, language, { path: '/staff' });
  await typed(words.staff.search, 'phong');
  await page.getByLabel(words.staff.filterPosition).selectOption({ label: 'Quản lý' });
  await expect(page.getByRole('link', { name: 'Nguyễn Thị Lan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trần Văn Hùng' })).toHaveCount(0);
  // The position chosen after the search keeps the search: Châu is a manager too, and does not
  // match "phong", so she shows only if the search was lost.
  await expect(page.getByRole('link', { name: 'Lê Minh Châu' })).toHaveCount(0);
  await expect(page).toHaveURL(/q=phong/);
  await unfocus();
  await at('staff-14-search');

  // 15. A code changed: the page says the person signs in with the new one.
  await open(page, language, { path: '/staff' });
  await personNamed(page, 'Phạm Quốc Bảo');
  await typed(words.person.codeNew, 'nv-12');
  await press(words.person.codeSet);
  await expect(page.getByRole('alert')).toHaveText(
    words.person.codeChanged.replace('{{code}}', 'NV-12'),
  );
  await at('staff-15-code-changed');

  // 16. A value the company's own field refuses.
  await open(page, language, { path: '/staff/new' });
  await typed(words.addPerson.name, 'Mai Linh');
  await page.getByLabel(fieldName('dependants', language)).fill('two');
  await press(words.addPerson.submit);
  await expect(page.getByText(words.fields.invalidNumber)).toBeVisible();
  await at('staff-16-field-refused');

  // 17. An email given: the person may sign in with it, and no mail is sent.
  await open(page, language, { path: '/staff', signIns: true });
  await personNamed(page, 'Trần Văn Hùng');
  await typed(words.person.emailNew, 'hung@minh-phat.example');
  await press(words.person.emailSet);
  await expect(page.getByRole('alert')).toHaveText(
    words.person.emailChanged.replace('{{email}}', 'hung@minh-phat.example'),
  );
  await at('staff-17-email');

  // 18. A QR code and its link, for one sign-in within 15 minutes; both are minted, so both are
  // masked.
  await open(page, language, { path: '/staff', signIns: true });
  await personNamed(page, 'Phạm Quốc Bảo');
  await press(words.person.qrShow);
  const code = page.getByRole('img', { name: words.person.qrImage });
  await expect(code).toBeVisible();
  await at('staff-18-qr', [code, page.getByLabel(words.person.qrLink)]);

  // 19. Import: the template is handed over, and the file chosen.
  await open(page, language, { path: '/staff/import' });
  await expect(title(words.import.title)).toBeVisible();
  const template = page.waitForEvent('download');
  await press(words.import.template);
  expect((await template).suggestedFilename()).toBe(`staff-${language}.xlsx`);
  await chooseFile(page, language, 'import');
  await at('staff-19-import');

  // 20. Before saving: each row read, with the reasons for the refused.
  await open(page, language, { path: '/staff/import' });
  await chooseFile(page, language, 'import');
  // By the keyboard: the pointer stays parked, so the hover scrollbar of the table never shows.
  await page.getByRole('button', { name: words.import.read, exact: true }).press('Enter');
  await expect(title(words.import.previewTitle)).toBeVisible();
  await expect(page.getByText(words.import.willAdd, { exact: true })).toHaveCount(3);
  await at('staff-20-preview');

  // 21. Imported: the people added, without sign-ins.
  await press(words.import.add.replace('{{count}}', '3'));
  await expect(title(words.import.doneTitle)).toBeVisible();
  await expect(page.getByText(words.import.doneAdded.replace('{{count}}', '3'))).toBeVisible();
  await at('staff-21-imported');

  // 22. A file without the name column.
  await open(page, language, { path: '/staff/import' });
  await chooseFile(page, language, 'import-no-name');
  await press(words.import.read);
  await expect(page.getByRole('alert')).toHaveText(
    words.import.noName.replaceAll('{{name}}', words.addPerson.name),
  );
  await at('staff-22-no-name');

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

  // Allowed to change the settings: Settings is in the menu.
  await open(page, language, { path: '/settings', as: 'EMP-0003' });
  await expect(title(words.settings.title)).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: words.nav.menu }).getByRole('link', {
      name: words.nav.settings,
    }),
  ).toBeVisible();
  await at('office-5-settings');

  // Changing one's own password: from the user's menu, the current one first. The full run types
  // the person's real one.
  const lan = await open(page, language, { path: '/staff', as: 'EMP-0001' });
  await page.getByRole('button', { name: 'Nguyễn Thị Lan' }).click();
  await page.getByRole('menuitem', { name: words.user.password, exact: true }).click();
  await expect(title(words.ownPassword.title)).toBeVisible();
  await page
    .getByLabel(exactly(words.ownPassword.current))
    .fill(lan?.people['EMP-0001'] ?? 'Old-password-1!');
  await page.getByLabel(exactly(words.ownPassword.new)).fill('New-password-2@');
  await page.getByLabel(exactly(words.ownPassword.again)).fill('New-password-2@');
  await press(words.ownPassword.submit);
  await expect(page.getByRole('alert')).toHaveText(words.ownPassword.changed);
  await unfocus();
  await at('office-6-password');

  // The current password wrong: the fake answers the change with a 403 once; the full run types a
  // password the person does not have.
  await open(page, language, { path: '/password', as: 'EMP-0001', cue: 'changePassword:403' });
  await page.getByLabel(exactly(words.ownPassword.current)).fill('Old-password-1!');
  await page.getByLabel(exactly(words.ownPassword.new)).fill('New-password-2@');
  await page.getByLabel(exactly(words.ownPassword.again)).fill('New-password-2@');
  await press(words.ownPassword.submit);
  await expect(page.getByRole('alert')).toHaveText(words.ownPassword.wrong);
  await unfocus();
  await at('office-7-password-wrong');

  // The phone's walk: a QR code opened on a phone that is signed out.
  await open(page, language, { path: qrAddress(page, false), out: true, signIns: true });
  await expect(title(words.staff.title)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phạm Quốc Bảo', exact: true })).toBeVisible();
  await at('phone-1-signed-in');

  await open(page, language, { path: qrAddress(page, true), out: true, signIns: true });
  await expect(title(words.qrSignIn.refusedTitle)).toBeVisible();
  await at('phone-2-code-used');
}

for (const [device, width] of Object.entries(WIDTHS)) {
  test.describe(`piece 2, groups A, B, C and D: the staff setup, the staff and the phone, on a ${device} (${width})`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [language, name] of [
      ['vi', 'Vietnamese'],
      ['en', 'English'],
    ] as const) {
      test(`walks all thirty-three screens in ${name}`, async ({ page }) => {
        await walk(page, language, width);
      });
    }
  });
}
