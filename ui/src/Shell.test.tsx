import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { PAGES } from './nav';
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

const sideMenu = () => screen.getAllByRole('navigation', { name: 'Menu' })[0];
const bar = () => screen.getAllByRole('navigation', { name: 'Menu' })[1];

describe('Shell', () => {
  it('shows the company’s name as the first heading, and a page in the middle', () => {
    shell(['en']);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
    expect(screen.getByText('the page')).toBeTruthy();
  });

  it('10: The header shows the company’s name beside the stand-in logo, never the stored one', () => {
    shell(['en']);

    const header = document.querySelector('header')!;
    expect(header.querySelector('img')).toBeNull();
    expect(header.querySelector('svg.tabler-icon-brand-adobe')?.getAttribute('width')).toBe('36');
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
  });

  it('1: The header is painted 135° from the brand’s shade 7 to 9 and the menu 180° from 9 to 8, in white text', () => {
    shell(['en']);

    const header = document.querySelector('header')!;
    expect(header.getAttribute('style')).toContain(
      'linear-gradient(135deg, var(--mantine-color-brand-7) 0%, var(--mantine-color-brand-9) 100%)',
    );
    expect(sideMenu().getAttribute('style')).toContain(
      'linear-gradient(180deg, var(--mantine-color-brand-9) 0%, var(--mantine-color-brand-8) 100%)',
    );
    expect(header.style.color).toBe('rgb(255, 255, 255)');
    expect(sideMenu().style.color).toBe('rgb(255, 255, 255)');
    // 250 pixels wide, 64 high for the phone's bar, as Mantine writes them: in rem.
    const rules = [...document.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('');
    expect(rules).toContain('--app-shell-navbar-width:calc(15.625rem');
    expect(rules).toContain('--app-shell-footer-height:calc(4rem');
  });

  it('6: One navigation named Menu a width: the side menu from 768, the bar below; the open page washed', () => {
    shell(['en']);

    expect(sideMenu().className).toContain('mantine-visible-from-sm');
    expect(bar().parentElement?.className).toContain('mantine-hidden-from-sm');
    const link = within(sideMenu()).getByRole('link', { name: 'Settings' });
    expect(link.getAttribute('href')).toBe('/settings');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(
      within(sideMenu()).getByRole('link', { name: 'Orders' }).getAttribute('aria-current'),
    ).toBe(null);
  });

  it('2: The PC’s toggle is named by its act, hides and shows the menu, and tells the device', async () => {
    const onShown = vi.fn();
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        onShown={onShown}
      >
        <p>the page</p>
      </Shell>,
    );
    const hide = screen.getByRole('button', { name: 'Hide the menu' });
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(hide.className).toContain('mantine-visible-from-sm');

    await userEvent.click(hide);
    const show = screen.getByRole('button', { name: 'Show the menu' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('navigation', { name: 'Menu' })).toHaveLength(1);
    expect(onShown).toHaveBeenLastCalledWith(false);

    await userEvent.click(show);
    expect(screen.getAllByRole('navigation', { name: 'Menu' })).toHaveLength(2);
    expect(onShown).toHaveBeenLastCalledWith(true);
  });

  it('2: The menu starts hidden when the device kept it hidden', () => {
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        shown={false}
      >
        <p>the page</p>
      </Shell>,
    );

    expect(
      screen.getByRole('button', { name: 'Show the menu' }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.getAllByRole('navigation', { name: 'Menu' })).toHaveLength(1);
  });

  it('3: The bar holds the first four pages in the menu’s order and More, each named, the open page marked', () => {
    shell(['en']);

    const links = within(bar()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'My deliveries',
      'Orders',
      'Delivery requests',
      'Settings',
      'More',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/my-deliveries',
      '/orders',
      '/deliveries',
      '/settings',
      '/more',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      'page',
      null,
    ]);
  });

  it('3: A page past the fourth marks More, and More itself is marked on its own page', () => {
    const later = [...PAGES.filter((page) => page.id !== 'settings'), PAGES[3]];
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        pages={later}
      >
        <p>the page</p>
      </Shell>,
    );
    const links = within(bar()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      null,
      'page',
    ]);
  });

  it('3: The bar’s More goes to the address the app gives it', () => {
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        morePath="/operator/more"
      >
        <p>the page</p>
      </Shell>,
    );

    expect(within(bar()).getByRole('link', { name: 'More' }).getAttribute('href')).toBe(
      '/operator/more',
    );
  });

  it('5: The language is a header button over the company’s languages, the current one marked', async () => {
    const onLanguage = vi.fn();
    shell(['vi', 'en'], { onLanguage, onSignOut: vi.fn() });

    const button = screen.getByRole('button', { name: 'Language' });
    expect(button.textContent).toBe('EN');
    await userEvent.click(button);
    expect(screen.getByRole('menuitem', { name: 'English' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Tiếng Việt' }).getAttribute('aria-current')).toBe(
      'false',
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tiếng Việt' }));

    expect(onLanguage).toHaveBeenCalledExactlyOnceWith('vi');
  });

  it('5: The user’s menu no longer holds the language, and one language gives no button', async () => {
    shell(['vi', 'en']);
    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.queryByRole('menuitem', { name: 'Tiếng Việt' })).toBeNull();
    cleanup();

    const onSignOut = vi.fn();
    shell(['en'], { onLanguage: vi.fn(), onSignOut });
    expect(screen.queryByRole('button', { name: 'Language' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('starts with the user’s menu open when asked', () => {
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

  it('lists the pages of the user’s own in the user’s menu, above sign-out, only when it is given some', async () => {
    shell(['en']);
    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Sign out']);

    draw(
      <Shell
        brand={brand}
        user="ops"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        menuLinks={[{ to: '/mine', label: 'Mine' }]}
      >
        <p>the page</p>
      </Shell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'ops' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent).slice(-2)).toEqual(['Mine', 'Sign out']);
    expect(items.at(-2)?.getAttribute('href')).toBe('/mine');
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
