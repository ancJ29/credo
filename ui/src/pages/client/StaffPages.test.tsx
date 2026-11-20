import { staffConfig } from '@credo/shared';
import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openApp, person, type Spied } from '../../../tests/open';
import { ApiError, type Api } from '../../api';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;
/** A label that carries a star is found by its word at the start, as the dictionary spells it. */
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
/** One user for the file, with no wait on the event loop between the actions it makes: the default
 * `delay: 0` hands control back to the loop after every key and click, which a loaded machine
 * stretches; the events themselves, and what the page does with them, are the same. */
const user = userEvent.setup({ delay: null });
/** A row of the list, by the person's name. */
const rowOf = async (name: string) => {
  const rows = (await screen.findAllByText(name)).flatMap((cell) => cell.closest('tr') ?? []);
  expect(rows).toHaveLength(1);
  return rows[0] as HTMLElement;
};
/** A card of a detail page, by its title. */
const cardOf = async (title: string) =>
  (await screen.findByRole('heading', { level: 3, name: title })).closest('section') as HTMLElement;
const menu = () => within(screen.getAllByRole('navigation', { name: words.nav.menu })[0]);

describe('the staff list', () => {
  it('The staff list shows each person’s name, code, department, position, phone and status chip, in code order; the status choice opens on Active and shows people who left or everyone', async () => {
    openApp('/staff');

    const lan = await rowOf('Nguyễn Thị Lan');
    // the avatar's initials come with the name, and the company's own fields shown in the list after
    // them, the status chip last
    expect(
      within(lan)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'NTNguyễn Thị Lan',
      'EMP-0001',
      'Văn phòng',
      'Quản lý',
      '0903 111 001',
      '',
      '',
      words.staff.chipActive,
    ]);
    const codes = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    expect(codes).toEqual([
      'EMP-0001',
      'EMP-0002',
      'EMP-0003',
      'EMP-0004',
      'EMP-0005',
      'EMP-0006',
      'EMP-0007',
    ]);
    expect(screen.queryByText('Hoàng Gia Huy')).toBeNull();
    // the choice opens on Active and offers the three
    const status = screen.getByLabelText<HTMLSelectElement>(words.staff.status);
    expect(status.value).toBe('active');
    expect([...status.options].map((option) => option.text)).toEqual([
      words.staff.statusActive,
      words.staff.statusInactive,
      words.staff.statusAll,
    ]);
    expect(screen.queryByLabelText('Show people who left')).toBeNull();
    // the chip is a filled badge in the theme's primary, with the design system's 4-px corners: no colour of its own
    // but the rule's pick for this company's green, whose buttons move to shade 7 under white
    const chip = within(lan).getByText(words.staff.chipActive).closest('.mantine-Badge-root');
    expect(chip?.getAttribute('style')).toBe(
      '--badge-radius: calc(0.25rem * var(--mantine-scale)); --badge-bg: var(--mantine-color-brand-7); --badge-color: var(--mantine-color-white); --badge-bd: calc(0.0625rem * var(--mantine-scale)) solid transparent;',
    );

    await user.selectOptions(status, words.staff.statusInactive);
    const left = await rowOf('Hoàng Gia Huy');
    expect(within(left).getByText(words.staff.chipInactive)).toBeTruthy();
    expect(
      within(left)
        .getByText(words.staff.chipInactive)
        .closest('.mantine-Badge-root')
        ?.getAttribute('style'),
    ).toContain('--badge-bg: var(--mantine-color-gray-filled)');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByText('Nguyễn Thị Lan')).toBeNull();

    await user.selectOptions(status, words.staff.statusAll);
    await rowOf('Nguyễn Thị Lan');
    expect(screen.getAllByRole('row')).toHaveLength(9);
    const all = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    expect(all.at(-1)).toBe('EMP-0008');
  });

  it('From 768 the search and every select sit on one line above the table, the search growing and each select compact with its name only for assistive tools; under 768 the names show above them', async () => {
    openApp('/staff');
    await rowOf('Nguyễn Thị Lan');

    const controls = [
      words.staff.search,
      words.staff.status,
      words.staff.filterDepartment,
      words.staff.filterPosition,
      'Driving licence',
    ].map((name) => screen.getByLabelText(name));
    // one row container holds all five, in today's order
    const row = controls[0]?.closest('[class*="filters"]');
    expect(row).toBeTruthy();
    expect(controls.every((control) => control.closest('[class*="filters"]') === row)).toBe(true);
    expect(
      controls.map((control) =>
        [...(row?.children ?? [])].indexOf(
          control.closest('.mantine-InputWrapper-root') as Element,
        ),
      ),
    ).toEqual([0, 1, 2, 3, 4]);
    // each select's "all" says what it filters
    expect(
      controls.slice(2).map((control) => (control as HTMLSelectElement).options[0]?.text),
    ).toEqual([
      words.staff.filterAllDepartments,
      words.staff.filterAllPositions,
      words.staff.filterAllOf.replace('{{field}}', 'driving licence'),
    ]);
    // the visible label shows under 768 only, the accessible name stays
    for (const control of controls) {
      const wrapper = control.closest('.mantine-InputWrapper-root') as HTMLElement;
      const label = wrapper.querySelector('label') as HTMLElement;
      expect(label.className).toContain('mantine-hidden-from-sm');
      expect(control.getAttribute('aria-label')).toBe(label.textContent);
    }
  });

  it('A card whose department and position share a name shows both lines, with no duplicate-key warning', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    openApp('/staff', {
      override: (api, original) => {
        api.listEmployees.mockImplementation(async () =>
          (await original.listEmployees()).map((employee) => ({
            ...employee,
            department: { id: 'gone-d', name: 'Kế toán' },
            position: { id: 'gone-p', name: 'Kế toán' },
          })),
        );
      },
    });
    await screen.findAllByTestId('staff-card');

    const lan = screen.getAllByTestId('staff-card')[0];
    expect(lan.textContent).toContain('EMP-0001Kế toánKế toán0903 111 001');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('same key');
    warn.mockRestore();
  });

  it('Inactive with nobody who left says no one matches', async () => {
    openApp('/staff?status=inactive', {
      override: (api, original) => {
        api.listEmployees.mockImplementation(async () =>
          (await original.listEmployees()).filter((employee) => !employee.archived),
        );
      },
    });

    expect(await screen.findByText(words.staff.noMatch)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Under 768 one card a person shows the name as a link, code, department, position, phone and chip, and a missing value leaves no empty line; from 768 the table', async () => {
    openApp('/staff?status=all');
    await rowOf('Nguyễn Thị Lan');

    // both are drawn, one shown by the width: the table from 768, the cards under it
    expect(screen.getByRole('table').closest('.mantine-visible-from-sm')).toBeTruthy();
    const cards = within(screen.getByTestId('staff-cards'));
    const all = cards.getAllByTestId('staff-card');
    expect(all).toHaveLength(8);
    expect(screen.getByTestId('staff-cards').className).toContain('mantine-hidden-from-sm');
    const lan = within(all[0]);
    expect(lan.getByRole('link', { name: 'Nguyễn Thị Lan' }).getAttribute('href')).toMatch(
      /^\/staff\/.+/,
    );
    expect(all[0]?.textContent).toBe('NTNguyễn Thị LanActiveEMP-0001Văn phòngQuản lý0903 111 001');
    // Huy left: the chip says so
    expect(all[7]?.textContent).toContain(words.staff.chipInactive);
    // a person in no department has no empty line for it
    const ngocAnh = all.find((card) => card.textContent?.includes('Bùi Ngọc Anh')) as HTMLElement;
    expect(ngocAnh.querySelectorAll('p').length).toBeLessThan(all[0].querySelectorAll('p').length);
    expect(
      [...ngocAnh.querySelectorAll('p')].every((line) => line.textContent?.trim() !== ''),
    ).toBe(true);
  });

  it('Each person sees in the menu only the pages their permissions allow, and on a page only the buttons for what they may do; a page they may not open says so, and with no page at all one page says there is nothing for them yet', async () => {
    // the root: every page, every button
    const root = openApp('/staff');
    expect(await screen.findByRole('link', { name: words.staff.add })).toBeTruthy();
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      words.nav.orders,
      words.nav.deliveries,
      words.nav.settings,
      words.nav.staff,
      words.nav.staffSetup,
      words.nav.customers,
      words.nav.products,
    ]);
    root.unmount();

    // an office manager: the orders and the staff list, and the button to add; no Settings, no setup
    const lan = openApp('/staff', { as: 'EMP-0001' });
    expect(await screen.findByRole('link', { name: words.staff.add })).toBeTruthy();
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      words.nav.orders,
      words.nav.deliveries,
      words.nav.staff,
      words.nav.customers,
      words.nav.products,
    ]);
    lan.unmount();

    // a warehouse hand who may only see: the list without the button
    const bao = openApp('/staff', { as: 'EMP-0004' });
    await screen.findAllByText('Nguyễn Thị Lan');
    expect(screen.queryByRole('link', { name: words.staff.add })).toBeNull();
    bao.unmount();

    // a page they may not open says so, in the frame their menu draws
    const settings = openApp('/settings', { as: 'EMP-0001' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      words.forbidden.title,
    );
    settings.unmount();
    const setup = openApp('/staff-setup', { as: 'EMP-0004' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      words.forbidden.title,
    );
    setup.unmount();
    const add = openApp('/staff/new', { as: 'EMP-0004' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      words.forbidden.title,
    );
    add.unmount();

    // no page at all: one page says there is nothing yet
    // the data set's drivers hold a page of their own, so the right to deliver is taken away first
    openApp('/staff', { as: 'EMP-0005', noDrivers: true });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      words.nothing.title,
    );
    expect(menu().queryAllByRole('link')).toEqual([]);
  });

  it('Only the root imports staff: the list shows it the button to the import page, and shows it to no one else, whatever staff rights they hold', async () => {
    // the root: the button leads to the import page
    const root = openApp('/staff');
    await user.click(await screen.findByRole('link', { name: words.staff.import }));
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(words.import.title);
    root.unmount();

    // an office manager who may see and add people: the add button, and no import
    const lan = openApp('/staff', { as: 'EMP-0001' });
    expect(await screen.findByRole('link', { name: words.staff.add })).toBeTruthy();
    expect(screen.queryByRole('link', { name: words.staff.import })).toBeNull();
    lan.unmount();
  });

  it('A 403 makes the UI read `me` again and redraw', async () => {
    // the cue stands for what the root just changed: the list is refused once, and `me` is read
    const { api } = openApp('/staff', { as: 'EMP-0004', cue: 'listEmployees:403' });
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(2));
    // what they may do is as it was, so the page stays theirs and offers another try
    await user.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await rowOf('Nguyễn Thị Lan')).toBeTruthy();
  });
});

