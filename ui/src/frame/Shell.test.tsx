import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { PAGES } from '../nav';
import { Providers } from './Providers';
import { MemoryRouter } from 'react-router';
import { shadesOf } from '../design-system/appTheme';
import { onBrand } from '../design-system/onBrand';
import { HEADER_WASHES } from '../design-system/tokens';
import { HeaderBrand, type Look, Shell } from './Shell';

const frameCss = readFileSync(join(import.meta.dirname, 'frameLook.module.css'), 'utf8');
const words = DICTIONARIES.en;
const brand = { name: 'Minh Phát', logo: 'data:image/png;base64,AAAA', logoOnColour: null };

const shell = (
  languages: ('vi' | 'en')[],
  handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() },
) =>
  draw(
    <Shell brand={brand} user="root" languages={languages} {...handlers}>
      <p>the page</p>
    </Shell>,
  );

const sideMenu = () => screen.getAllByRole('navigation', { name: words.nav.menu })[0];
const bar = () => screen.getAllByRole('navigation', { name: words.nav.menu })[1];

/** The shell drawn in a company's colour, with the variables the page's styles hold. */
const inColour = (colour: string) => {
  const drawn = render(
    <Providers colour={colour} language="en" test>
      <MemoryRouter initialEntries={['/settings']}>
        <Shell
          brand={brand}
          user="root"
          languages={['en']}
          onLanguage={vi.fn()}
          onSignOut={vi.fn()}
        >
          <p>the page</p>
        </Shell>
      </MemoryRouter>
    </Providers>,
  );
  const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('');
  const value = (name: string) => new RegExp(`--credo-${name}: ([^;]+);`).exec(css)?.[1];
  const result = { css, value, header: document.querySelector('header')!, menu: sideMenu() };
  return { ...result, drawn };
};

const frameStyles = readFileSync(join(import.meta.dirname, 'frame.module.css'), 'utf8');

describe('the header and the menu follow the colour', () => {
  it('7: the header draws the header’s pick, the washes following', () => {
    for (const colour of ['#2f7d6d', '#d97757', '#ff0000', '#ffff00', '#ffbf00', '#9e2d20']) {
      const pick = onBrand(shadesOf(colour), 'header');
      const { value, header, drawn } = inColour(colour);
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(pick.colour.slice(at, at + 2), 16));

      expect(value('on-header'), colour).toBe(pick.colour);
      expect(value('header-gradient'), colour).toBe(
        `linear-gradient(135deg, var(--mantine-color-brand-${pick.span[0]}) 0%, var(--mantine-color-brand-${pick.span.at(-1)}) 100%)`,
      );
      for (const [role, share] of Object.entries(HEADER_WASHES))
        expect(value(role), colour).toBe(`rgba(${r}, ${g}, ${b}, ${share / 100})`);
      expect(header.style.color, colour).toBe('var(--credo-on-header)');
      drawn.unmount();
    }
    // the light colour: dark text over the lighter shades, ending at its own colour
    const light = inColour('#d97757');
    expect(light.value('on-header')).toBe('#111827');
    expect(light.value('header-gradient')).toContain('brand-5) 0%, var(--mantine-color-brand-7)');
    expect(light.value('header-hover')).toBe('rgba(17, 24, 39, 0.12)');
    light.drawn.unmount();
  });

  it('7: the stylesheet’s header, buttons, chip, avatar and badge read the header’s variables', () => {
    for (const name of [
      'on-header',
      'header-hover',
      'header-badge',
      'header-avatar',
      'header-avatar-edge',
    ])
      expect(frameStyles).toContain(`var(--credo-${name})`);
  });

  it('8: the menu draws the menu’s pick, its open page and hover washes following', () => {
    for (const colour of ['#2f7d6d', '#d97757', '#ff0000', '#ffff00', '#ffbf00', '#9e2d20']) {
      const pick = onBrand(shadesOf(colour), 'menu');
      const { value, menu, drawn } = inColour(colour);
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(pick.colour.slice(at, at + 2), 16));

      expect(value('on-menu'), colour).toBe(pick.colour);
      expect(value('menu-gradient'), colour).toBe(
        `linear-gradient(180deg, var(--mantine-color-brand-${pick.span[0]}) 0%, var(--mantine-color-brand-${pick.span.at(-1)}) 100%)`,
      );
      expect(value('menu-hover'), colour).toBe(`rgba(${r}, ${g}, ${b}, 0.05)`);
      expect(value('menu-current'), colour).toBe(`rgba(${r}, ${g}, ${b}, 0.1)`);
      expect(menu.style.color, colour).toBe('var(--credo-on-menu)');
      drawn.unmount();
    }
    // amber is the one that leaves white: dark text on shades 8 to 7
    const amber = inColour('#ffbf00');
    expect(amber.value('on-menu')).toBe('#111827');
    expect(amber.value('menu-gradient')).toContain('brand-8) 0%, var(--mantine-color-brand-7)');
    amber.drawn.unmount();
    expect(frameStyles).toContain('color: var(--credo-on-menu)');
    expect(frameStyles).toContain('var(--credo-menu-hover)');
    expect(frameStyles).toContain('var(--credo-menu-current)');
  });
});

