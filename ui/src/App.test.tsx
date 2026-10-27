import type { ConfigDoc, TenantConfig } from '@credo/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawApp } from '../tests/render';
import { type Api, ApiError } from './api';
import { App } from './App';
import { DICTIONARIES } from './i18n';
import { createDeviceStore } from './device';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'en',
};
const doc: ConfigDoc = { config, version: 'v1' };
const root = { name: 'root', root: true };

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** An API whose every call answers well unless the test says otherwise. */
function setup(overrides: Partial<Api> = {}, kept: Record<string, string> = {}) {
  const storage = memory(kept);
  const device = createDeviceStore(storage);
  const api = {
    getConfig: vi.fn(() => Promise.resolve(doc)),
    me: vi.fn(() => Promise.resolve({ user: root })),
    signIn: vi.fn(() => Promise.resolve({ authId: 'd.s', expiresAt: 1, user: root })),
    signOut: vi.fn(() => Promise.resolve()),
    saveConfig: vi.fn(() =>
      Promise.resolve({ kind: 'saved' as const, doc: { config, version: 'v2' } }),
    ),
    ...overrides,
  } satisfies Api;
  const drawn = drawApp(<App api={api} device={device} test />);
  return { api, device, storage, ...drawn };
}

/** The brand colour the page is drawn in, as Mantine's variable holds it. */
const brandColour = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--mantine-color-brand-7');

const signedIn = { 'credo.session': 'd.s' };

