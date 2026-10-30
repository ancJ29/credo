import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { Shell } from './Shell';

const brand = { name: 'Minh Phát', logo: 'data:image/png;base64,AAAA' };

const shell = (
  languages: ('vi' | 'en')[],
  handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() },
) =>
  draw(
    <Shell brand={brand} user="root" languages={languages} {...handlers}>
      <p>the page</p>
    </Shell>,
  );

describe('Shell', () => {
  it('shows the company’s name as the first heading, and a page in the middle', () => {
    shell(['en']);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
    expect(screen.getByText('the page')).toBeTruthy();
  });

  it('lists Settings in the menu, marked as the page shown', () => {
    shell(['en']);

    const link = screen.getByRole('link', { name: 'Settings' });
    expect(link.getAttribute('href')).toBe('/settings');
    expect(link.getAttribute('data-active')).toBe('true');
  });

  it('opens and closes the menu on a phone', async () => {
    shell(['en']);
    const burger = screen.getByRole('button', { name: 'Menu' });

    await userEvent.click(burger);
    expect(burger.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  it('offers the language switch only when the company offers both', async () => {
    const onLanguage = vi.fn();
    shell(['vi', 'en'], { onLanguage, onSignOut: vi.fn() });

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tiếng Việt' }));

    expect(onLanguage).toHaveBeenCalledExactlyOnceWith('vi');
  });

  it('does not offer the language the screen is already in', async () => {
    shell(['vi', 'en']);

    await userEvent.click(screen.getByRole('button', { name: 'root' }));

    expect(screen.getByRole('menuitem', { name: 'English' }).hasAttribute('disabled')).toBe(true);
  });

  it('has no language switch when the company offers one language', async () => {
    const onSignOut = vi.fn();
    shell(['en'], { onLanguage: vi.fn(), onSignOut });

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.queryByText('Language')).toBeNull();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('starts with the user’s menu open when asked, and without a logo shows the name alone', () => {
    draw(
      <Shell
        brand={{ name: 'Minh Phát', logo: null }}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        userMenuOpen
      >
        <p>the page</p>
      </Shell>,
    );

    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
    expect(document.querySelector('header img')).toBeNull();
  });

  it('shows a badge beside the brand only when it is given one, as the operator’s frame does', () => {
    shell(['en']);
    expect(document.querySelector('header .mantine-Badge-root')).toBeNull();
    cleanup();

    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        badge="Operator"
      >
        <p>the page</p>
      </Shell>,
    );
    expect(document.querySelector('header .mantine-Badge-root')?.textContent).toBe('Operator');
  });

  it('C: The user’s menu lists "Change password" only where the app gives the page, and it opens that page', async () => {
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        userMenuOpen
      >
        <p>the page</p>
      </Shell>,
    );
    expect(screen.queryByRole('menuitem', { name: 'Change password' })).toBeNull();
    cleanup();

    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        passwordPath="/password"
      >
        <p>the page</p>
      </Shell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.getByRole('menuitem', { name: 'Change password' }).getAttribute('href')).toBe(
      '/password',
    );
  });
});
