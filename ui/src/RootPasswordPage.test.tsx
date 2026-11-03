import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const PATH = '/operator/clients/hoa-sen/root-password';
const open = (options: Parameters<typeof openApp>[1] = {}) =>
  openApp(PATH, { operator: true, ...options });
const GOOD = 'Abcdef1!';
const MADE = 'Fake-password-1!';

const codeBox = () => screen.findByLabelText(/Type the client’s code to confirm/);
const setButton = () => screen.getByRole('button', { name: words.operator.rootSet });

async function fill({ code = 'hoa-sen', first = '', again = '' } = {}) {
  await userEvent.type(await codeBox(), code);
  if (first) await userEvent.type(screen.getByLabelText(words.person.passwordNew), first);
  if (again) await userEvent.type(screen.getByLabelText(words.person.passwordAgain), again);
}

describe('a client’s root password set anew', () => {
  it('The clients list offers New root password on each row, to a page naming the company, its code and what it ends', async () => {
    openApp('/operator/clients', { operator: true });
    const link = await screen.findByRole('link', { name: 'New root password: hoa-sen' });
    expect(link.getAttribute('href')).toBe(PATH);
    await userEvent.click(link);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'New root password for Hoa Sen' }),
    ).toBeTruthy();
    expect(screen.getByText(/signed out on every device/)).toBeTruthy();
    expect(screen.getByLabelText(/Type the client’s code to confirm/)).toBeTruthy();
    expect(screen.getByText('This client’s code is hoa-sen.')).toBeTruthy();
    expect(screen.getByText(words.operator.rootEmptyHint, { exact: false })).toBeTruthy();
  });

  it('Nothing is sent until the code is typed: another code is refused on the form and the touch is not asked', async () => {
    const { api } = open();
    await fill({ code: 'binh-an', first: GOOD, again: GOOD });
    await userEvent.click(setButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.rootCodeWrong);
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
    expect(api.setRootPassword).not.toHaveBeenCalled();
  });

  it('A code typed in capitals and with spaces around it is the code', async () => {
    const { api } = open();
    await fill({ code: '  HOA-Sen ', first: GOOD, again: GOOD });
    await userEvent.click(setButton());

    await screen.findByRole('heading', { level: 2, name: words.operator.rootDoneTitle });
    expect(api.setRootPassword).toHaveBeenCalledOnce();
  });

  it('A typed password breaking the rule, or two that differ, is refused on the form with piece 2’s words, before anything is sent', async () => {
    const { api } = open();
    await fill({ first: 'weak', again: 'weak' });
    await userEvent.click(setButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.person.passwordInvalid);

    await userEvent.clear(screen.getByLabelText(words.person.passwordNew));
    await userEvent.type(screen.getByLabelText(words.person.passwordNew), GOOD);
    await userEvent.click(setButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.person.passwordMismatch);
    expect(api.setRootPassword).not.toHaveBeenCalled();
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
  });

  it('A typed password is set with a fresh touch made for this act, said set, and never shown back', async () => {
    const { api } = open();
    await fill({ first: GOOD, again: GOOD });
    await userEvent.click(setButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: words.operator.rootDoneTitle }),
    ).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('root-password');
    expect(api.setRootPassword).toHaveBeenCalledExactlyOnceWith('hoa-sen', {
      password: GOOD,
      confirm: expect.objectContaining({ token: 'fake.token' }) as unknown,
    });
    expect(document.body.innerHTML).not.toContain(GOOD);
    expect(screen.queryByLabelText(words.operator.rootMadePassword)).toBeNull();
  });

  it('Left empty, the app makes one: shown once with a copy button, and gone after the operator leaves', async () => {
    const { api } = open();
    await fill();
    await userEvent.click(setButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: words.operator.rootMadeTitle }),
    ).toBeTruthy();
    expect(api.setRootPassword).toHaveBeenCalledWith(
      'hoa-sen',
      expect.objectContaining({ password: null }),
    );
    expect(screen.getByLabelText<HTMLInputElement>(words.operator.rootMadePassword).value).toBe(
      MADE,
    );
    expect(
      screen.getByRole('button', { name: `Copy: ${words.operator.rootMadePassword}` }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: words.operator.back }));
    await screen.findAllByRole('row');
    expect(document.body.innerHTML).not.toContain(MADE);
  });

  it('A touch not given sets nothing and keeps what was typed', async () => {
    const { api } = open({ cue: 'passkey:notGiven' });
    await fill({ first: GOOD, again: GOOD });
    await userEvent.click(setButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.setRootPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>(words.person.passwordNew).value).toBe(GOOD);
  });

  it('A setting that fails says the password is as it was, and keeps the code and the passwords typed', async () => {
    open({ cue: 'setRootPassword:503' });
    await fill({ first: GOOD, again: GOOD });
    await userEvent.click(setButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.rootFailed);
    expect(screen.getByLabelText<HTMLInputElement>(/Type the client’s code to confirm/).value).toBe(
      'hoa-sen',
    );
    expect(screen.getByLabelText<HTMLInputElement>(words.person.passwordNew).value).toBe(GOOD);
    expect(screen.queryByRole('heading', { name: words.operator.rootDoneTitle })).toBeNull();
  });

  it('A 401 opens the prompt over the page, the code and the passwords typed kept', async () => {
    const { api } = open();
    await fill({ first: GOOD, again: GOOD });
    api.setRootPassword.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(setButton());

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(words.person.passwordNew).value).toBe(GOOD);
  });

  it('A code the list lacks shows the client unknown, with a way back', async () => {
    openApp('/operator/clients/nobody/root-password', { operator: true });

    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.rootUnknown);
    expect(screen.getByRole('link', { name: words.operator.back }).getAttribute('href')).toBe(
      '/operator/clients',
    );
  });

  it('A list that cannot be loaded offers another try', async () => {
    open({ cue: 'listClients:503' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(await codeBox()).toBeTruthy();
  });

  it('Says it all in Vietnamese', async () => {
    open({ language: 'vi' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Mật khẩu root mới cho Hoa Sen' }),
    ).toBeTruthy();
  });
});
