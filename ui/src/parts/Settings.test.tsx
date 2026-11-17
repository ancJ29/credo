import { MAX_LOGO_BYTES, type TenantConfig } from '@credo/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { PALETTES } from '../design-system/palettes';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { Settings } from './Settings';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: 'data:image/png;base64,AAAA',
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

type Props = Parameters<typeof Settings>[0];

const props = (more: Partial<Props> = {}): Props => ({
  status: 'ready',
  config,
  outcome: null,
  saving: false,
  onSave: vi.fn(),
  onRetry: vi.fn(),
  onReload: vi.fn(),
  ...more,
});

const words = DICTIONARIES.en.settings;
const wordsVi = DICTIONARIES.vi.settings;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const palettesIn = (dictionary: typeof words) =>
  PALETTES.map((palette) => dictionary.palettes[palette.name]);

const checked = () =>
  screen.getAllByRole<HTMLInputElement>('radio').filter((radio) => radio.checked);

const save = () => screen.getByRole('button', { name: words.save });

describe('Settings', () => {
  it('waits while the settings load', () => {
    draw(<Settings {...props({ status: 'loading' })} />);

    expect(screen.getByLabelText(DICTIONARIES.en.common.loading)).toBeTruthy();
    expect(screen.queryByLabelText(labelled(words.name))).toBeNull();
  });

  it('offers a retry when the settings did not load', async () => {
    const onRetry = vi.fn();
    draw(<Settings {...props({ status: 'failed', onRetry })} />);

    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.en.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('A failed save says so and keeps what was typed', async () => {
    const p = props();
    const { rerender } = draw(<Settings {...p} />);
    const name = screen.getByLabelText<HTMLInputElement>(labelled(words.name));

    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát Sài Gòn');
    await userEvent.click(screen.getByRole('checkbox', { name: LANGUAGE_NAMES.en }));
    rerender(<Settings {...{ ...p, outcome: 'failed' as const }} />);

    expect(screen.getByRole('alert').textContent).toBe(words.saveFailed);
    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.name)).value).toBe(
      'Minh Phát Sài Gòn',
    );
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: LANGUAGE_NAMES.en }).checked,
    ).toBe(false);
  });

  it('a save over a newer one offers the newer settings', async () => {
    const onReload = vi.fn();
    draw(<Settings {...props({ outcome: 'conflict', onReload })} />);

    await userEvent.click(screen.getByRole('button', { name: words.conflictReload }));

    expect(onReload).toHaveBeenCalledOnce();
  });

  it('a saved settings page says so, and a fresh one says nothing', () => {
    const { rerender } = draw(<Settings {...props({ outcome: 'saved' })} />);
    expect(screen.getByRole('alert').textContent).toBe(words.saved);

    rerender(<Settings {...props()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends the whole draft on save', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.clear(screen.getByLabelText(labelled(words.name)));
    await userEvent.type(screen.getByLabelText(labelled(words.name)), 'New name');
    await userEvent.click(save());

    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...config, name: 'New name' });
  });

  it('refuses a save without a name, or with a colour that is not #rrggbb', async () => {
    draw(<Settings {...props()} />);
    expect(save().hasAttribute('disabled')).toBe(false);

    await userEvent.clear(screen.getByLabelText(labelled(words.name)));
    expect(save().hasAttribute('disabled')).toBe(true);
    await userEvent.type(screen.getByLabelText(labelled(words.name)), 'Name');
    expect(save().hasAttribute('disabled')).toBe(false);

    await userEvent.clear(screen.getByLabelText(words.colour));
    await userEvent.type(screen.getByLabelText(words.colour), '#12');
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('moves the default to a language still offered, and refuses none', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.click(screen.getByRole('checkbox', { name: LANGUAGE_NAMES.vi }));
    expect(screen.getByLabelText<HTMLSelectElement>(words.defaultLanguage).value).toBe('en');
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith({ ...config, languages: ['en'], defaultLanguage: 'en' });

    await userEvent.click(screen.getByRole('checkbox', { name: LANGUAGE_NAMES.en }));
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('picks the default among the languages offered', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.selectOptions(screen.getByLabelText(words.defaultLanguage), 'en');
    await userEvent.click(save());

    expect(onSave).toHaveBeenCalledWith({ ...config, defaultLanguage: 'en' });
  });

  it('shows the logo, lets it be replaced by an image, and removed', async () => {
    draw(<Settings {...props({ config: { ...config, logo: null } })} />);
    expect(screen.getByText(words.logoNone)).toBeTruthy();

    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await userEvent.upload(input, new File(['x'], 'logo.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: words.logoRemove })).toBeTruthy(),
    );
    expect(document.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);

    await userEvent.click(screen.getByRole('button', { name: words.logoRemove }));
    expect(screen.getByText(words.logoNone)).toBeTruthy();
  });

  it('refuses a logo over the limit at the chooser, says why, and keeps the draft’s logo', async () => {
    draw(<Settings {...props()} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    await userEvent.upload(
      input,
      new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'big.png', { type: 'image/png' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      words.logoTooLarge.replace('{{max}}', String(MAX_LOGO_BYTES / 1024)),
    );
    expect(document.querySelector('img')!.getAttribute('src')).toBe(config.logo);
  });

  it('takes a logo of exactly the limit, and the refusal goes with it', async () => {
    draw(<Settings {...props()} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const choose = (bytes: number) =>
      userEvent.upload(input, new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' }));

    await choose(MAX_LOGO_BYTES + 1);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await choose(MAX_LOGO_BYTES);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await waitFor(() =>
      expect(document.querySelector('img')!.getAttribute('src')).not.toBe(config.logo),
    );
  });

  it('refuses a file that is not an image at the chooser, in either language', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { unmount } = draw(<Settings {...props()} />);
    const choose = () =>
      user.upload(
        document.querySelector<HTMLInputElement>('input[type=file]')!,
        new File(['hello'], 'notes.txt', { type: 'text/plain' }),
      );

    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(words.logoNotImage);
    expect(document.querySelector('img')!.getAttribute('src')).toBe(config.logo);
    unmount();

    draw(<Settings {...props()} />, 'vi');
    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(wordsVi.logoNotImage);
  });

  it('says a refused save was refused, in its own words', () => {
    draw(<Settings {...props({ outcome: 'refused' })} />);

    expect(screen.getByRole('alert').textContent).toBe(words.saveRefused);
  });

  it('ignores a file chooser closed without a file', () => {
    draw(<Settings {...props({ config: { ...config, logo: null } })} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(screen.getByText(words.logoNone)).toBeTruthy();
  });

  it('shows the nine palettes as one radio group named Palette, in the legacy’s order, in both languages', () => {
    const { unmount } = draw(<Settings {...props()} />);

    expect(screen.getByRole('radiogroup', { name: words.palette })).toBeTruthy();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(
      PALETTES.map((palette) => palette.name),
    );
    expect(
      screen.getAllByRole<HTMLInputElement>('radio').map((radio) => radio.labels?.[0]?.textContent),
    ).toEqual(palettesIn(words));
    unmount();

    draw(<Settings {...props()} />, 'vi');
    expect(screen.getByRole('radiogroup', { name: wordsVi.palette })).toBeTruthy();
    expect(
      screen.getAllByRole<HTMLInputElement>('radio').map((radio) => radio.labels?.[0]?.textContent),
    ).toEqual(palettesIn(wordsVi));
  });

  it('puts a picked palette’s shade 7 in the colour field, checks it, and saves that colour', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.click(screen.getByRole('radio', { name: words.palettes.terracotta }));

    expect(screen.getByLabelText<HTMLInputElement>(words.colour).value).toBe('#d97757');
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: words.palettes.terracotta }).checked,
    ).toBe(true);
    expect(checked()).toHaveLength(1);
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...config, colour: '#d97757' });
  });

  it('checks the swatch whose shade 7 is typed, in any case, and none for any other colour', async () => {
    draw(<Settings {...props()} />);
    const colour = screen.getByLabelText(words.colour);
    expect(checked()).toHaveLength(0);

    await userEvent.clear(colour);
    await userEvent.type(colour, '#456955');
    expect(checked().map((radio) => radio.value)).toEqual(['forest']);

    await userEvent.clear(colour);
    await userEvent.type(colour, '#047857'.toUpperCase());
    expect(checked().map((radio) => radio.value)).toEqual(['emerald']);

    await userEvent.clear(colour);
    await userEvent.type(colour, '#456956');
    expect(checked()).toHaveLength(0);
  });

  it('starts a new company on steel, checked', () => {
    draw(<Settings {...props({ config: { ...config, colour: '#3e618c' } })} />);

    expect(checked().map((radio) => radio.value)).toEqual(['steel']);
  });

  it('6: shows the three frame switches below the colour field, off when never set, in both languages', () => {
    const { unmount } = draw(<Settings {...props()} />);

    const names = [words.whiteHeader, words.whiteMenu, words.menuIcons];
    const switches = screen.getAllByRole<HTMLInputElement>('switch');
    expect(switches.map((one) => one.labels?.[0]?.textContent)).toEqual(names);
    expect(switches.map((one) => one.checked)).toEqual([false, false, false]);
    const colour = screen.getByLabelText(words.colour);
    expect(
      colour.compareDocumentPosition(switches[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    unmount();

    draw(<Settings {...props()} />, 'vi');
    expect(
      screen.getAllByRole<HTMLInputElement>('switch').map((one) => one.labels?.[0]?.textContent),
    ).toEqual([wordsVi.whiteHeader, wordsVi.whiteMenu, wordsVi.menuIcons]);
  });

  it('6: sends each switch as set, apart from the others', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.click(screen.getByRole('switch', { name: words.whiteMenu }));
    await userEvent.click(save());
    expect(onSave).toHaveBeenLastCalledWith({ ...config, whiteMenu: true });

    await userEvent.click(screen.getByRole('switch', { name: words.whiteHeader }));
    await userEvent.click(screen.getByRole('switch', { name: words.menuIcons }));
    await userEvent.click(screen.getByRole('switch', { name: words.whiteMenu }));
    await userEvent.click(save());
    expect(onSave).toHaveBeenLastCalledWith({
      ...config,
      whiteHeader: true,
      menuIcons: true,
    });
  });
});
