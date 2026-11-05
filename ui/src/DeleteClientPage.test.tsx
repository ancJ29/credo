import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const PATH = '/operator/clients/hoa-sen/delete';
const open = (options: Parameters<typeof openApp>[1] = {}, path = PATH) =>
  openApp(path, { operator: true, ...options });

const codeBox = () => screen.findByLabelText(/Type the client’s code to confirm/);
const deleteButton = () => screen.findByRole('button', { name: words.operator.deleteClientMake });

describe('a client deleted whole', () => {
  it('the page names the company and what goes; the code typed and a touch made for this act delete it, and the list comes back without it', async () => {
    const { api } = open();

    expect(await screen.findByRole('heading', { level: 2, name: 'Delete Hoa Sen' })).toBeTruthy();
    expect(
      screen.getByText(words.operator.deleteClientIntro.replace('{{name}}', 'Hoa Sen')),
    ).toBeTruthy();
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('delete-client');
    expect(api.deleteClient).toHaveBeenCalledExactlyOnceWith('hoa-sen', {
      confirm: expect.objectContaining({ token: 'fake.token' }) as unknown,
    });
    await screen.findAllByRole('row');
    expect(screen.queryByRole('cell', { name: 'hoa-sen' })).toBeNull();
  });

  it('the code typed wrong makes no touch and no call', async () => {
    const { api } = open();
    await userEvent.type(await codeBox(), 'binh-an');
    await userEvent.click(await deleteButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.rootCodeWrong);
    expect(api.operatorPasskeyConfirmOptions).not.toHaveBeenCalled();
    expect(api.deleteClient).not.toHaveBeenCalled();
  });

  it('a client not in the list has no page: it says so and offers the list, never the touch', async () => {
    const { api } = open({}, '/operator/clients/nobody/delete');

    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.rootUnknown);
    expect(screen.queryByRole('button', { name: words.operator.deleteClientMake })).toBeNull();
    expect(api.deleteClient).not.toHaveBeenCalled();
  });

  it('a client already gone (404) leaves the page listing again', async () => {
    open({ cue: 'deleteClient:404' });
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
  });

  it('records left make the page press on and say how many, until none are', async () => {
    const { api } = open();
    api.deleteClient
      .mockResolvedValueOnce({ left: 2 })
      .mockResolvedValueOnce({ left: 1 })
      .mockResolvedValueOnce({ left: 0 });
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(api.deleteClient).toHaveBeenCalledTimes(3);
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledOnce();
  });

  it('a press that stops midway says so and says how many were left', async () => {
    const { api } = open();
    api.deleteClient.mockResolvedValueOnce({ left: 5 }).mockRejectedValueOnce(new ApiError(503));
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain(words.operator.deleteClientFailed);
    expect(screen.getByRole('status').textContent).toBe(
      words.operator.deleteClientLeft.replace('{{count}}', '5'),
    );
  });

  it('a touch not given deletes nothing; the page stays', async () => {
    const { api } = open({ cue: 'passkey:notGiven' });
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.deleteClient).not.toHaveBeenCalled();
  });

  it('a failure says the client may not be deleted; a 401 opens the prompt', async () => {
    const { api } = open({ cue: 'deleteClient:503' });
    await userEvent.type(await codeBox(), 'hoa-sen');
    await userEvent.click(await deleteButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.operator.deleteClientFailed);

    api.deleteClient.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(await deleteButton());
    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Delete the client/ })).toBeTruthy(),
    );
  });

  it('says it all in Vietnamese', async () => {
    open({ language: 'vi' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Xóa Hoa Sen' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: DICTIONARIES.vi.operator.deleteClientMake }),
    ).toBeTruthy();
  });
});
