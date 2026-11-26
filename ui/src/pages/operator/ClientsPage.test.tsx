import { DEMO_CLIENTS } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
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

describe('17: the waiting companies above the list', () => {
  const sentAt = Date.UTC(2026, 10, 3, 12);
  const waiting = {
    code: 'son-ha',
    name: 'Sơn Hà Vật Liệu',
    contactName: 'Lê Minh Châu',
    contactPhone: '0903 555 012',
    sentAt,
  };
  const apiOf = (extra: Partial<Record<keyof Api, unknown>> = {}) => {
    const api = {
      listClients: vi.fn(() => Promise.resolve(SOME)),
      listSignUps: vi.fn(() => Promise.resolve([waiting])),
      approveSignUp: vi.fn(() => Promise.resolve({ kind: 'approved' as const, link: '/login' })),
      refuseSignUp: vi.fn(() => Promise.resolve()),
      ...extra,
    };
    draw(<ClientsPage api={api as unknown as Api} onSignedOut={vi.fn()} />);
    return api;
  };
  const approve = () =>
    userEvent.click(
      screen.getByRole('button', { name: `${words.operator.approve}: ${waiting.name}` }),
    );
  const refuse = () =>
    userEvent.click(
      screen.getByRole('button', { name: `${words.operator.refuse}: ${waiting.name}` }),
    );

  it('lists each waiting company’s name, address, contact and day asked, with Approve and Refuse, above the companies', async () => {
    apiOf();

    const heading = await screen.findByRole('heading', {
      level: 3,
      name: words.operator.waitingTitle,
    });
    const rows = screen.getAllByRole('row');
    const waitingRow = rows.find((row) => within(row).queryByText(waiting.name) !== null)!;
    expect(
      within(waitingRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      waiting.name,
      waiting.code,
      `${waiting.contactName} · ${waiting.contactPhone}`,
      '3 Nov 2026',
      `${words.operator.approve}${words.operator.refuse}`,
    ]);
    // above the companies: the waiting block's heading comes before the first company's row
    const firstCompany = rows.find((row) => within(row).queryByText('Bình An') !== null)!;
    expect(
      heading.compareDocumentPosition(firstCompany) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no block where none waits, and none where the list cannot be read', async () => {
    apiOf({ listSignUps: vi.fn(() => Promise.resolve([])) });
    await screen.findByRole('table');
    expect(screen.queryByRole('heading', { name: words.operator.waitingTitle })).toBeNull();
  });

  it('shows no block while the companies’ list is not read, so a failed page says the one thing', async () => {
    apiOf({ listClients: vi.fn(() => Promise.reject(new ApiError(503, true))) });

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: words.operator.waitingTitle })).toBeNull();
    expect(screen.queryByText(waiting.name)).toBeNull();
  });

  it('shows no block where the list cannot be read, and the companies still show', async () => {
    apiOf({ listSignUps: vi.fn(() => Promise.reject(new ApiError(null))) });

    expect(await screen.findByText('Bình An')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: words.operator.waitingTitle })).toBeNull();
  });

  it('approves a company: says so by its name, takes it off the waiting rows and reads the companies again', async () => {
    const api = apiOf();
    await screen.findByText(waiting.name);

    await approve();

    expect((await screen.findByRole('status')).textContent).toContain(
      words.operator.approved.replace('{{name}}', waiting.name),
    );
    expect(api.approveSignUp).toHaveBeenCalledExactlyOnceWith('son-ha');
    expect(
      screen.queryByRole('button', { name: `${words.operator.approve}: ${waiting.name}` }),
    ).toBeNull();
    expect(api.listClients).toHaveBeenCalledTimes(2);
  });

  it('keeps the request where the address was made meanwhile or the call fails, and says so', async () => {
    const api = apiOf({
      approveSignUp: vi
        .fn()
        .mockResolvedValueOnce({ kind: 'taken' })
        .mockRejectedValueOnce(new ApiError(503)),
    });
    await screen.findByText(waiting.name);

    await approve();
    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.taken);
    await approve();
    await screen.findByText(words.operator.approveFailed);

    expect(api.approveSignUp).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('button', { name: `${words.operator.approve}: ${waiting.name}` }),
    ).toBeTruthy();
  });

  it('asks before a refusal: Keep it waiting keeps the request and sends nothing, the confirm removes it', async () => {
    const api = apiOf();
    await screen.findByText(waiting.name);

    await refuse();
    expect(
      screen.getByText(words.operator.refuseAsk.replace('{{name}}', waiting.name)),
    ).toBeTruthy();
    expect(api.refuseSignUp).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: words.operator.refuseCancel }));
    expect(
      screen.queryByText(words.operator.refuseAsk.replace('{{name}}', waiting.name)),
    ).toBeNull();
    expect(api.refuseSignUp).not.toHaveBeenCalled();

    await refuse();
    await userEvent.click(screen.getByRole('button', { name: words.operator.refuseConfirm }));

    await waitFor(() => expect(screen.queryByText(waiting.name)).toBeNull());
    expect(api.refuseSignUp).toHaveBeenCalledExactlyOnceWith('son-ha');
  });

  it('says a refusal that failed, and keeps the request', async () => {
    apiOf({ refuseSignUp: vi.fn(() => Promise.reject(new ApiError(503))) });
    await screen.findByText(waiting.name);

    await refuse();
    await userEvent.click(screen.getByRole('button', { name: words.operator.refuseConfirm }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);
    expect(screen.getByText(waiting.name)).toBeTruthy();
  });

  it('a signed-out operator is sent to sign in when a waiting call is refused with a 401', async () => {
    const onSignedOut = vi.fn();
    const api = {
      listClients: vi.fn(() => Promise.resolve(SOME)),
      listSignUps: vi.fn(() => Promise.resolve([waiting])),
      approveSignUp: vi.fn(() => Promise.reject(new ApiError(401, true))),
      refuseSignUp: vi.fn(),
    };
    draw(<ClientsPage api={api as unknown as Api} onSignedOut={onSignedOut} />);
    await screen.findByText(waiting.name);

    await approve();

    await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
  });
});
