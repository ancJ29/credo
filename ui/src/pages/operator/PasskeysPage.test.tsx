import { DEMO_PASSKEYS } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const open = (options: Parameters<typeof openApp>[1] = {}) =>
  openApp('/operator/passkeys', { operator: true, ...options });

/** The rows of the list, as their texts: the day added, the day last used. */
const rows = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 2)
        .map((cell) => cell.textContent),
    );

describe('the operator’s own passkeys', () => {
  it('lists each passkey by when it was added and when last used, and says "not used yet" for one never used; no secret and no name', async () => {
    open();

    expect(await screen.findByRole('heading', { level: 2, name: 'Your passkeys' })).toBeTruthy();
    await screen.findAllByRole('row');
    expect(rows()).toEqual([
      ['5 Oct 2026', '28 Oct 2026'],
      ['25 Oct 2026', 'Not used yet'],
    ]);
    expect(screen.getAllByRole('button', { name: /^Remove: / })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add a passkey' })).toBeTruthy();
  });

  it('says it in Vietnamese: the days as the day first, and the words of the language', async () => {
    open({ language: 'vi' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Khóa truy cập của bạn' }),
    ).toBeTruthy();
    await screen.findAllByRole('row');
    expect(rows()[1]).toEqual(['25/10/2026', 'Chưa dùng']);
  });

  it('Adding one makes a passkey on this device and lists it beside the others, never used', async () => {
    const { api } = open();
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + 3));
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('add');
    expect(api.operatorPasskeyAddOptions).toHaveBeenCalledOnce();
    expect(api.operatorPasskeyAdd).toHaveBeenCalledOnce();
    const sent = api.operatorPasskeyAdd.mock.calls[0]?.[0];
    expect(sent?.token).toBe('fake.token');
    expect(sent?.confirm.token).toBe('fake.token');
    expect(rows()[2]?.[1]).toBe('Not used yet');
  });

  it('A passkey not given says so and lists the same; a failure of the service says it was not added', async () => {
    open({ cue: 'passkey:notGiven' });
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('The touch is asked before an add and before a remove, and a touch not given sends neither', async () => {
    const { api } = open({ cue: 'passkey:notGiven' });
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Remove: 5 Oct 2026' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('remove');
    expect(api.operatorPasskeyRemove).not.toHaveBeenCalled();
    expect(api.operatorPasskeyAddOptions).not.toHaveBeenCalled();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('An add the service fails says the passkey was not added, and the next try clears it', async () => {
    open({ cue: 'operatorPasskeyAdd:503' });
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.addFailed);

    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
  });

  it('Removing one takes it off the list; removing the last says it cannot be removed, and it stays', async () => {
    const { api } = open();
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Remove: 5 Oct 2026' }));

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(1 + 1));
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledWith('remove');
    expect(api.operatorPasskeyRemove).toHaveBeenCalledExactlyOnceWith(
      DEMO_PASSKEYS[0]?.id,
      expect.objectContaining({ token: 'fake.token' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove: 25 Oct 2026' }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.lastOne);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 1);
  });

  it('A removal the service fails says it was not removed', async () => {
    open({ cue: 'operatorPasskeyRemove:503' });
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Remove: 5 Oct 2026' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.removeFailed);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('A list that cannot be loaded offers another try', async () => {
    open({ cue: 'operatorPasskeys:503' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findAllByRole('row')).toHaveLength(1 + 2);
  });

  it('A 401 on the list opens the prompt over the page', async () => {
    open({ cue: 'operatorPasskeys:401' });
    expect(await screen.findByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
  });

  it('An add that meets a 401 opens the prompt, and the page stays', async () => {
    const { api } = open();
    await screen.findAllByRole('row');
    api.operatorPasskeyAdd.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));

    expect(await screen.findByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('A removal that meets a 401 opens the prompt, and the list is as it was', async () => {
    const { api } = open();
    await screen.findAllByRole('row');
    api.operatorPasskeyRemove.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(screen.getByRole('button', { name: 'Remove: 5 Oct 2026' }));

    expect(await screen.findByRole('dialog', { name: 'Your sign-in ended' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });
});