describe('a 403 or a 401 on a page', () => {
  /** The app reads `me` again after a 403: the second answer is `answer`. */
  const refusedThen = (answer: () => Promise<never>) => (api: Spied, original: Api) => {
    let reads = 0;
    api.me.mockImplementation(() => (++reads === 1 ? original.me() : answer()));
  };

  it('A 403 makes the UI read `me` again, and a person who may no longer see the list is shown the page that says so', async () => {
    const { api } = openApp('/staff', {
      as: 'EMP-0004',
      cue: 'listEmployees:403',
      override: (api, original) => {
        let reads = 0;
        vi.mocked(api.me).mockImplementation(async () => {
          const answer = await original.me();
          return ++reads === 1 ? answer : { user: { ...answer.user, permissions: {} } };
        });
      },
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.nothing.title }),
    ).toBeTruthy();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('A 403 on the settings save reads `me` again, and a person who may no longer change them is shown the page that says so', async () => {
    const { api } = openApp('/settings', {
      as: 'EMP-0003',
      override: (spied, original) => {
        spied.saveConfig.mockRejectedValue(new ApiError(403));
        let reads = 0;
        spied.me.mockImplementation(async () => {
          const answer = await original.me();
          return ++reads === 1 ? answer : { user: { ...answer.user, permissions: {} } };
        });
      },
    });
    await user.type(await screen.findByLabelText(starting(words.settings.name)), 'x');

    await user.click(screen.getByRole('button', { name: words.settings.save }));

    expect(
      await screen.findByRole('heading', { level: 2, name: words.nothing.title }),
    ).toBeTruthy();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('A 403 that `me` cannot be read after leaves the page as it was, and a 401 there signs out', async () => {
    const unavailable = openApp('/staff', {
      as: 'EMP-0004',
      cue: 'listEmployees:403',
      override: refusedThen(() => Promise.reject(new ApiError(503))),
    });
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await waitFor(() => expect(unavailable.api.me).toHaveBeenCalledTimes(2));
    unavailable.unmount();

    const signedOut = openApp('/staff', {
      as: 'EMP-0004',
      cue: 'listEmployees:403',
      override: refusedThen(() => Promise.reject(new ApiError(401))),
    });
    expect(await screen.findByLabelText(new RegExp(words.auth.username))).toBeTruthy();
    expect(signedOut.device.authId()).toBeNull();
  });
});

describe('a page left before it is read', () => {
  it('A page closed before its read ends draws nothing and fails nothing', async () => {
    for (const ends of ['answers', 'fails'] as const) {
      const drawn = openApp('/staff', {
        override: (api, original) => {
          vi.mocked(api.listEmployees).mockImplementation(
            () =>
              new Promise((resolve, reject) =>
                setTimeout(
                  () =>
                    ends === 'answers'
                      ? void original.listEmployees().then(resolve)
                      : reject(new ApiError(503)),
                  150,
                ),
              ),
          );
        },
      });
      await waitFor(() => expect(drawn.api.listEmployees).toHaveBeenCalled());
      drawn.unmount();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(document.body.textContent, ends).toBe('');
    }
  });
});

describe('a person added', () => {
  const fill = async (name: string, code: string, phone = '', note = '') => {
    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), name);
    await user.type(screen.getByLabelText(starting(words.addPerson.code)), code);
    if (phone) await user.type(screen.getByLabelText(words.addPerson.phone), phone);
    if (note) await user.type(screen.getByLabelText(words.addPerson.note), note);
  };

  it('The root adds a person with a name, a code, a phone, a department, a position and a note, and is then shown their sign-in name and a first password once, to copy and hand over; the password is never shown again and is kept only as its hash', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', 'emp-0100', '0909', 'Mới vào');
    await user.selectOptions(screen.getByLabelText(words.addPerson.department), 'Kho');
    await user.selectOptions(screen.getByLabelText(words.addPerson.position), 'Nhân viên');

    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    expect(
      await screen.findByRole('heading', { level: 2, name: words.addPerson.madeTitle }),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(words.addPerson.signInName).value).toBe(
      'EMP-0100',
    );
    const shown = screen.getByLabelText<HTMLInputElement>(words.addPerson.firstPassword).value;
    expect(shown.length).toBeGreaterThan(7);
    expect(api.addEmployee).toHaveBeenCalledWith({
      name: 'Mai Linh',
      code: 'emp-0100',
      extra: { phone: '0909', note: 'Mới vào' },
      departmentId: DEMO_STAFF_SETUP.departments[0]?.id,
      positionId: DEMO_STAFF_SETUP.positions[1]?.id,
    });

    // another person: the form is empty again and the password is on no screen
    await user.click(screen.getByRole('button', { name: words.addPerson.another }));
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.addPerson.name)).value).toBe('');
    expect(document.body.textContent).not.toContain(shown);
    // their page: they are the root's, with a sign-in
    await user.type(screen.getByLabelText(starting(words.addPerson.name)), 'Người khác');
    await user.type(screen.getByLabelText(starting(words.addPerson.code)), 'EMP-0101');
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));
    await user.click(await screen.findByRole('link', { name: words.addPerson.open }));
    expect(
      await screen.findByText(words.person.signInReady.replace('{{code}}', 'EMP-0101')),
    ).toBeTruthy();
  });

  it('Someone allowed to add people adds one with a name, a code, a phone and a note, without a department, a position or a sign-in, which the root gives; the person’s page says they cannot sign in yet', async () => {
    const { api } = openApp('/staff/new', { as: 'EMP-0001' });
    await fill('Mai Linh', 'emp-0100', '0909', 'Mới vào');
    expect(screen.queryByLabelText(words.addPerson.department)).toBeNull();
    expect(screen.queryByLabelText(words.addPerson.position)).toBeNull();

    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    expect(await screen.findByText(words.person.signInNotYet)).toBeTruthy();
    expect(api.addEmployee).toHaveBeenCalledWith({
      name: 'Mai Linh',
      code: 'emp-0100',
      extra: { phone: '0909', note: 'Mới vào' },
    });
    expect(screen.queryByLabelText(words.addPerson.firstPassword)).toBeNull();
  });

  it('A code is 2 to 20 of the letters A to Z, digits and hyphens, unique in the company in any case, among people who left too, and is the person’s sign-in name; a code already taken is refused, and its holder is unchanged', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', 'E');

    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    expect(await screen.findByText(words.addPerson.codeInvalid)).toBeTruthy();
    expect(api.addEmployee).not.toHaveBeenCalled();

    // a code that a person who left holds, typed in another case
    await user.clear(screen.getByLabelText(starting(words.addPerson.code)));
    await user.type(screen.getByLabelText(starting(words.addPerson.code)), 'emp-0008');
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.addPerson.taken);
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.addPerson.name)).value).toBe(
      'Mai Linh',
    );
    expect(person('EMP-0008').name).toBe('Hoàng Gia Huy');
    expect((await api.getEmployee(person('EMP-0008').id)).employee.name).toBe('Hoàng Gia Huy');
  });

  it('A code of spaces alone is no code: the add is sent without one, to be numbered', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', '   ');

    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    await screen.findByRole('heading', { level: 2, name: words.addPerson.madeTitle });
    expect(vi.mocked(api.addEmployee).mock.calls[0]?.[0]).toEqual({
      name: 'Mai Linh',
      extra: {},
      departmentId: null,
      positionId: null,
    });
  });

  it('A save that fails says so and keeps what was typed (an add)', async () => {
    openApp('/staff/new', { cue: 'addEmployee:503' });
    await fill('Mai Linh', 'EMP-0100');

    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.addPerson.failed);
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.addPerson.name)).value).toBe(
      'Mai Linh',
    );
  });
});

