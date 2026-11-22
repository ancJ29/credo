import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { DICTIONARIES } from '../../i18n';
import { TOKENS } from '../../design-system/tokens';
import { CopyText } from './CopyText';

const words = DICTIONARIES.en.operator;
const VALUE = 'https://an-phat.example/login';

describe('CopyText', () => {
  it('231 case 10: the button copies its value and says the copied word, alone', async () => {
    draw(<CopyText value={VALUE} label={words.copy} about="Sign-in link" />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: `${words.copy}: Sign-in link` }));

    expect(copied).toHaveBeenCalledOnce();
    expect(copied).toHaveBeenLastCalledWith(VALUE);
    expect(screen.getByRole('button', { name: `${words.copied}: Sign-in link` })).toBeDefined();
  });

  it('231 case 10: given a field, the value shows read-only in the code face beside the button', async () => {
    draw(<CopyText value={VALUE} label={words.copy} about="Sign-in link" field="Link" />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Link' });
    expect(input.value).toBe(VALUE);
    expect(input.readOnly).toBe(true);
    expect(input.style.fontFamily).toBe(TOKENS.codeFace.fontFamily);
    const button = screen.getByRole('button', { name: `${words.copy}: Sign-in link` });
    expect(input.parentElement?.contains(button)).toBe(true);

    await user.click(button);
    expect(copied).toHaveBeenLastCalledWith(VALUE);
    expect(screen.getByRole('button', { name: `${words.copied}: Sign-in link` })).toBeDefined();
  });
});
