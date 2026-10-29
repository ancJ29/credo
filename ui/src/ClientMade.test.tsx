import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { ClientMade } from './ClientMade';

const MADE = {
  link: 'https://credo.example/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};

describe('ClientMade', () => {
  it('shows the link, the root’s name and its first password, to select and send', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    for (const [label, value] of [
      [/Link/, MADE.link],
      [/Root name/, MADE.rootName],
      [/First password/, MADE.password],
    ] as const) {
      const field = screen.getByRole<HTMLInputElement>('textbox', { name: label });
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

    await userEvent.click(screen.getByRole('button', { name: 'Add another client' }));

    expect(onAnother).toHaveBeenCalledOnce();
  });

  it('copies each of the three with its own button', async () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    for (const [name, value] of [
      ['Copy: Link', MADE.link],
      ['Copy: Root name', MADE.rootName],
      ['Copy: First password', MADE.password],
    ] as const) {
      await user.click(screen.getByRole('button', { name }));
      expect(copied).toHaveBeenLastCalledWith(value);
    }
    expect(copied).toHaveBeenCalledTimes(3);
  });

  it('offers the way back to the clients, a link to the list', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Back to the clients' }).getAttribute('href')).toBe(
      '/operator/clients',
    );
  });
});