describe('a person’s page', () => {
  const open = (code: string, options: Parameters<typeof openApp>[1] = {}) =>
    openApp(`/staff/${person(code).id}`, options);

  it('A person’s page shows their details, their note, how they sign in and whether they can yet; someone allowed changes their name, phone and note there', async () => {
    const { api } = open('EMP-0002', { as: 'EMP-0001' });

    expect(
      (await screen.findByRole('heading', { level: 2, name: 'Trần Văn Hùng' })).textContent,
    ).toBe('Trần Văn Hùng');
    expect(screen.getByLabelText<HTMLInputElement>(words.person.phone).value).toBe('0903 111 002');
    expect(screen.getByLabelText<HTMLTextAreaElement>(words.person.note).value).toContain(
      'Được lưu trữ',
    );
    // the first card names what they sign in with: the code, and whether they can yet
    const basic = await cardOf(words.person.basic);
    expect(within(basic).getByLabelText<HTMLInputElement>(words.person.signInName).value).toBe(
      'EMP-0002',
    );
    expect(
      within(basic).getByText(words.person.signInReady.replace('{{code}}', 'EMP-0002')),
    ).toBeTruthy();
    // someone who may change a person changes their details, and no more
    expect(screen.queryByLabelText(words.person.department, { selector: 'select' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText(words.person.password, { selector: 'h3' })).toBeNull();

    const name = screen.getByLabelText(starting(words.person.name));
    await user.clear(name);
    await user.type(name, 'Trần Hùng');
    await user.clear(screen.getByLabelText(words.person.phone));
    await user.click(screen.getByRole('button', { name: words.person.save }));

    expect(await screen.findByText(words.person.saved)).toBeTruthy();
    const saved = (await api.getEmployee(person('EMP-0002').id)).employee;
    expect(saved.name).toBe('Trần Hùng');
    // an emptied field removes its key, and the note, untouched, stays
    expect(saved.extra).toEqual({ note: person('EMP-0002').extra.note });
    expect(api.saveEmployee).toHaveBeenCalledWith(person('EMP-0002').id, {
      version: 'e1',
      name: 'Trần Hùng',
      extra: { note: person('EMP-0002').extra.note },
    });
  });

  it('A person’s page, for someone who may only see, changes nothing, and one with no sign-in yet says so', async () => {
    open('EMP-0007', { as: 'EMP-0004' });

    const basic = await cardOf(words.person.basic);
    expect(within(basic).getByText(words.person.signInNotYet)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.person.name)).readOnly).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: words.person.save })).toBeNull();
    expect(screen.queryByRole('button', { name: words.person.archive })).toBeNull();
  });

  it('A save over someone else’s newer one is refused, what was typed is kept, and the page offers the newer details', async () => {
    const { api } = open('EMP-0002', { cue: 'saveEmployee:409' });
    const name = await screen.findByLabelText(starting(words.person.name));
    await user.clear(name);
    await user.type(name, 'Tên mới');

    await user.click(screen.getByRole('button', { name: words.person.save }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.person.conflict);
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.person.name)).value).toBe(
      'Tên mới',
    );
    await user.click(screen.getByRole('button', { name: words.person.conflictReload }));
    expect(await screen.findByDisplayValue('Trần Văn Hùng')).toBeTruthy();
    expect(api.getEmployee).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so and keeps what was typed', async () => {
    open('EMP-0002', { cue: 'saveEmployee:503' });
    const name = await screen.findByLabelText(starting(words.person.name));
    await user.clear(name);
    await user.type(name, 'Tên mới');

    await user.click(screen.getByRole('button', { name: words.person.save }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.person.saveFailed);
    expect(screen.getByLabelText<HTMLInputElement>(starting(words.person.name)).value).toBe(
      'Tên mới',
    );
  });

  it('On a person’s page, adding, changing or archiving says it needs seeing the staff list while that is refused to the person, whatever their department and position give', async () => {
    open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });
    const group = (label: string) =>
      screen.getByRole('radiogroup', { name: `${words.person.permissions}: ${label}` });
    const needs = () =>
      screen.queryAllByText(
        words.permissions.needs.replace('{{what}}', words.permissions.staff_canView),
      );
    // the warehouse allows seeing, so an added right has what it needs
    await user.click(
      within(group(words.permissions.staff_canCreate)).getByText(words.permissions.allow),
    );
    expect(needs()).toHaveLength(0);

    await user.click(
      within(group(words.permissions.staff_canView)).getByText(words.permissions.refuse),
    );
    expect(needs()).toHaveLength(1);
    await user.click(
      within(group(words.permissions.staff_canCreate)).getByText(words.permissions.inherit),
    );
    expect(needs()).toHaveLength(0);
    await user.click(
      within(group(words.permissions.staff_canDelete)).getByText(words.permissions.allow),
    );
    expect(needs()).toHaveLength(1);
    await user.click(
      within(group(words.permissions.staff_canView)).getByText(words.permissions.inherit),
    );
    expect(needs()).toHaveLength(0);
  });

  it('A save that a 403 refuses says the person may not change this, keeps what was typed to be read, and the Save button is gone when they may no longer', async () => {
    open('EMP-0002', {
      as: 'EMP-0001',
      cue: 'saveEmployee:403',
      override: (api, original) => {
        let reads = 0;
        api.me.mockImplementation(async () => {
          const answer = await original.me();
          return ++reads === 1
            ? answer
            : { user: { ...answer.user, permissions: { 'staff.canView': true } } };
        });
      },
    });
    const name = await screen.findByLabelText(starting(words.person.name));
    await user.clear(name);
    await user.type(name, 'Tên mới');

    await user.click(screen.getByRole('button', { name: words.person.save }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: words.person.save })).toBeNull(),
    );
    expect((await screen.findByRole('alert')).textContent).toBe(words.person.saveForbidden);
    const kept = screen.getByLabelText<HTMLInputElement>(starting(words.person.name));
    expect(kept.value).toBe('Tên mới');
    expect(kept.readOnly).toBe(true);
  });

  it('Each department and each position carries what its staff may do, and each person may carry their own; the person’s beats the position’s, which beats the department’s, and what none of them allows is refused', async () => {
    const { api } = open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });
    const group = (label: string) =>
      screen.getByRole('radiogroup', { name: `${words.person.permissions}: ${label}` });
    // the warehouse allows seeing: shown as the level above, and not custom
    expect(
      within(group(words.permissions.staff_canView)).getByRole('radio', {
        name: words.permissions.inherit,
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByText(`${words.permissions.inherit}: ${words.permissions.allowed}`),
    ).toHaveLength(1);
    expect(
      screen.getAllByText(`${words.permissions.inherit}: ${words.permissions.refused}`),
    ).toHaveLength(7);

    // the person's own: allow archiving, which nothing above allows; allow seeing, which the department already does
    await user.click(
      within(group(words.permissions.staff_canDelete)).getByText(words.permissions.allow),
    );
    await user.click(
      within(group(words.permissions.staff_canView)).getByText(words.permissions.allow),
    );
    expect(screen.getAllByText(words.permissions.custom)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: words.person.save }));

    // only what differs is stored
    expect(await screen.findByText(words.person.saved)).toBeTruthy();
    expect((await api.getEmployee(person('EMP-0004').id)).employee.permissions).toEqual({
      'staff.canDelete': true,
    });
    // what is theirs shows as theirs: archiving only, the one that differs from the levels above
    expect(screen.getAllByText(words.permissions.custom)).toHaveLength(1);
  });

  it('A position’s refusal beats its department’s allowance on the person’s page, and the root’s Allow over it is stored as the person’s own', async () => {
    const { api } = open('EMP-0007');
    await screen.findByRole('heading', { level: 2, name: 'Bùi Ngọc Anh' });

    // the office allows changing a person's details and the trainee position refuses it
    await user.selectOptions(screen.getByLabelText(words.person.department), 'Văn phòng');
    await user.selectOptions(screen.getByLabelText(words.person.position), 'Thực tập');

    const label = words.permissions.staff_canEdit;
    const row = screen.getByText(label).parentElement as HTMLElement;
    expect(
      within(row).getByText(`${words.permissions.inherit}: ${words.permissions.refused}`),
    ).toBeTruthy();
    expect(
      screen.getAllByText(`${words.permissions.inherit}: ${words.permissions.allowed}`),
    ).toHaveLength(4);
    await user.click(
      within(
        screen.getByRole('radiogroup', { name: `${words.person.permissions}: ${label}` }),
      ).getByText(words.permissions.allow),
    );
    await user.click(screen.getByRole('button', { name: words.person.save }));

    // what the levels above refuse, the person's Allow differs from, so it is stored
    expect(await screen.findByText(words.person.saved)).toBeTruthy();
    expect((await api.getEmployee(person('EMP-0007').id)).employee.permissions).toEqual({
      'staff.canEdit': true,
    });
  });

  it('The root moves a person to another department and position and changes their note, and the change is theirs on the list', async () => {
    const { api } = open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });

    await user.selectOptions(screen.getByLabelText(words.person.department), 'Văn phòng');
    await user.selectOptions(screen.getByLabelText(words.person.position), 'Quản lý');
    await user.type(screen.getByLabelText(words.person.note), 'Chuyển lên văn phòng.');
    await user.click(screen.getByRole('button', { name: words.person.save }));

    expect(await screen.findByText(words.person.saved)).toBeTruthy();
    const saved = (await api.getEmployee(person('EMP-0004').id)).employee;
    expect(saved.department?.name).toBe('Văn phòng');
    expect(saved.position?.name).toBe('Quản lý');
    expect(saved.extra).toMatchObject({
      note: 'Chuyển lên văn phòng.',
      personalPhone: '0903 222 004',
    });
    // a person put in no department has none
    await user.selectOptions(
      screen.getByLabelText(words.person.department),
      words.person.noneChosen,
    );
    await user.click(screen.getByRole('button', { name: words.person.save }));
    await waitFor(async () =>
      expect((await api.getEmployee(person('EMP-0004').id)).employee.department).toBeNull(),
    );
  });

  it('A root saving a person in no department and no position stores neither', async () => {
    const { api } = open('EMP-0007');
    await screen.findByRole('heading', { level: 2, name: 'Bùi Ngọc Anh' });

    await user.click(screen.getByRole('button', { name: words.person.save }));

    expect(await screen.findByText(words.person.saved)).toBeTruthy();
    expect(api.saveEmployee).toHaveBeenCalledWith(
      person('EMP-0007').id,
      expect.objectContaining({ departmentId: null, positionId: null, permissions: {} }),
    );
  });

  it('The root gives a person a password, typed twice or made by the app, of at least 8 characters with a capital, a small letter, a digit and one of `@$!%*?&`; it is shown once, and it signs the person out on every device', async () => {
    const { api } = open('EMP-0007');
    await screen.findByText(words.person.signInNotYet);
    const give = () => user.click(screen.getByRole('button', { name: words.person.passwordSet }));

    // refused on the page before any call
    await user.type(screen.getByLabelText(words.person.passwordNew), 'weak');
    await give();
    expect((await screen.findByRole('alert')).textContent).toContain(words.person.passwordInvalid);
    await user.clear(screen.getByLabelText(words.person.passwordNew));
    await user.type(screen.getByLabelText(words.person.passwordNew), 'Abcdef1!');
    await user.type(screen.getByLabelText(words.person.passwordAgain), 'Abcdef1?');
    await give();
    expect((await screen.findByRole('alert')).textContent).toContain(words.person.passwordMismatch);
    expect(api.setPassword).not.toHaveBeenCalled();

    // typed twice
    await user.clear(screen.getByLabelText(words.person.passwordAgain));
    await user.type(screen.getByLabelText(words.person.passwordAgain), 'Abcdef1!');
    await give();
    expect(await screen.findByDisplayValue('Abcdef1!')).toBeTruthy();
    expect(api.setPassword).toHaveBeenCalledWith(person('EMP-0007').id, 'Abcdef1!');
    expect(screen.getByText(words.person.signInReady.replace('{{code}}', 'EMP-0007'))).toBeTruthy();
    // the fields are emptied: the password is on the screen once
    expect(screen.getByLabelText<HTMLInputElement>(words.person.passwordNew).value).toBe('');

    // made by the app
    await user.click(screen.getByRole('button', { name: words.person.passwordMake }));
    await waitFor(() =>
      expect(api.setPassword).toHaveBeenLastCalledWith(person('EMP-0007').id, null),
    );
    expect(screen.queryByDisplayValue('Abcdef1!')).toBeNull();
    expect(screen.getByText(words.person.passwordOnce)).toBeTruthy();
  });

  it('A password the page could not set says so', async () => {
    open('EMP-0007', { cue: 'setPassword:503' });
    await screen.findByText(words.person.signInNotYet);

    await user.click(screen.getByRole('button', { name: words.person.passwordMake }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.person.passwordFailed);
  });

  it('Someone allowed locks a person who left, after a check: they are stopped at their next step, and their record and code are kept; the page then offers the unlock', async () => {
    const { api } = open('EMP-0006', { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });

    // the check first: nothing is locked until it is answered
    await user.click(screen.getByRole('button', { name: words.person.archive }));
    expect(api.archiveEmployee).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: words.person.archiveCancel }));
    await user.click(screen.getByRole('button', { name: words.person.archive }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam'),
      }),
    );

    expect(await screen.findByText(words.person.archived)).toBeTruthy();
    expect(api.archiveEmployee).toHaveBeenCalledOnce();
    // the lock is gone and the unlock is offered instead
    expect(screen.queryByRole('button', { name: words.person.archive })).toBeNull();
    expect(screen.getByRole('button', { name: words.person.restore })).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.save })).toBeNull();
    expect((await api.getEmployee(person('EMP-0006').id)).employee).toMatchObject({
      archived: true,
      code: 'EMP-0006',
    });
    // and the list hides them
    await user.click(screen.getByRole('link', { name: words.staff.back }));
    await rowOf('Nguyễn Thị Lan');
    expect(screen.queryByText('Đặng Hoài Nam')).toBeNull();
  });

  it('A lock that fails says so, and one over a newer record is refused', async () => {
    const failing = open('EMP-0006', { cue: 'archiveEmployee:503' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    await user.click(screen.getByRole('button', { name: words.person.archive }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam'),
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(words.person.archiveFailed);
    failing.unmount();

    open('EMP-0006', { cue: 'archiveEmployee:409' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    await user.click(screen.getByRole('button', { name: words.person.archive }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam'),
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(words.person.conflict);
  });

  it('Switched back on, a person who left is a working person again: no Left badge, the actions back, the record as it was', async () => {
    const { api } = open('EMP-0008', { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    expect(screen.getByText(words.staff.left)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.save })).toBeNull();

    // the check first: nobody is unlocked until it is answered
    await user.click(screen.getByRole('button', { name: words.person.restore }));
    expect(api.restoreEmployee).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: words.person.restoreCancel }));
    await user.click(screen.getByRole('button', { name: words.person.restore }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.restoreConfirm.replace('{{name}}', 'Hoàng Gia Huy'),
      }),
    );

    expect(await screen.findByRole('button', { name: words.person.archive })).toBeTruthy();
    expect(api.restoreEmployee).toHaveBeenCalledOnce();
    expect(screen.queryByText(words.staff.left)).toBeNull();
    expect(screen.queryByText(words.person.archived)).toBeNull();
    expect(screen.getByRole('button', { name: words.person.save })).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.restore })).toBeNull();
    expect((await api.getEmployee(person('EMP-0008').id)).employee).toMatchObject({
      archived: false,
      code: 'EMP-0008',
    });
  });

  it('The unlock is offered only on a person who left, and only to someone allowed to lock', async () => {
    const working = open('EMP-0006', { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    expect(screen.getByRole('button', { name: words.person.archive })).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.restore })).toBeNull();
    working.unmount();

    const notAllowed = open('EMP-0008', { as: 'EMP-0004' });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    expect(screen.getByText(words.staff.left)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.restore })).toBeNull();
    expect(screen.queryByRole('button', { name: words.person.archive })).toBeNull();
    notAllowed.unmount();
  });

  it('An unlock the BFF refuses says so, and the page stays as it was', async () => {
    const failing = open('EMP-0008', { cue: 'restoreEmployee:503' });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    await user.click(screen.getByRole('button', { name: words.person.restore }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.restoreConfirm.replace('{{name}}', 'Hoàng Gia Huy'),
      }),
    );
    expect(
      (await screen.findAllByRole('alert')).map((alert) => alert.textContent).join(' '),
    ).toContain(words.person.restoreFailed);
    expect(screen.getByText(words.staff.left)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.person.save })).toBeNull();
    failing.unmount();

    open('EMP-0008', { cue: 'restoreEmployee:409' });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    await user.click(screen.getByRole('button', { name: words.person.restore }));
    await user.click(
      screen.getByRole('button', {
        name: words.person.restoreConfirm.replace('{{name}}', 'Hoàng Gia Huy'),
      }),
    );
    expect(
      (await screen.findAllByRole('alert')).map((alert) => alert.textContent).join(' '),
    ).toContain(words.person.conflict);
    expect(screen.getByText(words.staff.left)).toBeTruthy();
  });

  it('Both panels read in Vietnamese and in English', async () => {
    const left = open('EMP-0008', { language: 'vi' });
    await screen.findByRole('heading', { level: 2, name: 'Hoàng Gia Huy' });
    await user.click(screen.getByRole('button', { name: wordsVi.person.restore }));
    expect(
      screen.getByRole('button', {
        name: wordsVi.person.restoreConfirm.replace('{{name}}', 'Hoàng Gia Huy'),
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: wordsVi.person.restoreCancel })).toBeTruthy();
    left.unmount();

    open('EMP-0006', { language: 'vi' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    await user.click(screen.getByRole('button', { name: wordsVi.person.archive }));
    expect(
      screen.getByRole('button', {
        name: wordsVi.person.archiveConfirm.replace('{{name}}', 'Đặng Hoài Nam'),
      }),
    ).toBeTruthy();
  });

  it('A person who is not there says the page could not be loaded', async () => {
    openApp('/staff/00000000-0000-4000-8000-00000000ffff');

    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
  });
});

