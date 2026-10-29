import { DEMO_CLIENTS } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { type Api, ApiError } from './api';
import { ClientsPage } from './ClientsPage';

const list = (clients: Awaited<ReturnType<Api['listClients']>>) => ({
  listClients: vi.fn(() => Promise.resolve(clients)),
});
const item = (code: string, name: string, madeAt: number | null) => ({
  code,
  name,
  madeAt,
  link: `/login?client-code=${code}`,
});
const SOME = [
  item('binh-an', 'Bình An', Date.UTC(2026, 9, 21, 12)),
  item('old-one', 'Old One', null),
];

describe('ClientsPage', () => {
  it('lists each client’s name as made, code and made-on day, newest as the BFF answers, with a dash for none', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />);

    const rows = await screen.findAllByRole('row');
    expect(
      rows.map((row) =>
        within(row)
          .queryAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      [],
      ['Bình An', 'binh-an', '21 Oct 2026', 'Copy the link'],
      ['Old One', 'old-one', '—', 'Copy the link'],
    ]);
    expect(screen.getByRole('columnheader', { name: 'Name when made' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add a client' }).getAttribute('href')).toBe(
      '/operator/clients/new',
    );
  });

  it('shows the day in the language shown', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />, 'vi');

    expect(await screen.findByText('21/10/2026')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Ngày tạo' })).toBeTruthy();
  });

  it('copies a client’s sign-in link, this address and the link path', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(await screen.findByRole('button', { name: 'Copy the link: binh-an' }));

    expect(copied).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/login?client-code=binh-an`,
    );
    expect(await screen.findByRole('button', { name: 'Copied: binh-an' })).toBeTruthy();
  });

  it('With no client yet, the list says so and still offers to add the first', async () => {
    draw(<ClientsPage api={list([]) as unknown as Api} onSignedOut={vi.fn()} />);

    expect(await screen.findByText('No clients yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: 'Add a client' })).toBeTruthy();
  });

  it('A list that cannot be loaded says so and offers to try again, which reads it again', async () => {
    const listClients = vi
      .fn<Api['listClients']>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue([item(DEMO_CLIENTS[0].code, 'Minh Phát', 1)]);
    const onSignedOut = vi.fn();
    draw(<ClientsPage api={{ listClients } as unknown as Api} onSignedOut={onSignedOut} />);

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    expect(screen.getByRole('link', { name: 'Add a client' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Minh Phát')).toBeTruthy();
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('A 401 on the list signs the operator out', async () => {
    const onSignedOut = vi.fn();
    const api = { listClients: () => Promise.reject(new ApiError(401)) } as unknown as Api;
    draw(<ClientsPage api={api} onSignedOut={onSignedOut} />);

    await screen.findByRole('alert');
    expect(onSignedOut).toHaveBeenCalledOnce();
  });
});
