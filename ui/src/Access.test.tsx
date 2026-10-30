import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { openApp, person, type Spied } from '../tests/open';
import { draw } from '../tests/render';
import { sceneParts } from './scene';
import { StaffListPage } from './StaffListPage';

const menu = () => within(screen.getByRole('navigation', { name: 'Menu' }));
const forbidden = () =>
  screen.findByRole('heading', { level: 2, name: 'You cannot open this page' });

/** Someone with a page but not the staff list: only the settings are theirs. */
const onlySettings = (spied: Spied) => {
  spied.me.mockResolvedValue({
    user: { name: 'Hạnh', root: false, permissions: { 'settings.canEdit': true } },
  });
};

describe('a route guard', () => {
  it('Every page opens by its address only for someone whose menu lists it: the 403 page stands in for the rest, and the page’s data is not asked', async () => {
    for (const path of [
      '/staff',
      `/staff/${person('EMP-0002').id}`,
      '/staff-setup',
      '/staff/new',
    ]) {
      const drawn = openApp(path, { override: onlySettings });

      expect(await forbidden(), path).toBeTruthy();
      expect(
        menu()
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Settings']);
      expect(drawn.api.listEmployees, path).not.toHaveBeenCalled();
      expect(drawn.api.getEmployee, path).not.toHaveBeenCalled();
      expect(drawn.api.getStaffSetup, path).not.toHaveBeenCalled();
      drawn.unmount();
    }
  });

  it('Someone who may see the staff list opens a person by its address, and the root opens every page', async () => {
    const reader = openApp(`/staff/${person('EMP-0002').id}`, { as: 'EMP-0004' });
    expect(await screen.findByDisplayValue('Trần Văn Hùng')).toBeTruthy();
    reader.unmount();

    for (const [path, heading] of [
      ['/settings', 'Settings'],
      ['/staff', 'Staff'],
      ['/staff-setup', 'Departments and positions'],
      ['/staff/new', 'Add a person'],
    ] as const) {
      const root = openApp(path);
      expect(await screen.findByRole('heading', { level: 2, name: heading }), path).toBeTruthy();
      root.unmount();
    }
  });
});

describe('Settings by permission', () => {
  it('A department, a position or a person may be allowed to change the company’s settings: the page is in their menu and they save', async () => {
    const { api } = openApp('/staff', { as: 'EMP-0003' });

    await screen.findByRole('heading', { level: 2, name: 'Staff' });
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Settings', 'Staff']);
    await userEvent.click(menu().getByRole('link', { name: 'Settings' }));
    const name = await screen.findByLabelText(/^Company name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/^Saved\./)).toBeTruthy();
    expect(api.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Minh Phát 2' }),
      'v1',
    );
  });

  it('Someone not allowed finds no Settings in the menu, and its address says so', async () => {
    const { api } = openApp('/settings', { as: 'EMP-0001' });

    expect(await forbidden()).toBeTruthy();
    expect(menu().queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(api.getConfig).toHaveBeenCalledTimes(1);
  });

  it('The root gives the permission to a department on the setup page, and its people are offered it', async () => {
    const { api } = openApp('/staff-setup');
    const delivery = (await screen.findByDisplayValue('Giao hàng')).closest(
      '.mantine-Paper-root',
    ) as HTMLElement;

    await userEvent.click(
      within(delivery).getByRole('checkbox', { name: 'Change the company’s settings' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    const saved = (await api.getStaffSetup()).setup.departments[2];
    expect(saved?.permissions).toEqual({ 'settings.canEdit': true });
  });
});

/** The list drawn bare, with the address it keeps beside it. */
function Probe() {
  return <output aria-label="address">{useLocation().search}</output>;
}

describe('the list’s address', () => {
  const root = { name: 'root', root: true, permissions: {} };
  const drawn = () => {
    const { api } = sceneParts({ language: 'en' });
    return draw(
      <>
        <StaffListPage api={api} user={root} onSignedOut={() => {}} onForbidden={() => {}} />
        <Probe />
      </>,
    );
  };
  const address = () => screen.getByLabelText('address').textContent;

  it('The address keeps both: what is typed and chosen is written once set, and cleared when emptied', async () => {
    drawn();
    const search = await screen.findByLabelText('Search');

    expect(address()).toBe('');
    await userEvent.type(search, 'lan');
    expect(address()).toBe('?q=lan');
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Kho');
    await userEvent.click(screen.getByLabelText('Show people who left'));
    await userEvent.selectOptions(screen.getByLabelText('Driving licence'), 'Class C');
    expect(address()).toBe(
      `?q=lan&department=${DEMO_STAFF_SETUP.departments[0]?.id}&left=1&f.licence=c`,
    );
    await userEvent.clear(search);
    await userEvent.selectOptions(screen.getByLabelText('Department'), 'All');
    await userEvent.click(screen.getByLabelText('Show people who left'));
    await userEvent.selectOptions(screen.getByLabelText('Driving licence'), 'All');
    expect(address()).toBe('');
  });

  it('A syllable being composed is not written to the address half-way, and the whole of it is when it ends', async () => {
    drawn();
    const search = await screen.findByLabelText<HTMLInputElement>('Search');

    fireEvent.compositionStart(search);
    fireEvent.change(search, { target: { value: 'ng' } });
    fireEvent.change(search, { target: { value: 'ngu' } });
    expect(search.value).toBe('ngu');
    expect(address()).toBe('');
    fireEvent.compositionEnd(search);
    expect(address()).toBe('?q=ngu');
    // and typing after goes on as before
    await userEvent.type(search, 'y');
    expect(address()).toBe('?q=nguy');
  });
});