describe('the start date, the birth date and the address', () => {
  type Switches = Partial<Record<'startDate' | 'birthDate' | 'address', boolean>>;
  /** The data set's setup with these switches set over its own. */
  const switched =
    (on: Switches) =>
    (spied: Spied, original: Api): void => {
      spied.getStaffSetup.mockImplementation(async () => {
        const read = await original.getStaffSetup();
        const { fields } = staffConfig(read.setup);
        return { ...read, setup: { ...read.setup, fields: { ...fields, ...on } } };
      });
    };
  const OFF = { startDate: false, birthDate: false, address: false };
  const LABELS = {
    startDate: words.fields.startDate,
    birthDate: words.fields.birthDate,
    address: words.fields.address,
  };
  const gridOf = (field: HTMLElement) => field.closest('.mantine-SimpleGrid-root');
  /** A date typed as text: a browser's date input never offers a day that is not one, so the
   * input is made a text input first, as an older browser's would be. */
  const typeDay = (field: HTMLElement, value: string) => {
    (field as HTMLInputElement).type = 'text';
    fireEvent.change(field, { target: { value } });
  };

  it('With the three switched on, a person’s page shows the start and birth dates in one row and the address below; each switched off, its field is absent', async () => {
    openApp(`/staff/${person('EMP-0005').id}`);

    const basic = await cardOf(words.person.basic);
    const start = within(basic).getByLabelText<HTMLInputElement>(words.fields.startDate);
    const birth = within(basic).getByLabelText<HTMLInputElement>(words.fields.birthDate);
    const address = within(basic).getByLabelText<HTMLInputElement>(words.fields.address);
    expect([start.type, birth.type, address.type]).toEqual(['date', 'date', 'text']);
    expect([start.value, birth.value, address.value]).toEqual([
      '2023-08-21',
      '1985-01-30',
      '45 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
    ]);
    // the two dates share a row, the address is outside it, below
    expect(gridOf(start)).not.toBeNull();
    expect(gridOf(start)).toBe(gridOf(birth));
    expect(gridOf(address)).not.toBe(gridOf(start));
    expect(start.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['startDate', 'birthDate', 'address'] as const)(
    'The %s switched off leaves its field out and the others in',
    async (key) => {
      openApp(`/staff/${person('EMP-0005').id}`, { override: switched({ [key]: false }) });

      await cardOf(words.person.basic);
      for (const [other, label] of Object.entries(LABELS)) {
        expect(screen.queryByLabelText(label) === null, `${key} ${other}`).toBe(other === key);
      }
    },
  );

  it('All three switched off draw no row and no address', async () => {
    openApp(`/staff/${person('EMP-0005').id}`, { override: switched(OFF) });

    await cardOf(words.person.basic);
    for (const label of Object.values(LABELS)) expect(screen.queryByLabelText(label)).toBeNull();
  });

  it('Someone who may only see reads the three and changes none', async () => {
    openApp(`/staff/${person('EMP-0005').id}`, {
      override: (spied) => {
        spied.me.mockResolvedValue({
          user: { name: 'Hạnh', root: false, permissions: { 'staff.canView': true } },
        });
      },
    });

    const start = await screen.findByLabelText<HTMLInputElement>(words.fields.startDate);
    expect(start.readOnly).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>(words.fields.address).readOnly).toBe(true);
  });

  it('The add page shows the same three, and Add sends them in extra under startDate, birthDate and address', async () => {
    const { api } = openApp('/staff/new');

    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), 'Mai Linh');
    fireEvent.change(screen.getByLabelText(words.fields.startDate), {
      target: { value: '2026-03-05' },
    });
    fireEvent.change(screen.getByLabelText(words.fields.birthDate), {
      target: { value: '1999-12-31' },
    });
    await user.type(screen.getByLabelText(words.fields.address), ' 7 Trần Phú ');
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));

    await screen.findByRole('heading', { level: 2, name: words.addPerson.madeTitle });
    expect(api.addEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: { startDate: '2026-03-05', birthDate: '1999-12-31', address: '7 Trần Phú' },
      }),
    );
    // another person: the three are empty again
    await user.click(screen.getByRole('button', { name: words.addPerson.another }));
    expect(screen.getByLabelText<HTMLInputElement>(words.fields.address).value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(words.fields.startDate).value).toBe('');
  });

  it('The add page sends none of the three left empty, and none whose switch is off', async () => {
    const empty = openApp('/staff/new');
    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), 'Mai Linh');
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));
    await screen.findByRole('heading', { level: 2, name: words.addPerson.madeTitle });
    expect(empty.api.addEmployee).toHaveBeenCalledWith(expect.objectContaining({ extra: {} }));
    empty.unmount();

    const off = openApp('/staff/new', { override: switched(OFF) });
    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), 'Mai Linh');
    expect(screen.queryByLabelText(words.fields.birthDate)).toBeNull();
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));
    await screen.findByRole('heading', { level: 2, name: words.addPerson.madeTitle });
    expect(off.api.addEmployee).toHaveBeenCalledWith(expect.objectContaining({ extra: {} }));
  });

  it('A date that is not a real day is refused at its field and nothing is sent, on the add page and on the person’s page', async () => {
    const added = openApp('/staff/new');
    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), 'Mai Linh');
    typeDay(screen.getByLabelText(words.fields.startDate), '2026-02-30');
    await user.click(screen.getByRole('button', { name: words.addPerson.submit }));
    expect(await screen.findByText(words.fields.invalidDate)).toBeTruthy();
    expect(added.api.addEmployee).not.toHaveBeenCalled();
    // the refusal goes as the day fits
    typeDay(screen.getByLabelText(words.fields.startDate), '2026-02-28');
    expect(screen.queryByText(words.fields.invalidDate)).toBeNull();
    added.unmount();

    const shown = openApp(`/staff/${person('EMP-0005').id}`);
    typeDay(await screen.findByLabelText(words.fields.birthDate), '1985-13-01');
    await user.click(screen.getByRole('button', { name: words.person.save }));
    expect(await screen.findByText(words.fields.invalidDate)).toBeTruthy();
    expect(shown.api.saveEmployee).not.toHaveBeenCalled();
  });

  it('A person’s page saves the three typed, an emptied one removes its key, and a value stored while a switch was on survives a save made while it is off', async () => {
    const { api } = openApp(`/staff/${person('EMP-0005').id}`);
    fireEvent.change(await screen.findByLabelText(words.fields.startDate), {
      target: { value: '2024-01-02' },
    });
    await user.clear(screen.getByLabelText(words.fields.address));
    await user.click(screen.getByRole('button', { name: words.person.save }));
    await screen.findByText(words.person.saved);
    const extra = api.saveEmployee.mock.calls[0]?.[1].extra;
    expect(extra).toMatchObject({ startDate: '2024-01-02', birthDate: '1985-01-30' });
    expect(Object.keys(extra ?? {})).not.toContain('address');

    // the switches off: the stored values stay
    const off = openApp(`/staff/${person('EMP-0005').id}`, { override: switched(OFF) });
    const name = (await screen.findAllByLabelText(starting(words.person.name))).at(
      -1,
    ) as HTMLElement;
    await user.type(name, ' B');
    await user.click(
      screen.getAllByRole('button', { name: words.person.save }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(off.api.saveEmployee).toHaveBeenCalled());
    expect(off.api.saveEmployee.mock.calls[0]?.[1].extra).toMatchObject({
      startDate: '2023-08-21',
      birthDate: '1985-01-30',
      address: '45 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
    });
  });

  it('An own field stored under the key address leaves the staff screens drawn, and the person’s own address wins over it on a save', async () => {
    const legacy = {
      key: 'address',
      label: { vi: 'Nơi ở cũ', en: 'Old address' },
      kind: 'text' as const,
      options: [],
      inList: false,
    };
    const { api, unmount } = openApp(`/staff/${person('EMP-0005').id}`, {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const read = await original.getStaffSetup();
          return { ...read, setup: { ...read.setup, customFields: [legacy] } };
        });
      },
    });

    // both fields draw; the page is not lost
    const [own, mine] = [
      await screen.findByLabelText('Old address'),
      screen.getByLabelText(words.fields.address),
    ];
    await user.clear(mine);
    await user.type(mine, '9 Hai Bà Trưng');
    await user.type(own, 'old');
    await user.click(screen.getByRole('button', { name: words.person.save }));
    await screen.findByText(words.person.saved);
    expect(api.saveEmployee.mock.calls[0]?.[1].extra).toMatchObject({ address: '9 Hai Bà Trưng' });

    // the add page: the same
    unmount();
    const added = openApp('/staff/new', {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const read = await original.getStaffSetup();
          return { ...read, setup: { ...read.setup, customFields: [legacy] } };
        });
      },
    });
    await user.type(await screen.findByLabelText(starting(words.addPerson.name)), 'Mai Linh');
    await user.type(screen.getAllByLabelText('Old address').at(-1) as HTMLElement, 'old');
    await user.type(
      screen.getAllByLabelText(words.fields.address).at(-1) as HTMLElement,
      '7 Trần Phú',
    );
    await user.click(
      screen.getAllByRole('button', { name: words.addPerson.submit }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(added.api.addEmployee).toHaveBeenCalled());
    expect(added.api.addEmployee.mock.calls[0]?.[0].extra).toMatchObject({ address: '7 Trần Phú' });
  });

  it('The labels read in Vietnamese', async () => {
    openApp(`/staff/${person('EMP-0005').id}`, { language: 'vi' });

    expect(await screen.findByLabelText(wordsVi.fields.startDate)).toBeTruthy();
    expect(screen.getByLabelText(wordsVi.fields.birthDate)).toBeTruthy();
    expect(screen.getByLabelText(wordsVi.fields.address)).toBeTruthy();
    expect(screen.getByLabelText('Ngày ký hợp đồng')).toBeTruthy();
  });
});

