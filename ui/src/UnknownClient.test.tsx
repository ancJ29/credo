import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../tests/render';
import { UnknownClient } from './UnknownClient';

describe('UnknownClient', () => {
  it('says the address names no company we know and to open the link the company sent', () => {
    draw(<UnknownClient />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'We do not know this address',
    );
    expect(screen.getByText(/names no company we know/).textContent).toContain(
      'Open the link your company sent you',
    );
  });

  it('shows no company’s name or logo, and nothing to press', () => {
    const { container } = draw(<UnknownClient />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
