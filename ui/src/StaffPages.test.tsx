import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openApp, person, type Spied } from '../tests/open';
import { ApiError, type Api } from './api';

/** A row of the list, by the person's name. */
const rowOf = async (name: string) => {
  const rows = (await screen.findAllByText(name)).flatMap((cell) => cell.closest('tr') ?? []);
  expect(rows).toHaveLength(1);
  return rows[0] as HTMLElement;
};
const menu = () => within(screen.getByRole('navigation', { name: 'Menu' }));

describe('the staff list', () => {
  it('The staff list shows each person’s name, code, department, position and phone, in code order; people who left are hidden, and a filter shows them', async () => {
    openApp('/staff');

    const lan = await rowOf('Nguyễn Thị Lan');
    // the avatar's initials come with the name, and the company's own fields shown in the list after
    expect(
      within(lan)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['NTNguyễn Thị Lan', 'EMP-0001', 'Văn phòng', 'Quản lý', '0903 111 001', '', '']);
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

    await userEvent.click(screen.getByLabelText('Show people who left'));

    const left = await rowOf('Hoàng Gia Huy');
    expect(within(left).getByText('Left')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(9);
  });

  it('Each person sees in the menu only the pages their permissions allow, and on a page only the buttons for what they may do; a page they may not open says so, and with no page at all one page says there is nothing for them yet', async () => {
    // the root: every page, every button
    const root = openApp('/staff');
    expect(await screen.findByRole('link', { name: 'Add a person' })).toBeTruthy();
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Settings', 'Staff', 'Departments and positions']);
    root.unmount();

    // an office manager: the staff list, and the button to add; no Settings, no setup
    const lan = openApp('/staff', { as: 'EMP-0001' });
    expect(await screen.findByRole('link', { name: 'Add a person' })).toBeTruthy();
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Staff']);
    lan.unmount();

    // a warehouse hand who may only see: the list without the button
    const bao = openApp('/staff', { as: 'EMP-0004' });
    await screen.findByText('Nguyễn Thị Lan');
    expect(screen.queryByRole('link', { name: 'Add a person' })).toBeNull();
    bao.unmount();

    // a page they may not open says so, in the frame their menu draws
    const settings = openApp('/settings', { as: 'EMP-0001' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'You cannot open this page',
    );
    settings.unmount();
    const setup = openApp('/staff-setup', { as: 'EMP-0004' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'You cannot open this page',
    );
    setup.unmount();
    const add = openApp('/staff/new', { as: 'EMP-0004' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'You cannot open this page',
    );
    add.unmount();

    // no page at all: one page says there is nothing yet
    openApp('/staff', { as: 'EMP-0005' });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'Nothing for you here yet',
    );
    expect(menu().queryAllByRole('link')).toEqual([]);
  });

  it('Only the root imports staff: the list shows it the button to the import page, and shows it to no one else, whatever staff rights they hold', async () => {
    // the root: the button leads to the import page
    const root = openApp('/staff');
    await userEvent.click(await screen.findByRole('link', { name: 'Import from Excel' }));
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'Add staff from Excel',
    );
    root.unmount();

    // an office manager who may see and add people: the add button, and no import
    const lan = openApp('/staff', { as: 'EMP-0001' });
    expect(await screen.findByRole('link', { name: 'Add a person' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Import from Excel' })).toBeNull();
    lan.unmount();
  });

  it('A 403 makes the UI read `me` again and redraw', async () => {
    // the cue stands for what the root just changed: the list is refused once, and `me` is read
    const { api } = openApp('/staff', { as: 'EMP-0004', cue: 'listEmployees:403' });
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(2));
    // what they may do is as it was, so the page stays theirs and offers another try
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
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
      await screen.findByRole('heading', { level: 2, name: 'Nothing for you here yet' }),
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
    await userEvent.type(await screen.findByLabelText(/^Company name/), 'x');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nothing for you here yet' }),
    ).toBeTruthy();
    expect(api.me).toHaveBeenCalledTimes(2);
  });

  it('A 403 that `me` cannot be read after leaves the page as it was, and a 401 there signs out', async () => {
    const unavailable = openApp('/staff', {
      as: 'EMP-0004',
      cue: 'listEmployees:403',
      override: refusedThen(() => Promise.reject(new ApiError(503))),
    });
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await waitFor(() => expect(unavailable.api.me).toHaveBeenCalledTimes(2));
    unavailable.unmount();

    const signedOut = openApp('/staff', {
      as: 'EMP-0004',
      cue: 'listEmployees:403',
      override: refusedThen(() => Promise.reject(new ApiError(401))),
    });
    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
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
    await userEvent.type(await screen.findByLabelText(/^Name/), name);
    await userEvent.type(screen.getByLabelText(/^Code/), code);
    if (phone) await userEvent.type(screen.getByLabelText('Phone'), phone);
    if (note) await userEvent.type(screen.getByLabelText('Note'), note);
  };

  it('The root adds a person with a name, a code, a phone, a department, a position and a note, and is then shown their sign-in name and a first password once, to copy and hand over; the password is never shown again and is kept only as its hash', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', 'emp-0100', '0909', 'Mới vào');
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Kho');
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Nhân viên');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Person added' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Sign-in name').value).toBe('EMP-0100');
    const shown = screen.getByLabelText<HTMLInputElement>('First password').value;
    expect(shown.length).toBeGreaterThan(7);
    expect(api.addEmployee).toHaveBeenCalledWith({
      name: 'Mai Linh',
      code: 'emp-0100',
      extra: { phone: '0909', note: 'Mới vào' },
      departmentId: DEMO_STAFF_SETUP.departments[0]?.id,
      positionId: DEMO_STAFF_SETUP.positions[1]?.id,
    });

    // another person: the form is empty again and the password is on no screen
    await userEvent.click(screen.getByRole('button', { name: 'Add another person' }));
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
    expect(document.body.textContent).not.toContain(shown);
    // their page: they are the root's, with a sign-in
    await userEvent.type(screen.getByLabelText(/^Name/), 'Người khác');
    await userEvent.type(screen.getByLabelText(/^Code/), 'EMP-0101');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Open their page' }));
    expect(await screen.findByText('Signs in with the code EMP-0101 and a password.')).toBeTruthy();
  });

  it('Someone allowed to add people adds one with a name, a code, a phone and a note, without a department, a position or a sign-in, which the root gives; the person’s page says they cannot sign in yet', async () => {
    const { api } = openApp('/staff/new', { as: 'EMP-0001' });
    await fill('Mai Linh', 'emp-0100', '0909', 'Mới vào');
    expect(screen.queryByLabelText('Department')).toBeNull();
    expect(screen.queryByLabelText('Position')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('Cannot sign in yet: the root has not given a password.'),
    ).toBeTruthy();
    expect(api.addEmployee).toHaveBeenCalledWith({
      name: 'Mai Linh',
      code: 'emp-0100',
      extra: { phone: '0909', note: 'Mới vào' },
    });
    expect(screen.queryByLabelText('First password')).toBeNull();
  });

  it('A code is 2 to 20 of the letters A to Z, digits and hyphens, unique in the company in any case, among people who left too, and is the person’s sign-in name; a code already taken is refused, and its holder is unchanged', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', 'E');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('A code is 2 to 20 letters A to Z, digits or hyphens.'),
    ).toBeTruthy();
    expect(api.addEmployee).not.toHaveBeenCalled();

    // a code that a person who left holds, typed in another case
    await userEvent.clear(screen.getByLabelText(/^Code/));
    await userEvent.type(screen.getByLabelText(/^Code/), 'emp-0008');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toContain('already belongs to someone');
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Mai Linh');
    expect(person('EMP-0008').name).toBe('Hoàng Gia Huy');
    expect((await api.getEmployee(person('EMP-0008').id)).employee.name).toBe('Hoàng Gia Huy');
  });

  it('A code of spaces alone is no code: the add is sent without one, to be numbered', async () => {
    const { api } = openApp('/staff/new');
    await fill('Mai Linh', '   ');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await screen.findByRole('heading', { level: 2, name: 'Person added' });
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

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect((await screen.findByRole('alert')).textContent).toContain('was not added');
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Mai Linh');
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
    expect(screen.getByLabelText<HTMLInputElement>('Phone').value).toBe('0903 111 002');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Note').value).toContain('Được lưu trữ');
    expect(screen.getByText('Signs in with the code EMP-0002 and a password.')).toBeTruthy();
    // someone who may change a person changes their details, and no more
    expect(screen.queryByLabelText('Department', { selector: 'select' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByText('Password', { selector: 'h3' })).toBeNull();

    const name = screen.getByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Trần Hùng');
    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
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

    expect(
      await screen.findByText('Cannot sign in yet: the root has not given a password.'),
    ).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  it('A save over someone else’s newer one is refused, what was typed is kept, and the page offers the newer details', async () => {
    const { api } = open('EMP-0002', { cue: 'saveEmployee:409' });
    const name = await screen.findByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Tên mới');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved newer details first',
    );
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Tên mới');
    await userEvent.click(screen.getByRole('button', { name: 'Show the newer details' }));
    expect(await screen.findByDisplayValue('Trần Văn Hùng')).toBeTruthy();
    expect(api.getEmployee).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so and keeps what was typed', async () => {
    open('EMP-0002', { cue: 'saveEmployee:503' });
    const name = await screen.findByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Tên mới');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('were not saved');
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Tên mới');
  });

  it('On a person’s page, adding, changing or archiving says it needs seeing the staff list while that is refused to the person, whatever their department and position give', async () => {
    open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });
    const group = (label: string) =>
      screen.getByRole('radiogroup', { name: `Their own permissions: ${label}` });
    const needs = () => screen.queryAllByText('Needs “See the staff list”.');
    // the warehouse allows seeing, so an added right has what it needs
    await userEvent.click(within(group('Add a person')).getByText('Allow'));
    expect(needs()).toHaveLength(0);

    await userEvent.click(within(group('See the staff list')).getByText('Refuse'));
    expect(needs()).toHaveLength(1);
    await userEvent.click(within(group('Add a person')).getByText('As the level above'));
    expect(needs()).toHaveLength(0);
    await userEvent.click(within(group('Archive a person')).getByText('Allow'));
    expect(needs()).toHaveLength(1);
    await userEvent.click(within(group('See the staff list')).getByText('As the level above'));
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
    const name = await screen.findByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Tên mới');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The details were not saved: you may no longer change this person. What you typed is still shown.',
    );
    const kept = screen.getByLabelText<HTMLInputElement>(/^Name/);
    expect(kept.value).toBe('Tên mới');
    expect(kept.readOnly).toBe(true);
  });

  it('Each department and each position carries what its staff may do, and each person may carry their own; the person’s beats the position’s, which beats the department’s, and what none of them allows is refused', async () => {
    const { api } = open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });
    const group = (label: string) =>
      screen.getByRole('radiogroup', { name: `Their own permissions: ${label}` });
    // the warehouse allows seeing: shown as the level above, and not custom
    expect(
      within(group('See the staff list')).getByRole('radio', { name: 'As the level above' }),
    ).toBeTruthy();
    expect(screen.getAllByText('As the level above: Allowed')).toHaveLength(1);
    expect(screen.getAllByText('As the level above: Refused')).toHaveLength(4);

    // the person's own: allow archiving, which nothing above allows; allow seeing, which the department already does
    await userEvent.click(within(group('Archive a person')).getByText('Allow'));
    await userEvent.click(within(group('See the staff list')).getByText('Allow'));
    expect(screen.getAllByText('Custom')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // only what differs is stored
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect((await api.getEmployee(person('EMP-0004').id)).employee.permissions).toEqual({
      'staff.canDelete': true,
    });
    // what is theirs shows as theirs: archiving only, the one that differs from the levels above
    expect(screen.getAllByText('Custom')).toHaveLength(1);
  });

  it('A position’s refusal beats its department’s allowance on the person’s page, and the root’s Allow over it is stored as the person’s own', async () => {
    const { api } = open('EMP-0007');
    await screen.findByRole('heading', { level: 2, name: 'Bùi Ngọc Anh' });

    // the office allows changing a person's details and the trainee position refuses it
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Văn phòng');
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Thực tập');

    const label = 'Change a person’s name and details';
    const row = screen.getByText(label).parentElement as HTMLElement;
    expect(within(row).getByText('As the level above: Refused')).toBeTruthy();
    expect(screen.getAllByText('As the level above: Allowed')).toHaveLength(2);
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: `Their own permissions: ${label}` })).getByText(
        'Allow',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // what the levels above refuse, the person's Allow differs from, so it is stored
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect((await api.getEmployee(person('EMP-0007').id)).employee.permissions).toEqual({
      'staff.canEdit': true,
    });
  });

  it('The root moves a person to another department and position and changes their note, and the change is theirs on the list', async () => {
    const { api } = open('EMP-0004');
    await screen.findByRole('heading', { level: 2, name: 'Phạm Quốc Bảo' });

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Văn phòng');
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Quản lý');
    await userEvent.type(screen.getByLabelText('Note'), 'Chuyển lên văn phòng.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    const saved = (await api.getEmployee(person('EMP-0004').id)).employee;
    expect(saved.department?.name).toBe('Văn phòng');
    expect(saved.position?.name).toBe('Quản lý');
    expect(saved.extra).toMatchObject({
      note: 'Chuyển lên văn phòng.',
      personalPhone: '0903 222 004',
    });
    // a person put in no department has none
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'None');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await api.getEmployee(person('EMP-0004').id)).employee.department).toBeNull(),
    );
  });

  it('A root saving a person in no department and no position stores neither', async () => {
    const { api } = open('EMP-0007');
    await screen.findByRole('heading', { level: 2, name: 'Bùi Ngọc Anh' });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(api.saveEmployee).toHaveBeenCalledWith(
      person('EMP-0007').id,
      expect.objectContaining({ departmentId: null, positionId: null, permissions: {} }),
    );
  });

  it('The root gives a person a password, typed twice or made by the app, of at least 8 characters with a capital, a small letter, a digit and one of `@$!%*?&`; it is shown once, and it signs the person out on every device', async () => {
    const { api } = open('EMP-0007');
    await screen.findByText('Cannot sign in yet: the root has not given a password.');
    const give = () => userEvent.click(screen.getByRole('button', { name: 'Give this password' }));

    // refused on the page before any call
    await userEvent.type(screen.getByLabelText('New password'), 'weak');
    await give();
    expect((await screen.findByRole('alert')).textContent).toContain('does not meet the rule');
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.type(screen.getByLabelText('New password'), 'Abcdef1!');
    await userEvent.type(screen.getByLabelText('The new password again'), 'Abcdef1?');
    await give();
    expect((await screen.findByRole('alert')).textContent).toContain('The two passwords differ');
    expect(api.setPassword).not.toHaveBeenCalled();

    // typed twice
    await userEvent.clear(screen.getByLabelText('The new password again'));
    await userEvent.type(screen.getByLabelText('The new password again'), 'Abcdef1!');
    await give();
    expect(await screen.findByDisplayValue('Abcdef1!')).toBeTruthy();
    expect(api.setPassword).toHaveBeenCalledWith(person('EMP-0007').id, 'Abcdef1!');
    expect(screen.getByText('Signs in with the code EMP-0007 and a password.')).toBeTruthy();
    // the fields are emptied: the password is on the screen once
    expect(screen.getByLabelText<HTMLInputElement>('New password').value).toBe('');

    // made by the app
    await userEvent.click(screen.getByRole('button', { name: 'Make one for me' }));
    await waitFor(() =>
      expect(api.setPassword).toHaveBeenLastCalledWith(person('EMP-0007').id, null),
    );
    expect(screen.queryByDisplayValue('Abcdef1!')).toBeNull();
    expect(
      screen.getByText('Shown now and never again. It signed the person out on every device.'),
    ).toBeTruthy();
  });

  it('A password the page could not set says so', async () => {
    open('EMP-0007', { cue: 'setPassword:503' });
    await screen.findByText('Cannot sign in yet: the root has not given a password.');

    await userEvent.click(screen.getByRole('button', { name: 'Make one for me' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The password was not set');
  });

  it('Someone allowed archives a person who left, after a check: they are stopped at their next step and cannot sign in again, and their record and code are kept; no one is un-archived, so someone who returns is added again under a new code', async () => {
    const { api } = open('EMP-0006', { as: 'EMP-0001' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });

    // the check first: nothing is archived until it is answered
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(api.archiveEmployee).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Keep them' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive Đặng Hoài Nam' }));

    expect(
      await screen.findByText('This person left. Their record and code are kept.'),
    ).toBeTruthy();
    expect(api.archiveEmployee).toHaveBeenCalledOnce();
    // nothing brings them back on this page
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect((await api.getEmployee(person('EMP-0006').id)).employee).toMatchObject({
      archived: true,
      code: 'EMP-0006',
    });
    // and the list hides them
    await userEvent.click(screen.getByRole('link', { name: 'Back to the staff list' }));
    await rowOf('Nguyễn Thị Lan');
    expect(screen.queryByText('Đặng Hoài Nam')).toBeNull();
  });

  it('An archive that fails says so, and one over a newer record is refused', async () => {
    const failing = open('EMP-0006', { cue: 'archiveEmployee:503' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive Đặng Hoài Nam' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'were not archived'.replace('were', 'They were'),
    );
    failing.unmount();

    open('EMP-0006', { cue: 'archiveEmployee:409' });
    await screen.findByRole('heading', { level: 2, name: 'Đặng Hoài Nam' });
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive Đặng Hoài Nam' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved newer details first',
    );
  });

  it('A person who is not there says the page could not be loaded', async () => {
    openApp('/staff/00000000-0000-4000-8000-00000000ffff');

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
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
    ];
    // a key with no words shows as the key: a dotted name of the dictionaries' groups
    const KEY =
      /\b(common|nav|staff|person|addPerson|setup|permissions|forbidden|nothing)\.[A-Za-z_]+/;
    const missingKey = () => KEY.exec(document.body.textContent)?.[0] ?? null;
    for (const language of ['vi', 'en'] as const) {
      for (const { path, ready } of screens) {
        const drawn = openApp(path, { language });
        await screen.findAllByRole(ready);
        expect(missingKey(), `${language} ${path}`).toBeNull();
        // the screen speaks the language chosen
        expect(document.body.textContent).toContain(language === 'vi' ? 'Nhân viên' : 'Staff');
        drawn.unmount();
      }
    }
    for (const language of ['vi', 'en'] as const) {
      for (const as of ['EMP-0005']) {
        const drawn = openApp('/staff', { language, as });
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
