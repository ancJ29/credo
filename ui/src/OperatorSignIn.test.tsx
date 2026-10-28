import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { OperatorSignIn } from './OperatorSignIn';

describe('OperatorSignIn', () => {
  it('is credo’s own door: its name over the form, and a title no client’s sign-in has', () => {
    draw(<OperatorSignIn status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Operator sign-in');
  });

  it('says it in Vietnamese too', () => {
    draw(<OperatorSignIn status="idle" onSubmit={vi.fn()} />, 'vi');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Đăng nhập người vận hành');
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<OperatorSignIn status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Username/), 'operator');
    await userEvent.type(screen.getByLabelText(/Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('operator', 'secret');
  });
});
