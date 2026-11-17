import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES, LANGUAGE_NAMES } from '../i18n';
import { MorePage } from '../pages/MorePage';
import { OperatorPage } from './OperatorPage';

const words = DICTIONARIES.en;

const page = (handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() }) =>
  draw(
    <OperatorPage name="operator" {...handlers}>
      <p>the page</p>
    </OperatorPage>,
  );

describe('OperatorPage', () => {
  it('wears credo’s name with a badge saying whose door this is, and shows who is signed in', () => {
    page();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(words.app.name);
    expect(screen.getByText(words.operator.badge)).toBeTruthy();
    expect(screen.getByText('the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'operator' })).toBeTruthy();
  });

  it('7: The menu holds the operator’s five sections, top to bottom, each at its own address, and the bar holds the first four and More', () => {
    page();

    const side = within(screen.getAllByRole('navigation', { name: words.nav.menu })[0]);
    const links = side.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      words.nav.clients,
      words.nav.operators,
      words.nav.services,
      words.nav.usage,
      words.nav.activity,
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/operator/clients',
      '/operator/operators',
      '/operator/services',
      '/operator/usage',
      '/operator/activity',
    ]);
    const bar = within(screen.getAllByRole('navigation', { name: words.nav.menu })[1]);
    expect(bar.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      words.nav.clients,
      words.nav.operators,
      words.nav.services,
      words.nav.usage,
      words.nav.more,
    ]);
    expect(bar.getByRole('link', { name: words.nav.more }).getAttribute('href')).toBe(
      '/operator/more',
    );
  });

  it('7: The console’s More holds Activity, the operator’s passkeys and sign-out', async () => {
    const handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() };
    draw(
      <OperatorPage name="operator" {...handlers}>
        <MorePage />
      </OperatorPage>,
    );

    const main = within(document.querySelector('main')!);
    expect(main.getAllByRole('link').map((link) => link.textContent)).toEqual([
      words.nav.activity,
      words.passkey.menu,
    ]);
    await userEvent.click(main.getByRole('button', { name: words.user.signOut }));
    expect(handlers.onSignOut).toHaveBeenCalledOnce();
  });

  it('holds the language in the header’s own button and sign-out in the user’s menu', async () => {
    const handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() };
    page(handlers);

    await userEvent.click(screen.getByRole('button', { name: words.user.language }));
    await userEvent.click(screen.getByRole('menuitem', { name: LANGUAGE_NAMES.vi }));
    expect(handlers.onLanguage).toHaveBeenCalledExactlyOnceWith('vi');

    await userEvent.click(screen.getByRole('button', { name: 'operator' }));
    await userEvent.click(screen.getByRole('menuitem', { name: words.user.signOut }));
    expect(handlers.onSignOut).toHaveBeenCalledOnce();
  });

  it('lists the operator’s own passkeys in the user’s menu, above sign-out, at their own address', async () => {
    page();

    await userEvent.click(screen.getByRole('button', { name: 'operator' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.at(-2)?.textContent).toBe(words.passkey.menu);
    expect(items.at(-2)?.getAttribute('href')).toBe('/operator/passkeys');
    expect(items.at(-1)?.textContent).toBe(words.user.signOut);
  });
});