describe('Shell', () => {
  it('shows the company’s name as the first heading, and a page in the middle', () => {
    shell(['en']);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
    expect(screen.getByText('the page')).toBeTruthy();
  });

  it('10: The header shows the company’s name beside its logo, the stand-in where it has none', () => {
    shell(['en']);

    const header = document.querySelector('header')!;
    expect(header.querySelector('img')?.getAttribute('src')).toBe(brand.logo);
    expect(header.querySelector('svg.tabler-icon-brand-adobe')).toBeNull();
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
    cleanup();

    draw(
      <Shell
        brand={{ name: 'Minh Phát', logo: null }}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
      >
        <p>the page</p>
      </Shell>,
    );
    const bare = document.querySelector('header')!;
    expect(bare.querySelector('img')).toBeNull();
    expect(bare.querySelector('svg.tabler-icon-brand-adobe')?.getAttribute('width')).toBe('36');
  });

  it('The brand stays at 600 beside the bold page titles', () => {
    shell(['en']);

    expect(screen.getByRole('heading', { level: 1 }).getAttribute('style')).toContain(
      'font-weight: 600',
    );
  });

  it('1: The header is painted 135° from the brand’s shade 7 to 9 and the menu 180° from 9 to 8, in white text', () => {
    shell(['en']);

    const header = document.querySelector('header')!;
    expect(header.getAttribute('style')).toContain('var(--credo-header-gradient)');
    expect(sideMenu().getAttribute('style')).toContain('var(--credo-menu-gradient)');
    expect(header.style.color).toBe('var(--credo-on-header)');
    expect(sideMenu().style.color).toBe('var(--credo-on-menu)');
    // for this colour the variables are the ones from before the rule: shade 7 to 9 and 9 to 8, in white
    const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('');
    expect(css).toContain(
      '--credo-header-gradient: linear-gradient(135deg, var(--mantine-color-brand-7) 0%, var(--mantine-color-brand-9) 100%)',
    );
    expect(css).toContain(
      '--credo-menu-gradient: linear-gradient(180deg, var(--mantine-color-brand-9) 0%, var(--mantine-color-brand-8) 100%)',
    );
    expect(css).toContain('--credo-on-header: #ffffff;');
    expect(css).toContain('--credo-on-menu: #ffffff;');
    // 250 pixels wide, 64 high for the phone's bar, as Mantine writes them: in rem.
    const rules = [...document.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('');
    expect(rules).toContain('--app-shell-navbar-width:calc(15.625rem');
    expect(rules).toContain('--app-shell-footer-height:calc(4rem');
  });

  it('13: The menu’s labels are 14 px at 600, the phone’s bar has a line and a soft shadow above, the phone’s header a soft shadow below, the PC’s none', () => {
    shell(['en']);

    const rules = [...document.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('');
    expect(rules).toContain('--credo-menu-size: 14px;');
    expect(rules).toContain('--credo-weight-emphasis: 600;');
    const item = readFileSync(join(import.meta.dirname, 'frame.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\n\.item \{[^}]*\}/)![0];
    expect(item).toContain('font-size: var(--credo-menu-size);');
    expect(item).toContain('font-weight: var(--credo-weight-emphasis);');

    const footer = bar().parentElement!;
    expect(footer.style.borderTop).toBe('var(--credo-bar-line)');
    expect(footer.style.boxShadow).toBe('var(--credo-bar-shadow)');
    // the header's shadow is the phone's alone: a rule below 48em on `.header`, none outside it
    const css = readFileSync(join(import.meta.dirname, 'frame.module.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(css).toMatch(
      /@media \(max-width: 47\.99em\) \{\s*\.header \{\s*box-shadow: var\(--credo-header-shadow\);\s*\}\s*\}/,
    );
    expect(css.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '')).not.toContain('header-shadow');
    expect(document.querySelector('header')!.style.boxShadow).toBe('');
    for (const name of ['bar-line', 'bar-shadow', 'header-shadow'])
      expect(rules).toMatch(new RegExp(`--credo-${name}: [^;]+;`));
  });

  it('6: One navigation named Menu a width: the side menu from 768, the bar below; the open page washed', () => {
    shell(['en']);

    expect(sideMenu().className).toContain('mantine-visible-from-sm');
    expect(bar().parentElement?.className).toContain('mantine-hidden-from-sm');
    const link = within(sideMenu()).getByRole('link', { name: words.nav.settings });
    expect(link.getAttribute('href')).toBe('/settings');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(
      within(sideMenu()).getByRole('link', { name: words.nav.orders }).getAttribute('aria-current'),
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
    const hide = screen.getByRole('button', { name: words.nav.hideMenu });
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    expect(hide.className).toContain('mantine-visible-from-sm');

    await userEvent.click(hide);
    const show = screen.getByRole('button', { name: words.nav.showMenu });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('navigation', { name: words.nav.menu })).toHaveLength(1);
    expect(onShown).toHaveBeenLastCalledWith(false);

    await userEvent.click(show);
    expect(screen.getAllByRole('navigation', { name: words.nav.menu })).toHaveLength(2);
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
      screen.getByRole('button', { name: words.nav.showMenu }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.getAllByRole('navigation', { name: words.nav.menu })).toHaveLength(1);
  });

  it('3: The bar holds the first four pages in the menu’s order and More, each named, the open page marked', () => {
    shell(['en']);

    const links = within(bar()).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      words.nav.myDeliveries,
      words.nav.orders,
      words.nav.deliveries,
      words.nav.settings,
      words.nav.more,
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

    expect(within(bar()).getByRole('link', { name: words.nav.more }).getAttribute('href')).toBe(
      '/operator/more',
    );
  });

  it('5: The language is a header button over the company’s languages, the current one marked', async () => {
    const onLanguage = vi.fn();
    shell(['vi', 'en'], { onLanguage, onSignOut: vi.fn() });

    const button = screen.getByRole('button', { name: words.user.language });
    expect(button.textContent).toBe('EN');
    await userEvent.click(button);
    expect(
      screen.getByRole('menuitem', { name: LANGUAGE_NAMES.en }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitem', { name: LANGUAGE_NAMES.vi }).getAttribute('aria-current'),
    ).toBe('false');
    await userEvent.click(screen.getByRole('menuitem', { name: LANGUAGE_NAMES.vi }));

    expect(onLanguage).toHaveBeenCalledExactlyOnceWith('vi');
  });

  it('5: The user’s menu no longer holds the language, and one language gives no button', async () => {
    shell(['vi', 'en']);
    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.queryByRole('menuitem', { name: LANGUAGE_NAMES.vi })).toBeNull();
    cleanup();

    const onSignOut = vi.fn();
    shell(['en'], { onLanguage: vi.fn(), onSignOut });
    expect(screen.queryByRole('button', { name: words.user.language })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));
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

    expect(screen.getByRole('menuitem', { name: words.user.signOut })).toBeTruthy();
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
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      words.user.signOut,
    ]);

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
    expect(items.map((item) => item.textContent).slice(-2)).toEqual(['Mine', words.user.signOut]);
    expect(items.at(-2)?.getAttribute('href')).toBe('/mine');
  });

  it('C: The user’s menu lists the change-password link only where the app gives the page, and it opens that page', async () => {
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
    expect(screen.queryByRole('menuitem', { name: words.user.password })).toBeNull();
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
    expect(screen.getByRole('menuitem', { name: words.user.password }).getAttribute('href')).toBe(
      '/password',
    );
  });

  it('18: The user’s menu lists the add-a-passkey link right after the password’s, only where the app gives the page, and it opens that page', async () => {
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
    expect(screen.queryByRole('menuitem', { name: words.user.passkey })).toBeNull();
    cleanup();

    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        passwordPath="/password"
        passkeyPath="/passkeys"
      >
        <p>the page</p>
      </Shell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'root' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      words.user.password,
      words.user.passkey,
      words.user.signOut,
    ]);
    expect(screen.getByRole('menuitem', { name: words.user.passkey }).getAttribute('href')).toBe(
      '/passkeys',
    );
  });

  const looked = (look: Look, shown = true) =>
    draw(
      <Shell
        brand={brand}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
        shown={shown}
        look={look}
      >
        <p>the page</p>
      </Shell>,
    );
  /** The body of the rule whose selector is exactly this one, comments left out. */
  const rule = (selector: string) =>
    frameCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((block) => block.split('{'))
      .find(([head]) => head?.trim() === selector)?.[1] ?? '';

  it('7: A white header and menu drop the brand’s paint and take the grey ones, only when on', () => {
    shell(['en']);
    expect(document.querySelector('header')!.hasAttribute('data-white')).toBe(false);
    expect(sideMenu().hasAttribute('data-white')).toBe(false);
    cleanup();

    looked({ whiteHeader: true, whiteMenu: true, menuIcons: false });
    const header = document.querySelector('header')!;
    expect(header.getAttribute('data-white')).toBe('true');
    expect(header.getAttribute('style') ?? '').not.toContain('gradient');
    expect(sideMenu().getAttribute('data-white')).toBe('true');
    expect(sideMenu().getAttribute('style') ?? '').not.toContain('gradient');
    cleanup();

    looked({ whiteHeader: true, whiteMenu: false, menuIcons: false });
    expect(document.querySelector('header')!.hasAttribute('data-white')).toBe(true);
    expect(sideMenu().hasAttribute('data-white')).toBe(false);
    expect(sideMenu().getAttribute('style')).toContain('gradient');
    cleanup();

    looked({ whiteHeader: false, whiteMenu: true, menuIcons: false });
    expect(document.querySelector('header')!.getAttribute('style')).toContain('gradient');
    expect(sideMenu().hasAttribute('data-white')).toBe(true);

    const header7 = rule('.header');
    expect(header7).toContain('var(--credo-surface)');
    expect(header7).toContain('var(--credo-text)');
    expect(header7).toContain('var(--credo-border)');
    const item = rule('.item');
    expect(item).toContain('var(--credo-text)');
    expect(rule('.item svg')).toContain('var(--credo-text-muted)');
    const open = rule(".item[aria-current='page']");
    expect(open).toContain('var(--credo-brand-tint)');
    expect(open).toContain('var(--credo-on-brand-tint)');
    expect(rule(".item[aria-current='page'] svg")).toContain('var(--credo-brand-text)');
  });

  it('7: The white header draws the company’s name by the grey rule, never by an inline colour', () => {
    looked({ whiteHeader: true, whiteMenu: false, menuIcons: false });
    const white = screen.getByRole('heading', { level: 1 });
    expect(white.getAttribute('style') ?? '').not.toContain('color');
    expect(white.className).toContain('brandName');
    expect(rule('.brandName')).toContain('var(--credo-text)');
    cleanup();

    looked({ whiteHeader: false, whiteMenu: true, menuIcons: false });
    const coloured = screen.getByRole('heading', { level: 1 });
    expect(coloured.getAttribute('style')).toContain('inherit');
    expect(coloured.className).not.toContain('brandName');
  });

  it('8: The strip’s tip shows on keyboard focus as well as on hover', () => {
    const css = frameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toContain('.stripItem[data-tip]:hover::before');
    expect(css).toContain('.stripItem[data-tip]:focus-visible::before');
  });

  it('8: Icons on, the hidden PC menu leaves a strip of named icons; off, it hides whole', () => {
    looked({ whiteHeader: false, whiteMenu: false, menuIcons: false }, false);
    expect(screen.getAllByRole('navigation', { name: words.nav.menu })).toHaveLength(1);
    cleanup();

    looked({ whiteHeader: false, whiteMenu: false, menuIcons: true }, false);
    const strip = sideMenu();
    expect(strip.hasAttribute('data-strip')).toBe(true);
    expect(strip.className).toContain('mantine-visible-from-sm');
    const links = within(strip).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(
      within(sideMenu())
        .getAllByRole('link')
        .map((link) => link.getAttribute('data-tip')),
    );
    expect(links).toHaveLength(PAGES.length);
    expect(links.every((link) => link.getAttribute('aria-label'))).toBe(true);
    expect(strip.textContent).toBe('');
    const rules = [...document.querySelectorAll('style')].map((one) => one.textContent).join('');
    expect(rules).toContain('--app-shell-navbar-width:calc(3.75rem');
    cleanup();

    looked({ whiteHeader: false, whiteMenu: false, menuIcons: true }, true);
    expect(sideMenu().hasAttribute('data-strip')).toBe(false);
    expect(within(sideMenu()).getByRole('link', { name: words.nav.settings }).textContent).toBe(
      words.nav.settings,
    );
  });
});

