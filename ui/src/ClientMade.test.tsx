import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { ClientMade } from './ClientMade';
import { MADE } from './mock/fixtures';

describe('ClientMade', () => {
  it('shows the link, the root’s name and its first password, to select and send', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    for (const [label, value] of [
      [/Link/, MADE.link],
      [/Root name/, MADE.rootName],
      [/First password/, MADE.password],
    ] as const) {
      const field = screen.getByLabelText<HTMLInputElement>(label);
      expect(field.value).toBe(value);
      expect(field.readOnly).toBe(true);
    }
  });

  it('says the password is shown now and never again', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toContain('never again');
  });

  it('offers another client', async () => {
    const onAnother = vi.fn();
    draw(<ClientMade {...MADE} onAnother={onAnother} />);

    await userEvent.click(screen.getByRole('button', { name: 'Make another client' }));

    expect(onAnother).toHaveBeenCalledOnce();
  });
});
