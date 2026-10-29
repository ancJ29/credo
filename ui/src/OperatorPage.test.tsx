import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { OperatorPage } from './OperatorPage';

const page = (handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() }) =>
  draw(
    <OperatorPage name="operator" {...handlers}>
      <p>the page</p>
    </OperatorPage>,
  );

describe('OperatorPage', () => {
  it('wears credo’s name with a badge saying whose door this is, and shows who is signed in', () => {
    page();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(screen.getByText('Operator')).toBeTruthy();
    expect(screen.getByText('the page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'operator' })).toBeTruthy();
  });

  it('The menu holds Clients, Operators, Services status, Usage and costs and Activity, top to bottom, each at its own address', () => {
    page();

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Clients',
      'Operators',
      'Services status',
      'Usage and costs',
      'Activity',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/operator/clients',
      '/operator/operators',
      '/operator/services',
      '/operator/usage',
      '/operator/activity',
    ]);
  });

  it('holds the language and sign-out in the user’s menu', async () => {
    const handlers = { onLanguage: vi.fn(), onSignOut: vi.fn() };
    page(handlers);

    await userEvent.click(screen.getByRole('button', { name: 'operator' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tiếng Việt' }));
    expect(handlers.onLanguage).toHaveBeenCalledExactlyOnceWith('vi');

    await userEvent.click(screen.getByRole('button', { name: 'operator' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(handlers.onSignOut).toHaveBeenCalledOnce();
  });
});
