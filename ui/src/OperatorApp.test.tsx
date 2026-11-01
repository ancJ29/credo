import { passkeyCalls, staffCalls } from '../tests/unused';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawApp } from '../tests/render';
import { type Api, ApiError } from './api';
import { App } from './App';
import { PasskeyNotGiven } from './passkeys';
import { createDeviceStore } from './device';
import { DICTIONARIES } from './i18n';

const made = {
  link: '/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};

const english = { 'credo.language': 'en' };

const CLIENTS = [
  {
    code: 'binh-an',
    name: 'Bình An',
    madeAt: Date.UTC(2026, 9, 21, 12),
    link: '/login?client-code=binh-an',
  },
  { code: 'old-one', name: 'Old One', madeAt: null, link: '/login?client-code=old-one' },
];

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

const credential = {
  id: 'k',
  rawId: 'k',
  type: 'public-key' as const,
  response: {},
  clientExtensionResults: {},
};
const ONE = { id: 'o1', name: 'operator' };

/** The app at the operator's address, on a device that may hold the operator's handle. */
function setup(
  overrides: Partial<Api> = {},
  kept: Record<string, string> = english,
  path = '/operator',
  passkeys = { register: vi.fn(), authenticate: vi.fn(() => Promise.resolve(credential)) },
) {
  const device = createDeviceStore(memory(kept));
  const api = {
    getConfig: vi.fn(() => Promise.reject(new ApiError(404))),
    me: vi.fn(() => Promise.reject(new ApiError(401))),
    signIn: vi.fn(() => Promise.reject(new ApiError(401))),
    signOut: vi.fn(() => Promise.resolve()),
    saveConfig: vi.fn(() => Promise.reject(new ApiError(401))),
    ...passkeyCalls,
    operatorPasskeyOptions: vi.fn(() =>
      Promise.resolve({ options: { challenge: 'c' }, token: 't.s' }),
    ),
    operatorPasskeySignIn: vi.fn(() =>
      Promise.resolve({ authId: 'd.op', expiresAt: 1, operator: ONE }),
    ),
    operatorSignOut: vi.fn(() => Promise.resolve()),
    operatorMe: vi.fn(() => Promise.resolve({ operator: ONE })),
    makeClient: vi.fn(() => Promise.resolve({ kind: 'made' as const, client: made })),
    ...staffCalls,
    listClients: vi.fn(() => Promise.resolve(CLIENTS)),
    operatorServices: vi.fn(() => Promise.reject(new ApiError(null))),
    ...overrides,
  } satisfies Api;
  const drawn = drawApp(
    <App api={api} device={device} passkeys={passkeys} build="dev" test />,
    path,
  );
  return { api, device, passkeys, ...drawn };
}

const signedIn = { ...english, 'credo.operator': 'd.op' };

async function signInAsOperator() {
  await userEvent.click(await screen.findByRole('button', { name: 'Sign in with a passkey' }));
}

async function makeAClient(code = 'minh-phat', name = 'Minh Phát') {
  await userEvent.click(await screen.findByRole('link', { name: 'Add a client' }));
  await userEvent.type(await screen.findByLabelText(/Client code/), code);
  await userEvent.type(screen.getByLabelText(/Company name/), name);
  await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
}

describe('the operator’s page', () => {
  it('opens at /operator, in credo’s name and colour, and asks no company anything', async () => {
    const { api } = setup();

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Credo');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Operator sign-in');
    expect(
      getComputedStyle(document.documentElement).getPropertyValue('--mantine-color-brand-7'),
    ).toBe('#3e618c');
    expect(api.getConfig).not.toHaveBeenCalled();
    expect(api.operatorMe).not.toHaveBeenCalled();
  });

  it('opens at every address under /operator, and nowhere else', async () => {
    setup({}, english, '/operator/clients');
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe('Operator sign-in');
  });

  it('The operator signs in with a passkey alone, no name and no password typed, and lands on the dashboard: the clients list, the five sections and who is signed in', async () => {
    const { api, device, passkeys } = setup();
    expect(await screen.findByRole('button', { name: 'Sign in with a passkey' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/Password/)).toBeNull();
    await signInAsOperator();

    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(await screen.findByText('Bình An')).toBeTruthy();
    expect(screen.getByText('Operator')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'operator' })).toBeTruthy();
    expect(
      screen.getAllByRole('link', {
        name: /^(Clients|Operators|Services status|Usage and costs|Activity)$/,
      }),
    ).toHaveLength(5);
    expect(api.operatorPasskeyOptions).toHaveBeenCalledOnce();
    expect(passkeys.authenticate).toHaveBeenCalledExactlyOnceWith({ challenge: 'c' });
    expect(api.operatorPasskeySignIn).toHaveBeenCalledExactlyOnceWith({
      token: 't.s',
      response: credential,
    });
    expect(device.operatorAuthId()).toBe('d.op');
    expect(device.authId()).toBeNull();
  });

  it('A passkey not given says so, one that opens nothing here says so without saying why, and a service that fails says it is unavailable, never "no passkey"', async () => {
    const operatorPasskeySignIn = vi
      .fn<Api['operatorPasskeySignIn']>()
      .mockRejectedValueOnce(new ApiError(401))
      .mockRejectedValueOnce(new ApiError(503, true));
    const { passkeys } = setup({ operatorPasskeySignIn });
    passkeys.authenticate.mockRejectedValueOnce(new PasskeyNotGiven());

    await signInAsOperator();
    expect((await screen.findByRole('alert')).textContent).toBe(DICTIONARIES.en.passkey.notGiven);

    await signInAsOperator();
    expect(await screen.findByText(DICTIONARIES.en.passkey.refused)).toBeTruthy();

    await signInAsOperator();
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.operator.unavailableStorage,
    );
    expect(screen.queryByText(DICTIONARIES.en.passkey.refused)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(await screen.findByRole('button', { name: 'Sign in with a passkey' })).toBeTruthy();
  });

  it('A passkey that fails in the device for any cause but "not given" says the service is unavailable', async () => {
    const { passkeys } = setup();
    passkeys.authenticate.mockRejectedValueOnce(new Error('the library failed'));

    await signInAsOperator();

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
  });

  it('C: Before sign-in the unavailable screen names the hop: the BFF answered with its own 503 and c-storage did not, or the BFF did not answer, whatever the call that failed', async () => {
    const { passkeys } = setup({
      operatorPasskeyOptions: vi
        .fn<Api['operatorPasskeyOptions']>()
        .mockRejectedValueOnce(new ApiError(503, true))
        .mockRejectedValueOnce(new ApiError(503))
        .mockRejectedValueOnce(new ApiError(null)),
    });
    for (const [again, words] of [
      [false, DICTIONARIES.en.operator.unavailableStorage],
      [true, DICTIONARIES.en.operator.unavailableBff],
      [true, DICTIONARIES.en.operator.unavailableBff],
    ] as const) {
      if (again) {
        await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
      }
      await signInAsOperator();
      expect((await screen.findByRole('alert')).textContent).toContain(words);
    }
    expect(passkeys.authenticate).not.toHaveBeenCalled();
  });

  it('C: A reload that meets a BFF whose storage is silent, or a BFF that is silent, says which', async () => {
    const storage = setup({ operatorMe: () => Promise.reject(new ApiError(503, true)) }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.operator.unavailableStorage,
    );
    storage.unmount();

    setup({ operatorMe: () => Promise.reject(new ApiError(null)) }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.operator.unavailableBff,
    );
  });

  it('A reload keeps the sign-in; only the BFF’s 401 drops the handle', async () => {
    const first = setup({}, signedIn);
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(first.api.operatorMe).toHaveBeenCalledOnce();
    first.unmount();

    const refused = setup({ operatorMe: () => Promise.reject(new ApiError(401)) }, signedIn);
    expect(await screen.findByRole('button', { name: 'Sign in with a passkey' })).toBeTruthy();
    expect(refused.device.operatorAuthId()).toBeNull();
    refused.unmount();

    const operatorMe = vi
      .fn<Api['operatorMe']>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue({ operator: ONE });
    const down = setup({ operatorMe }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.operator.unavailableBff,
    );
    expect(down.device.operatorAuthId()).toBe('d.op');

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(operatorMe).toHaveBeenCalledTimes(2);
  });

  it('The operator makes a client from a code and a name, and is shown once its link, its root’s name and its first password', async () => {
    const { api } = setup({}, signedIn);
    await makeAClient();

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(api.makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Link/ }).value).toBe(
      `${window.location.origin}/login?client-code=minh-phat`,
    );
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Root name/ }).value).toBe('root');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /First password/ }).value).toBe(
      made.password,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add another client' }));

    expect(await screen.findByLabelText(/Client code/)).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(made.password);
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('');
  });

  it('A code typed in capitals, or with spaces around it, is lowered and trimmed before it is sent', async () => {
    const { api } = setup({}, signedIn);
    await makeAClient('  Minh-PHAT ');

    await screen.findByRole('heading', { level: 2, name: 'Client made' });
    expect(api.makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('A code already taken is refused, says so, and what was typed stays', async () => {
    setup({ makeClient: () => Promise.resolve({ kind: 'taken' }) }, signedIn);
    await makeAClient();

    expect((await screen.findByRole('alert')).textContent).toContain('nothing was changed');
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát');
    expect(screen.queryByRole('textbox', { name: /First password/ })).toBeNull();
  });

  it('A make that fails says nothing was made, and what was typed stays', async () => {
    setup({ makeClient: () => Promise.reject(new ApiError(503)) }, signedIn);
    await makeAClient();

    expect((await screen.findByRole('alert')).textContent).toContain('The client was not made');
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
  });

  it('A client added leads the list the operator goes back to, and the password is not on it', async () => {
    const listClients = vi
      .fn<Api['listClients']>()
      .mockResolvedValueOnce(CLIENTS)
      .mockResolvedValue([
        {
          code: 'minh-phat',
          name: 'Minh Phát',
          madeAt: Date.UTC(2026, 9, 29, 12),
          link: made.link,
        },
        ...CLIENTS,
      ]);
    setup({ listClients }, signedIn);
    await makeAClient();
    await userEvent.click(await screen.findByRole('link', { name: 'Back to the clients' }));

    const cells = await screen.findAllByRole('cell');
    expect(cells[0]?.textContent).toBe('Minh Phát');
    expect(cells[2]?.textContent).toBe('29 Oct 2026');
    expect(document.body.innerHTML).not.toContain(made.password);
  });

  it('A make the BFF refuses with a 401 opens the passkey prompt over the page, which stays with what was typed; the make is not sent again by itself, and one touch goes on', async () => {
    const makeClient = vi
      .fn<Api['makeClient']>()
      .mockRejectedValueOnce(new ApiError(401))
      .mockResolvedValue({ kind: 'made', client: made });
    const { device, api, passkeys } = setup({ makeClient }, signedIn);
    await makeAClient();

    expect(await screen.findByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát');
    expect(makeClient).toHaveBeenCalledOnce();
    expect(device.operatorAuthId()).toBe('d.op');

    await userEvent.click(screen.getByRole('button', { name: 'Use your passkey' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(passkeys.authenticate).toHaveBeenCalledOnce();
    expect(api.operatorPasskeySignIn).toHaveBeenCalledOnce();
    expect(makeClient).toHaveBeenCalledOnce();
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát');

    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(makeClient).toHaveBeenCalledTimes(2);
  });

  it('A passkey that names another operator starts the console over, dropping what was typed, and names them in the header', async () => {
    const operatorPasskeySignIn = vi.fn<Api['operatorPasskeySignIn']>().mockResolvedValue({
      authId: 'd.other',
      expiresAt: 1,
      operator: { id: 'o2', name: 'Ops Two' },
    });
    const { device } = setup(
      { makeClient: () => Promise.reject(new ApiError(401)), operatorPasskeySignIn },
      signedIn,
    );
    await makeAClient();
    await userEvent.click(await screen.findByRole('button', { name: 'Use your passkey' }));

    expect(await screen.findByRole('button', { name: 'Ops Two' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('');
    expect(device.operatorAuthId()).toBe('d.other');
  });

  it('The prompt says why it did not go on: the passkey not given, one that opens nothing here, or the service unavailable; and "Sign out" leaves for the door', async () => {
    const operatorPasskeySignIn = vi
      .fn<Api['operatorPasskeySignIn']>()
      .mockRejectedValueOnce(new ApiError(401))
      .mockRejectedValueOnce(new ApiError(503));
    const { device, passkeys } = setup(
      { listClients: () => Promise.reject(new ApiError(401)), operatorPasskeySignIn },
      signedIn,
    );
    passkeys.authenticate.mockRejectedValueOnce(new PasskeyNotGiven());
    const press = () => userEvent.click(screen.getByRole('button', { name: 'Use your passkey' }));
    const dialog = async () => await screen.findByRole('dialog');

    await dialog();
    await press();
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
        DICTIONARIES.en.passkey.notGiven,
      ),
    );
    await press();
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
        DICTIONARIES.en.passkey.refused,
      ),
    );
    await press();
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
        DICTIONARIES.en.common.unavailable,
      ),
    );

    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in with a passkey' })).toBeTruthy();
    expect(device.operatorAuthId()).toBeNull();
  });

  it('Signing out ends it on that device, whether or not the service heard, and the next make starts empty', async () => {
    const { api, device } = setup(
      { operatorSignOut: () => Promise.reject(new ApiError(null)) },
      signedIn,
    );
    await makeAClient();
    await screen.findByRole('textbox', { name: /First password/ });

    await userEvent.click(screen.getByRole('button', { name: 'operator' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in with a passkey' })).toBeTruthy();
    expect(device.operatorAuthId()).toBeNull();
    expect(document.body.innerHTML).not.toContain(made.password);
    expect(api.operatorMe).toHaveBeenCalledOnce();
  });

  it('speaks the language the device chose, else Vietnamese', async () => {
    setup({}, { 'credo.language': 'en' });
    expect(await screen.findByText(DICTIONARIES.en.operator.signIn)).toBeTruthy();
  });

  it('the join page speaks the language the device chose, else Vietnamese', async () => {
    const link = `/operator/join#${'l'.repeat(43)}`;
    const first = setup({}, {}, link);
    expect(await screen.findByText(DICTIONARIES.vi.passkey.joinTitle)).toBeTruthy();
    first.unmount();

    setup({}, english, link);
    expect(await screen.findByText(DICTIONARIES.en.passkey.joinTitle)).toBeTruthy();
  });

  it('speaks Vietnamese on a device that chose nothing', async () => {
    setup({}, {});
    expect(await screen.findByText(DICTIONARIES.vi.operator.signIn)).toBeTruthy();
  });

  it('Each section has its own address, and the three not built are one page: the section’s name and “coming soon”, calling nothing', async () => {
    const { api } = setup({}, signedIn, '/operator/usage');
    expect(await screen.findByRole('heading', { level: 2, name: 'Usage and costs' })).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(api.listClients).not.toHaveBeenCalled();

    for (const [section, title] of [
      ['Operators', 'Operators'],
      ['Activity', 'Activity'],
    ]) {
      await userEvent.click(screen.getByRole('link', { name: section }));
      expect(await screen.findByRole('heading', { level: 2, name: title })).toBeTruthy();
      expect(screen.getByText('Coming soon')).toBeTruthy();
    }
    expect(api.listClients).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('link', { name: 'Services status' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Services status' })).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();

    await userEvent.click(screen.getByRole('link', { name: 'Clients' }));
    expect(await screen.findByText('Bình An')).toBeTruthy();
  });

  it('/operator, /operator/clients and any unknown path under /operator open the list', async () => {
    for (const path of ['/operator', '/operator/clients', '/operator/nowhere']) {
      const { unmount } = setup({}, signedIn, path);
      expect(await screen.findByText('Bình An'), path).toBeTruthy();
      unmount();
    }
  });

  it('The header names the operator the sign-in answered, and the one `me` answers after a reload', async () => {
    const first = setup({
      operatorPasskeySignIn: () =>
        Promise.resolve({ authId: 'd.op', expiresAt: 1, operator: { id: 'o1', name: 'Ops One' } }),
    });
    await signInAsOperator();
    expect(await screen.findByRole('button', { name: 'Ops One' })).toBeTruthy();
    first.unmount();

    setup(
      { operatorMe: () => Promise.resolve({ operator: { id: 'o1', name: 'Ops Two' } }) },
      signedIn,
    );
    expect(await screen.findByRole('button', { name: 'Ops Two' })).toBeTruthy();
  });

  it('The language chosen in the header is kept on the device and the page speaks it', async () => {
    const { device } = setup({}, signedIn);
    await userEvent.click(await screen.findByRole('button', { name: 'operator' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tiếng Việt' }));

    expect(device.language()).toBe('vi');
    expect(await screen.findByRole('heading', { level: 2, name: 'Khách hàng' })).toBeTruthy();
    expect(screen.getByText('21/10/2026')).toBeTruthy();
  });

  it('A 401 on the list opens the prompt over the page and keeps the handle until a passkey replaces it', async () => {
    const { device } = setup({ listClients: () => Promise.reject(new ApiError(401)) }, signedIn);

    expect(await screen.findByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(device.operatorAuthId()).toBe('d.op');
  });

  it('A list that cannot be loaded keeps the operator signed in and offers another try', async () => {
    const listClients = vi
      .fn<Api['listClients']>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue(CLIENTS);
    const { device } = setup({ listClients }, signedIn);

    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    expect(device.operatorAuthId()).toBe('d.op');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bình An')).toBeTruthy();
  });
});
