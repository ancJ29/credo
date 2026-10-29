import { DEMO_PHOTOS, DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../tests/open';
import { draw } from '../tests/render';
import { App } from './App';
import { sceneParts } from './scene';
import { StaffListPage } from './StaffListPage';
import { shrinkToPhoto } from './photo';

vi.mock('./photo', () => ({ shrinkToPhoto: vi.fn() }));

const PHOTO = Object.values(DEMO_PHOTOS)[0];
const menu = () => within(screen.getByRole('navigation', { name: 'Menu' }));
const at = (code: string) => `/staff/${person(code).id}`;

/** The staff setup page's last field editor: the one a click on "Add a field" just made. */
const lastOf = (label: string | RegExp) => screen.getAllByLabelText(label).at(-1) as HTMLElement;

/** Three long stories (dozens of keystrokes on Mantine's inputs, then a save and a re-read) take
 * 1 to 1.4 s alone and over 5 s in a whole `pnpm check` with other worktrees' gates running: named
 * slow here, one by one, while the default timeout stands for every other test. */
const SLOW = { timeout: 20_000 };

describe('the company’s optional fields', () => {
  it(
    'The root chooses which optional fields the company keeps on a person, the second phone and the photo here, all off until turned on; a field turned off is hidden everywhere, and what was stored in it stays',
    SLOW,
    async () => {
      const { api } = openApp(at('EMP-0004'));
      // on in the data set: the second phone with its value, the photo panel
      expect(await screen.findByDisplayValue('0903 222 004')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 3, name: 'Photo' })).toBeTruthy();

      // the root turns both off on the setup page and saves
      await userEvent.click(menu().getByRole('link', { name: 'Departments and positions' }));
      await userEvent.click(await screen.findByRole('checkbox', { name: 'A second phone' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'A photo' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Saved.')).toBeTruthy();
      expect((await api.getStaffSetup()).setup.fields).toEqual({
        personalPhone: false,
        photo: false,
        email: false,
        qr: false,
      });

      // hidden everywhere: the person's page, the add form, the list's initials
      api.getPhoto.mockClear();
      await userEvent.click(menu().getByRole('link', { name: 'Staff' }));
      const lanRow = (await screen.findByText('Nguyễn Thị Lan')).closest('tr') as HTMLElement;
      expect(lanRow.textContent).not.toContain('NT');
      await userEvent.click(screen.getByRole('link', { name: 'Phạm Quốc Bảo' }));
      await screen.findByLabelText(/^Name/);
      expect(screen.queryByLabelText('Second phone')).toBeNull();
      expect(screen.queryByRole('heading', { level: 3, name: 'Photo' })).toBeNull();
      expect(api.getPhoto).not.toHaveBeenCalled();

      // and what was stored stays: a save of the name keeps the second phone
      await userEvent.clear(screen.getByLabelText(/^Name/));
      await userEvent.type(screen.getByLabelText(/^Name/), 'Bảo');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText('Saved.');
      expect((await api.getEmployee(person('EMP-0004').id)).employee.extra).toMatchObject({
        personalPhone: '0903 222 004',
      });
      await userEvent.click(menu().getByRole('link', { name: 'Staff' }));
      await userEvent.click(await screen.findByRole('link', { name: 'Add a person' }));
      await screen.findByLabelText(/^Name/);
      expect(screen.queryByLabelText('Second phone')).toBeNull();
    },
  );

  it('Someone allowed to add people but not to see the staff list adds one without the fields the setup holds, which they cannot read', async () => {
    const { api } = openApp('/staff/new', {
      override: (spied, original) => {
        // as the BFF answers someone who is not the root: no first password
        spied.addEmployee.mockImplementation(async (request) => {
          const result = await original.addEmployee(request);
          return result.kind === 'added'
            ? { kind: 'added', reply: { ...result.reply, password: null } }
            : result;
        });
        spied.me.mockResolvedValue({
          user: {
            name: 'Hạnh',
            root: false,
            permissions: { 'staff.canCreate': true, 'settings.canEdit': true },
          },
        });
      },
    });
    await userEvent.type(await screen.findByLabelText(/^Name/), 'Mai Linh');
    expect(screen.queryByLabelText('Second phone')).toBeNull();
    expect(screen.queryByLabelText('Driving licence')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(api.addEmployee).toHaveBeenCalledWith({ name: 'Mai Linh', extra: {} }),
    );
    expect(api.getStaffSetup).not.toHaveBeenCalled();
    // the new person's page is not theirs to open: the guard says so
    expect(
      await screen.findByRole('heading', { level: 2, name: 'You cannot open this page' }),
    ).toBeTruthy();
  });

  it('A company that saved no fields keeps none: nothing beyond the phone and the note is asked, and no photo is read', async () => {
    const { api } = openApp(at('EMP-0004'), {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const read = await original.getStaffSetup();
          const { fields: _f, customFields: _c, numbering: _n, ...bare } = read.setup;
          return { ...read, setup: bare };
        });
      },
    });

    await screen.findByLabelText(/^Name/);
    expect(screen.queryByLabelText('Second phone')).toBeNull();
    expect(screen.queryByLabelText('Driving licence')).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Photo' })).toBeNull();
    expect(api.getPhoto).not.toHaveBeenCalled();
  });

  it('The setup page shows each switch as the company holds it, and keeps the fields and the numbering through a save of the departments', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'A second phone' }).checked).toBe(
      true,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Saved.');
    const saved = (await api.getStaffSetup()).setup;
    expect(saved.fields).toEqual({ ...DEMO_STAFF_SETUP.fields, email: false, qr: false });
    expect(saved.customFields).toEqual(DEMO_STAFF_SETUP.customFields);
    expect(saved.numbering).toEqual(DEMO_STAFF_SETUP.numbering);
  });
});

