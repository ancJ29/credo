import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { AddClientPage } from './AddClientPage';
import { type Api, ApiError } from '../../api';

const GIB = 1024 ** 3;
const made = {
  link: '/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};
const TWO = [
  { name: 'home', companies: 4, freeBytes: 38 * GIB },
  { name: 'b2', companies: 0, freeBytes: 112 * GIB },
];

const page = (operatorBoxes: Api['operatorBoxes']) => {
  const makeClient = vi.fn<Api['makeClient']>(() =>
    Promise.resolve({ kind: 'made', client: made }),
  );
  draw(
    <AddClientPage api={{ makeClient, operatorBoxes } as unknown as Api} onSignedOut={vi.fn()} />,
  );
  return makeClient;
};

async function fillAndMake() {
  await userEvent.type(screen.getByLabelText(/Client code/), 'minh-phat');
  await userEvent.type(screen.getByLabelText(/Company name/), 'Minh Phát');
  await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
}

describe('AddClientPage, the boxes', () => {
  it('C9: The page reads the boxes and a company is made on the one picked', async () => {
    const makeClient = page(() => Promise.resolve(TWO));
    await userEvent.click(await screen.findByRole('radio', { name: /^b2/ }));

    await fillAndMake();

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát', 'b2');
  });

  it('C9: With the home box left chosen no box is sent', async () => {
    const makeClient = page(() => Promise.resolve(TWO));
    await screen.findByRole('radio', { name: /^home/ });

    await fillAndMake();

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });

  it('C9: A list that does not come leaves the form with no choice, and a company is made on the home box', async () => {
    const makeClient = page(() => Promise.reject(new ApiError(503)));

    await fillAndMake();

    expect(await screen.findByRole('heading', { level: 2, name: 'Client made' })).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(makeClient).toHaveBeenCalledExactlyOnceWith('minh-phat', 'Minh Phát');
  });
});
