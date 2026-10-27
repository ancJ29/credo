import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { Boot } from './Boot';

describe('Boot', () => {
  it('waits without a message', () => {
    draw(<Boot status="loading" onRetry={vi.fn()} />);

    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the service is unavailable and offers a retry', async () => {
    const onRetry = vi.fn();
    draw(<Boot status="unavailable" onRetry={onRetry} />);

    expect(screen.getByRole('alert').textContent).toContain('service is unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