describe('the company’s own fields', () => {
  it('The second phone is asked when a person is added and when one is changed, and kept as typed', async () => {
    const { api } = openApp('/staff/new');
    await userEvent.type(await screen.findByLabelText(/^Name/), 'Mai Linh');
    await userEvent.type(screen.getByLabelText('Second phone'), ' 0909 000 111 ');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Open their page' }));

    const second = await screen.findByLabelText<HTMLInputElement>('Second phone');
    expect(second.value).toBe('0909 000 111');
    await userEvent.clear(second);
    await userEvent.type(second, '0909 000 222');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(api.saveEmployee).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ extra: { personalPhone: '0909 000 222' } }),
    );
  });

  it(
    'The root adds the company’s own fields to a person, each with a name in Vietnamese and English, a kind (text, number, date, or a choice from a list) and whether the list shows it; they appear on the form, the person’s page and the list, and a value is checked as its kind says',
    SLOW,
    async () => {
      const { api } = openApp('/staff-setup');
      await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

      await userEvent.click(screen.getByRole('button', { name: 'Add a field' }));
      await userEvent.type(lastOf(/^Key/), 'shoe');
      await userEvent.type(lastOf(/^Name in Vietnamese/), 'Cỡ giày');
      await userEvent.type(lastOf(/^Name in English/), 'Shoe size');
      await userEvent.selectOptions(lastOf('Kind'), 'Number');
      await userEvent.click(lastOf('Show in the staff list'));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText('Saved.');
      expect((await api.getStaffSetup()).setup.customFields?.at(-1)).toEqual({
        key: 'shoe',
        label: { vi: 'Cỡ giày', en: 'Shoe size' },
        kind: 'number',
        options: [],
        inList: true,
      });

      // on the form: a value that is no number is refused, what was typed kept
      await userEvent.click(menu().getByRole('link', { name: 'Staff' }));
      await userEvent.click(await screen.findByRole('link', { name: 'Add a person' }));
      await userEvent.type(await screen.findByLabelText(/^Name/), 'Mai Linh');
      await userEvent.type(screen.getByLabelText('Shoe size'), 'abc');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(await screen.findByText('A number, for example 3 or 3.5.')).toBeTruthy();
      expect(api.addEmployee).not.toHaveBeenCalled();
      expect(screen.getByLabelText<HTMLInputElement>('Shoe size').value).toBe('abc');

      // a value that fits is kept as a number
      await userEvent.clear(screen.getByLabelText('Shoe size'));
      await userEvent.type(screen.getByLabelText('Shoe size'), '41,5');
      await userEvent.selectOptions(screen.getByLabelText('Driving licence'), 'Class C');
      await userEvent.type(screen.getByLabelText('Vehicle plate'), '51C-999.99');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(await screen.findByRole('link', { name: 'Open their page' }));

      // on the person's page and in the list
      expect(await screen.findByDisplayValue('41.5')).toBeTruthy();
      expect(screen.getByLabelText<HTMLSelectElement>('Driving licence').value).toBe('c');
      expect(screen.getByLabelText('Vehicle plate')).toBeTruthy();
      expect(screen.getByLabelText('Start date')).toBeTruthy();
      expect(api.addEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ extra: { shoe: 41.5, licence: 'c', plate: '51C-999.99' } }),
      );
      await userEvent.click(screen.getByRole('link', { name: 'Back to the staff list' }));
      const row = (await screen.findByText('Mai Linh')).closest('tr') as HTMLElement;
      const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
      expect(headers).toEqual([
        'Name',
        'Code',
        'Department',
        'Position',
        'Phone',
        'Driving licence',
        'Start date',
        'Shoe size',
      ]);
      expect(within(row).getAllByRole('cell').at(-3)?.textContent).toBe('Class C');
      expect(within(row).getAllByRole('cell').at(-1)?.textContent).toBe('41.5');
    },
  );

  it('The company’s own fields are named and chosen in the language shown, a choice by its options’ names', async () => {
    openApp(at('EMP-0005'), { language: 'vi' });

    const licence = await screen.findByLabelText<HTMLSelectElement>('Bằng lái xe');
    expect(licence.value).toBe('c');
    expect([...licence.options].map((option) => option.text)).toEqual([
      'Không có',
      'Hạng B2',
      'Hạng C',
    ]);
    expect(screen.getByLabelText<HTMLInputElement>('Ngày vào làm').type).toBe('date');
    expect(screen.getByLabelText<HTMLInputElement>('Ngày vào làm').value).toBe('2023-08-21');
    expect(screen.getByLabelText<HTMLInputElement>('Số người phụ thuộc').value).toBe('2');
  });

  it('A value the company’s own field refuses is said at the field and nothing is saved, whatever the kind', async () => {
    const { api } = openApp(at('EMP-0005'));
    const dependants = await screen.findByLabelText('Dependants');

    await userEvent.clear(dependants);
    await userEvent.type(dependants, 'two');
    fireEvent.change(screen.getByLabelText('Vehicle plate'), {
      target: { value: 'x'.repeat(501) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A number, for example 3 or 3.5.')).toBeTruthy();
    expect(screen.getByText('Too long: at most 500 characters.')).toBeTruthy();
    expect(api.saveEmployee).not.toHaveBeenCalled();
    // the refusal goes as the value fits
    await userEvent.clear(dependants);
    await userEvent.type(dependants, '3');
    expect(screen.queryByText('A number, for example 3 or 3.5.')).toBeNull();
  });

  it('A form that drops a key it does not show erases it: this one keeps a key it does not know and a field turned off, and an emptied field removes its key', async () => {
    const { api } = openApp(at('EMP-0005'), {
      override: (spied, original) => {
        spied.getEmployee.mockImplementation(async (id) => {
          const read = await original.getEmployee(id);
          read.employee.extra = {
            ...read.employee.extra,
            legacy: { kept: true },
            personalPhone: 'x',
          };
          return read;
        });
      },
    });
    const plate = await screen.findByLabelText('Vehicle plate');
    await userEvent.clear(plate);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');

    const extra = api.saveEmployee.mock.calls[0]?.[1].extra;
    expect(extra).toEqual({
      phone: '0903 111 005',
      note: 'Lái xe tải nhỏ.',
      licence: 'c',
      started: '2023-08-21',
      dependants: 2,
      legacy: { kept: true },
      personalPhone: 'x',
    });
    // the emptied field's key is gone, not kept with nothing in it
    expect(Object.keys(extra ?? {})).not.toContain('plate');
  });

  it('The editor refuses fields it cannot take and says so: a field with no key, the same key twice, a choice with no options', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const refusedAs = 'A field needs a key nobody else has';

    await userEvent.click(screen.getByRole('button', { name: 'Add a field' }));
    await save();
    expect((await screen.findByRole('alert')).textContent).toContain(refusedAs);

    // the same key as another
    await userEvent.type(lastOf(/^Key/), 'plate');
    await userEvent.type(lastOf(/^Name in Vietnamese/), 'Biển');
    await userEvent.type(lastOf(/^Name in English/), 'Plate');
    await save();
    expect((await screen.findByRole('alert')).textContent).toContain(refusedAs);

    // a choice with an option, then without
    await userEvent.clear(lastOf(/^Key/));
    await userEvent.type(lastOf(/^Key/), 'colour');
    await userEvent.selectOptions(lastOf('Kind'), 'A choice from a list');
    await save();
    expect((await screen.findByRole('alert')).textContent).toContain(refusedAs);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add an option' }).at(-1) as HTMLElement,
    );
    await userEvent.type(lastOf('Option key'), 'red');
    await userEvent.type(lastOf('Option in Vietnamese'), 'Đỏ');
    await userEvent.type(lastOf('Option in English'), 'Red');
    expect(api.saveStaffSetup).not.toHaveBeenCalled();
    await save();
    await screen.findByText('Saved.');
    expect((await api.getStaffSetup()).setup.customFields?.at(-1)?.options).toEqual([
      { value: 'red', label: { vi: 'Đỏ', en: 'Red' } },
    ]);

    // an option and a field are removed
    await userEvent.click(screen.getByRole('button', { name: 'Remove the option red' }));
    expect(screen.queryByDisplayValue('red')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove colour' }));
    expect(screen.queryByDisplayValue('colour')).toBeNull();
  });

  it('An option is renamed in the language shown, and a company with no field of its own says so', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

    await userEvent.clear(screen.getAllByLabelText('Option in English')[0]);
    await userEvent.type(screen.getAllByLabelText('Option in English')[0], 'B2 class');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    const licence = (await api.getStaffSetup()).setup.customFields?.[0];
    expect(licence?.options.map((option) => option.label.en)).toEqual(['B2 class', 'Class C']);

    for (const key of ['licence', 'started', 'plate', 'dependants']) {
      await userEvent.click(screen.getByRole('button', { name: `Remove ${key}` }));
    }
    expect(screen.getAllByText('None yet.').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect((await api.getStaffSetup()).setup.customFields).toEqual([]);
  });

  it('A field’s key is fixed once it is saved', async () => {
    openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

    expect(screen.getByDisplayValue('licence').hasAttribute('readonly')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Add a field' }));
    expect(lastOf(/^Key/).hasAttribute('readonly')).toBe(false);
  });
});

describe('the numbering', () => {
  it('A code left empty is the next number under the company’s prefix and length (`EMP-` and 4 digits until the root sets them), counted past every code ever given, people who left included', async () => {
    const { api } = openApp('/staff/new');
    const code = await screen.findByLabelText<HTMLInputElement>(/^Code/);
    expect(code.required).toBe(false);
    await userEvent.type(screen.getByLabelText(/^Name/), 'Mai Linh');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText<HTMLInputElement>('Sign-in name')).toMatchObject({
      value: 'EMP-0009',
    });
    expect(api.addEmployee).toHaveBeenCalledWith({
      name: 'Mai Linh',
      extra: {},
      departmentId: null,
      positionId: null,
    });
  });

  it('The root sets the prefix and the digits, sees the first code they give, and a numbering the BFF would refuse is said and not sent', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    expect(screen.getByText('The first code would be EMP-0001.')).toBeTruthy();

    await userEvent.clear(screen.getByLabelText('Prefix'));
    await userEvent.type(screen.getByLabelText('Prefix'), 'nv');
    await userEvent.clear(screen.getByLabelText('Digits'));
    await userEvent.type(screen.getByLabelText('Digits'), '0');
    expect(screen.queryByText(/The first code would be/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('A prefix is up to 10');
    expect(api.saveStaffSetup).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Digits'));
    await userEvent.type(screen.getByLabelText('Digits'), '3');
    expect(screen.getByText('The first code would be NV001.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect((await api.getStaffSetup()).setup.numbering).toEqual({ prefix: 'NV', digits: 3 });
  });
});

describe('a code changed', () => {
  it('The root changes a person’s code: from then on they sign in with the new one, they are signed out everywhere, and nothing that names the person changes', async () => {
    const { api } = openApp(at('EMP-0004'));
    await userEvent.type(await screen.findByLabelText('New code'), 'nv-12');

    await userEvent.click(screen.getByRole('button', { name: 'Change the code' }));

    expect(
      await screen.findByText(/The code is now NV-12\. The person signs in with it/),
    ).toBeTruthy();
    expect(api.changeCode).toHaveBeenCalledWith(person('EMP-0004').id, {
      version: 'e1',
      code: 'nv-12',
    });
    expect(screen.getByText('NV-12')).toBeTruthy();
    expect(screen.getByText('Signs in with the code NV-12 and a password.')).toBeTruthy();
    // the same person, by id: their department is still theirs
    expect(screen.getByLabelText<HTMLSelectElement>('Department').selectedOptions[0]?.text).toBe(
      'Kho',
    );
  });

  it('A code already taken or not a code is said, and the person’s code is as it was', async () => {
    const { api } = openApp(at('EMP-0004'));
    const field = await screen.findByLabelText('New code');
    const change = () => userEvent.click(screen.getByRole('button', { name: 'Change the code' }));

    await userEvent.type(field, 'x');
    await change();
    expect(
      await screen.findByText('A code is 2 to 20 letters A to Z, digits or hyphens.'),
    ).toBeTruthy();
    expect(api.changeCode).not.toHaveBeenCalled();

    await userEvent.clear(field);
    await userEvent.type(field, 'emp-0008');
    await change();
    expect(await screen.findByText(/already belongs to someone/)).toBeTruthy();
    expect(screen.getByText('EMP-0004')).toBeTruthy();
  });

  it('A code change that fails says so, and one over someone else’s newer save offers the newer details', async () => {
    const failing = openApp(at('EMP-0004'), { cue: 'changeCode:503' });
    await userEvent.type(await screen.findByLabelText('New code'), 'nv-12');
    await userEvent.click(screen.getByRole('button', { name: 'Change the code' }));
    expect(await screen.findByText('The code was not changed: try again.')).toBeTruthy();
    failing.unmount();

    openApp(at('EMP-0004'), { cue: 'changeCode:409' });
    await userEvent.type(await screen.findByLabelText('New code'), 'nv-12');
    await userEvent.click(screen.getByRole('button', { name: 'Change the code' }));
    expect(await screen.findByText(/Someone saved newer details first/)).toBeTruthy();
  });

  it('Only the root changes a code: no one else is offered it, nor is a person who left', async () => {
    const office = openApp(at('EMP-0002'), { as: 'EMP-0001' });
    await screen.findByLabelText(/^Name/);
    expect(screen.queryByLabelText('New code')).toBeNull();
    office.unmount();

    openApp(at('EMP-0008'));
    await screen.findByText('This person left. Their record and code are kept.');
    expect(screen.queryByLabelText('New code')).toBeNull();
  });
});

describe('a photo', () => {
  const choose = (file = new File(['x'], 'face.png', { type: 'image/png' })) =>
    userEvent.upload(document.querySelector<HTMLInputElement>('input[type=file]')!, file);

  it('Someone allowed to change a person crops and saves a square photo, made small by the app, shown on the person’s page; the list shows initials', async () => {
    vi.mocked(shrinkToPhoto).mockResolvedValue(PHOTO);
    const { api } = openApp(at('EMP-0002'));
    expect(await screen.findByText('No photo yet.')).toBeTruthy();

    await choose();

    expect(await screen.findByText('The photo is saved.')).toBeTruthy();
    expect(api.savePhoto).toHaveBeenCalledWith(person('EMP-0002').id, {
      photo: PHOTO,
      version: '',
    });
    expect(screen.getByRole('img', { name: 'Trần Văn Hùng' }).getAttribute('src')).toBe(PHOTO);
    expect(screen.queryByText('No photo yet.')).toBeNull();
    // a second photo goes over the first, at the version it was saved at
    await choose();
    await waitFor(() => expect(api.savePhoto).toHaveBeenCalledTimes(2));
    expect(api.savePhoto).toHaveBeenLastCalledWith(person('EMP-0002').id, {
      photo: PHOTO,
      version: 'p1',
    });
    // the list shows initials, not the picture
    await userEvent.click(menu().getByRole('link', { name: 'Staff' }));
    const row = (await screen.findByText('Trần Văn Hùng')).closest('tr') as HTMLElement;
    expect(row.textContent).toContain('TV');
    expect(within(row).queryByRole('img')).toBeNull();
  });

  it('A photo the person already has is shown, and a file that cannot be used, a failed save and a newer photo are each said', async () => {
    vi.mocked(shrinkToPhoto).mockRejectedValueOnce(new Error('not a picture'));
    openApp(at('EMP-0003'));
    expect((await screen.findByRole('img', { name: 'Lê Minh Châu' })).getAttribute('src')).toBe(
      PHOTO,
    );
    expect(screen.queryByText('No photo yet.')).toBeNull();

    await choose();
    expect(await screen.findByText('That file could not be used as a photo.')).toBeTruthy();
  });

  it('A photo that fails to save says so, and one over someone else’s newer photo says that', async () => {
    vi.mocked(shrinkToPhoto).mockResolvedValue(PHOTO);
    const failing = openApp(at('EMP-0003'), { cue: 'savePhoto:503' });
    await screen.findByRole('img', { name: 'Lê Minh Châu' });
    await choose();
    expect(await screen.findByText('The photo was not saved: try again.')).toBeTruthy();
    failing.unmount();

    openApp(at('EMP-0003'), { cue: 'savePhoto:409' });
    await screen.findByRole('img', { name: 'Lê Minh Châu' });
    await choose();
    expect(await screen.findByText(/Someone saved a photo first/)).toBeTruthy();
  });

  it('A cancelled choice saves nothing', async () => {
    vi.mocked(shrinkToPhoto).mockClear();
    const { api } = openApp(at('EMP-0003'));
    await screen.findByRole('img', { name: 'Lê Minh Châu' });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
      target: { files: [] },
    });
    expect(shrinkToPhoto).not.toHaveBeenCalled();
    expect(api.savePhoto).not.toHaveBeenCalled();
  });

  it('A person who may only see has no way to change the photo', async () => {
    const { api } = openApp(at('EMP-0003'), { as: 'EMP-0004' });

    expect(await screen.findByRole('img', { name: 'Lê Minh Châu' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull();
    expect(api.savePhoto).not.toHaveBeenCalled();
  });
});

describe('search and filters', () => {
  const names = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('link')[0]?.textContent);

  it('Search finds a person by any word the list shows, the company’s own fields included, with or without accents and in any case', async () => {
    openApp('/staff');
    const search = await screen.findByLabelText('Search');
    await screen.findByText('Nguyễn Thị Lan');

    // a name without its marks, in any case
    await userEvent.type(search, 'NGUYEN lan');
    expect(names()).toEqual(['Nguyễn Thị Lan']);
    // a code, a department, a position and a phone
    for (const [typed, found] of [
      ['emp-0004', 'Phạm Quốc Bảo'],
      ['van phong quan ly', 'Nguyễn Thị Lan'],
      ['0903 111 006', 'Đặng Hoài Nam'],
      ['thuc tap', 'Đặng Hoài Nam'],
      // the company's own fields the list shows, a choice by its name in the language
      ['b2', 'Đặng Hoài Nam'],
      ['2023-08-21', 'Võ Thanh Tùng'],
    ] as const) {
      await userEvent.clear(search);
      await userEvent.type(search, typed);
      expect(names(), typed).toEqual([found].flat());
    }
    // nothing matches: the list says so, and a field not shown in the list is not searched
    await userEvent.clear(search);
    await userEvent.type(search, '51C-123.45');
    expect(
      await screen.findByText('No one matches. Change the search or the filters.'),
    ).toBeTruthy();
  });

  it('Search reads the language shown: a choice’s Vietnamese name finds it, and đ is d', async () => {
    openApp('/staff', { language: 'vi' });
    const search = await screen.findByLabelText('Tìm kiếm');
    await screen.findByText('Nguyễn Thị Lan');

    await userEvent.type(search, 'hang b2');
    expect(names()).toEqual(['Đặng Hoài Nam']);
    await userEvent.clear(search);
    await userEvent.type(search, 'dang hoai');
    expect(names()).toEqual(['Đặng Hoài Nam']);
  });

  it('Filters choose by department, position, whether they left, and the company’s choice fields', async () => {
    openApp('/staff');
    await screen.findByText('Nguyễn Thị Lan');

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Kho');
    expect(names()).toEqual(['Lê Minh Châu', 'Phạm Quốc Bảo']);
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Quản lý');
    expect(names()).toEqual(['Lê Minh Châu']);
    // people who left show with the filter, inside the others
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Nhân viên');
    await userEvent.click(screen.getByLabelText('Show people who left'));
    expect(names()).toEqual(['Phạm Quốc Bảo', 'Hoàng Gia Huy']);
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'All');
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'All');
    await userEvent.click(screen.getByLabelText('Show people who left'));
    // a choice field shown in the list
    await userEvent.selectOptions(screen.getByLabelText('Driving licence'), 'Class B2');
    expect(names()).toEqual(['Đặng Hoài Nam']);
    await userEvent.selectOptions(screen.getByLabelText('Driving licence'), 'All');
    expect(names()).toHaveLength(7);
    // a field that is not a choice, or not shown in the list, has no filter
    expect(screen.queryByLabelText('Vehicle plate')).toBeNull();
    expect(screen.queryByLabelText('Start date')).toBeNull();
  });

  it('The address keeps both, so a copied link opens the same list', async () => {
    const kho = DEMO_STAFF_SETUP.departments[0]?.id;
    openApp(`/staff?q=${encodeURIComponent('bảo')}&department=${kho}&left=1&f.licence=`);

    expect((await screen.findByLabelText<HTMLInputElement>('Search')).value).toBe('bảo');
    expect(names()).toEqual(['Phạm Quốc Bảo']);
    expect(screen.getByLabelText<HTMLSelectElement>('Department').value).toBe(kho);
    expect(screen.getByLabelText<HTMLInputElement>('Show people who left').checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('Driving licence').value).toBe('');
  });
});

describe('the person’s page keeps what the person did', () => {
  const choose = () =>
    userEvent.upload(
      document.querySelector<HTMLInputElement>('input[type=file]')!,
      new File(['x'], 'face.png', { type: 'image/png' }),
    );
  const typePhone = async (value: string) => {
    const phone = await screen.findByRole('textbox', { name: 'Phone' });
    await userEvent.clear(phone);
    await userEvent.type(phone, value);
  };

  it('A photo just saved stays shown after the details are saved, and the next photo goes over it at its version', async () => {
    vi.mocked(shrinkToPhoto).mockResolvedValue(PHOTO);
    const { api } = openApp(at('EMP-0002'));
    await screen.findByText('No photo yet.');
    await choose();
    await screen.findByText('The photo is saved.');

    await typePhone('0903 999 000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');

    expect(screen.queryByText('No photo yet.')).toBeNull();
    await choose();
    await waitFor(() => expect(api.savePhoto).toHaveBeenCalledTimes(2));
    expect(api.savePhoto).toHaveBeenLastCalledWith(person('EMP-0002').id, {
      photo: PHOTO,
      version: 'p1',
    });
    expect(screen.queryByText(/Someone saved a photo first/)).toBeNull();
  });

  it('A photo over someone else’s newer one says so and takes the newer photo, so the next try goes over it', async () => {
    vi.mocked(shrinkToPhoto).mockResolvedValue(PHOTO);
    const { api } = openApp(at('EMP-0002'), {
      override: (spied, original) => {
        // read at a version the fake no longer holds: the first save is over a moved photo
        spied.getPhoto.mockResolvedValueOnce({ photo: null, version: 'p0' });
        void original;
      },
    });
    await screen.findByText('No photo yet.');

    await choose();
    expect(await screen.findByText(/Someone saved a photo first/)).toBeTruthy();
    await choose();

    await waitFor(() => expect(api.savePhoto).toHaveBeenCalledTimes(2));
    expect(api.savePhoto).toHaveBeenNthCalledWith(1, person('EMP-0002').id, {
      photo: PHOTO,
      version: 'p0',
    });
    expect(api.savePhoto).toHaveBeenNthCalledWith(2, person('EMP-0002').id, {
      photo: PHOTO,
      version: '',
    });
    expect(await screen.findByText('The photo is saved.')).toBeTruthy();
  });

  it('A photo conflict that carries no newer photo is said all the same', async () => {
    vi.mocked(shrinkToPhoto).mockResolvedValue(PHOTO);
    openApp(at('EMP-0002'), {
      override: (spied) => {
        spied.savePhoto.mockResolvedValue({ kind: 'conflict', current: null });
      },
    });
    await screen.findByText('No photo yet.');

    await choose();

    expect(await screen.findByText(/Someone saved a photo first/)).toBeTruthy();
    expect(screen.getByText('No photo yet.')).toBeTruthy();
  });

  it('A person who left has no way to change the photo', async () => {
    openApp(at('EMP-0008'));
    await screen.findByText('This person left. Their record and code are kept.');

    expect(screen.getByRole('heading', { level: 3, name: 'Photo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull();
  });

  it('What was typed in the details survives a code change, and a problem said about one try is gone at the next', async () => {
    const { api } = openApp(at('EMP-0004'));
    await typePhone('0903 999 000');
    const field = screen.getByLabelText('New code');
    const change = () => userEvent.click(screen.getByRole('button', { name: 'Change the code' }));
    await userEvent.type(field, 'emp-0008');
    await change();
    expect(await screen.findByText(/already belongs to someone/)).toBeTruthy();

    await userEvent.clear(field);
    await userEvent.type(field, 'nv-12');
    await change();

    expect(await screen.findByText(/The code is now NV-12/)).toBeTruthy();
    expect(screen.queryByText(/already belongs to someone/)).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('New code').value).toBe('');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Phone' }).value).toBe(
      '0903 999 000',
    );
    // the save after it goes over the version the code change made
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(api.saveEmployee).toHaveBeenCalledWith(
      person('EMP-0004').id,
      expect.objectContaining({ version: 'e2' }),
    );
  });

  it('The words about a new code go when the newer details are read', async () => {
    const { api } = openApp(at('EMP-0004'));
    await userEvent.type(await screen.findByLabelText('New code'), 'nv-12');
    await userEvent.click(screen.getByRole('button', { name: 'Change the code' }));
    await screen.findByText(/The code is now NV-12/);
    api.saveEmployee.mockResolvedValueOnce({ kind: 'conflict' });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show the newer details' }));

    await screen.findByLabelText(/^Name/);
    expect(screen.queryByText(/The code is now NV-12/)).toBeNull();
  });

  it('A value kept on a person that no longer fits its field is theirs until another is typed: a removed choice is listed as itself, and only a changed value is refused', async () => {
    const { api } = openApp(at('EMP-0006'), {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const doc = await original.getStaffSetup();
          return {
            ...doc,
            setup: {
              ...doc.setup,
              customFields: doc.setup.customFields!.map((field) =>
                field.key === 'licence'
                  ? { ...field, options: field.options.filter((o) => o.value !== 'b2') }
                  : field,
              ),
            },
          };
        });
        spied.getEmployee.mockImplementation(async (id) => {
          const doc = await original.getEmployee(id);
          return {
            ...doc,
            employee: { ...doc.employee, extra: { ...doc.employee.extra, dependants: 'abc' } },
          };
        });
      },
    });
    const licence = await screen.findByLabelText<HTMLSelectElement>('Driving licence');
    expect(licence.value).toBe('b2');
    expect(licence.selectedOptions[0]?.textContent).toBe('b2');
    await typePhone('0903 999 000');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Saved.');
    expect(api.saveEmployee).toHaveBeenCalledTimes(1);
    expect(api.saveEmployee.mock.calls[0]?.[1].extra).toMatchObject({
      licence: 'b2',
      dependants: 'abc',
    });

    // another value typed in a field that still has its stored one is checked
    const dependants = screen.getByLabelText('Dependants');
    await userEvent.clear(dependants);
    await userEvent.type(dependants, 'two');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A number, for example 3 or 3.5.')).toBeTruthy();
    expect(api.saveEmployee).toHaveBeenCalledTimes(1);
  });
});

