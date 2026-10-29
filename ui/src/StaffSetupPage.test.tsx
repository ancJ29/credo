import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';

describe('the staff setup page', () => {
  it('The root keeps the company’s departments and positions, adding, renaming and removing them; a person names theirs by its id, so a rename follows them, and a removed one shows on them as it was saved', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

    // add one, rename one, remove one
    await userEvent.click(screen.getByRole('button', { name: 'Add a department' }));
    const names = screen.getAllByRole('textbox', { name: /^Name/ });
    await userEvent.type(names[3], 'Bếp');
    const warehouse = screen.getByDisplayValue('Kho');
    await userEvent.clear(warehouse);
    await userEvent.type(warehouse, 'Kho hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Giao hàng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByText('Saved.')).textContent).toBe('Saved.');
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
    await userEvent.click(screen.getByRole('link', { name: 'Staff' }));
    const warehouseStaff = (await screen.findByText('Phạm Quốc Bảo')).closest('tr') as HTMLElement;
    expect(within(warehouseStaff).getByText('Kho hàng')).toBeTruthy();
    const delivery = screen.getByText('Võ Thanh Tùng').closest('tr') as HTMLElement;
    expect(within(delivery).getByText('Giao hàng')).toBeTruthy();
  });

  it('Piece 2’s permissions are to see the staff list, to add a person, to change a person’s name and details, and to archive a person; the root sets them at any of the three levels', async () => {
    openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

    const labels = [
      'See the staff list',
      'Add a person',
      'Change a person’s name and details',
      'Archive a person',
      'Change the company’s settings',
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
    ]);
    // a position takes each as allow, refuse or as the level above
    const trainee = screen
      .getByDisplayValue('Thực tập')
      .closest('.mantine-Paper-root') as HTMLElement;
    const edit = within(trainee).getByRole('radiogroup', {
      name: 'Thực tập: Change a person’s name and details',
    });
    expect(within(edit).getByRole<HTMLInputElement>('radio', { name: 'Refuse' }).checked).toBe(
      true,
    );
    expect(within(trainee).getAllByRole('radiogroup')).toHaveLength(5);
  });

  it('The root’s save over newer ones is refused and what was typed is kept, and a failed save says so and keeps it too', async () => {
    const { api } = openApp('/staff-setup', { cue: 'saveStaffSetup:409' });
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    const warehouse = screen.getByDisplayValue('Kho');
    await userEvent.clear(warehouse);
    await userEvent.type(warehouse, 'Kho mới');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Someone saved newer ones first',
    );
    expect(screen.getByDisplayValue('Kho mới')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show the newer ones' }));
    expect(await screen.findByDisplayValue('Kho')).toBeTruthy();
    expect(api.getStaffSetup).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so and keeps what was typed', async () => {
    openApp('/staff-setup', { cue: 'saveStaffSetup:503' });
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    await userEvent.type(screen.getByDisplayValue('Kho'), ' 2');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was saved');
    expect(screen.getByDisplayValue('Kho 2')).toBeTruthy();
  });

  it('A department stores only what it allows, and a position what it allows or refuses; what is left alone is stored as nothing', async () => {
    const { api } = openApp('/staff-setup');
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    const paper = (name: string) =>
      screen.getByDisplayValue(name).closest('.mantine-Paper-root') as HTMLElement;

    // the warehouse stops seeing and starts archiving; the delivery hands start seeing
    const warehouse = within(paper('Kho')).getAllByRole('checkbox');
    await userEvent.click(warehouse[0]);
    await userEvent.click(warehouse[3]);
    await userEvent.click(within(paper('Giao hàng')).getAllByRole('checkbox')[0]);
    // the staff position refuses archiving; the manager's allowance is left as the level above
    const staff = within(paper('Nhân viên')).getByRole('radiogroup', {
      name: 'Nhân viên: Archive a person',
    });
    await userEvent.click(within(staff).getByText('Refuse'));
    const manager = within(paper('Quản lý')).getByRole('radiogroup', {
      name: 'Quản lý: Archive a person',
    });
    await userEvent.click(within(manager).getByText('As the level above'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    const { setup } = await api.getStaffSetup();
    expect(setup.departments.map((unit) => unit.permissions)).toEqual([
      { 'staff.canDelete': true },
      { 'staff.canView': true, 'staff.canCreate': true, 'staff.canEdit': true },
      { 'staff.canView': true },
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
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
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
    await screen.findByRole('heading', { level: 2, name: 'Departments and positions' });
    for (const name of ['Quản lý', 'Nhân viên', 'Thực tập']) {
      await userEvent.click(screen.getByRole('button', { name: `Remove ${name}` }));
    }
    expect(screen.getByText('None yet.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('refused as they are');
    expect(screen.getByText('None yet.')).toBeTruthy();
  });
});
