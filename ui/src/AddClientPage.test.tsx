import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { AddClientPage } from './AddClientPage';
import { type Api, ApiError } from './api';

const made = {
  link: '/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};

const page = (makeClient: Api['makeClient'], onSignedOut = vi.fn()) => {
  const rendered = draw(
    <AddClientPage api={{ makeClient } as unknown as Api} onSignedOut={onSignedOut} />,
  );
  return { onSignedOut, ...rendered };
};

async function fillAndMake(code = 'minh-phat', name = 'Minh Phát') {
  await userEvent.type(screen.getByLabelText(/Client code/), code);
  await userEvent.type(screen.getByLabelText(/Company name/), name);
  await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
}

describe('AddClientPage', () => {
  it('Added: the link, the root’s name and the first password are shown once, then the operator adds another and the password is gone', async () => {
    const makeClient = vi.fn<Api['makeClient']>(() =>
      Promise.resolve({ kind: 'made', client: made }),
    );
    page(makeClient);
    await fillAndMake('  Minh-PHAT ');

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Link/ }).value).toBe(
      `${window.location.origin}/login?client-code=minh-phat`,
    );
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Root name/ }).value).toBe('root');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /First password/ }).value).toBe(
      made.password,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add another client' }));

    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('');
    expect(document.body.innerHTML).not.toContain(made.password);
  });

  it('A code already taken is refused, says so, and what was typed stays', async () => {
    page(() => Promise.resolve({ kind: 'taken' }));
    await fillAndMake();

    expect((await screen.findByRole('alert')).textContent).toContain('nothing was changed');
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát');
  });

  it('A make that fails says nothing was made, and what was typed stays', async () => {
    const { onSignedOut } = page(() => Promise.reject(new ApiError(503)));
    await fillAndMake();

    expect((await screen.findByRole('alert')).textContent).toContain('The client was not made');
    expect(screen.getByLabelText<HTMLInputElement>(/Client code/).value).toBe('minh-phat');
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('A code not in the form sends nothing', async () => {
    const makeClient = vi.fn<Api['makeClient']>();
    page(makeClient);
    await fillAndMake('x');

    expect(screen.getByText(/Use 3 to 32 lowercase letters/)).toBeTruthy();
    expect(makeClient).not.toHaveBeenCalled();
  });

  it('A 401 on the make signs the operator out', async () => {
    const { onSignedOut } = page(() => Promise.reject(new ApiError(401)));
    await fillAndMake();

    await screen.findByRole('alert');
    expect(onSignedOut).toHaveBeenCalledOnce();
  });
});
