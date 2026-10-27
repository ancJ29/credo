import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { SignIn } from './SignIn';

const brand = { name: 'Minh Phát', logo: null };

describe('SignIn', () => {
  it('shows the company’s name as the first heading', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Minh Phát');
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<SignIn brand={brand} status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Sign-in name/), 'root');
    await userEvent.type(screen.getByLabelText(/Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('root', 'secret');
  });

  it('starts from what is already typed', () => {
    draw(
      <SignIn
        brand={brand}
        status="idle"
        initial={{ username: 'root', password: 'secret' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>(/Sign-in name/).value).toBe('root');
  });

  it('a refusal says what to do, and an idle form says nothing', () => {
    const { rerender } = draw(<SignIn brand={brand} status="refused" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Check them and try again');

    rerender(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('waits while the service answers', () => {
    draw(<SignIn brand={brand} status="busy" onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sign in' }).hasAttribute('data-loading')).toBe(true);
  });
});
