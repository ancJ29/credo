import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { NewClient } from './NewClient';

const GIB = 1024 ** 3;
const TWO = [
  { name: 'home', companies: 4, freeBytes: 38 * GIB },
  { name: 'b2', companies: 1, freeBytes: 112 * GIB },
];

async function fill() {
  await userEvent.type(screen.getByLabelText(/Client code/), 'minh-phat');
  await userEvent.type(screen.getByLabelText(/Company name/), 'Minh Phát');
}

describe('NewClient, the list of boxes', () => {
  it('C9: The form lists each box with its free disk and its companies, the home box chosen', () => {
    draw(<NewClient status="idle" boxes={TWO} onSubmit={vi.fn()} />);

    const home = screen.getByRole<HTMLInputElement>('radio', {
      name: 'home: 38 GB free, 4 companies',
    });
    const second = screen.getByRole<HTMLInputElement>('radio', {
      name: 'b2: 112 GB free, 1 companies',
    });
    expect(home.checked).toBe(true);
    expect(second.checked).toBe(false);
  });

  it('C9: The home box chosen sends no box, and another box picked is sent with the form', async () => {
    const onSubmit = vi.fn();
    draw(<NewClient status="idle" boxes={TWO} onSubmit={onSubmit} />);
    await fill();

    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
    expect(onSubmit).toHaveBeenLastCalledWith('minh-phat', 'Minh Phát');

    await userEvent.click(screen.getByRole('radio', { name: /^b2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
    expect(onSubmit).toHaveBeenLastCalledWith('minh-phat', 'Minh Phát', 'b2');

    await userEvent.click(screen.getByRole('radio', { name: /^home/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Make the client' }));
    expect(onSubmit).toHaveBeenLastCalledWith('minh-phat', 'Minh Phát');
  });

  it('C9: A box that did not answer is shown so and cannot be chosen', () => {
    draw(
      <NewClient
        status="idle"
        boxes={[TWO[0], { name: 'b2', companies: 0, freeBytes: null }]}
        onSubmit={vi.fn()}
      />,
    );

    const down = screen.getByRole<HTMLInputElement>('radio', { name: 'b2: not answering' });
    expect(down.disabled).toBe(true);
  });

  it('C9: With one box or none there is nothing to choose, so no list is drawn', () => {
    const { unmount } = draw(<NewClient status="idle" boxes={[TWO[0]]} onSubmit={vi.fn()} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    unmount();
    draw(<NewClient status="idle" onSubmit={vi.fn()} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