describe('the words', () => {
  it('Every new screen reads fully in Vietnamese and in English', async () => {
    const id = person('EMP-0007').id;
    const screens = [
      { path: '/staff', ready: 'table' },
      { path: '/staff-setup', ready: 'textbox' },
      { path: '/staff/new', ready: 'textbox' },
      { path: `/staff/${id}`, ready: 'textbox' },
      { path: `/staff/${person('EMP-0008').id}`, ready: 'textbox' },
    ];
    // a key with no words shows as the key: a dotted name that starts with a group, bar a file name
    const KEY = new RegExp(
      `(?<![A-Za-z_.])(${Object.keys(DICTIONARIES.en).join('|')})(?!\\.(?:xlsx|csv)\\b)(\\.[a-z][A-Za-z0-9_]*)+`,
    );
    const missingKey = () => KEY.exec(document.body.textContent)?.[0] ?? null;
    for (const language of ['vi', 'en'] as const) {
      for (const { path, ready } of screens) {
        const drawn = openApp(path, { language });
        await screen.findAllByRole(ready);
        expect(missingKey(), `${language} ${path}`).toBeNull();
        // the screen speaks the language chosen
        expect(document.body.textContent).toContain(DICTIONARIES[language].nav.staff);
        drawn.unmount();
      }
    }
    for (const language of ['vi', 'en'] as const) {
      for (const as of ['EMP-0005']) {
        const drawn = openApp('/staff', { language, as, noDrivers: true });
        await screen.findByRole('status');
        expect(missingKey()).toBeNull();
        drawn.unmount();
      }
      const forbidden = openApp('/settings', { language, as: 'EMP-0001' });
      await screen.findByRole('status');
      expect(missingKey()).toBeNull();
      forbidden.unmount();
    }
  });
});
