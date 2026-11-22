import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { DICTIONARIES } from '../i18n';
import { ClientMade } from './ClientMade';

const words = DICTIONARIES.en.operator;
/** A label that carries a star is found by its word inside it, as the dictionary spells it. */
const labelled = (word: string) => new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const MADE = {
  link: 'https://credo.example/login?client-code=minh-phat',
  rootName: 'root',
  password: 'q7Hn4VdM2xKp9sRw',
};

describe('ClientMade', () => {
  it('shows the link, the root’s name and its first password, to select and send', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    for (const [label, value] of [
      [labelled(words.link), MADE.link],
      [labelled(words.rootName), MADE.rootName],
      [labelled(words.firstPassword), MADE.password],
    ] as const) {
      const field = screen.getByRole<HTMLInputElement>('textbox', { name: label });
      expect(field.value).toBe(value);
      expect(field.readOnly).toBe(true);
    }
  });

  it('says the password is shown once', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    expect(screen.getByRole('status').textContent).toBe(words.madeIntro);
  });

  it('offers another client', async () => {
    const onAnother = vi.fn();
    draw(<ClientMade {...MADE} onAnother={onAnother} />);

    await userEvent.click(screen.getByRole('button', { name: words.another }));

    expect(onAnother).toHaveBeenCalledOnce();
  });

  it('copies each of the three with its own button', async () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);
    const user = userEvent.setup();
    const copied = vi.spyOn(navigator.clipboard, 'writeText');

    for (const [name, value] of [
      [`${words.copy}: ${words.link}`, MADE.link],
      [`${words.copy}: ${words.rootName}`, MADE.rootName],
      [`${words.copy}: ${words.firstPassword}`, MADE.password],
    ] as const) {
      await user.click(screen.getByRole('button', { name }));
      expect(copied).toHaveBeenLastCalledWith(value);
    }
    expect(copied).toHaveBeenCalledTimes(3);
  });

  it('offers the way back to the clients, a link to the list', () => {
    draw(<ClientMade {...MADE} onAnother={vi.fn()} />);

    expect(screen.getByRole('link', { name: words.back }).getAttribute('href')).toBe(
      '/operator/clients',
    );
  });
});