describe('the list and its address', () => {
  /** The address, and a way back in the history. */
  function Probe() {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    return (
      <>
        <output aria-label="address">{`${pathname}${search}`}</output>
        <button type="button" onClick={() => void navigate(-1)}>
          history back
        </button>
      </>
    );
  }
  const address = () => screen.getByLabelText('address').textContent;
  const appAt = (...entries: string[]) => {
    const { api, device } = sceneParts({ language: 'en' });
    render(
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <App api={api} device={device} test />
        <Probe />
      </MemoryRouter>,
    );
    return api;
  };

  it('A search or a filter replaces the address, so back leaves the list and does not step through its narrowings', async () => {
    appAt('/staff-setup', '/staff');
    await userEvent.type(await screen.findByLabelText('Search'), 'lan');
    await userEvent.selectOptions(screen.getByLabelText('Position'), 'Quản lý');
    await waitFor(() => expect(address()).toContain('q=lan&position='));

    await userEvent.click(screen.getByRole('button', { name: 'history back' }));

    await waitFor(() => expect(address()).toBe('/staff-setup'));
  });

  it('The menu’s Staff link clears the list’s address and the search box with it; history back to a searched list puts its word in the box', async () => {
    appAt('/staff?q=lan');
    const search = await screen.findByLabelText<HTMLInputElement>('Search');
    await screen.findByText('Nguyễn Thị Lan');
    expect(search.value).toBe('lan');

    await userEvent.click(menu().getByRole('link', { name: 'Staff' }));
    await screen.findByText('Trần Văn Hùng');
    expect(address()).toBe('/staff');
    expect(search.value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'history back' }));
    await waitFor(() => expect(address()).toBe('/staff?q=lan'));
    await waitFor(() => expect(screen.queryByText('Trần Văn Hùng')).toBeNull());
    expect(screen.getByLabelText<HTMLInputElement>('Search').value).toBe('lan');
  });

  it('Two narrowings before the router commits the first keep both', async () => {
    const { api } = sceneParts({ language: 'en' });
    const root = { name: 'root', root: true, permissions: {} };
    draw(
      <>
        <StaffListPage api={api} user={root} onSignedOut={() => {}} onForbidden={() => {}} />
        <Probe />
      </>,
    );
    const search = await screen.findByLabelText<HTMLInputElement>('Search');
    await screen.findByText('Nguyễn Thị Lan');
    const position = screen.getByLabelText<HTMLSelectElement>('Position');
    const manager = DEMO_STAFF_SETUP.positions[0].id;
    // Two discrete events with no render between, as two actions arriving inside one transition.
    const valueSetter = (prototype: object) =>
      // The native setter, called on the element: it does not use `this` of the descriptor.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set as (
        this: unknown,
        v: string,
      ) => void;
    const setValue = valueSetter(HTMLInputElement.prototype);
    const setSelect = valueSetter(HTMLSelectElement.prototype);
    const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    global.IS_REACT_ACT_ENVIRONMENT = false;
    setValue.call(search, 'phong');
    search.dispatchEvent(new Event('input', { bubbles: true }));
    setSelect.call(position, manager);
    position.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    global.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {});

    expect(address()).toBe(`/settings?q=phong&position=${manager}`);
  });

  it('A word typed and undone inside one router update leaves nothing behind: the menu’s Staff link then clears the box', async () => {
    const { api, device } = sceneParts({ language: 'en' });
    render(
      <MemoryRouter initialEntries={['/staff']}>
        <App api={api} device={device} test />
        <Probe />
      </MemoryRouter>,
    );
    const search = await screen.findByLabelText<HTMLInputElement>('Search');
    await screen.findByText('Nguyễn Thị Lan');
    // The native setter, called on the element.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set as (
      this: unknown,
      v: string,
    ) => void;
    const global = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    global.IS_REACT_ACT_ENVIRONMENT = false;
    for (const text of ['a', '', 'a']) {
      setValue.call(search, text);
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    global.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => {});
    expect(search.value).toBe('a');

    await userEvent.click(menu().getByRole('link', { name: 'Staff' }));

    await screen.findByText('Trần Văn Hùng');
    expect(address()).toBe('/staff');
    expect(screen.getByLabelText<HTMLInputElement>('Search').value).toBe('');
  });

  it('A criterion the page cannot show, a removed department or a field it does not list, narrows nothing', async () => {
    appAt('/staff?department=gone&position=gone&f.plate=51C&f.licence=zzz');
    await screen.findByLabelText('Search');
    await screen.findByText('Nguyễn Thị Lan');

    expect(screen.getByLabelText<HTMLSelectElement>('Department').value).toBe('');
    expect(screen.getByLabelText<HTMLSelectElement>('Driving licence').value).toBe('');
    expect(screen.queryByText('No one matches. Change the search or the filters.')).toBeNull();
    // the next narrowing drops them from the address
    await userEvent.type(screen.getByLabelText('Search'), 'lan');
    await waitFor(() => expect(address()).toBe('/staff?q=lan'));
  });

  it('A choice field the list does not show has no filter', async () => {
    openApp('/staff', {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const doc = await original.getStaffSetup();
          return {
            ...doc,
            setup: {
              ...doc.setup,
              customFields: doc.setup.customFields!.map((field) =>
                field.key === 'licence' ? { ...field, inList: false } : field,
              ),
            },
          };
        });
      },
    });
    await screen.findByText('Nguyễn Thị Lan');

    expect(screen.queryByLabelText('Driving licence')).toBeNull();
  });

  it('The page’s own Back returns to the list as it was narrowed, and to the bare list when the person was opened by address', async () => {
    appAt('/staff?q=lan');
    await userEvent.click(await screen.findByRole('link', { name: 'Nguyễn Thị Lan' }));
    await screen.findByRole('heading', { level: 2, name: 'Nguyễn Thị Lan' });

    await userEvent.click(screen.getByRole('link', { name: /Back/ }));

    expect((await screen.findByLabelText<HTMLInputElement>('Search')).value).toBe('lan');
    expect(address()).toBe('/staff?q=lan');
  });

  it('A person opened by address goes back to the bare list', async () => {
    appAt(at('EMP-0001'));
    await screen.findByRole('heading', { level: 2, name: 'Nguyễn Thị Lan' });

    await userEvent.click(screen.getByRole('link', { name: /Back/ }));

    await screen.findByLabelText('Search');
    expect(address()).toBe('/staff');
  });
});
