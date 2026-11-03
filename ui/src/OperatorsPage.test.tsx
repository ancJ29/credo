import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const open = (options: Parameters<typeof openApp>[1] = {}) =>
  openApp('/operator/operators', { operator: true, ...options });

/** The rows of the list, as their cells' texts. */
const rows = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );

describe('the operators of the console', () => {
  it('B1 row 1: lists everyone who may sign in, the last added first: name, state, adder, day added, passkeys, last sign-in; the reader marked “you”', async () => {
    const { api } = open();

    expect(await screen.findByRole('heading', { level: 2, name: 'Operators' })).toBeTruthy();
    await screen.findAllByRole('row');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name',
      'State',
      'Added by',
      'Added on',
      'Passkeys',
      'Last sign-in',
    ]);
    expect(rows()).toEqual([
      ['Lan Anh', 'Invited', 'operator', '29 Oct 2026', '0', '—'],
      ['Minh Quân', 'Active', '—', '12 Oct 2026', '1', '27 Oct 2026'],
      ['operatoryou', 'Active', 'the command line', '5 Oct 2026', '2', '30 Oct 2026'],
    ]);
    expect(screen.getAllByText('you')).toHaveLength(1);
    expect(api.listOperators).toHaveBeenCalledOnce();
    // no client’s data is read for this page
    expect(api.listClients).not.toHaveBeenCalled();
  });

  it('B1 row 1: says it in Vietnamese, the days as the day first', async () => {
    open({ language: 'vi' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Người vận hành' })).toBeTruthy();
    await screen.findAllByRole('row');
    expect(rows()[0]).toEqual(['Lan Anh', 'Đã mời', 'operator', '29/10/2026', '0', '—']);
    expect(rows()[2]?.[0]).toBe('operatorbạn');
    expect(rows()[2]?.[2]).toBe('dòng lệnh');
  });

  it('B1 row 1: the menu’s Operators opens it, and Add an operator leads to the create page', async () => {
    openApp('/operator/clients', { operator: true });
    await userEvent.click(await screen.findByRole('link', { name: 'Operators' }));

    expect(await screen.findByRole('cell', { name: 'Minh Quân' })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: words.team.add }));
    expect(
      await screen.findByRole('heading', { level: 2, name: words.team.newTitle }),
    ).toBeTruthy();
  });

  it('B1: a list that cannot be loaded offers another try', async () => {
    open({ cue: 'listOperators:503' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(await screen.findByRole('cell', { name: 'Minh Quân' })).toBeTruthy();
  });

  it('B1: a 401 on the list opens the sign-in prompt over the page', async () => {
    open({ cue: 'listOperators:401' });

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
  });
});