async function signInAs(name = 'root', password = 'pw') {
  await userEvent.type(await screen.findByLabelText(/Username/), name);
  await userEvent.type(screen.getByLabelText(/Password/), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

describe('the app', () => {
  it('The sign-in already wears the company’s name, and asks nobody who they are', async () => {
    const { api } = setup();

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Minh Phát');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sign in to your account');
    expect(api.me).not.toHaveBeenCalled();
  });

  it('A session lasts a week; a reload keeps it', async () => {
    const { api } = setup({}, signedIn);

    expect((await screen.findAllByText('Settings')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'root' })).toBeTruthy();
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('Only the BFF’s 401 signs out: a handle it refuses is dropped', async () => {
    const { device } = setup({ me: () => Promise.reject(new ApiError(401)) }, signedIn);

    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(device.authId()).toBeNull();
  });

  it('Only the BFF’s 401 signs out: any other failure says the service is unavailable', async () => {
    const { device, unmount } = setup({ me: () => Promise.reject(new ApiError(503)) }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
    expect(device.authId()).toBe('d.s');
    unmount();

    setup({ me: () => Promise.reject(new TypeError('boom')) }, signedIn);
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
  });

  it('A config that does not parse stops the boot, and a retry boots again', async () => {
    const getConfig = vi
      .fn<Api['getConfig']>()
      .mockRejectedValueOnce(new ApiError(null))
      .mockResolvedValue(doc);
    setup({ getConfig });

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
    expect(screen.queryByLabelText(/Username/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.vi.common.retry }));
    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it('The root signs in and lands on the menu’s first page', async () => {
    const { api, device } = setup();
    await signInAs();

    expect((await screen.findByRole('heading', { level: 2, name: 'Settings' })).textContent).toBe(
      'Settings',
    );
    expect(api.signIn).toHaveBeenCalledExactlyOnceWith('root', 'pw');
    expect(device.authId()).toBe('d.s');
  });

  it('A refused sign-in says what to do, and a service that fails says it is unavailable', async () => {
    const signIn = vi
      .fn<Api['signIn']>()
      .mockRejectedValueOnce(new ApiError(401))
      .mockRejectedValueOnce(new ApiError(503));
    setup({ signIn });

    await signInAs();
    expect((await screen.findByRole('alert')).textContent).toContain('Wrong username or password');

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
  });

  it('Signing out ends it on that device, whether or not the service heard', async () => {
    const { api, device } = setup({ signOut: () => Promise.reject(new ApiError(null)) }, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(device.authId()).toBeNull();
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('With both languages each user switches in their menu, kept on that device', async () => {
    const first = setup({}, signedIn);
    expect((await screen.findAllByText('Settings')).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tiếng Việt' }));

    expect((await screen.findAllByText('Cài đặt')).length).toBeGreaterThan(0);
    expect(first.device.language()).toBe('vi');
    first.unmount();

    const second = createDeviceStore(first.storage);
    drawApp(<App api={first.api} device={second} test />);
    expect((await screen.findAllByText('Cài đặt')).length).toBeGreaterThan(0);
  });

  it('Opens in the company’s default language when the device chose none', async () => {
    setup();

    expect(await screen.findByText('Sign in to your account')).toBeTruthy();
  });

  it('A device that has booted before speaks the language it showed while the settings load or fail', async () => {
    setup({ getConfig: () => Promise.reject(new ApiError(503)) }, { 'credo.shown': 'en' });

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.en.common.unavailable,
    );
  });

  it('A device that never booted and chose nothing speaks Vietnamese until the settings load', async () => {
    setup({ getConfig: () => Promise.reject(new ApiError(503)) });

    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
  });

  it('Each successful boot keeps the language it showed: the choice, else the company’s default', async () => {
    const first = setup();
    await screen.findByText('Sign in to your account');
    expect(first.device.shownLanguage()).toBe('en');
    first.unmount();

    const chosen = setup({}, { 'credo.language': 'vi' });
    await screen.findByText(DICTIONARIES.vi.auth.title);
    expect(chosen.device.shownLanguage()).toBe('vi');
    chosen.unmount();

    const gone = setup(
      {
        getConfig: () =>
          Promise.resolve({ config: { ...config, languages: ['en'] }, version: 'v1' }),
      },
      { 'credo.language': 'vi', 'credo.shown': 'vi' },
    );
    await screen.findByText(DICTIONARIES.en.auth.title);
    expect(gone.device.shownLanguage()).toBe('en');
  });

  it('A language the company no longer offers gives way to its default', async () => {
    const saved = { config: { ...config, languages: ['en' as const] }, version: 'v2' };
    setup(
      { saveConfig: () => Promise.resolve({ kind: 'saved', doc: saved }) },
      {
        ...signedIn,
        'credo.language': 'vi',
      },
    );
    await screen.findAllByText('Cài đặt');

    await userEvent.click(
      await screen.findByRole('button', { name: DICTIONARIES.vi.settings.save }),
    );

    expect((await screen.findAllByText('Settings')).length).toBeGreaterThan(0);
  });

  it('The root sets the company’s name and colour; every screen shows them', async () => {
    const saved = {
      config: { ...config, name: 'Minh Phát Sài Gòn', colour: '#b4532a' },
      version: 'v2',
    };
    const saveConfig = vi.fn<Api['saveConfig']>(() =>
      Promise.resolve({ kind: 'saved', doc: saved }),
    );
    setup({ saveConfig }, { ...signedIn, 'credo.language': 'en' });

    const name = await screen.findByLabelText(/Company name/);
    expect(brandColour()).toBe('#2f7d6d');
    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát Sài Gòn');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Saved');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát Sài Gòn');
    expect(saveConfig).toHaveBeenCalledExactlyOnceWith(
      { ...config, name: 'Minh Phát Sài Gòn' },
      'v1',
    );
    expect(brandColour()).toBe('#b4532a');
  });

  it('A failed save says so and keeps what was typed', async () => {
    const saveConfig = vi.fn<Api['saveConfig']>(() => Promise.reject(new ApiError(503)));
    setup({ saveConfig }, signedIn);

    const name = await screen.findByLabelText(/Company name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Typed and kept');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('were not saved');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Typed and kept');
    expect(saveConfig).toHaveBeenCalledOnce();
  });

  it('A save the BFF refuses with a 400 says it was refused, not that the service is down, and keeps what was typed', async () => {
    const saveConfig = vi.fn<Api['saveConfig']>(() => Promise.reject(new ApiError(400)));
    setup({ saveConfig }, signedIn);

    const name = await screen.findByLabelText(/Company name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Typed and kept');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = (await screen.findByRole('alert')).textContent;
    expect(alert).toContain('were refused');
    expect(alert).not.toContain('try again');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Typed and kept');
  });

  it('A save refused with a 401 signs out', async () => {
    const { device } = setup({ saveConfig: () => Promise.reject(new ApiError(401)) }, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByLabelText(/Username/)).toBeTruthy();
    expect(device.authId()).toBeNull();
  });

  it('A save over a newer one is refused, and the page offers the newer one', async () => {
    const newer = { config: { ...config, name: 'Someone else’s name' }, version: 'v9' };
    const getConfig = vi.fn<Api['getConfig']>().mockResolvedValueOnce(doc).mockResolvedValue(newer);
    setup({ getConfig, saveConfig: () => Promise.resolve({ kind: 'conflict' }) }, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Someone saved newer');

    await userEvent.click(screen.getByRole('button', { name: 'Show the newer settings' }));

    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe(
        'Someone else’s name',
      ),
    );
    expect(screen.queryByText(/Someone saved newer/)).toBeNull();
  });

  it('A page that cannot reload the newer settings offers a retry', async () => {
    const getConfig = vi
      .fn<Api['getConfig']>()
      .mockResolvedValueOnce(doc)
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue(doc);
    setup({ getConfig, saveConfig: () => Promise.resolve({ kind: 'conflict' }) }, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show the newer settings' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText(/Company name/)).toBeTruthy();
  });

  it('sends any other path to the first page', async () => {
    const storage = memory(signedIn);
    const device = createDeviceStore(storage);
    const api = setup().api;
    drawApp(<App api={api} device={device} test />, '/nowhere');

    expect(await screen.findAllByRole('heading', { name: 'Settings' })).not.toHaveLength(0);
  });
});
