import type { ConfigDoc, TenantConfig } from '@credo/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { drawApp } from '../tests/render';
import { noPasskeys, passkeyCalls, staffCalls } from '../tests/unused';
import { type Api, ApiError } from './api';
import { App } from './App';
import { DICTIONARIES, LANGUAGE_NAMES } from './i18n';
import { createDeviceStore, type DeviceStore } from './device';
import { PasskeyNotGiven, type Passkeys } from './passkeys';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: null,
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'en',
  formattedName: '',
  description: '',
};
const doc: ConfigDoc = { config, version: 'v1' };
const root = { name: 'root', root: true, permissions: {} };

const memory = (initial: Record<string, string> = {}) => {
  const kept = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
};

/** A device already linked to a client, as one is after its link was opened once. */
const linked = { 'credo.client': 'minh-phat' };
/** A device that never opened a link. */
const unlinked = { 'credo.client': null };

/** An API whose every call answers well unless the test says otherwise, on a device already
 * linked to a client unless `kept` says `unlinked`. */
function setup(
  overrides: Partial<Api> | ((device: DeviceStore) => Partial<Api>) = {},
  kept: Record<string, string | null> = {},
  path = '/',
  address?: string,
  tab?: ReturnType<typeof memory>,
  passkeys: Passkeys = noPasskeys,
) {
  const initial = Object.entries({ ...linked, ...kept }).flatMap(([key, value]) =>
    value === null ? [] : [[key, value] as const],
  );
  const storage = memory(Object.fromEntries(initial));
  const device = createDeviceStore(storage, tab);
  const api = {
    getConfig: vi.fn(() => Promise.resolve(doc)),
    me: vi.fn(() => Promise.resolve({ user: root })),
    signIn: vi.fn(() => Promise.resolve({ authId: 'd.s', expiresAt: 1, user: root })),
    signOut: vi.fn(() => Promise.resolve()),
    saveConfig: vi.fn(() =>
      Promise.resolve({ kind: 'saved' as const, doc: { config, version: 'v2' } }),
    ),
    operatorSignOut: vi.fn(() => Promise.resolve()),
    operatorMe: vi.fn(() => Promise.reject(new ApiError(401))),
    makeClient: vi.fn(() => Promise.reject(new ApiError(null))),
    listOperators: vi.fn(() => Promise.reject(new ApiError(null))),
    addOperator: vi.fn(() => Promise.reject(new ApiError(null))),
    newOperatorLink: vi.fn(() => Promise.reject(new ApiError(null))),
    deleteOperator: vi.fn(() => Promise.reject(new ApiError(null))),
    deleteClient: vi.fn(() => Promise.reject(new ApiError(null))),
    moveClient: vi.fn(() => Promise.reject(new ApiError(null))),
    setRootPassword: vi.fn(() => Promise.reject(new ApiError(null))),
    operatorServices: vi.fn(() => Promise.reject(new ApiError(null))),
    operatorBoxes: vi.fn(() => Promise.reject(new ApiError(null))),
    ...staffCalls,
    ...passkeyCalls,
    ...(typeof overrides === 'function' ? overrides(device) : overrides),
  } satisfies Api;
  const drawn = drawApp(
    <App api={api} device={device} passkeys={passkeys} build="dev" test address={address} />,
    path,
  );
  return { api, device, storage, tab, ...drawn };
}

/** The brand colour the page is drawn in, as Mantine's variable holds it. */
const brandColour = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--mantine-color-brand-7');

const signedIn = { 'credo.session': 'd.s' };

async function signInAs(name = 'root', password = 'pw') {
  await userEvent.type(await screen.findByLabelText(labelled(words.auth.username)), name);
  await userEvent.type(screen.getByLabelText(labelled(words.auth.password)), password);
  await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
}