describe('HeaderBrand', () => {
  const FORMATTED = '<b>Minh</b><br><span style="color:#1d3557">Phát</span>';
  const drawn = (white: boolean) =>
    draw(
      <HeaderBrand name="Minh Phát" formatted={FORMATTED} white={white} />,
    ).container.querySelector('h1')!;

  it('12: on the coloured header the formatted name’s colours give way to its text colour, bold and break kept', () => {
    const title = drawn(false);

    expect(title.querySelector('[aria-hidden="true"]')!.innerHTML).toBe('<b>Minh</b><br>Phát');
    expect(title.querySelector('[style*="color: rgb(29, 53, 87)"]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeDefined();
  });

  it('12: on the white header the formatted name is drawn as typed', () => {
    const title = drawn(true);

    expect(title.querySelector('[aria-hidden="true"]')!.innerHTML).toBe(
      '<b>Minh</b><br><span style="color: rgb(29, 53, 87);">Phát</span>',
    );
  });

  it('14: the brand draws the logos as the header’s table says, beside the name, with an empty alt', () => {
    const pictures = (white: boolean) =>
      draw(
        <HeaderBrand name="Minh Phát" white={white} logo="/logo.png" logoOnColour="/light.png" />,
      ).container.querySelector('img');

    expect(pictures(false)?.getAttribute('src')).toBe('/light.png');
    expect(pictures(false)?.getAttribute('alt')).toBe('');
    cleanup();
    expect(pictures(true)?.getAttribute('src')).toBe('/logo.png');
    cleanup();
    const alone = draw(<HeaderBrand name="Minh Phát" white={false} logo="/logo.png" />);
    expect(alone.container.querySelector('img')?.getAttribute('src')).toBe('/logo.png');
    expect(screen.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeDefined();
  });

  it('3: where no formatted name is set the plain name is drawn as bare text, as before', () => {
    const { container } = draw(<HeaderBrand name="Minh Phát" white={false} />);

    expect(container.querySelector('h1')!.innerHTML).toBe('Minh Phát');
  });
});

describe('Shell, the formatted name', () => {
  it('3: the header draws the company’s formatted name, read by the plain name, and the plain name where none is set', () => {
    const formatted = { ...brand, formattedName: '<b>Minh</b><br>Phát', description: '' };
    const first = draw(
      <Shell
        brand={formatted}
        user="root"
        languages={['en']}
        onLanguage={vi.fn()}
        onSignOut={vi.fn()}
      >
        <p>the page</p>
      </Shell>,
    );
    expect(first.container.querySelector('header [aria-hidden="true"] b')?.textContent).toBe(
      'Minh',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Minh Phát' })).toBeDefined();
    cleanup();

    const plain = shell(['en']);
    expect(plain.container.querySelector('header h1')?.innerHTML).toBe('Minh Phát');
  });
});
