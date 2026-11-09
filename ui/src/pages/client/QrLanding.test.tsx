import { cleanup, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { QrLanding } from './QrLanding';
import { SignIn } from '../SignIn';

const brand = { name: 'Minh Phát', logo: null };

/** What frames a door, in its order: the header, the ground, the card. */
const frameOf = (container: HTMLElement) => {
  const header = container.querySelector('header');
  return [
    header?.className,
    header?.getAttribute('style'),
    header?.nextElementSibling?.getAttribute('style'),
  ];
};

describe('the QR landing', () => {
  it('5: draws the same frame as the password sign-in, busy or refused', () => {
    const signIn = draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    const expected = frameOf(signIn.container);
    cleanup();

    for (const status of ['busy', 'refused'] as const) {
      const { container } = draw(<QrLanding brand={brand} status={status} onPassword={vi.fn()} />);
      expect(frameOf(container), status).toEqual(expected);
      expect(screen.getByRole('heading', { level: 1 }).textContent, status).toBe('Minh Phát');
      expect(screen.getByRole('status'), status).toBeTruthy();
      cleanup();
    }
  });
});
