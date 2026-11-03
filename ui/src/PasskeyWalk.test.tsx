import {
  DEMO_INVITED_NAME,
  DEMO_JOIN_TOKEN,
  DEMO_PASSKEYS,
  OPERATOR_NAME,
} from '@credo/shared/demo';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { DICTIONARIES } from './i18n';

/**
 * The passkeys walk spec's six screens, replayed on the fake with the real router: each opens at an
 * address of its own, is checked by whole labels, and waits on nothing but an expect, in both
 * languages as the spec walks them.
 */
describe.each(['en', 'vi'] as const)(
  'the operator’s passkeys, screens 1 to 6, in %s',
  (language) => {
    const words = DICTIONARIES[language];
    const JOIN = `/operator/join#${DEMO_JOIN_TOKEN}`;
    const open = (path: string, cue?: string, operator?: boolean) =>
      openApp(path, { language, cue, operator });
    const title = (name: string) => screen.findByRole('heading', { level: 2, name });
    const press = async (name: string) =>
      await userEvent.click(await screen.findByRole('button', { name }));

    it('Screen 1 names whose link it is, who made it, and offers the button to make a passkey', async () => {
      open(JOIN);

      expect(await title(words.passkey.joinTitle)).toBeTruthy();
      expect(
        await screen.findByText(words.passkey.joinFor.replace('{{name}}', DEMO_INVITED_NAME)),
      ).toBeTruthy();
      expect(
        screen.getByText(words.passkey.joinMadeBy.replace('{{name}}', OPERATOR_NAME)),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: words.passkey.makeButton })).toBeTruthy();
    });

    it('Screen 2 lists the two passkeys, one never used, with the button to add one', async () => {
      open('/operator/passkeys', undefined, true);

      expect(await title(words.passkey.title)).toBeTruthy();
      expect(await screen.findByRole('cell', { name: words.passkey.never })).toBeTruthy();
      expect(screen.getByRole('button', { name: words.passkey.add })).toBeTruthy();
    });

    it('Screen 3 says the passkey was not given when the sign-in button is pressed with the authenticator cued', async () => {
      open('/operator', 'passkey:notGiven');
      await title(words.operator.signIn);
      await press(words.passkey.signInButton);

      expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    });

    it('Screen 4 says no operator here has the passkey when the sign-in answers a 401', async () => {
      open('/operator', 'operatorPasskeySignIn:401');
      await title(words.operator.signIn);
      await press(words.passkey.signInButton);

      expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.refused);
    });

    it('Screen 5 says the link cannot be used when its opening answers a 404', async () => {
      open(JOIN, 'operatorJoinOptions:404');

      expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.dead);
    });

    it('Screen 2, in the full run, adds a passkey to the list by the page’s own button', async () => {
      // As the full run does: the device holds the join's passkey, which the list names and the
      // add options exclude, so the second is made as on another device: the add options drop the
      // exclusion and nothing else (the walk's route does the same), and the device keeps what it
      // holds.
      const { passkeys } = openApp('/operator/passkeys', {
        language,
        operator: true,
        override: (api, original) => {
          api.operatorPasskeyAddOptions.mockImplementation(async () => {
            const reply = await original.operatorPasskeyAddOptions();
            const options = { ...reply.options };
            delete options['excludeCredentials'];
            return { ...reply, options };
          });
        },
      });
      await title(words.passkey.title);
      expect(await screen.findAllByRole('row')).toHaveLength(1 + 2);
      passkeys.hold(DEMO_PASSKEYS[0].id);

      await press(words.passkey.add);

      await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + 3));
    });

    it('Screen 2, on a device that still holds a passkey the list names, is refused by it, as the browser refuses', async () => {
      const { passkeys } = open('/operator/passkeys', undefined, true);
      await title(words.passkey.title);
      expect(await screen.findAllByRole('row')).toHaveLength(1 + 2);
      passkeys.hold(DEMO_PASSKEYS[0].id);

      await press(words.passkey.add);

      expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.alreadyHere);
      expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
    });

    it('Screen 6 opens the prompt over the form, which keeps what was typed', async () => {
      open('/operator/clients/new', 'makeClient:401', true);
      await title(words.operator.newTitle);
      await userEvent.type(
        await screen.findByLabelText(new RegExp(`^${words.operator.code}`)),
        'minh-phat',
      );
      await userEvent.type(
        screen.getByLabelText(new RegExp(`^${words.operator.companyName}`)),
        'Minh Phát',
      );
      await press(words.operator.make);

      expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
      expect(
        screen.getByLabelText<HTMLInputElement>(new RegExp(`^${words.operator.code}`)).value,
      ).toBe('minh-phat');
    });
  },
);
