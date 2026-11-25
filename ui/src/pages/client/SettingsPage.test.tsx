import { type ConfigDoc, NO_PICTURES, type TenantConfig } from '@credo/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { ApiError, type Api } from '../../api';
import { SettingsPage } from './SettingsPage';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const config: TenantConfig = {
  name: 'Minh Phát',
  logo: 'data:image/png;base64,AAAA',
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
  formattedName: '',
  description: '',
};

const doc: ConfigDoc = { config, version: 'v1', pictures: NO_PICTURES };

describe('a save the BFF refuses on the settings page', () => {
  it('A 401 signs the person out and also leaves the failed outcome on the page', async () => {
    const onSignedOut = vi.fn();
    const onForbidden = vi.fn();
    const api = { saveConfig: vi.fn().mockRejectedValue(new ApiError(401)) } as unknown as Api;
    draw(
      <SettingsPage
        api={api}
        doc={doc}
        onDoc={vi.fn()}
        onSignedOut={onSignedOut}
        onForbidden={onForbidden}
      />,
    );
    await userEvent.type(await screen.findByLabelText(starting(words.settings.name)), 'x');

    await userEvent.click(screen.getByRole('button', { name: words.settings.save }));

    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(onForbidden).not.toHaveBeenCalled();
    // The failed outcome after a 401 is the deliberate consequence of deciding a 403 once, in
    // `refusal`: the page no longer re-checks the 401 to withhold it, and the sign-out redraws
    // the app over this page anyway. Do not add a status check here to remove it.
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

describe('a picture saved at its choice on the settings page', () => {
  const png = () => new File(['x'], 'light.png', { type: 'image/png' });
  const held = {
    ...({ config, version: 'v1' } as const),
    pictures: {
      ...NO_PICTURES,
      'logo-on-colour': { address: '/api/pictures/minh/logo-on-colour?v=t', version: 't' },
    },
  };
  const page = (api: Partial<Api>, onDoc = vi.fn(), at: ConfigDoc = doc) =>
    draw(
      <SettingsPage
        api={api as Api}
        doc={at}
        onDoc={onDoc}
        onSignedOut={vi.fn()}
        onForbidden={vi.fn()}
      />,
    );
  const light = () =>
    screen.getByText(words.settings.logoOnColour, { selector: 'p' }).parentElement!;
  const choose = () =>
    userEvent.upload(document.querySelectorAll<HTMLInputElement>('input[type=file]')[1], png());

  it('17: sends the chosen image at once with the tag it was read at, takes the reply’s doc and says saved', async () => {
    const savePicture = vi.fn().mockResolvedValue({ kind: 'saved', doc: held });
    const onDoc = vi.fn();
    page({ savePicture }, onDoc);

    await choose();

    await waitFor(() => expect(onDoc).toHaveBeenCalledWith(held));
    expect(savePicture).toHaveBeenCalledExactlyOnceWith(
      'logo-on-colour',
      expect.stringMatching(/^data:image\/png;base64,/),
      null,
    );
    expect((await within(light()).findByRole('status')).textContent).toBe(words.settings.saved);
  });

  it('18: text typed and not saved stays across a picture’s save, which moves no version', async () => {
    const savePicture = vi.fn().mockResolvedValue({ kind: 'saved', doc: held });
    const { rerender } = page({ savePicture });
    const name = () => screen.getByLabelText<HTMLInputElement>(starting(words.settings.name));
    await userEvent.type(name(), ' mới');

    await choose();
    await within(light()).findByRole('status');
    rerender(
      <SettingsPage
        api={{ savePicture } as unknown as Api}
        doc={held}
        onDoc={vi.fn()}
        onSignedOut={vi.fn()}
        onForbidden={vi.fn()}
      />,
    );

    expect(name().value).toBe('Minh Phát mới');
    expect(document.querySelector('[data-preview="header"] img')?.getAttribute('src')).toBe(
      held.pictures['logo-on-colour'].address,
    );
  });

  it('17: a remove sends none with the picture’s tag; a conflict shows the newer doc and says so', async () => {
    const savePicture = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'conflict', doc: held })
      .mockResolvedValueOnce({ kind: 'conflict', doc: null });
    const onDoc = vi.fn();
    page({ savePicture }, onDoc, held);

    await userEvent.click(
      within(light()).getByRole('button', { name: words.settings.logoOnColourRemove }),
    );
    await waitFor(() => expect(onDoc).toHaveBeenCalledWith(held));
    expect(savePicture).toHaveBeenCalledWith('logo-on-colour', null, 't');
    expect((await within(light()).findByRole('alert')).textContent).toContain(
      words.settings.conflict,
    );
    await userEvent.click(
      within(light()).getByRole('button', { name: words.settings.logoOnColourRemove }),
    );
    await waitFor(() => expect(savePicture).toHaveBeenCalledTimes(2));
    expect(onDoc).toHaveBeenCalledTimes(1);
  });

  it('17: a refused picture says so, any other failure says it failed, a 401 signs out', async () => {
    const onSignedOut = vi.fn();
    const savePicture = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400))
      .mockRejectedValueOnce(new ApiError(503))
      .mockRejectedValueOnce(new ApiError(401));
    draw(
      <SettingsPage
        api={{ savePicture } as unknown as Api}
        doc={doc}
        onDoc={vi.fn()}
        onSignedOut={onSignedOut}
        onForbidden={vi.fn()}
      />,
    );

    await choose();
    expect((await within(light()).findByRole('alert')).textContent).toBe(
      words.settings.saveRefused,
    );
    await choose();
    await waitFor(() =>
      expect(within(light()).getByRole('alert').textContent).toBe(words.settings.saveFailed),
    );
    await choose();
    await waitFor(() => expect(onSignedOut).toHaveBeenCalledOnce());
  });
});
