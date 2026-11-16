import { CREDO_COLOUR } from '@credo/shared';
import { DEMO_JOIN_TOKEN } from '@credo/shared/demo';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../../tests/open';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { OperatorSignIn } from './operator/OperatorSignIn';
import { Providers } from '../frame/Providers';
import { QrLanding } from './client/QrLanding';
import { SignIn, SignInFrame } from './SignIn';
import { BRAND_GRADIENT, shadesOf } from '../theme';

const brand = { name: 'Minh Phát', logo: null };

describe('SignIn', () => {
  it('shows the company’s name as the first heading', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
  });

  it('16: draws a wait as one red line, in seconds under a minute and in whole minutes from one, in both languages', () => {
    const words = (seconds: number, language: 'en' | 'vi') => {
      draw(
        <Providers colour={CREDO_COLOUR} language={language} test>
          <SignIn brand={brand} status="wait" waitSeconds={seconds} onSubmit={vi.fn()} />
        </Providers>,
      );
      const text = screen.getByRole('alert').textContent;
      cleanup();
      return text;
    };

    expect(words(30, 'en')).toBe('Too many wrong tries. Try again in 30 seconds.');
    expect(words(1, 'en')).toBe('Too many wrong tries. Try again in 1 second.');
    expect(words(60, 'en')).toBe('Too many wrong tries. Try again in 1 minute.');
    expect(words(840, 'en')).toBe('Too many wrong tries. Try again in 14 minutes.');
    expect(words(30, 'vi')).toBe('Nhập sai quá nhiều lần. Hãy thử lại sau 30 giây.');
    expect(words(900, 'vi')).toBe('Nhập sai quá nhiều lần. Hãy thử lại sau 15 phút.');
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<SignIn brand={brand} status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Username/), 'root');
    await userEvent.type(screen.getByLabelText(/Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('root', 'secret');
  });

  it('wears the account title over its form, and the frame names its heading as it is told over what it holds', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sign in to your account');
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

    expect(screen.getByLabelText<HTMLInputElement>(/Username/).value).toBe('root');
  });

  it('a refusal says what to do, and an idle form says nothing', () => {
    const { rerender } = draw(<SignIn brand={brand} status="refused" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Wrong username or password');

    rerender(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('waits while the service answers', () => {
    draw(<SignIn brand={brand} status="busy" onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sign In' }).hasAttribute('data-loading')).toBe(true);
  });

  it('is the old card: a title over underlined fields with their placeholders, and no extras', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sign in to your account');
    expect(screen.getByPlaceholderText('Enter your username')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
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
  it('1: every door draws the app’s header: the brand gradient, a logo and the name', () => {
    for (const [name, door] of doors()) {
      const { container } = draw(door);
      const header = screen.getByRole('banner');
      expect(header.getAttribute('style'), name).toContain(BRAND_GRADIENT);
      expect(header.querySelector('svg'), name).toBeTruthy();
      expect(within(header).getByRole('heading', { level: 1 }).textContent, name).toBeTruthy();
      expect(container.querySelectorAll('header'), name).toHaveLength(1);
      cleanup();
    }
    draw(
      <SignInFrame brand={{ name: 'Minh Phát', logo: 'logo.png' }} title="T">
        x
      </SignInFrame>,
    );
    expect(screen.getByRole('banner').querySelector('img')?.getAttribute('src')).toBe('logo.png');
  });

  it('2: no door draws a side menu or the phone’s bar', () => {
    for (const [name, door] of doors()) {
      draw(door);
      expect(screen.queryByRole('navigation'), name).toBeNull();
      expect(document.querySelector('nav'), name).toBeNull();
      expect(document.querySelector('footer'), name).toBeNull();
      cleanup();
    }
  });

  it('3: the card sits on the app’s ground, not a gradient of its own', () => {
    for (const [name, door] of doors()) {
      const { container } = draw(door);
      const styles = [...container.querySelectorAll('[style]')].map((el) =>
        el.getAttribute('style'),
      );
      const gradients = styles.filter((style) => style?.includes('gradient'));
      expect(
        gradients.every((style) => style?.includes('brand-7')),
        name,
      ).toBe(true);
      expect(styles.join(' '), name).not.toContain('neutral-0');
      cleanup();
    }
  });

  it('4: a client’s door takes its client’s colour, credo’s doors credo’s', () => {
    const style = (colour: string, door: ReactNode) => {
      const { container } = render(
        <Providers colour={colour} language="en" test>
          <MemoryRouter>{door}</MemoryRouter>
        </Providers>,
      );
      const css = [...document.querySelectorAll('style')].map((el) => el.textContent).join('');
      const header = container.querySelector('header');
      cleanup();
      return { css, header: header?.getAttribute('style') };
    };
    const client = style('#aa3300', <SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    const credo = style(CREDO_COLOUR, <OperatorSignIn status="idle" onSubmit={vi.fn()} />);

    expect(client.header).toContain('--mantine-color-brand-7');
    expect(client.css).toContain(shadesOf('#aa3300')[7]);
    expect(client.css).not.toContain(shadesOf(CREDO_COLOUR)[7]);
    expect(credo.css).toContain(shadesOf(CREDO_COLOUR)[7]);
    expect(credo.css).not.toContain(shadesOf('#aa3300')[7]);
  });

  it('6: a door whose caller offers one language, or none, draws no switch', () => {
    for (const offered of [undefined, [], ['en']] as const) {
      for (const [name, door] of doors(offered)) {
        draw(door);
        expect(screen.queryByRole('group', { name: 'Language' }), name).toBeNull();
        expect(screen.queryByRole('button', { name: 'Tiếng Việt' }), name).toBeNull();
        cleanup();
      }
    }
    for (const [name, door] of doors(['vi', 'en'])) {
      draw(door);
      expect(screen.getByRole('group', { name: 'Language' }), name).toBeTruthy();
      cleanup();
    }
  });

  it('7: the switch changes the words shown, never what is submitted', async () => {
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
    await userEvent.type(screen.getByLabelText(/Username/), 'root');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));

    expect(onLanguage).toHaveBeenCalledExactlyOnceWith('vi');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>(/Username/).value).toBe('root');
    cleanup();

    const { api, device } = openApp('/login?client-code=demo', { out: true });
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      'Sign in to your account',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe(
      DICTIONARIES.vi.auth.title,
    );
    expect(device.language()).toBe('vi');
    expect(api.signIn).not.toHaveBeenCalled();
  });
});

describe('the join page in the same frame', () => {
  it('1+2: draws the header and no menu, and the language switch since its caller offers a handler', async () => {
    openApp(`/operator/join#${DEMO_JOIN_TOKEN}`);
    await screen.findByRole('button', { name: 'Make a passkey' });
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(document.querySelector('nav')).toBeNull();
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
  });
});
