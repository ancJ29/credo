import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../../../tests/render';
import { DICTIONARIES } from '../../i18n';
import { WaitingClient } from './WaitingClient';

const words = DICTIONARIES.en;

describe('WaitingClient', () => {
  it('16: says the company signed up and opens once an operator approves it, in credo’s own name, with nothing to press', () => {
    const { container } = draw(<WaitingClient />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.signUp.waitingTitle);
    expect(screen.getByText(words.signUp.waitingText)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
