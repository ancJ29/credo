import { MAX_LOGO_BYTES, NO_PICTURES, type TenantConfig } from '@credo/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { themeOf } from '../design-system/appTheme';
import { PALETTES } from '../design-system/palettes';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { Settings } from './Settings';

const config: TenantConfig = {
  name: 'Minh Phát',
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
  formattedName: '',
  description: '',
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
  pictures: NO_PICTURES,
  onPicture: vi.fn(),
  pictureOutcome: null,
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
/** A picture field by its label: the block the label, the picture and the buttons sit in. */
const field = (label: string) => screen.getByText(label, { selector: 'p' }).parentElement!;

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
    expect(screen.getByRole('status').textContent).toBe(words.saved);

    rerender(<Settings {...props()} />);
    expect(screen.queryByRole('status')).toBeNull();
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

  it('17: draws the two pictures of the Pictures block as the reply names them, each with its choose and remove', () => {
    draw(
      <Settings
        {...props({
          pictures: {
            logo: { address: '/api/a', version: 't' },
            'logo-on-colour': null,
            'tab-icon': null,
            'app-icon': null,
          },
        })}
      />,
    );

    const logo = field(words.logo);
    expect(logo.querySelector('img')?.getAttribute('src')).toBe('/api/a');
    expect(within(logo).getByRole('button', { name: words.logoRemove })).toBeTruthy();
    const light = field(words.logoOnColour);
    expect(light.querySelector('img')).toBeNull();
    expect(within(light).getByText(words.logoOnColourNone)).toBeTruthy();
    expect(within(light).getByText(words.logoOnColourHint)).toBeTruthy();
    expect(within(light).getByRole('button', { name: words.logoOnColourChoose })).toBeTruthy();
    expect(within(light).queryByRole('button', { name: words.logoOnColourRemove })).toBeNull();
  });

  it('17: a chosen image is told at once, by its kind, as a data URL, and a remove as none; the draft is as it was', async () => {
    const onPicture = vi.fn();
    const onSave = vi.fn();
    draw(
      <Settings
        {...props({
          onPicture,
          onSave,
          pictures: {
            logo: { address: '/api/a', version: 't' },
            'logo-on-colour': null,
            'tab-icon': null,
            'app-icon': null,
          },
        })}
      />,
    );
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type=file]');

    await userEvent.upload(inputs[1], new File(['x'], 'light.png', { type: 'image/png' }));
    await waitFor(() => expect(onPicture).toHaveBeenCalledTimes(1));
    expect(onPicture).toHaveBeenCalledWith(
      'logo-on-colour',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    await userEvent.upload(inputs[0], new File(['x'], 'logo.png', { type: 'image/png' }));
    await waitFor(() => expect(onPicture).toHaveBeenCalledTimes(2));
    expect(onPicture).toHaveBeenLastCalledWith(
      'logo',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    await userEvent.click(
      within(field(words.logo)).getByRole('button', { name: words.logoRemove }),
    );
    expect(onPicture).toHaveBeenLastCalledWith('logo', null);
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith(config);
  });

  it('17: a file over the limit or not an image is refused at the chooser, under its own field, in either language, and told to no one', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onPicture = vi.fn();
    const { unmount } = draw(<Settings {...props({ onPicture })} />);
    const input = (at: number) =>
      document.querySelectorAll<HTMLInputElement>('input[type=file]')[at];

    await user.upload(
      input(1),
      new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'big.png', { type: 'image/png' }),
    );
    expect(within(field(words.logoOnColour)).getByRole('alert').textContent).toBe(
      words.logoTooLarge.replace('{{max}}', String(MAX_LOGO_BYTES / 1024)),
    );
    expect(within(field(words.logo)).queryByRole('alert')).toBeNull();
    await user.upload(input(0), new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(within(field(words.logo)).getByRole('alert').textContent).toBe(words.logoNotImage);
    expect(onPicture).not.toHaveBeenCalled();
    unmount();

    draw(<Settings {...props()} />, 'vi');
    await user.upload(input(0), new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect((await screen.findByRole('alert')).textContent).toBe(wordsVi.logoNotImage);
  });

  it('17: a file of exactly the limit is taken and its refusal goes', async () => {
    const onPicture = vi.fn();
    draw(<Settings {...props({ onPicture })} />);
    const input = document.querySelectorAll<HTMLInputElement>('input[type=file]')[0];
    const choose = (bytes: number) =>
      userEvent.upload(input, new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' }));

    await choose(MAX_LOGO_BYTES + 1);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await choose(MAX_LOGO_BYTES);

    await waitFor(() => expect(onPicture).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('17: a refusal at the chooser goes with the remove that follows it', async () => {
    const onPicture = vi.fn();
    draw(
      <Settings
        {...props({
          onPicture,
          pictures: { ...NO_PICTURES, logo: { address: '/api/a', version: 't' } },
        })}
      />,
    );
    const input = document.querySelectorAll<HTMLInputElement>('input[type=file]')[0];

    await userEvent.upload(
      input,
      new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'big.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    await userEvent.click(
      within(field(words.logo)).getByRole('button', { name: words.logoRemove }),
    );
    expect(onPicture).toHaveBeenLastCalledWith('logo', null);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('17: a picture’s save says how it ended under its own field only', () => {
    const outcome = (
      kind: 'logo' | 'logo-on-colour',
      how: 'saved' | 'failed' | 'refused' | 'conflict',
    ) => draw(<Settings {...props({ pictureOutcome: { kind, outcome: how } })} />);
    const saved = outcome('logo-on-colour', 'saved');
    expect(within(field(words.logoOnColour)).getByRole('status').textContent).toBe(words.saved);
    expect(within(field(words.logo)).queryByRole('status')).toBeNull();
    saved.unmount();
    const failed = outcome('logo', 'failed');
    expect(within(field(words.logo)).getByRole('alert').textContent).toBe(words.saveFailed);
    failed.unmount();
    const refused = outcome('logo', 'refused');
    expect(within(field(words.logo)).getByRole('alert').textContent).toBe(words.saveRefused);
    refused.unmount();
    outcome('logo', 'conflict');
    expect(within(field(words.logo)).getByRole('alert').textContent).toContain(words.conflict);
  });

  it('17: the preview’s header and card wear the pictures of the reply, the header choosing as the app’s does', () => {
    draw(
      <Settings
        {...props({
          pictures: {
            logo: { address: '/api/a', version: 't' },
            'logo-on-colour': { address: '/api/b', version: 'u' },
            'tab-icon': null,
            'app-icon': null,
          },
        })}
      />,
    );

    expect(picture('card').querySelector('img')?.getAttribute('src')).toBe('/api/a');
    expect(picture('header').querySelector('img')?.getAttribute('src')).toBe('/api/b');
  });

  it('says a refused save was refused, in its own words', () => {
    draw(<Settings {...props({ outcome: 'refused' })} />);

    expect(screen.getByRole('alert').textContent).toBe(words.saveRefused);
  });

  it('ignores a file chooser closed without a file', () => {
    const onPicture = vi.fn();
    draw(<Settings {...props({ onPicture })} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onPicture).not.toHaveBeenCalled();
    expect(screen.getByText(words.logoNone)).toBeTruthy();
  });

  it('shows the six palettes as one radio group named Palette, in the human’s order, in both languages', () => {
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

    await userEvent.click(screen.getByRole('radio', { name: words.palettes.brick }));

    expect(screen.getByLabelText<HTMLInputElement>(words.colour).value).toBe('#9e2d20');
    expect(
      screen.getByRole<HTMLInputElement>('radio', { name: words.palettes.brick }).checked,
    ).toBe(true);
    expect(checked()).toHaveLength(1);
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...config, colour: '#9e2d20' });
  });

  it('checks the swatch whose shade 7 is typed, in any case, and none for any other colour', async () => {
    draw(<Settings {...props()} />);
    const colour = screen.getByLabelText(words.colour);
    expect(checked()).toHaveLength(0);

    await userEvent.clear(colour);
    await userEvent.type(colour, '#854a00');
    expect(checked().map((radio) => radio.value)).toEqual(['bronze']);

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

/** The preview's two pictures, as the page draws them. */
const picture = (which: 'header' | 'card') =>
  document.querySelector<HTMLElement>(`[data-preview="${which}"]`)!;
const scopeBrand = () =>
  document
    .querySelector<HTMLElement>('[data-colour-scope]')!
    .style.getPropertyValue('--mantine-color-brand-7');

describe('Settings in four blocks beside a preview', () => {
  it('1: draws its fields in four titled blocks, Identity, Pictures, Color and frame, Languages, in that order, and one save after them, in both languages', () => {
    const order = (dictionary: typeof words) => [
      dictionary.identity,
      dictionary.pictures,
      dictionary.frame,
      dictionary.languagesSection,
    ];
    const { unmount } = draw(<Settings {...props()} />);
    const titles = () =>
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(titles().slice(0, 4)).toEqual(order(words));
    const last = screen.getByRole('heading', { level: 3, name: words.languagesSection });
    expect(screen.getAllByRole('button', { name: words.save })).toHaveLength(1);
    expect(last.compareDocumentPosition(save()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const block = (name: string) =>
      screen.getByRole('heading', { level: 3, name }).closest('section');
    expect(block(words.identity)?.contains(screen.getByLabelText(labelled(words.name)))).toBe(true);
    expect(block(words.frame)?.contains(screen.getByLabelText(words.colour))).toBe(true);
    expect(block(words.frame)?.querySelectorAll('[role="switch"]')).toHaveLength(3);
    expect(block(words.languagesSection)?.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      2,
    );
    unmount();

    draw(<Settings {...props()} />, 'vi');
    expect(titles().slice(0, 4)).toEqual(order(wordsVi));
  });

  it('2: the preview’s header and card draw the name, the logo, the colour and the white header as typed and chosen, before any save', async () => {
    const onSave = vi.fn();
    draw(
      <Settings
        {...props({
          onSave,
          pictures: {
            logo: { address: '/api/a', version: 't' },
            'logo-on-colour': null,
            'tab-icon': null,
            'app-icon': null,
          },
        })}
      />,
    );
    expect(picture('header').textContent).toContain('Minh Phát');
    expect(picture('card').querySelector('img')?.getAttribute('src')).toBe('/api/a');
    expect(picture('header').getAttribute('data-white')).toBeNull();

    await userEvent.clear(screen.getByLabelText(labelled(words.name)));
    await userEvent.type(screen.getByLabelText(labelled(words.name)), 'New name');
    await userEvent.clear(screen.getByLabelText(words.colour));
    await userEvent.type(screen.getByLabelText(words.colour), '#9e2d20');
    await userEvent.click(screen.getByRole('switch', { name: words.whiteHeader }));

    expect(picture('header').textContent).toContain('New name');
    expect(picture('card').textContent).toContain('New name');
    expect(picture('header').getAttribute('data-white')).toBe('true');
    expect(scopeBrand()).toBe(themeOf('#9e2d20').colors?.['brand']?.[7]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('3: while the colour field holds no #rrggbb the preview wears the saved colour', async () => {
    draw(<Settings {...props()} />);
    const saved = themeOf(config.colour).colors?.['brand']?.[7];
    expect(scopeBrand()).toBe(saved);

    await userEvent.clear(screen.getByLabelText(words.colour));
    await userEvent.type(screen.getByLabelText(words.colour), '#12');
    expect(scopeBrand()).toBe(saved);
    await userEvent.type(screen.getByLabelText(words.colour), '3456');
    expect(scopeBrand()).toBe(themeOf('#123456').colors?.['brand']?.[7]);
  });

  it('6: the preview is hidden from a reader and takes no focus: no heading, alert, status or header of its own', () => {
    draw(<Settings {...props()} />);

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      words.title,
      words.identity,
      words.pictures,
      words.frame,
      words.languagesSection,
      words.preview,
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    for (const which of ['header', 'card'] as const) {
      expect(picture(which).getAttribute('aria-hidden')).toBe('true');
      expect(picture(which).hasAttribute('inert')).toBe(true);
    }
    expect(screen.getAllByRole('textbox').length).toBe(4);
  });
});

const FORMATTED = '<b>Minh</b><br><span style="color:#1d3557">Phát</span>';

describe('Settings, the identity fields', () => {
  it('11: the Identity block holds the name, the formatted name with its hint and preview, and the description', () => {
    draw(<Settings {...props()} />);

    expect(screen.getByRole('heading', { level: 3, name: words.identity })).toBeDefined();
    expect(screen.getByRole('textbox', { name: labelled(words.name) })).toBeDefined();
    expect(screen.getByRole('textbox', { name: words.formattedName })).toBeDefined();
    expect(screen.getByText(words.formattedNameHint)).toBeDefined();
    expect(screen.getByText(words.formattedNamePreview)).toBeDefined();
    expect(screen.getByRole('textbox', { name: words.description })).toBeDefined();
  });

  it('11: typing redraws the field’s preview and the preview’s header and card before any save, the description on the card', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.click(screen.getByRole('textbox', { name: words.formattedName }));
    await userEvent.paste(FORMATTED);
    await userEvent.type(screen.getByRole('textbox', { name: words.description }), 'Vật liệu');

    for (const where of [picture('header'), picture('card')])
      expect(where.querySelector('[aria-hidden="true"] b')?.textContent).toBe('Minh');
    expect(picture('card').textContent).toContain('Vật liệu');
    expect(picture('header').textContent).not.toContain('Vật liệu');
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith({
      ...config,
      formattedName: FORMATTED,
      description: 'Vật liệu',
    });
  });
});

describe('Settings, the tab icon and the phone-app icon', () => {
  const user = userEvent.setup({ applyAccept: false });
  const file = (type = 'image/png', size = 10) =>
    new File([new Uint8Array(size)], 'icon', { type });
  const input = (label: string) =>
    field(label).querySelector<HTMLInputElement>('input[type=file]')!;
  const drawn = (kind: 'tab-icon' | 'app-icon') => ({
    address: `/api/pictures/minh-phat/${kind}?v=v1`,
    version: '',
  });
  const held = {
    ...NO_PICTURES,
    'tab-icon': drawn('tab-icon'),
    'app-icon': drawn('app-icon'),
  };

  it('12: holds both icon fields beside the logos, the drawn one named where none is stored, and the preview wears the addresses', () => {
    draw(<Settings {...props({ pictures: held })} />);

    for (const label of [words.tabIcon, words.appIcon]) {
      const one = within(field(label));
      expect(one.getByText(words.iconDrawn)).toBeTruthy();
      expect(one.queryByRole('button', { name: /^Remove/ })).toBeNull();
      expect(one.getByRole('button', { name: /^Upload/ })).toBeTruthy();
    }
    expect(screen.getByText(words.tabIconHint)).toBeTruthy();
    expect(screen.getByText(words.appIconHint)).toBeTruthy();
    expect(document.querySelector('[data-preview="tab"] img')?.getAttribute('src')).toBe(
      '/api/pictures/minh-phat/tab-icon?v=v1',
    );
    expect(document.querySelector('[data-preview="home"] img')?.getAttribute('src')).toBe(
      '/api/pictures/minh-phat/app-icon?v=v1&size=192',
    );
    expect(screen.getByText(words.iconPreviewTab)).toBeTruthy();
    expect(screen.getByText(words.iconPreviewHome)).toBeTruthy();
  });

  it('12: a chosen icon is made by the browser and saved at once, the phone-app icon with its second size', async () => {
    const onPicture = vi.fn();
    const makeIcon = vi
      .fn()
      .mockResolvedValueOnce({ picture: 'data:image/png;base64,AAAA' })
      .mockResolvedValueOnce({
        picture: 'data:image/png;base64,BBBB',
        small: 'data:image/png;base64,CCCC',
      });
    draw(<Settings {...props({ pictures: held, onPicture, makeIcon })} />);

    const tab = file();
    await user.upload(input(words.tabIcon), tab);
    await waitFor(() =>
      expect(onPicture).toHaveBeenLastCalledWith(
        'tab-icon',
        'data:image/png;base64,AAAA',
        undefined,
      ),
    );
    expect(makeIcon).toHaveBeenLastCalledWith(tab, 'tab-icon');
    await user.upload(input(words.appIcon), file());
    await waitFor(() =>
      expect(onPicture).toHaveBeenLastCalledWith(
        'app-icon',
        'data:image/png;base64,BBBB',
        'data:image/png;base64,CCCC',
      ),
    );
  });

  it('12: refuses at the chooser a file that is no image, one over 200 KB, a phone-app icon under 512 and a file the browser cannot read, each under its own field', async () => {
    const onPicture = vi.fn();
    const makeIcon = vi
      .fn()
      .mockResolvedValueOnce('tooSmall')
      .mockRejectedValueOnce(new Error('unreadable'));
    draw(<Settings {...props({ pictures: held, onPicture, makeIcon })} />);
    const message = (label: string) => within(field(label)).getByRole('alert').textContent;

    await user.upload(input(words.tabIcon), file('text/plain'));
    expect(message(words.tabIcon)).toBe(words.logoNotImage);
    await user.upload(input(words.tabIcon), file('image/png', MAX_LOGO_BYTES + 1));
    expect(message(words.tabIcon)).toBe(
      words.logoTooLarge.replace('{{max}}', String(MAX_LOGO_BYTES / 1024)),
    );
    await user.upload(input(words.appIcon), file());
    await waitFor(() => expect(message(words.appIcon)).toBe(words.iconTooSmall));
    await user.upload(input(words.tabIcon), file());
    await waitFor(() => expect(message(words.tabIcon)).toBe(words.logoNotImage));
    expect(within(field(words.appIcon)).getAllByRole('alert')).toHaveLength(1);
    expect(onPicture).not.toHaveBeenCalled();
  });

  it('12: refuses at the chooser an icon the browser makes over 200 KB at either size, under its own field with its own word, and takes one at the limit', async () => {
    const onPicture = vi.fn();
    const url = (bytes: number) =>
      `data:image/png;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4 - ((3 - (bytes % 3)) % 3))}${'='.repeat((3 - (bytes % 3)) % 3)}`;
    const small = { picture: url(10), small: url(MAX_LOGO_BYTES + 1) };
    const makeIcon = vi
      .fn()
      .mockResolvedValueOnce({ picture: url(MAX_LOGO_BYTES + 1) })
      .mockResolvedValueOnce(small)
      .mockResolvedValueOnce({ picture: url(MAX_LOGO_BYTES), small: url(MAX_LOGO_BYTES) });
    draw(<Settings {...props({ pictures: held, onPicture, makeIcon })} />);
    const message = (label: string) => within(field(label)).getByRole('alert').textContent;
    const tooLarge = words.iconTooLarge.replace('{{max}}', String(MAX_LOGO_BYTES / 1024));

    await user.upload(input(words.tabIcon), file());
    await waitFor(() => expect(message(words.tabIcon)).toBe(tooLarge));
    await user.upload(input(words.appIcon), file());
    await waitFor(() => expect(message(words.appIcon)).toBe(tooLarge));
    expect(onPicture).not.toHaveBeenCalled();
    await user.upload(input(words.appIcon), file());
    await waitFor(() => expect(onPicture).toHaveBeenCalledOnce());
    expect(within(field(words.appIcon)).queryByRole('alert')).toBeNull();
  });

  it('12: shows a stored icon with its remove, which sends none', async () => {
    const onPicture = vi.fn();
    const stored = { ...held, 'tab-icon': { address: '/api/t', version: 'tag' } };
    draw(<Settings {...props({ pictures: stored, onPicture })} />);

    expect(within(field(words.tabIcon)).queryByText(words.iconDrawn)).toBeNull();
    await user.click(
      within(field(words.tabIcon)).getByRole('button', { name: words.tabIconRemove }),
    );
    expect(onPicture).toHaveBeenLastCalledWith('tab-icon', null);
    expect(
      within(field(words.appIcon)).queryByRole('button', { name: words.appIconRemove }),
    ).toBeNull();
  });

  it('12: the phone-app icon’s remove sends none, and a missing address draws no picture', async () => {
    const onPicture = vi.fn();
    const stored = { ...held, 'app-icon': { address: '/api/a', version: 'tag' } };
    draw(<Settings {...props({ pictures: stored, onPicture })} />);
    await user.click(
      within(field(words.appIcon)).getByRole('button', { name: words.appIconRemove }),
    );
    expect(onPicture).toHaveBeenLastCalledWith('app-icon', null);
  });

  it('12: a reply that predates the icons names none, and the preview draws no address', () => {
    draw(<Settings {...props()} />);
    expect(document.querySelector('[data-preview="tab"] img')?.getAttribute('src')).toBeNull();
    expect(within(field(words.tabIcon)).getByText(words.iconDrawn)).toBeTruthy();
  });
});
