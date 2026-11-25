import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { UnknownClient } from './UnknownClient';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
describe('UnknownClient', () => {
  it('says the address names no company we know and to open the link the company sent', () => {
    draw(<UnknownClient />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.unknownClient.title);
    expect(screen.getByText(words.unknownClient.text)).toBeTruthy();
  });

  it('16: leads to the sign-up page with one link, in credo’s own name', () => {
    draw(<UnknownClient />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(screen.getByRole('link', { name: words.signUp.title }).getAttribute('href')).toBe(
      '/sign-up',
    );
  });

  it('shows no company’s name or logo, and no button', () => {
    const { container } = draw(<UnknownClient />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
