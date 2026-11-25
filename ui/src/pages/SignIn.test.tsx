import { CREDO_COLOUR } from '@credo/shared';
import { DEMO_JOIN_TOKEN } from '@credo/shared/demo';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../../tests/open';
import { draw } from '../../tests/render';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { OperatorSignIn } from './operator/OperatorSignIn';
import { Providers } from '../frame/Providers';
import { QrLanding } from './client/QrLanding';
import { SignIn, SignInFrame } from './SignIn';
import { BRAND_GRADIENT, shadesOf } from '../design-system/appTheme';
import { TOKENS } from '../design-system/tokens';

const brand = { name: 'Minh Phát', logo: null };
const words = DICTIONARIES.en;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
/** A wait's line as the door says it, the count filled as the door fills it. */
const waited = (
  language: 'en' | 'vi',
  unit: 'second' | 'seconds' | 'minute' | 'minutes',
  count: number,
) => DICTIONARIES[language].wait[unit].replace('{{count}}', String(count));

describe('SignIn', () => {
  it('shows the company’s name as the first heading', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
  });

  it('16: draws a wait as one red line, in seconds under a minute and in whole minutes from one, in both languages', () => {
    const shown = (seconds: number, language: 'en' | 'vi') => {
      draw(
        <Providers colour={CREDO_COLOUR} language={language} test>
          <SignIn brand={brand} status="wait" waitSeconds={seconds} onSubmit={vi.fn()} />
        </Providers>,
      );
      const text = screen.getByRole('alert').textContent;
      cleanup();
      return text;
    };

    expect(shown(30, 'en')).toBe(waited('en', 'seconds', 30));
    expect(shown(1, 'en')).toBe(waited('en', 'second', 1));
    expect(shown(60, 'en')).toBe(waited('en', 'minute', 1));
    expect(shown(840, 'en')).toBe(waited('en', 'minutes', 14));
    expect(shown(30, 'vi')).toBe(waited('vi', 'seconds', 30));
    expect(shown(900, 'vi')).toBe(waited('vi', 'minutes', 15));
  });

  it('15: draws “or” and the passkey button only where a press is given, and sends the tick as it stands', async () => {
    const { unmount } = draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull();
    expect(screen.queryByText(words.auth.or)).toBeNull();
    unmount();

    const onPasskey = vi.fn();
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} onPasskey={onPasskey} />);
    expect(screen.getByText(words.auth.or)).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: words.auth.remember }));
    await userEvent.click(screen.getByRole('button', { name: words.auth.passkey }));

    expect(onPasskey).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('8: draws “Use a QR code” under “or” where a press is given, “or” where either button is, and nothing where neither', async () => {
    const { unmount } = draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: words.qrScan.button })).toBeNull();
    unmount();

    const onQr = vi.fn();
    const alone = draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} onQr={onQr} />);
    expect(screen.getByText(words.auth.or)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.auth.passkey })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: words.qrScan.button }));
    expect(onQr).toHaveBeenCalledOnce();
    alone.unmount();

    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} onPasskey={vi.fn()} onQr={onQr} />);
    expect(screen.getAllByText(words.auth.or)).toHaveLength(1);
    expect(screen.getByRole('button', { name: words.auth.passkey })).toBeTruthy();
    expect(screen.getByRole('button', { name: words.qrScan.button })).toBeTruthy();
  });

  it('16: tells a passkey not given and one refused as one red line each, and waits on the touch in the passkey button alone', () => {
    const shown = (status: 'notGiven' | 'passkeyRefused' | 'passkeyBusy') => {
      draw(<SignIn brand={brand} status={status} onSubmit={vi.fn()} onPasskey={vi.fn()} />);
      const alert = screen.queryByRole('alert')?.textContent ?? null;
      const loading = [
        screen.getByRole('button', { name: words.auth.submit }),
        screen.getByRole('button', { name: words.auth.passkey }),
      ].map((button) => button.hasAttribute('data-loading'));
      cleanup();
      return { alert, loading };
    };

    expect(shown('notGiven')).toEqual({ alert: words.passkey.notGiven, loading: [false, false] });
    expect(shown('passkeyRefused')).toEqual({
      alert: words.auth.passkeyRefused,
      loading: [false, false],
    });
    expect(shown('passkeyBusy')).toEqual({ alert: null, loading: [false, true] });
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<SignIn brand={brand} status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(labelled(words.auth.username)), 'root');
    await userEvent.type(screen.getByLabelText(labelled(words.auth.password)), 'secret');
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('root', 'secret', true);
  });

  it('7: starts with “Remember me” ticked, and sends the tick as it stands', async () => {
    const onSubmit = vi.fn();
    draw(<SignIn brand={brand} status="idle" onSubmit={onSubmit} />);

    const tick = screen.getByRole<HTMLInputElement>('checkbox', { name: words.auth.remember });
    expect(tick.checked).toBe(true);
    await userEvent.type(screen.getByLabelText(labelled(words.auth.username)), 'root');
    await userEvent.type(screen.getByLabelText(labelled(words.auth.password)), 'secret');
    await userEvent.click(tick);
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('root', 'secret', false);
  });

  it('wears the account title over its form, and the frame names its heading as it is told over what it holds', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.auth.title);
    cleanup();

    draw(
      <SignInFrame brand={brand} title="Join us">
        <p>inside</p>
      </SignInFrame>,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Join us');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(brand.name);
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('starts from what is already typed', () => {
    draw(
      <SignIn
        brand={brand}
        status="idle"
        initial={{ username: 'root', password: 'secret' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.auth.username)).value).toBe(
      'root',
    );
  });

  it('a refusal says what to do, and an idle form says nothing', () => {
    const { rerender } = draw(<SignIn brand={brand} status="refused" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe(words.auth.refused);

    rerender(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('waits while the service answers', () => {
    draw(<SignIn brand={brand} status="busy" onSubmit={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: words.auth.submit }).hasAttribute('data-loading'),
    ).toBe(true);
  });

  it('is the old card: a title over underlined fields with their placeholders, the one tick and no extras', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.auth.title);
    expect(screen.getByPlaceholderText(words.auth.usernamePlaceholder)).toBeTruthy();
    expect(screen.getByPlaceholderText(words.auth.passwordPlaceholder)).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the logo in the tinted head when the company has one', () => {
    const { container } = draw(
      <SignIn
        brand={{ ...brand, logo: 'data:image/png;base64,AAAA' }}
        status="idle"
        onSubmit={vi.fn()}
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });
});

/** Every door the frame draws, one state each, and the two doors that need the whole app. */
const doors = (languages?: readonly ('en' | 'vi')[]) => {
  const onLanguage = vi.fn();
  const own = { languages, onLanguage };
  return [
    ['sign-in', <SignIn key="a" brand={brand} status="idle" onSubmit={vi.fn()} {...own} />],
    [
      'sign-in refused',
      <SignIn key="b" brand={brand} status="refused" onSubmit={vi.fn()} {...own} />,
    ],
    ['operator', <OperatorSignIn key="c" status="idle" onSubmit={vi.fn()} {...own} />],
    [
      'operator not given',
      <OperatorSignIn key="d" status="notGiven" onSubmit={vi.fn()} {...own} />,
    ],
    ['qr busy', <QrLanding key="e" brand={brand} status="busy" onPassword={vi.fn()} {...own} />],
    [
      'qr refused',
      <QrLanding key="f" brand={brand} status="refused" onPassword={vi.fn()} {...own} />,
    ],
    [
      'frame',
      <SignInFrame key="g" brand={brand} title="T" {...own}>
        <p>x</p>
      </SignInFrame>,
    ],
  ] as const;
};

describe('the frame every door wears', () => {
  it('14: every door’s card holds the band with the logo where there is one, the name as the first heading and the title as the second', () => {
    for (const [name, door] of doors()) {
      const { container } = draw(door);
      const headings = screen.getAllByRole('heading');
      expect(headings[0]?.tagName, name).toBe('H1');
      expect(headings[0]?.textContent, name).toBeTruthy();
      expect(headings[1]?.tagName, name).toBe('H2');
      expect(headings[1]?.textContent, name).toBeTruthy();
      expect(container.querySelector('[data-bar]'), name).toBeTruthy();
      expect(container.querySelector('img'), name).toBeNull();
      cleanup();
    }
    draw(
      <SignInFrame brand={{ name: 'Minh Phát', logo: 'logo.png' }} title="T">
        x
      </SignInFrame>,
    );
    expect(screen.getByRole('img', { name: 'Minh Phát' }).getAttribute('src')).toBe('logo.png');
  });

  it('7: every button on the brand’s gradient wears the header’s text, and the language switch its washes', () => {
    let seen = 0;
    for (const [name, door] of doors(['vi', 'en'])) {
      const { container } = draw(door);
      for (const button of container.querySelectorAll('button[type]')) {
        if (!button.getAttribute('style')?.includes(BRAND_GRADIENT)) continue;
        seen += 1;
        expect((button as HTMLElement).style.color, name).toBe('var(--credo-on-header)');
      }
      const group = screen.getByRole('group', { name: words.user.language });
      expect(group.getAttribute('style'), name).toContain('var(--credo-language-edge)');
      expect(
        within(group).getByRole('button', { name: LANGUAGE_NAMES.en }).getAttribute('style'),
        name,
      ).toContain('var(--credo-language-picked)');
      cleanup();
    }
    expect(seen).toBeGreaterThan(1);
  });

  it('16: no door draws a side menu, the phone’s bar or a header', () => {
    for (const [name, door] of doors()) {
      draw(door);
      expect(screen.queryByRole('navigation'), name).toBeNull();
      expect(document.querySelector('nav'), name).toBeNull();
      expect(document.querySelector('footer'), name).toBeNull();
      expect(document.querySelector('header'), name).toBeNull();
      expect(screen.queryByRole('banner'), name).toBeNull();
      cleanup();
    }
  });

  it('13: every door stands on the brand’s sweep over the whole screen, and its card carries no gradient but its bar’s', () => {
    for (const [name, door] of doors()) {
      const { container } = draw(door);
      const sweep = container.querySelector<HTMLElement>(`[style*="${TOKENS.doorSweep}"]`);
      expect(sweep?.getAttribute('style'), name).toContain('100vh');
      for (const heading of screen.getAllByRole('heading'))
        expect(sweep?.contains(heading), name).toBe(true);
      const gradients = [...container.querySelectorAll('[style]')]
        .map((el) => el.getAttribute('style'))
        .filter((style) => style?.includes('gradient'));
      expect(
        gradients.every(
          (style) => style?.includes('--credo-header-gradient') || style?.includes('90deg'),
        ),
        name,
      ).toBe(true);
      cleanup();
    }
  });

  it('13: a client’s door takes its client’s colour, credo’s doors credo’s', () => {
    const style = (colour: string, door: ReactNode) => {
      const { container } = render(
        <Providers colour={colour} language="en" test>
          <MemoryRouter>{door}</MemoryRouter>
        </Providers>,
      );
      const css = [...document.querySelectorAll('style')].map((el) => el.textContent).join('');
      const sweep = container
        .querySelector(`[style*="${TOKENS.doorSweep}"]`)
        ?.getAttribute('style');
      cleanup();
      return { css, sweep };
    };
    const client = style('#aa3300', <SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    const credo = style(CREDO_COLOUR, <OperatorSignIn status="idle" onSubmit={vi.fn()} />);

    expect(client.sweep).toContain('var(--credo-header-gradient)');
    expect(client.css).toContain(
      '--credo-header-gradient: linear-gradient(135deg, var(--mantine-color-brand-7)',
    );
    expect(client.css).toContain(shadesOf('#aa3300')[7]);
    expect(client.css).not.toContain(shadesOf(CREDO_COLOUR)[7]);
    expect(credo.css).toContain(shadesOf(CREDO_COLOUR)[7]);
    expect(credo.css).not.toContain(shadesOf('#aa3300')[7]);
  });

  it('15: a door whose caller offers one language, or none, draws no switch', () => {
    for (const offered of [undefined, [], ['en']] as const) {
      for (const [name, door] of doors(offered)) {
        draw(door);
        expect(screen.queryByRole('group', { name: words.user.language }), name).toBeNull();
        expect(screen.queryByRole('button', { name: LANGUAGE_NAMES.vi }), name).toBeNull();
        cleanup();
      }
    }
    for (const [name, door] of doors(['vi', 'en'])) {
      draw(door);
      expect(screen.getByRole('group', { name: words.user.language }), name).toBeTruthy();
      cleanup();
    }
  });

  it('15: the switch changes the words shown, never what is submitted', async () => {
    const onSubmit = vi.fn();
    const onLanguage = vi.fn();
    draw(
      <SignIn
        brand={brand}
        status="idle"
        onSubmit={onSubmit}
        languages={['vi', 'en']}
        onLanguage={onLanguage}
      />,
    );
    await userEvent.type(screen.getByLabelText(labelled(words.auth.username)), 'root');
    await userEvent.click(screen.getByRole('button', { name: LANGUAGE_NAMES.vi }));

    expect(onLanguage).toHaveBeenCalledExactlyOnceWith('vi');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>(labelled(words.auth.username)).value).toBe(
      'root',
    );
    cleanup();

    const { api, device } = openApp('/login?client-code=demo', { out: true });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(words.auth.title);
    await userEvent.click(screen.getByRole('button', { name: LANGUAGE_NAMES.vi }));
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      DICTIONARIES.vi.auth.title,
    );
    expect(device.language()).toBe('vi');
    expect(api.signIn).not.toHaveBeenCalled();
  });
});

