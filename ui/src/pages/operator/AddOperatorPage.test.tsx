import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const PATH = '/operator/operators/new';
const open = (options: Parameters<typeof openApp>[1] = {}) =>
  openApp(PATH, { operator: true, ...options });

const nameBox = () => screen.findByLabelText<HTMLInputElement>(/Operator’s name/);
const makeButton = () => screen.getByRole('button', { name: words.team.make });
async function typeName(name: string) {
  await userEvent.type(await nameBox(), name);
}

describe('adding an operator', () => {
  it('B1 row 2: a name and a fresh touch made for this act add one, and the join link is shown once with a copy button', async () => {
    const { api } = open();
    await typeName('  Thu Hà ');
    await userEvent.click(makeButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: words.team.addedTitle }),
    ).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('add-operator');
    expect(api.addOperator).toHaveBeenCalledExactlyOnceWith({
      name: 'Thu Hà',
      confirm: expect.objectContaining({ token: 'fake.token' }) as unknown,
    });
    expect(screen.getByRole('alert').textContent).toContain('Thu Hà');
    const link = screen.getByLabelText<HTMLInputElement>(words.team.link).value;
    expect(link).toBe(
      `${window.location.origin}/operator/join#${'fake-join-link-01'.padEnd(43, '0')}`,
    );
    expect(screen.getByRole('button', { name: `Copy: ${words.team.link}` })).toBeTruthy();
  });

  it('B1 row 2: the new operator is listed, invited, added by the one reading; the link is gone once the page is left', async () => {
    open();
    await typeName('Thu Hà');
    await userEvent.click(makeButton());
    await screen.findByLabelText(words.team.link);

    await userEvent.click(screen.getByRole('link', { name: words.team.back }));
    await screen.findAllByRole('row');
    const row = (await screen.findByRole('cell', { name: 'Thu Hà' })).closest('tr')!;
    expect(row.textContent).toContain('Invited');
    expect(row.textContent).toContain('operator');
    expect(document.body.innerHTML).not.toContain('fake-join-link');
  });

  it('B1 row 2: Add another comes back to an empty form', async () => {
    open();
    await typeName('Thu Hà');
    await userEvent.click(makeButton());
    await userEvent.click(await screen.findByRole('button', { name: words.team.another }));

    expect((await nameBox()).value).toBe('');
  });

  it('B1 row 3: a name already there, in other capitals and with spaces, is refused and says so; what was typed is kept and nothing is added', async () => {
    const { api } = open();
    await typeName(' LAN anh ');
    await userEvent.click(makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.team.taken);
    expect((await nameBox()).value).toBe(' LAN anh ');
    expect(screen.queryByRole('heading', { name: words.team.addedTitle })).toBeNull();
    expect(api.addOperator).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('link', { name: words.team.back }));
    await screen.findAllByRole('row');
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
  });

  it('B1 row 3: a 409 the service answers is the same refusal', async () => {
    open({ cue: 'addOperator:409' });
    await typeName('Thu Hà');
    await userEvent.click(makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.team.taken);
  });

  it('B1 row 5: an empty name, or one past 60 characters, is refused on the form before the touch is asked', async () => {
    const { api } = open();
    await typeName('   ');
    await userEvent.click(makeButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.team.nameInvalid);

    await userEvent.clear(await nameBox());
    await userEvent.click(await nameBox());
    await userEvent.paste('x'.repeat(61));
    await userEvent.click(makeButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.team.nameInvalid);
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
    expect(api.addOperator).not.toHaveBeenCalled();
  });

  it('B1 row 7: a touch not given adds no one and keeps the name', async () => {
    const { api } = open({ cue: 'passkey:notGiven' });
    await typeName('Thu Hà');
    await userEvent.click(makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.addOperator).not.toHaveBeenCalled();
    expect((await nameBox()).value).toBe('Thu Hà');
  });

  it('B1 row 7: only a touch not given reads “not given”: any other failure of the device says the operator was not added', async () => {
    const { passkeys } = open();
    vi.spyOn(passkeys, 'authenticate').mockRejectedValueOnce(new Error('the device broke'));
    await typeName('Thu Hà');
    await userEvent.click(makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.team.failed);
  });

  it('B2 row 5: a failure says the operator may not have been added, since the service may have written the roster line before it failed', () => {
    expect(words.team.failed).toMatch(/may not have been added/);
    expect(DICTIONARIES.vi.team.failed).toMatch(/có thể chưa được thêm/);
  });

  it('B1 row 8: a service that fails says no one was added, and keeps the name', async () => {
    open({ cue: 'addOperator:503' });
    await typeName('Thu Hà');
    await userEvent.click(makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.team.failed);
    expect((await nameBox()).value).toBe('Thu Hà');
    expect(screen.queryByRole('heading', { name: words.team.addedTitle })).toBeNull();
  });

  it('B1 row 7: a 401 opens the prompt over the page, the name kept', async () => {
    const { api } = open();
    await typeName('Thu Hà');
    api.addOperator.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(makeButton());

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>(/Operator’s name/).value).toBe('Thu Hà'),
    );
  });

  it('B1: says it all in Vietnamese', async () => {
    open({ language: 'vi' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Thêm người vận hành' }),
    ).toBeTruthy();
    await userEvent.type(await screen.findByLabelText(/Tên người vận hành/), 'Thu Hà');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm người vận hành' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Đã thêm người vận hành' }),
    ).toBeTruthy();
  });
});
