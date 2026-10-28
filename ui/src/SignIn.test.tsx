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

    await userEvent.type(screen.getByLabelText(/Username/), 'root');
    await userEvent.type(screen.getByLabelText(/Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('root', 'secret');
  });

  it('names its heading as it is told, in place of the account title', () => {
    draw(<SignIn brand={brand} status="idle" title="Operator sign-in" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Operator sign-in');
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

    expect(screen.getByLabelText<HTMLInputElement>(/Username/).value).toBe('root');
  });

  it('a refusal says what to do, and an idle form says nothing', () => {
    const { rerender } = draw(<SignIn brand={brand} status="refused" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Wrong username or password');

    rerender(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('waits while the service answers', () => {
    draw(<SignIn brand={brand} status="busy" onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sign In' }).hasAttribute('data-loading')).toBe(true);
  });

  it('is the old card: a title over underlined fields with their placeholders, and no extras', () => {
    draw(<SignIn brand={brand} status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sign in to your account');
    expect(screen.getByPlaceholderText('Enter your username')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the logo in the tinted head when the company has one', () => {
    const { container } = draw(
      <SignIn
        brand={{ ...brand, logo: 'data:image/png;base64,AAAA' }}
        status="idle"
        onSubmit={vi.fn()}
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });
});
