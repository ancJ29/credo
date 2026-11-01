import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { DICTIONARIES } from './i18n';
import { SessionEnded } from './SessionEnded';

const handlers = () => ({ onContinue: vi.fn(), onSignOut: vi.fn() });

describe('SessionEnded', () => {
  it('says the sign-in ended after an hour away or 12 hours in, and that what was typed is kept', () => {
    draw(<SessionEnded status="idle" {...handlers()} />);

    expect(screen.getByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
    expect(screen.getByText(DICTIONARIES.en.passkey.endedText)).toBeTruthy();
    expect(DICTIONARIES.en.passkey.endedText).toContain('an hour');
    expect(DICTIONARIES.en.passkey.endedText).toContain('12 hours');
    expect(DICTIONARIES.en.passkey.endedText).toContain('still here');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes on with one press of the passkey button, or leaves with sign out; neither Escape nor a click outside closes it', async () => {
    const { onContinue, onSignOut } = handlers();
    draw(<SessionEnded status="idle" onContinue={onContinue} onSignOut={onSignOut} />);

    await userEvent.keyboard('{Escape}');
    await userEvent.click(document.body);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onSignOut).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Use your passkey' }));
    expect(onContinue).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('says why it did not go on, in Vietnamese too, and shows the wait on the button', () => {
    const { rerender } = draw(<SessionEnded status="notGiven" {...handlers()} />, 'vi');
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.vi.passkey.notGiven);

    rerender(<SessionEnded status="refused" {...handlers()} />);
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.vi.passkey.refused);

    rerender(<SessionEnded status="unavailable" {...handlers()} />);
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.vi.common.unavailable);

    rerender(<SessionEnded status="busy" {...handlers()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: DICTIONARIES.vi.passkey.endedButton })
        .hasAttribute('data-loading'),
    ).toBe(true);
  });
});
