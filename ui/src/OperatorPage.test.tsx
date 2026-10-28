import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { OperatorPage } from './OperatorPage';

describe('OperatorPage', () => {
  it('wears credo’s name with a badge saying whose door this is, and has no menu of pages', () => {
    draw(
      <OperatorPage onSignOut={vi.fn()}>
        <p>the page</p>
      </OperatorPage>,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Credo');
    expect(screen.getByText('Operator')).toBeTruthy();
    expect(screen.getByText('the page')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('signs out from the header', async () => {
    const onSignOut = vi.fn();
    draw(<OperatorPage onSignOut={onSignOut}>x</OperatorPage>);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
