import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { NewClient } from './NewClient';

describe('NewClient', () => {
  it('asks for a code and the company’s name, and says what a code may be', () => {
    draw(<NewClient status="idle" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/Client code/)).toBeTruthy();
    expect(screen.getByLabelText(/Company name/)).toBeTruthy();
    expect(screen.getByText(/3 to 32 characters/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends what was typed', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Client code/), 'minh-phat');
    await userEvent.type(screen.getByLabelText(/Company name/), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('starts from what is already typed', () => {
    draw(
      <NewClient
        status="idle"
        initial={{ code: 'minh-phat', name: 'Minh Phát' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát');
  });

  it('waits while the service answers', () => {
    draw(<NewClient status="busy" onSubmit={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Make the client' }).hasAttribute('data-loading'),
    ).toBe(true);
  });

  it('a failure says nothing was made and that what was typed is kept', () => {
    draw(<NewClient status="failed" onSubmit={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toContain('The client was not made');
    expect(screen.getByRole('alert').textContent).toContain('still here');
    expect(screen.getByLabelText(/Client code/).getAttribute('aria-invalid')).toBeNull();
  });

  it('a taken code says so, that nothing changed, and marks the code', () => {
    draw(<NewClient status="taken" onSubmit={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toContain('already belongs to another client');
    expect(screen.getByRole('alert').textContent).toContain('nothing was changed');
    expect(screen.getByLabelText(/Client code/).getAttribute('aria-invalid')).toBe('true');
  });

  it('A code not in the form is refused on its field, saying the rule, and nothing is sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Client code/), '9 bad code');
    await userEvent.type(screen.getByLabelText(/Company name/), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));

    expect(screen.getByText(/Use 3 to 32 lowercase letters/)).toBeTruthy();
    expect(screen.getByLabelText(/Client code/).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText(/Company name/).getAttribute('aria-invalid')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('A name of spaces alone is refused on its field, and a fixed form is sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Client code/), 'minh-phat');
    await userEvent.type(screen.getByLabelText(/Company name/), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));

    expect(screen.getByText('Enter the company’s name.')).toBeTruthy();
    expect(screen.getByLabelText(/Client code/).getAttribute('aria-invalid')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Company name/), ' Minh Phát ');
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));

    expect(screen.queryByText('Enter the company’s name.')).toBeNull();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('A code typed in capitals or with spaces around it is lowered and trimmed before it is checked and sent', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/Client code/), '  Minh-PHAT ');
    await userEvent.type(screen.getByLabelText(/Company name/), 'Minh Phát');
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });
});
