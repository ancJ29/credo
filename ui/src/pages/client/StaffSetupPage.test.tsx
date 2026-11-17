import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;
/** A label that carries a star is found by its word at the start, as the dictionary spells it. */
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
/** One user for the file, with no wait on the event loop between the actions it makes: the default
 * `delay: 0` hands control back to the loop after every key and click, which a loaded machine
 * stretches; the events themselves, and what the page does with them, are the same. */
const user = userEvent.setup({ delay: null });
/** The line under a permission that works only with seeing the staff list. */
const NEEDS = words.permissions.needs.replace('{{what}}', words.permissions.staff_canView);

/** Three long stories (dozens of keystrokes on Mantine's inputs, then a save and a re-read) take
 * 1 to 1.4 s alone and over 5 s in a whole `pnpm check` with other worktrees' gates running: named
 * slow here, one by one, while the default timeout stands for every other test. */
const SLOW = { timeout: 20_000 };

describe('the staff setup page', () => {
  it(
    'The root keeps the company’s departments and positions, adding, renaming and removing them; a person names theirs by its id, so a rename follows them, and a removed one shows on them as it was saved',
    SLOW,
    async () => {
      const { api } = openApp('/staff-setup');
      await screen.findByRole('heading', { level: 2, name: words.setup.title });

      // add one, rename one, remove one
      await user.click(screen.getByRole('button', { name: words.setup.add }));
      const names = screen.getAllByRole('textbox', { name: starting(words.setup.name) });
      await user.type(names[3], 'Bếp');
      const warehouse = screen.getByDisplayValue('Kho');
      await user.clear(warehouse);
      await user.type(warehouse, 'Kho hàng');
      await user.click(screen.getByRole('button', { name: `${words.setup.remove} Giao hàng` }));
      await user.click(screen.getByRole('button', { name: words.setup.save }));

      expect((await screen.findByText(words.setup.saved)).textContent).toBe(words.setup.saved);
      const saved = await api.getStaffSetup();
      expect(saved.setup.departments.map((unit) => unit.name)).toEqual([
        'Kho hàng',
        'Văn phòng',
        'Bếp',
      ]);
      // the new one was given an id, the others kept theirs
      expect(saved.setup.departments.every((unit) => unit.id.length > 0)).toBe(true);
      expect(saved.setup.departments[0]?.id).toBe(DEMO_STAFF_SETUP.departments[0]?.id);

      // on the list: the rename follows each person, the removed one stays as it was saved
      await user.click(
        within(screen.getAllByRole('navigation', { name: words.nav.menu })[0]).getByRole('link', {
          name: words.nav.staff,
        }),
      );
      const warehouseStaff = (await screen.findAllByText('Phạm Quốc Bảo'))
        .at(-1)
        ?.closest('tr') as HTMLElement;
      expect(within(warehouseStaff).getByText('Kho hàng')).toBeTruthy();
      const delivery = screen.getAllByText('Võ Thanh Tùng').at(-1)?.closest('tr') as HTMLElement;
      expect(within(delivery).getByText('Giao hàng')).toBeTruthy();
    },
  );

  it('The setup page switches the start date, the birth date and the address on and off and saves them, in English and in Vietnamese', async () => {
    const { api } = openApp('/staff-setup');
    const start = await screen.findByRole('checkbox', { name: words.setup.fieldStartDate });
    const birth = screen.getByRole('checkbox', { name: words.setup.fieldBirthDate });
    const address = screen.getByRole('checkbox', { name: words.setup.fieldAddress });
    // on in the data set
    expect([start, birth, address].map((box) => (box as HTMLInputElement).checked)).toEqual([
      true,
      true,
      true,
    ]);

    await user.click(start);
    await user.click(birth);
    await user.click(address);
    await user.click(start);
    await user.click(address);
    await user.click(screen.getByRole('button', { name: words.setup.save }));
    await screen.findByText(words.setup.saved);
    expect((await api.getStaffSetup()).setup.fields).toMatchObject({
      startDate: true,
      birthDate: false,
      address: true,
    });
    await user.click(birth);
    expect((birth as HTMLInputElement).checked).toBe(true);
  });

  it('The setup page names the three switches in Vietnamese', async () => {
    openApp('/staff-setup', { language: 'vi' });

    for (const name of [
      wordsVi.setup.fieldStartDate,
      wordsVi.setup.fieldBirthDate,
      wordsVi.setup.fieldAddress,
    ]) {
      expect(await screen.findByRole('checkbox', { name })).toBeTruthy();
    }
  });

  it('Piece 2’s permissions are to see the staff list, to add a person, to change a person’s name and details, and to archive a person; the root sets them at any of the three levels', async () => {
    openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });

    const labels = [
      words.permissions.staff_canView,
      words.permissions.staff_canCreate,
      words.permissions.staff_canEdit,
      words.permissions.staff_canDelete,
      words.permissions.settings_canEdit,
      words.permissions.orders_canView,
      words.permissions.orders_canEdit,
      words.permissions.deliveries_canDeliver,
    ];
    // a department takes each as a choice, in the catalogue's order
    const office = screen
      .getByDisplayValue('Văn phòng')
      .closest('.mantine-Paper-root') as HTMLElement;
    const boxes = within(office).getAllByRole('checkbox');
    expect(
      boxes.map((box) => (box.closest('.mantine-Checkbox-root') as HTMLElement).textContent),
    ).toEqual(labels);
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([
      true,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
    // a position takes each as allow, refuse or as the level above
    const trainee = screen
      .getByDisplayValue('Thực tập')
      .closest('.mantine-Paper-root') as HTMLElement;
    const edit = within(trainee).getByRole('radiogroup', {
      name: `Thực tập: ${words.permissions.staff_canEdit}`,
    });
    expect(
      within(edit).getByRole<HTMLInputElement>('radio', { name: words.permissions.refuse }).checked,
    ).toBe(true);
    expect(within(trainee).getAllByRole('radiogroup')).toHaveLength(8);
  });

  it('A permission that works only with seeing the staff list says so under itself while seeing is refused, at a department and at a position', async () => {
    openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    const paper = (name: string) =>
      screen.getByDisplayValue(name).closest('.mantine-Paper-root') as HTMLElement;
    const needs = (name: string) => within(paper(name)).queryAllByText(NEEDS);
    expect(needs('Văn phòng')).toHaveLength(0);

    // the office stops seeing: the two it still allows say so, the one it never allowed does not
    const office = within(paper('Văn phòng')).getAllByRole('checkbox');
    await user.click(office[0]);
    expect(needs('Văn phòng')).toHaveLength(2);
    expect((office[1].closest('.mantine-Checkbox-root') as HTMLElement).textContent).toContain(
      NEEDS,
    );
    expect((office[3].closest('.mantine-Checkbox-root') as HTMLElement).textContent).not.toContain(
      NEEDS,
    );
    await user.click(office[3]);
    expect(needs('Văn phòng')).toHaveLength(3);
    await user.click(office[0]);
    expect(needs('Văn phòng')).toHaveLength(0);

    // a position that refuses seeing and allows adding says so; one that leaves seeing to the
    // department above does not, since the page cannot know that department
    const staff = (label: string) =>
      within(paper('Nhân viên')).getByRole('radiogroup', { name: `Nhân viên: ${label}` });
    await user.click(
      within(staff(words.permissions.staff_canCreate)).getByText(words.permissions.allow),
    );
    expect(needs('Nhân viên')).toHaveLength(0);
    await user.click(
      within(staff(words.permissions.staff_canView)).getByText(words.permissions.refuse),
    );
    expect(needs('Nhân viên')).toHaveLength(1);
    await user.click(
      within(staff(words.permissions.staff_canView)).getByText(words.permissions.inherit),
    );
    expect(needs('Nhân viên')).toHaveLength(0);
  });

  it('A department that never said anything about seeing, and allows changing, says it needs seeing', async () => {
    openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    await user.click(screen.getByRole('button', { name: words.setup.add }));
    const fresh = screen.getAllByRole('textbox', { name: starting(words.setup.name) })[3];
    const paper = fresh.closest('.mantine-Paper-root') as HTMLElement;
    const boxes = within(paper).getAllByRole('checkbox');
    expect(within(paper).queryAllByText(NEEDS)).toHaveLength(0);

    await user.click(boxes[3]);

    expect(within(paper).queryAllByText(NEEDS)).toHaveLength(1);
  });

  it('The root’s save over newer ones is refused and what was typed is kept, and a failed save says so and keeps it too', async () => {
    const { api } = openApp('/staff-setup', { cue: 'saveStaffSetup:409' });
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    const warehouse = screen.getByDisplayValue('Kho');
    await user.clear(warehouse);
    await user.type(warehouse, 'Kho mới');

    await user.click(screen.getByRole('button', { name: words.setup.save }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.setup.conflict);
    expect(screen.getByDisplayValue('Kho mới')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: words.setup.conflictReload }));
    expect(await screen.findByDisplayValue('Kho')).toBeTruthy();
    expect(api.getStaffSetup).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so and keeps what was typed', async () => {
    openApp('/staff-setup', { cue: 'saveStaffSetup:503' });
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    await user.type(screen.getByDisplayValue('Kho'), ' 2');

    await user.click(screen.getByRole('button', { name: words.setup.save }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.setup.saveFailed);
    expect(screen.getByDisplayValue('Kho 2')).toBeTruthy();
  });

  it('A department stores only what it allows, and a position what it allows or refuses; what is left alone is stored as nothing', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    const paper = (name: string) =>
      screen.getByDisplayValue(name).closest('.mantine-Paper-root') as HTMLElement;

    // the warehouse stops seeing and starts archiving; the delivery hands start seeing
    const warehouse = within(paper('Kho')).getAllByRole('checkbox');
    await user.click(warehouse[0]);
    await user.click(warehouse[3]);
    await user.click(within(paper('Giao hàng')).getAllByRole('checkbox')[0]);
    // the staff position refuses archiving; the manager's allowance is left as the level above
    const staff = within(paper('Nhân viên')).getByRole('radiogroup', {
      name: `Nhân viên: ${words.permissions.staff_canDelete}`,
    });
    await user.click(within(staff).getByText(words.permissions.refuse));
    const manager = within(paper('Quản lý')).getByRole('radiogroup', {
      name: `Quản lý: ${words.permissions.staff_canDelete}`,
    });
    await user.click(within(manager).getByText(words.permissions.inherit));
    await user.click(screen.getByRole('button', { name: words.setup.save }));

    expect(await screen.findByText(words.setup.saved)).toBeTruthy();
    const { setup } = await api.getStaffSetup();
    expect(setup.departments.map((unit) => unit.permissions)).toEqual([
      { 'staff.canDelete': true },
      {
        'staff.canView': true,
        'staff.canCreate': true,
        'staff.canEdit': true,
        'orders.canView': true,
        'orders.canEdit': true,
      },
      { 'staff.canView': true, 'deliveries.canDeliver': true },
    ]);
    expect(setup.positions.map((unit) => unit.permissions)).toEqual([
      {},
      { 'staff.canDelete': false },
      { 'staff.canEdit': false },
    ]);
  });

  it('A department loaded holding a stored `false` is saved without it, and a position keeps its refusals', async () => {
    const { api } = openApp('/staff-setup', {
      override: (spied, original) => {
        spied.getStaffSetup.mockImplementation(async () => {
          const doc = await original.getStaffSetup();
          const [first, ...rest] = doc.setup.departments;
          if (!first) throw new Error('the data set holds a department');
          return {
            ...doc,
            setup: {
              ...doc.setup,
              departments: [
                { ...first, permissions: { 'staff.canView': true, 'staff.canDelete': false } },
                ...rest,
              ],
            },
          };
        });
      },
    });
    await screen.findByRole('heading', { level: 2, name: words.setup.title });

    await user.click(screen.getByRole('button', { name: words.setup.save }));

    expect(await screen.findByText(words.setup.saved)).toBeTruthy();
    const saved = vi.mocked(api.saveStaffSetup).mock.calls[0]?.[0];
    expect(saved?.departments[0]?.permissions).toEqual({ 'staff.canView': true });
    expect(saved?.positions.map((unit) => unit.permissions)).toEqual([
      { 'staff.canDelete': true },
      {},
      { 'staff.canEdit': false },
    ]);
  });

  it('A save the BFF refuses as it is says so and keeps what was typed; with every position removed the page says none yet', async () => {
    openApp('/staff-setup', {
      override: (api) => {
        vi.mocked(api.saveStaffSetup).mockRejectedValue(new ApiError(400));
      },
    });
    await screen.findByRole('heading', { level: 2, name: words.setup.title });
    for (const name of ['Quản lý', 'Nhân viên', 'Thực tập']) {
      await user.click(screen.getByRole('button', { name: `${words.setup.remove} ${name}` }));
    }
    expect(screen.getByText(words.setup.none)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: words.setup.save }));

    expect((await screen.findByRole('alert')).textContent).toContain(words.setup.saveRefused);
    expect(screen.getByText(words.setup.none)).toBeTruthy();
  });
});
