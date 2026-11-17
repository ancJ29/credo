import { DEMO_CLIENTS } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { type Api, ApiError } from '../../api';
import { ClientsPage } from './ClientsPage';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;
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
      [
        'Bình An',
        'binh-an',
        'home',
        '21 Oct 2026',
        words.operator.copyLink,
        `${words.operator.rootPassword}${words.operator.deleteClient}`,
      ],
      [
        'Old One',
        'old-one',
        'home',
        '—',
        words.operator.copyLink,
        `${words.operator.rootPassword}${words.operator.deleteClient}`,
      ],
    ]);
    expect(screen.getByRole('columnheader', { name: words.operator.colName })).toBeTruthy();
    expect(screen.getByRole('link', { name: words.operator.add }).getAttribute('href')).toBe(
      '/operator/clients/new',
    );
  });

  it('draws a Delete button on every row, naming its code, to the delete page', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />);

    expect(
      (
        await screen.findByRole('link', { name: `${words.operator.deleteClient}: binh-an` })
      ).getAttribute('href'),
    ).toBe('/operator/clients/binh-an/delete');
    expect(
      screen.getByRole('link', { name: `${words.operator.deleteClient}: old-one` }),
    ).toBeTruthy();
  });

  it('shows the day in the language shown', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />, 'vi');

    expect(await screen.findByText('21/10/2026')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: wordsVi.operator.colMade })).toBeTruthy();
  });

  it('copies a client’s sign-in link, this address and the link path', async () => {
    draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(
      await screen.findByRole('button', { name: `${words.operator.copyLink}: binh-an` }),
    );

    expect(copied).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/login?client-code=binh-an`,
    );
    expect(
      await screen.findByRole('button', { name: `${words.operator.copied}: binh-an` }),
    ).toBeTruthy();
  });

  it('From the operator’s address a client’s copied link is the company’s own address', async () => {
    vi.stubGlobal('location', new URL('https://operator.ridge.example.test/operator'));
    try {
      draw(<ClientsPage api={list(SOME) as unknown as Api} onSignedOut={vi.fn()} />);
      const user = userEvent.setup();
      const copied = vi.spyOn(navigator.clipboard, 'writeText');

      await user.click(
        await screen.findByRole('button', { name: `${words.operator.copyLink}: binh-an` }),
      );

      expect(copied).toHaveBeenCalledExactlyOnceWith('https://binh-an.ridge.example.test/login');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('With no client yet, the list says so and still offers to add the first', async () => {
    draw(<ClientsPage api={list([]) as unknown as Api} onSignedOut={vi.fn()} />);

    expect(await screen.findByText(words.operator.empty)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: words.operator.add })).toBeTruthy();
  });

  it('A list that cannot be loaded says so and offers to try again, which reads it again', async () => {
    const listClients = vi
      .fn<Api['listClients']>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue([item(DEMO_CLIENTS[0].code, 'Minh Phát', 1)]);
    const onSignedOut = vi.fn();
    draw(<ClientsPage api={{ listClients } as unknown as Api} onSignedOut={onSignedOut} />);

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.loadFailed);
    expect(screen.getByRole('link', { name: words.operator.add })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));

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
