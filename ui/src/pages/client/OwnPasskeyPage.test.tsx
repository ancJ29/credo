import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../../../tests/open';
import { type Api } from '../../api';
import { DICTIONARIES } from '../../i18n';
import { type Spied } from '../../../tests/open';

const words = DICTIONARIES.en;
const press = () => userEvent.click(screen.getByRole('button', { name: words.ownPasskey.submit }));
const opened = () => screen.findByRole('button', { name: words.ownPasskey.submit });

afterEach(() => vi.restoreAllMocks());

describe('19: the add-a-passkey page', () => {
  it('asks its options as it opens, says what a passkey is and that the password stays, and one press adds the passkey and says how to use it', async () => {
    const { api } = openApp('/passkey', { as: person('EMP-0002').code });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskey.title }),
    ).toBeTruthy();
    await opened();
    expect(screen.getByText(words.ownPasskey.text)).toBeTruthy();
    expect(api.ownPasskeyOptions).toHaveBeenCalledOnce();
    expect(api.ownPasskeyAdd).not.toHaveBeenCalled();

    await press();

    expect(await screen.findByText(words.ownPasskey.added)).toBeTruthy();
    expect(screen.getByText(words.ownPasskey.addedText)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.ownPasskey.submit })).toBeNull();
    expect(api.ownPasskeyOptions).toHaveBeenCalledOnce();
    const sent = api.ownPasskeyAdd.mock.calls[0]?.[0];
    expect(sent?.token).toBe('fake.token');
    expect(sent?.response.id).toBeTruthy();
  });

  it('A passkey not given says so and keeps the button; the next press adds it on the options already held', async () => {
    const { api } = openApp('/passkey', { cue: 'passkey:notGiven' });
    await opened();
    await press();

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.ownPasskeyAdd).not.toHaveBeenCalled();
    await press();

    expect(await screen.findByText(words.ownPasskey.added)).toBeTruthy();
    expect(api.ownPasskeyOptions).toHaveBeenCalledOnce();
  });

  it('A device that already holds one of the person’s passkeys says so, and adds nothing', async () => {
    const { api, passkeys } = openApp('/passkey', {
      override: (spied: Spied, original: Api) => {
        spied.ownPasskeyOptions.mockImplementation(async () => {
          const reply = await original.ownPasskeyOptions();
          return { ...reply, options: { ...reply.options, excludeCredentials: [{ id: 'held' }] } };
        });
      },
    });
    passkeys.hold('held');
    await opened();
    await press();

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.alreadyHere);
    expect(api.ownPasskeyAdd).not.toHaveBeenCalled();
  });

  it('An add the service fails says it was not added, and the next press asks fresh options, the first being spent', async () => {
    const { api } = openApp('/passkey', { cue: 'ownPasskeyAdd:503' });
    await opened();
    await press();

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.addFailed);
    await press();

    expect(await screen.findByText(words.ownPasskey.added)).toBeTruthy();
    expect(api.ownPasskeyOptions).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('A session issued too long ago is told to sign in again, and the person stays signed in', async () => {
    openApp('/passkey', { cue: 'ownPasskeyAdd:403' });
    await opened();
    await press();

    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPasskey.tooOld);
    expect(screen.getByRole('button', { name: words.ownPasskey.submit })).toBeTruthy();
  });

  it('Options older than four minutes are asked again inside the press', async () => {
    const { api } = openApp('/passkey');
    await opened();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 60_000);
    await press();

    expect(await screen.findByText(words.ownPasskey.added)).toBeTruthy();
    expect(api.ownPasskeyOptions).toHaveBeenCalledTimes(2);
  });

  it('Where passkeys are off the options come as a 404: the page says so, as a company’s choice and not a failure to load, with no button to add', async () => {
    openApp('/passkey', { cue: 'ownPasskeyOptions:404' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPasskey.off);
    expect(screen.queryByRole('button', { name: words.ownPasskey.submit })).toBeNull();
  });

  it('Options that cannot be read say so and offer a retry, which asks again', async () => {
    const { api } = openApp('/passkey', { cue: 'ownPasskeyOptions:503' });

    await userEvent.click(await screen.findByRole('button', { name: words.common.retry }));

    await opened();
    expect(api.ownPasskeyOptions).toHaveBeenCalledTimes(2);
  });

  it('A session the service no longer knows signs the person out', async () => {
    openApp('/passkey', { cue: 'ownPasskeyAdd:401' });
    await opened();
    await press();

    expect(await screen.findByLabelText(new RegExp(words.auth.username))).toBeTruthy();
  });

  it('18: More lists Passkeys for a person, after Change password, and the line opens the list', async () => {
    openApp('/more', { as: person('EMP-0002').code });

    const link = await screen.findByRole('link', { name: words.user.passkey });
    expect(link.getAttribute('href')).toBe('/passkeys');
  });

  it('13: the page leads back to the list, before the press and after the add', async () => {
    openApp('/passkey', { as: person('EMP-0002').code });
    await opened();
    const back = () => screen.getByRole('link', { name: words.ownPasskeys.title });
    expect(back().getAttribute('href')).toBe('/passkeys');
    await press();
    await screen.findByText(words.ownPasskey.added);
    expect(back().getAttribute('href')).toBe('/passkeys');
    await userEvent.click(back());

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskeys.title }),
    ).toBeTruthy();
    expect((await screen.findAllByRole('row')).length).toBe(2);
  });
});