describe('the join page in the same frame', () => {
  it('14+16: draws the card and no header or menu, and the language switch since its caller offers a handler', async () => {
    openApp(`/operator/join#${DEMO_JOIN_TOKEN}`);
    await screen.findByRole('button', { name: words.passkey.makeButton });
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(document.querySelector('nav')).toBeNull();
    expect(screen.getByRole('group', { name: words.user.language })).toBeTruthy();
  });
});

describe('SignIn, the formatted name and the description', () => {
  const company = { ...brand, formattedName: '<b>Minh</b> Phát', description: 'Vật liệu xây dựng' };

  it('3, 4: the sign-in and the QR landing draw the formatted name and the description under it', () => {
    for (const door of [
      <SignIn key="s" brand={company} status="idle" onSubmit={vi.fn()} />,
      <QrLanding key="q" brand={company} status="busy" onPassword={vi.fn()} />,
    ]) {
      const { container } = draw(door);
      expect(container.querySelector('h1 [aria-hidden="true"] b')?.textContent).toBe('Minh');
      expect(screen.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeDefined();
      expect(screen.getByText('Vật liệu xây dựng')).toBeDefined();
      cleanup();
    }
  });

  it('4: draws no description where none is set', () => {
    const { container } = draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(container.querySelector('h1')?.innerHTML).toBe('Minh Phát');
    expect(screen.queryByText('Vật liệu xây dựng')).toBeNull();
  });
});
