import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../tests/open';
import { DICTIONARIES } from '../i18n';

/**
 * The walk spec's screens 2 and 12 of piece 1, replayed on the fake with the real router: a name
 * nobody holds typed with six wrong passwords, the first five refused as before, the sixth made to
 * wait 30 seconds, and the root's name typed back over it, as the spec does before screen 3.
 */
describe.each(['en', 'vi'] as const)('the sign-in after six wrong passwords, in %s', (language) => {
  const words = DICTIONARIES[language];

  it('Screen 12 answers the sixth wrong password with the wait, and the root’s name typed back is not waiting', async () => {
    openApp('/login?client-code=minh-phat', { language, out: true });
    const name = await screen.findByLabelText(words.auth.username);
    await userEvent.clear(name);
    await userEvent.type(name, `nobody-${language}-1280`);
    const password = screen.getByLabelText(words.auth.password);
    const submit = screen.getByRole('button', { name: words.auth.submit });

    for (let wrong = 1; wrong <= 5; wrong++) {
      await userEvent.clear(password);
      await userEvent.type(password, `not the password ${wrong}`);
      await userEvent.click(submit);
      expect((await screen.findByRole('alert')).textContent).toBe(words.auth.refused);
    }
    await userEvent.clear(password);
    await userEvent.type(password, 'not the password 6');
    await userEvent.click(submit);
    await screen.findByText(words.wait.seconds.replace('{{count}}', '30'));
    expect(screen.getByRole('alert').textContent).toBe(
      words.wait.seconds.replace('{{count}}', '30'),
    );

    await userEvent.clear(name);
    await userEvent.type(name, 'root');
    expect(screen.getByRole('button', { name: words.auth.submit })).toBeTruthy();
  });
});
