import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { DICTIONARIES } from '../../i18n';
import { OperatorSignIn } from './OperatorSignIn';

const words = DICTIONARIES.en;
const wordsVi = DICTIONARIES.vi;

describe('OperatorSignIn', () => {
  it('is credo’s own door: its name over the form, and a title no client’s sign-in has', () => {
    draw(<OperatorSignIn status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.operator.signIn);
  });

  it('says it in Vietnamese too', () => {
    draw(<OperatorSignIn status="idle" onSubmit={vi.fn()} />, 'vi');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(wordsVi.operator.signIn);
    expect(screen.getByRole('button').textContent).toBe(DICTIONARIES.vi.passkey.signInButton);
  });

  it('is one button and a hint about the device’s touch: no name and no password is asked', async () => {
    const onSubmit = vi.fn();
    draw(<OperatorSignIn status="idle" onSubmit={onSubmit} />);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(DICTIONARIES.en.passkey.signInHint)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: words.passkey.signInButton }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('says a passkey was not given, or that none here has this one, in an alert, and nothing when idle or busy', () => {
    const { rerender } = draw(<OperatorSignIn status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<OperatorSignIn status="notGiven" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.en.passkey.notGiven);

    rerender(<OperatorSignIn status="refused" onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.en.passkey.refused);

    rerender(<OperatorSignIn status="busy" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getByRole('button', { name: words.passkey.signInButton }).hasAttribute('data-loading'),
    ).toBe(true);
  });
});