describe('the app', () => {
  it('The sign-in already wears the company’s name, and asks nobody who they are', async () => {
    const { api } = setup();

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Minh Phát');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.auth.title);
    expect(api.me).not.toHaveBeenCalled();
  });

  it('A session lasts a week; a reload keeps it', async () => {
    const { api } = setup({}, signedIn);

    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'root' })).toBeTruthy();
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('Only the BFF’s 401 signs out: a handle it refuses is dropped', async () => {
    const { device } = setup({ me: () => Promise.reject(new ApiError(401)) }, signedIn);

    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
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
    expect(screen.queryByLabelText(labelled(words.auth.username))).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.vi.common.retry }));
    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it('The root signs in and lands on the menu’s first page, the orders', async () => {
    const { api, device } = setup();
    await signInAs();

    expect(
      (await screen.findByRole('heading', { level: 2, name: words.nav.orders })).textContent,
    ).toBe(words.nav.orders);
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
    expect((await screen.findByRole('alert')).textContent).toBe(words.auth.refused);

    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
  });

  it('16: A sign-in made to wait says for how long, and a 429 of no wait’s shape says the service is unavailable', async () => {
    const signIn = vi
      .fn<Api['signIn']>()
      .mockRejectedValueOnce(new ApiError(429, false, 30))
      .mockRejectedValueOnce(new ApiError(429));
    setup({ signIn });

    await signInAs();
    expect((await screen.findByRole('alert')).textContent).toBe(
      words.wait.seconds.replace('{{count}}', '30'),
    );

    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      DICTIONARIES.vi.common.unavailable,
    );
  });

  it('Signing out ends it on that device, whether or not the service heard', async () => {
    const { api, device } = setup({ signOut: () => Promise.reject(new ApiError(null)) }, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));

    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(device.authId()).toBeNull();
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('7: A sign-in with the tick off keeps its handle in the tab alone, and signing out clears it there', async () => {
    const tab = memory();
    const { api, device, storage } = setup({}, {}, '/', undefined, tab);
    await userEvent.click(await screen.findByRole('checkbox', { name: words.auth.remember }));
    await signInAs();

    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(api.signIn).toHaveBeenCalledExactlyOnceWith('root', 'pw');
    expect(tab.getItem('credo.session')).toBe('d.s');
    expect(storage.getItem('credo.session')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));
    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(device.authId()).toBeNull();
    expect(tab.getItem('credo.session')).toBeNull();
  });

  it('7: A sign-in with the tick left on keeps its handle on the device, and the request is the name and the password alone', async () => {
    const tab = memory();
    const { api, storage } = setup({}, {}, '/', undefined, tab);
    await signInAs();

    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(api.signIn).toHaveBeenCalledExactlyOnceWith('root', 'pw');
    expect(storage.getItem('credo.session')).toBe('d.s');
    expect(tab.getItem('credo.session')).toBeNull();
  });

  it('10: A 401 clears a handle kept in the tab', async () => {
    const tab = memory({ 'credo.session': 'd.s' });
    const { device } = setup(
      { me: () => Promise.reject(new ApiError(401)) },
      {},
      '/',
      undefined,
      tab,
    );

    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(device.authId()).toBeNull();
    expect(tab.getItem('credo.session')).toBeNull();
  });

  it.each([
    ['11: A password changed keeps the new session on the device where the old one was', true],
    ['11: A password changed keeps the new session in the tab where the old one was', false],
  ])('%s', async (_name, onDevice) => {
    const tab = memory(onDevice ? {} : { 'credo.session': 'd.s' });
    const { storage } = setup(
      {
        changePassword: () =>
          Promise.resolve({
            kind: 'changed' as const,
            session: { authId: 'n.s', expiresAt: 2, user: root },
          }),
      },
      onDevice ? signedIn : {},
      '/password',
      undefined,
      tab,
    );
    await userEvent.type(await screen.findByLabelText(words.ownPassword.current), 'old');
    await userEvent.type(screen.getByLabelText(words.ownPassword.new), 'Aa1!aaaa');
    await userEvent.type(screen.getByLabelText(words.ownPassword.again), 'Aa1!aaaa');
    await userEvent.click(screen.getByRole('button', { name: words.ownPassword.submit }));

    await screen.findByText(words.ownPassword.changed);
    expect(onDevice ? storage.getItem('credo.session') : tab.getItem('credo.session')).toBe('n.s');
    expect(onDevice ? tab.getItem('credo.session') : storage.getItem('credo.session')).toBeNull();
  });

  it('12: A QR code’s sign-in keeps the phone’s handle on the device', async () => {
    const tab = memory();
    const link = `/login?client-code=minh-phat&qr=${crypto.randomUUID()}.${'a'.repeat(32)}`;
    const { storage } = setup(
      {
        signInQr: () => Promise.resolve({ authId: 'q.s', expiresAt: 1, user: root }),
      },
      {},
      link,
      undefined,
      tab,
    );

    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(storage.getItem('credo.session')).toBe('q.s');
    expect(tab.getItem('credo.session')).toBeNull();
  });

  it('With both languages each user switches from the header’s button, kept on that device', async () => {
    const first = setup({}, signedIn);
    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: words.user.language }));
    await userEvent.click(screen.getByRole('menuitem', { name: LANGUAGE_NAMES.vi }));

    expect((await screen.findAllByText(wordsVi.nav.settings)).length).toBeGreaterThan(0);
    expect(first.device.language()).toBe('vi');
    first.unmount();

    const second = createDeviceStore(first.storage);
    drawApp(<App api={first.api} device={second} passkeys={noPasskeys} build="dev" test />);
    expect((await screen.findAllByText(wordsVi.nav.settings)).length).toBeGreaterThan(0);
  });

  it('4: More opens at its own address with the other pages, the password, the passkey and sign-out, and the toggle’s state is kept on the device', async () => {
    const { device } = setup({}, signedIn, '/more');
    const main = () => within(document.querySelector('main')!);
    await screen.findByRole('heading', { level: 2, name: words.nav.more });
    expect((await main().findAllByRole('link')).map((link) => link.getAttribute('href'))).toEqual([
      '/staff-setup',
      '/customers',
      '/products',
      '/password',
      '/passkey',
    ]);
    expect(device.menuShown()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: words.nav.hideMenu }));
    expect(device.menuShown()).toBe(false);
  });

  it('18: The root’s user menu lists Add a passkey after Change password, and it opens the add page', async () => {
    setup({}, signedIn);

    await userEvent.click(await screen.findByRole('button', { name: 'root' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      words.user.password,
      words.user.passkey,
      words.user.signOut,
    ]);
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.passkey }));

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskey.title }),
    ).toBeTruthy();
  });

  it('4: A person with no page still has More', async () => {
    setup(
      { me: vi.fn(() => Promise.resolve({ user: { name: 'x', root: false, permissions: {} } })) },
      signedIn,
      '/more',
    );

    expect(await screen.findByRole('button', { name: words.user.signOut })).toBeTruthy();
  });

  it('Opens in the company’s default language when the device chose none', async () => {
    setup();

    expect(await screen.findByText(words.auth.title)).toBeTruthy();
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
    await screen.findByText(words.auth.title);
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
      '/settings',
    );
    await screen.findAllByText(wordsVi.nav.settings);

    await userEvent.click(
      await screen.findByRole('button', { name: DICTIONARIES.vi.settings.save }),
    );

    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
  });

  it('4: until the save the app around the settings page keeps the saved name and colour, the preview wears the typed ones, and after it the app wears them', async () => {
    const saved = {
      config: { ...config, name: 'Minh Phát Sài Gòn', colour: '#b4532a' },
      version: 'v2',
    };
    const saveConfig = vi.fn<Api['saveConfig']>(() =>
      Promise.resolve({ kind: 'saved', doc: saved }),
    );
    setup({ saveConfig }, { ...signedIn, 'credo.language': 'en' }, '/settings');

    const name = await screen.findByLabelText(labelled(words.settings.name));
    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát Sài Gòn');
    await userEvent.clear(screen.getByLabelText(words.settings.colour));
    await userEvent.type(screen.getByLabelText(words.settings.colour), '#b4532a');

    const header = document.querySelector('[data-preview="header"]')!;
    expect(header.textContent).toContain('Minh Phát Sài Gòn');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
    expect(brandColour()).toBe('#2f7d6d');
    expect(saveConfig).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));
    expect((await screen.findByRole('status')).textContent).toBe(words.settings.saved);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát Sài Gòn');
    expect(brandColour()).toBe('#b4532a');
  });

  it('The root sets the company’s name and colour; every screen shows them', async () => {
    const saved = {
      config: { ...config, name: 'Minh Phát Sài Gòn', colour: '#b4532a' },
      version: 'v2',
    };
    const saveConfig = vi.fn<Api['saveConfig']>(() =>
      Promise.resolve({ kind: 'saved', doc: saved }),
    );
    setup({ saveConfig }, { ...signedIn, 'credo.language': 'en' }, '/settings');

    const name = await screen.findByLabelText(labelled(words.settings.name));
    expect(brandColour()).toBe('#2f7d6d');
    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát Sài Gòn');
    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    expect((await screen.findByRole('status')).textContent).toBe(words.settings.saved);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát Sài Gòn');
    expect(saveConfig).toHaveBeenCalledExactlyOnceWith(
      { ...config, name: 'Minh Phát Sài Gòn' },
      'v1',
    );
    expect(brandColour()).toBe('#b4532a');
  });

  it('The walk’s settings step: the root picks the Brick palette by its name and the saved screens wear it', async () => {
    const saved = { config: { ...config, colour: '#9e2d20' }, version: 'v2' };
    const saveConfig = vi.fn<Api['saveConfig']>(() =>
      Promise.resolve({ kind: 'saved', doc: saved }),
    );
    setup({ saveConfig }, { ...signedIn, 'credo.language': 'en' }, '/settings');

    await userEvent.click(
      await screen.findByRole('radio', { name: words.settings.palettes.brick }),
    );
    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    expect((await screen.findByRole('status')).textContent).toBe(words.settings.saved);
    expect(saveConfig).toHaveBeenCalledExactlyOnceWith({ ...config, colour: '#9e2d20' }, 'v1');
    expect(brandColour()).toBe('#9e2d20');
  });

  it('A failed save says so and keeps what was typed', async () => {
    const saveConfig = vi.fn<Api['saveConfig']>(() => Promise.reject(new ApiError(503)));
    setup({ saveConfig }, signedIn, '/settings');

    const name = await screen.findByLabelText(labelled(words.settings.name));
    await userEvent.clear(name);
    await userEvent.type(name, 'Typed and kept');
    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.settings.saveFailed);
    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.settings.name)).value).toBe(
      'Typed and kept',
    );
    expect(saveConfig).toHaveBeenCalledOnce();
  });

  it('A save the BFF refuses with a 400 says it was refused, not that the service is down, and keeps what was typed', async () => {
    const saveConfig = vi.fn<Api['saveConfig']>(() => Promise.reject(new ApiError(400)));
    setup({ saveConfig }, signedIn, '/settings');

    const name = await screen.findByLabelText(labelled(words.settings.name));
    await userEvent.clear(name);
    await userEvent.type(name, 'Typed and kept');
    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    const alert = (await screen.findByRole('alert')).textContent;
    expect(alert).toBe(words.settings.saveRefused);
    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.settings.name)).value).toBe(
      'Typed and kept',
    );
  });

  it('A save refused with a 401 signs out', async () => {
    const { device } = setup(
      { saveConfig: () => Promise.reject(new ApiError(401)) },
      signedIn,
      '/settings',
    );

    await userEvent.click(await screen.findByRole('button', { name: words.settings.save }));

    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(device.authId()).toBeNull();
  });

  it('A save over a newer one is refused, and the page offers the newer one', async () => {
    const newer = { config: { ...config, name: 'Someone else’s name' }, version: 'v9' };
    const getConfig = vi.fn<Api['getConfig']>().mockResolvedValueOnce(doc).mockResolvedValue(newer);
    setup(
      { getConfig, saveConfig: () => Promise.resolve({ kind: 'conflict' }) },
      signedIn,
      '/settings',
    );

    await userEvent.click(await screen.findByRole('button', { name: words.settings.save }));
    expect((await screen.findByRole('alert')).textContent).toContain(words.settings.conflict);

    await userEvent.click(screen.getByRole('button', { name: words.settings.conflictReload }));

    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>(labelled(words.settings.name)).value).toBe(
        'Someone else’s name',
      ),
    );
    expect(screen.queryByText(words.settings.conflict)).toBeNull();
  });

  it('A page that cannot reload the newer settings offers a retry', async () => {
    const getConfig = vi
      .fn<Api['getConfig']>()
      .mockResolvedValueOnce(doc)
      .mockRejectedValueOnce(new ApiError(503))
      .mockResolvedValue(doc);
    setup(
      { getConfig, saveConfig: () => Promise.resolve({ kind: 'conflict' }) },
      signedIn,
      '/settings',
    );

    await userEvent.click(await screen.findByRole('button', { name: words.settings.save }));
    await userEvent.click(
      await screen.findByRole('button', { name: words.settings.conflictReload }),
    );
    await userEvent.click(await screen.findByRole('button', { name: words.common.retry }));

    expect(await screen.findByLabelText(labelled(words.settings.name))).toBeTruthy();
  });

  it('The gallery opens at its own address, asks nobody to sign in and calls no API', async () => {
    const { api } = setup({}, unlinked, '/48b74d079/gallery');

    expect(await screen.findByRole('heading', { name: 'Design system' })).toBeTruthy();
    for (const call of Object.values(api)) {
      if (vi.isMockFunction(call)) expect(call).not.toHaveBeenCalled();
    }
  });

  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const ANDROID_TABLET =
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const IPAD_AS_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

  /** The gallery is for a computer: a phone, a tablet and an iPad that reports itself as a Mac get
   * the app's not-found screen at its address, and the gallery's code is never asked for. */
  it.each([
    ['a phone', IPHONE, 'iPhone', 5],
    ['a tablet', ANDROID_TABLET, 'Linux armv81', 5],
    ['an iPad that reports itself as a Mac', IPAD_AS_MAC, 'MacIntel', 5],
  ])('The gallery answers %s with the not-found screen', async (_who, agent, platform, touch) => {
    vi.stubGlobal('navigator', { userAgent: agent, platform, maxTouchPoints: touch });
    try {
      const { api } = setup({}, unlinked, '/48b74d079/gallery/atoms/door-card');

      expect(
        await screen.findByRole('heading', { name: wordsVi.unknownClient.title }),
      ).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Design system' })).toBeNull();
      for (const call of Object.values(api)) {
        if (vi.isMockFunction(call)) expect(call).not.toHaveBeenCalled();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('The gallery opens as it does on a Mac with no touch screen', async () => {
    vi.stubGlobal('navigator', {
      userAgent: IPAD_AS_MAC,
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    try {
      setup({}, unlinked, '/48b74d079/gallery');

      expect(await screen.findByRole('heading', { name: 'Design system' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: wordsVi.unknownClient.title })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('A near miss of the gallery’s address is the client’s app', async () => {
    setup({}, signedIn, '/48b74d079/galleryx');
    expect(await screen.findAllByRole('heading', { name: words.nav.orders })).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Design system' })).toBeNull();

    cleanup();
    setup({}, signedIn, '/48b74d079');
    expect(await screen.findAllByRole('heading', { name: words.nav.orders })).not.toHaveLength(0);
  });

  it('sends any other path to the first page', async () => {
    const storage = memory({ ...linked, ...signedIn });
    const device = createDeviceStore(storage);
    const api = setup().api;
    drawApp(<App api={api} device={device} passkeys={noPasskeys} build="dev" test />, '/nowhere');

    expect(await screen.findAllByRole('heading', { name: words.nav.orders })).not.toHaveLength(0);
  });

  it('A client’s link opens its sign-in in its name and colours, and the device keeps the code the link names, lowered and trimmed', async () => {
    const seen: (string | null)[] = [];
    const { device } = setup(
      (device) => ({
        getConfig: () => {
          seen.push(device.clientCode());
          return Promise.resolve(doc);
        },
      }),
      {},
      '/login?client-code=%20MINH-Phat%20',
    );

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Minh Phát');
    expect(screen.getByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(brandColour()).toBe('#2f7d6d');
    expect(seen).toEqual(['minh-phat']);
    expect(device.clientCode()).toBe('minh-phat');
  });

  it('On a company’s address that company opens, whatever the link or the device holds, and the device keeps it', async () => {
    const seen: (string | null)[] = [];
    const { device } = setup(
      (device) => ({
        getConfig: () => {
          seen.push(device.clientCode());
          return Promise.resolve(doc);
        },
      }),
      { 'credo.client': 'other-co' },
      '/login?client-code=third-co',
      'minh-phat.ridge.example.test',
    );

    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Minh Phát');
    expect(seen).toEqual(['minh-phat']);
    expect(device.clientCode()).toBe('minh-phat');
  });

  it('Where the address names no company, the link and then the device decide, as before', async () => {
    const seen: (string | null)[] = [];
    const getConfig = (device: DeviceStore) => () => {
      seen.push(device.clientCode());
      return Promise.resolve(doc);
    };
    setup(
      (device) => ({ getConfig: getConfig(device) }),
      { 'credo.client': 'other-co' },
      '/login?client-code=third-co',
      'operator.ridge.example.test',
    );
    await screen.findByLabelText(labelled(words.auth.username));
    cleanup();
    setup(
      (device) => ({ getConfig: getConfig(device) }),
      { 'credo.client': 'other-co' },
      '/',
      'localhost',
    );
    await screen.findByLabelText(labelled(words.auth.username));

    expect(seen).toEqual(['third-co', 'other-co']);
  });

  it('Drawn with no address given, the app reads the link alone', async () => {
    const { device } = setup({}, { 'credo.client': 'other-co' }, '/login?client-code=third-co');

    await screen.findByLabelText(labelled(words.auth.username));
    expect(device.clientCode()).toBe('third-co');
  });

  it('A reload at another address keeps the client the device was linked to', async () => {
    const seen: (string | null)[] = [];
    setup(
      (device) => ({
        getConfig: () => {
          seen.push(device.clientCode());
          return Promise.resolve(doc);
        },
      }),
      { 'credo.client': 'other-co' },
      '/settings',
    );

    await screen.findByLabelText(labelled(words.auth.username));
    expect(seen).toEqual(['other-co']);
  });

  it('A link to another client replaces the first, and the first’s handle is refused there and dropped', async () => {
    const { device } = setup(
      { me: () => Promise.reject(new ApiError(401)) },
      { 'credo.client': 'first-co', 'credo.session': 'd.s' },
      '/login?client-code=second-co',
    );

    expect(await screen.findByLabelText(labelled(words.auth.username))).toBeTruthy();
    expect(device.clientCode()).toBe('second-co');
    expect(device.authId()).toBeNull();
  });

  it('A link with no code, a malformed one, or one we do not know shows one screen, and no company’s name or colour', async () => {
    const cases: [string, Record<string, string | null>, Partial<Api>][] = [
      ['/', unlinked, {}],
      ['/login', unlinked, {}],
      ['/login?client-code=', linked, {}],
      ['/login?client-code=Not_A_Code', linked, {}],
      ['/login?client-code=ab', unlinked, {}],
      [
        '/login?client-code=nobody',
        unlinked,
        { getConfig: () => Promise.reject(new ApiError(404)) },
      ],
    ];
    for (const [path, kept, overrides] of cases) {
      const getConfig = vi.fn<Api['getConfig']>(
        overrides.getConfig ?? (() => Promise.resolve(doc)),
      );
      const view = setup({ ...overrides, getConfig }, kept, path);

      expect((await screen.findByRole('heading', { level: 1 })).textContent, path).toBe(
        DICTIONARIES.vi.unknownClient.title,
      );
      expect(document.body.textContent, path).not.toContain('Minh Phát');
      expect(brandColour(), path).toBe('#3e618c');
      expect(screen.queryByLabelText(labelled(words.auth.username)), path).toBeNull();
      // A link that cannot name a client asks the service nothing.
      expect(getConfig).toHaveBeenCalledTimes(path.endsWith('nobody') ? 1 : 0);
      view.unmount();
    }
  });

  describe('the sign-in by passkey on the door', () => {
    const offered = { options: { challenge: 'c' }, token: 't' };
    const answer = {
      id: 'k',
      rawId: 'k',
      type: 'public-key' as const,
      response: {},
      clientExtensionResults: {},
    };
    /** A door whose company answers its passkey options, and a device that gives `answer`. */
    const door = (overrides: Partial<Api> = {}, tab = memory()) => {
      const passkeys = {
        register: vi.fn(),
        authenticate: vi.fn(() => Promise.resolve(answer)),
      } satisfies Passkeys;
      const api = {
        passkeyOptions: vi.fn(() => Promise.resolve(offered)),
        passkeySignIn: vi.fn(() => Promise.resolve({ authId: 'p.s', expiresAt: 1, user: root })),
        ...overrides,
      };
      const drawn = setup(api, {}, '/', undefined, tab, passkeys);
      return { passkeys, ...drawn, api: { ...drawn.api, ...api } };
    };
    const press = async () =>
      await userEvent.click(await screen.findByRole('button', { name: words.auth.passkey }));

    it('15: draws “or” and the button where the options came, and nothing where they answered 404 or failed', async () => {
      const { api } = door();
      expect(await screen.findByRole('button', { name: words.auth.passkey })).toBeTruthy();
      expect(screen.getByText(words.auth.or)).toBeTruthy();
      expect(api.passkeyOptions).toHaveBeenCalledOnce();
      cleanup();

      const off = door({ passkeyOptions: vi.fn(() => Promise.resolve(null)) });
      await screen.findByLabelText(labelled(words.auth.username));
      await waitFor(() => expect(off.api.passkeyOptions).toHaveBeenCalledOnce());
      expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull();
      expect(screen.queryByText(words.auth.or)).toBeNull();
      cleanup();

      const down = door({ passkeyOptions: vi.fn(() => Promise.reject(new ApiError(null))) });
      await screen.findByLabelText(labelled(words.auth.username));
      await waitFor(() => expect(down.api.passkeyOptions).toHaveBeenCalledOnce());
      expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull();
    });

    it('16: a press gives the options to the device, sends its answer, keeps the handle and lands signed in', async () => {
      const tab = memory();
      const { api, passkeys, device, storage } = door({}, tab);
      await press();

      expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
      expect(passkeys.authenticate).toHaveBeenCalledExactlyOnceWith(offered.options);
      expect(api.passkeySignIn).toHaveBeenCalledExactlyOnceWith({
        token: offered.token,
        response: answer,
      });
      expect(device.authId()).toBe('p.s');
      expect(storage.getItem('credo.session')).toBe('p.s');
      expect(tab.getItem('credo.session')).toBeNull();
      expect(api.passkeyOptions).toHaveBeenCalledOnce();
    });

    it('16: a passkey not given is told with the form kept and the options held for the next press', async () => {
      const { api, passkeys } = door();
      passkeys.authenticate.mockRejectedValueOnce(new PasskeyNotGiven());
      await userEvent.type(await screen.findByLabelText(labelled(words.auth.username)), 'bao');
      await press();

      expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
      expect(screen.getByLabelText<HTMLInputElement>(labelled(words.auth.username)).value).toBe(
        'bao',
      );
      expect(api.passkeySignIn).not.toHaveBeenCalled();
      await press();
      expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
      expect(api.passkeyOptions).toHaveBeenCalledOnce();
    });

    it('16: a passkey that opens nothing here is told with the form kept, and the options are asked again', async () => {
      const { api } = door({
        passkeySignIn: vi.fn(() => Promise.reject(new ApiError(401))),
      });
      await userEvent.type(await screen.findByLabelText(labelled(words.auth.username)), 'bao');
      await press();

      expect((await screen.findByRole('alert')).textContent).toBe(words.auth.passkeyRefused);
      expect(screen.getByLabelText<HTMLInputElement>(labelled(words.auth.username)).value).toBe(
        'bao',
      );
      await waitFor(() => expect(api.passkeyOptions).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('button', { name: words.auth.passkey })).toBeTruthy();
    });

    it('16: a device or a service that fails says the service is unavailable, never “no passkey”', async () => {
      const { passkeys, unmount } = door();
      passkeys.authenticate.mockRejectedValueOnce(new Error('the library failed'));
      await press();
      expect((await screen.findByRole('alert')).textContent).toContain(
        DICTIONARIES.vi.common.unavailable,
      );
      unmount();

      door({ passkeySignIn: vi.fn(() => Promise.reject(new ApiError(503))) });
      await press();
      expect((await screen.findByRole('alert')).textContent).toContain(
        DICTIONARIES.vi.common.unavailable,
      );
    });

    it('17: options older than four minutes are asked again within the press, and held ones are not', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const fresh = { options: { challenge: 'later' }, token: 't2' };
        const passkeyOptions = vi
          .fn<Api['passkeyOptions']>()
          .mockResolvedValueOnce(offered)
          .mockResolvedValueOnce(fresh);
        const { api, passkeys } = door({ passkeyOptions });
        await screen.findByRole('button', { name: words.auth.passkey });
        vi.setSystemTime(Date.now() + 4 * 60_000 + 1);
        await press();

        expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
        expect(api.passkeyOptions).toHaveBeenCalledTimes(2);
        expect(passkeys.authenticate).toHaveBeenCalledExactlyOnceWith(fresh.options);
        expect(api.passkeySignIn).toHaveBeenCalledExactlyOnceWith({
          token: fresh.token,
          response: answer,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('17: where the options now answer 404, the press ends with the button gone', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const passkeyOptions = vi
          .fn<Api['passkeyOptions']>()
          .mockResolvedValueOnce(offered)
          .mockResolvedValueOnce(null);
        const { passkeys } = door({ passkeyOptions });
        await screen.findByRole('button', { name: words.auth.passkey });
        vi.setSystemTime(Date.now() + 5 * 60_000);
        await press();

        await waitFor(() =>
          expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull(),
        );
        expect(passkeys.authenticate).not.toHaveBeenCalled();
        expect(screen.queryByRole('alert')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('the tab and the page’s language', () => {
  const tab = () => document.title;
  const headTitle = (text: string) => {
    const title = document.createElement('title');
    title.textContent = text;
    document.head.append(title);
    return title;
  };

  it('1: the tab says Credo while the settings load, then the plain name, over a title already in the head', async () => {
    const first = headTitle('From the page');
    let release: (value: ConfigDoc) => void = () => {};
    const wait = new Promise<ConfigDoc>((resolve) => (release = resolve));
    setup({ getConfig: () => wait });

    await waitFor(() => expect(tab()).toBe('Credo'));
    release(doc);
    await waitFor(() => expect(tab()).toBe('Minh Phát'));
    first.remove();
  });

  it('1: the tab says Credo when the service fails, and the plain name signed in', async () => {
    const first = headTitle('From the page');
    const { unmount } = setup({ getConfig: () => Promise.reject(new ApiError(null)) });
    await screen.findByRole('alert');
    expect(tab()).toBe('Credo');
    unmount();

    setup({}, signedIn);
    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(tab()).toBe('Minh Phát');
    first.remove();
  });

  it('1: the tab says Credo for an unknown company', async () => {
    const first = headTitle('From the page');
    setup({}, unlinked);
    await screen.findByRole('heading', { name: wordsVi.unknownClient.title });
    expect(tab()).toBe('Credo');
    first.remove();
  });

  it('2: the page is marked in the language shown, and again when a person switches', async () => {
    setup({}, signedIn);
    expect((await screen.findAllByText(words.nav.settings)).length).toBeGreaterThan(0);
    expect(document.documentElement.getAttribute('lang')).toBe('en');

    await userEvent.click(screen.getByRole('button', { name: words.user.language }));
    await userEvent.click(screen.getByRole('menuitem', { name: LANGUAGE_NAMES.vi }));

    await waitFor(() => expect(document.documentElement.getAttribute('lang')).toBe('vi'));
  });

  it('2: the walk’s formatted steps: the root types both fields, saves, the header shows the name formatted, and signing out shows the card with the description', async () => {
    const formattedName = '<b>Minh</b><br><span style="color:#1d3557">Phát</span>';
    const description = 'Vật liệu xây dựng';
    const saved = { config: { ...config, formattedName, description }, version: 'v2' };
    const saveConfig = vi.fn<Api['saveConfig']>(() =>
      Promise.resolve({ kind: 'saved', doc: saved }),
    );
    setup({ saveConfig }, { ...signedIn, 'credo.language': 'en' }, '/settings');

    await userEvent.click(
      await screen.findByRole('textbox', { name: words.settings.formattedName }),
    );
    await userEvent.paste(formattedName);
    await userEvent.type(
      screen.getByRole('textbox', { name: words.settings.description }),
      description,
    );
    expect(document.querySelector('[data-preview="card"]')?.textContent).toContain(description);
    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    expect((await screen.findByRole('status')).textContent).toBe(words.settings.saved);
    expect(saveConfig).toHaveBeenCalledExactlyOnceWith(saved.config, 'v1');
    expect(document.querySelector('header [aria-hidden="true"] b')?.textContent).toBe('Minh');
    expect(screen.getAllByRole('heading', { level: 1 })[0].textContent).toContain('Minh Phát');

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));

    expect(await screen.findByText(description)).toBeTruthy();
    expect(document.querySelector('h1 [aria-hidden="true"] b')?.textContent).toBe('Minh');
  });
});
