import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { MorePage } from './MorePage';
import { PAGES } from '../nav';
import { Shell } from '../frame/Shell';

const brand = { name: 'Minh Phát', logo: null };

const more = (props: Partial<Parameters<typeof Shell>[0]> = {}) => {
  const onSignOut = vi.fn();
  draw(
    <Shell
      brand={brand}
      user="root"
      languages={['en']}
      onLanguage={vi.fn()}
      onSignOut={onSignOut}
      passwordPath="/password"
      {...props}
    >
      <MorePage />
    </Shell>,
  );
  return { onSignOut };
};

const main = () => within(document.querySelector('main')!);

describe('MorePage', () => {
  it('4: lists the pages the bar leaves out, then the person’s own links and sign-out', async () => {
    const { onSignOut } = more({ menuLinks: [{ to: '/mine', label: 'Mine' }] });

    expect(main().getByRole('heading', { level: 2 }).textContent).toBe('More');
    const links = main().getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Staff',
      'Departments and positions',
      'Customers',
      'Products',
      'Change password',
      'Mine',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/staff',
      '/staff-setup',
      '/customers',
      '/products',
      '/password',
      '/mine',
    ]);

    await userEvent.click(main().getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('4: with four pages or fewer, lists only the person’s own links and sign-out', () => {
    more({ pages: PAGES.slice(0, 4) });

    expect(
      main()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Change password']);
    expect(main().getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('is drawn only inside the frame', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => draw(<MorePage />)).toThrow('inside the frame');
    quiet.mockRestore();
  });
});
