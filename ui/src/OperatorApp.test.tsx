import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawApp } from '../tests/render';
import { type Api, ApiError } from './api';
import { App } from './App';
import { createDeviceStore } from './device';
import { DICTIONARIES } from './i18n';

const made = {
  link: '/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};

const english = { 'credo.language': 'en' };

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** The app at the operator's address, on a device that may hold the operator's handle. */
function setup(
  overrides: Partial<Api> = {},
  kept: Record<string, string> = english,
  path = '/operator',
) {
  const device = createDeviceStore(memory(kept));
  const api = {
    getConfig: vi.fn(() => Promise.reject(new ApiError(404))),
    me: vi.fn(() => Promise.reject(new ApiError(401))),
    signIn: vi.fn(() => Promise.reject(new ApiError(401))),
    signOut: vi.fn(() => Promise.resolve()),
    saveConfig: vi.fn(() => Promise.reject(new ApiError(401))),
    operatorSignIn: vi.fn(() =>
      Promise.resolve({ authId: 'd.op', expiresAt: 1, operator: { name: 'operator' } }),
    ),
    operatorSignOut: vi.fn(() => Promise.resolve()),
    operatorMe: vi.fn(() => Promise.resolve({ operator: { name: 'operator' } })),
    makeClient: vi.fn(() => Promise.resolve({ kind: 'made' as const, client: made })),
    ...overrides,
  } satisfies Api;
  const drawn = drawApp(<App api={api} device={device} test />, path);
  return { api, device, ...drawn };
}

const signedIn = { ...english, 'credo.operator': 'd.op' };

async function signInAsOperator(name = 'operator', password = 'pw') {
  await userEvent.type(await screen.findByLabelText(/Username/), name);
  await userEvent.type(screen.getByLabelText(/Password/), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

async function makeAClient(code = 'minh-phat', name = 'Minh Phát') {
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

  it('The operator signs in with a name and a password, and lands on the form that makes a client', async () => {
    const { api, device } = setup();
    await signInAsOperator();

    expect(
      (await screen.findByRole('heading', { level: 2, name: 'Make a client' })).textContent,
    ).toBe('Make a client');
    expect(api.operatorSignIn).toHaveBeenCalledExactlyOnceWith('operator', 'pw');
    expect(device.operatorAuthId()).toBe('d.op');
    expect(device.authId()).toBeNull();
  });

  it('A refused sign-in says what to do, and a service that fails says it is unavailable and offers the form again', async () => {
    const operatorSignIn = vi
      .fn<Api['operatorSignIn']>()
      .mockRejectedValueOnce(new ApiError(401))
      .mockRejectedValueOnce(new ApiError(503));
    setup({ operatorSignIn });

    await signInAsOperator();
    expect((await screen.findByRole('alert')).textContent).toContain('Wrong username or password');

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
  });

  it('A reload keeps the sign-in; only the BFF’s 401 drops the handle', async () => {
    const first = setup({}, signedIn);
    expect(await screen.findByRole('heading', { level: 2, name: 'Make a client' })).toBeTruthy();
    expect(first.api.operatorMe).toHaveBeenCalledOnce();
    first.unmount();

    const refused = setup({ operatorMe: () => Promise.reject(new ApiError(401)) }, signedIn);
    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(refused.device.operatorAuthId()).toBeNull();
    refused.unmount();

    const operatorMe = vi
      .fn<Api['operatorMe']>()
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue({ operator: { name: 'operator' } });
    const down = setup({ operatorMe }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
    expect(down.device.operatorAuthId()).toBe('d.op');

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Make a client' })).toBeTruthy();
    expect(operatorMe).toHaveBeenCalledTimes(2);
  });

  it('The operator makes a client from a code and a name, and is shown once its link, its root’s name and its first password', async () => {
    const { api } = setup({}, signedIn);
    await makeAClient();

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(api.makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
    expect(screen.getByLabelText<HTMLInputElement>(/Link/).value).toBe(
      `${window.location.origin}/login?client-code=minh-phat`,
    );
    expect(screen.getByLabelText<HTMLInputElement>(/Root name/).value).toBe('root');
    expect(screen.getByLabelText<HTMLInputElement>(/First password/).value).toBe(made.password);

    await userEvent.click(screen.getByRole('button', { name: 'Make another client' }));

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
    expect(screen.queryByLabelText(/First password/)).toBeNull();
  });

  it('A make that fails says nothing was made, and what was typed stays', async () => {
    setup({ makeClient: () => Promise.reject(new ApiError(503)) }, signedIn);
    await makeAClient();

    expect((await screen.findByRole('alert')).textContent).toContain('The client was not made');
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
  });

  it('A make the BFF refuses with a 401 signs the operator out', async () => {
    const { device } = setup({ makeClient: () => Promise.reject(new ApiError(401)) }, signedIn);
    await makeAClient();

    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(device.operatorAuthId()).toBeNull();
  });

  it('Signing out ends it on that device, whether or not the service heard, and the next make starts empty', async () => {
    const { api, device } = setup(
      { operatorSignOut: () => Promise.reject(new ApiError(null)) },
      signedIn,
    );
    await makeAClient();
    await screen.findByLabelText(/First password/);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(device.operatorAuthId()).toBeNull();
    expect(document.body.innerHTML).not.toContain(made.password);
    expect(api.operatorMe).toHaveBeenCalledOnce();
  });

  it('speaks the language the device chose, else Vietnamese', async () => {
    setup({}, { 'credo.language': 'en' });
    expect(await screen.findByText(DICTIONARIES.en.operator.signIn)).toBeTruthy();
  });

  it('speaks Vietnamese on a device that chose nothing', async () => {
    setup({}, {});
    expect(await screen.findByText(DICTIONARIES.vi.operator.signIn)).toBeTruthy();
  });
});
