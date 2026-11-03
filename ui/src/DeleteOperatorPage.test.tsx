import { DEMO_COLLEAGUE_ID, DEMO_OPERATOR_ID } from '@credo/shared/demo';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const at = (id: string) => `/operator/operators/${id}/delete`;
const open = (id: string, options: Parameters<typeof openApp>[1] = {}) =>
  openApp(at(id), { operator: true, ...options });
const deleteButton = () => screen.findByRole('button', { name: words.team.deleteMake });

describe('deleting a colleague', () => {
  it('B2 row 2: the page says what goes and that they are signed out at once; a touch made for this act then deletes them and the list comes back without them', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID);

    expect(await screen.findByRole('heading', { level: 2, name: 'Delete Minh Quân' })).toBeTruthy();
    expect(screen.getByText(words.team.deleteIntro.replace('{{name}}', 'Minh Quân'))).toBeTruthy();
    expect(api.deleteOperator).not.toHaveBeenCalled();
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('heading', { level: 2, name: 'Operators' })).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('delete-operator');
    expect(api.deleteOperator).toHaveBeenCalledExactlyOnceWith(DEMO_COLLEAGUE_ID, {
      confirm: expect.objectContaining({ token: 'fake.token' }) as unknown,
    });
    await screen.findAllByRole('row');
    expect(screen.queryByRole('cell', { name: 'Minh Quân' })).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('B2 row 4: oneself, or one not there, has no page: it says so and offers the list, never the touch', async () => {
    for (const id of [DEMO_OPERATOR_ID, '00000000-0000-4000-8000-000000000999']) {
      const { api, unmount } = open(id);

      expect((await screen.findByRole('alert')).textContent).toBe(words.team.unknown);
      expect(screen.queryByRole('button', { name: words.team.deleteMake })).toBeNull();
      expect(api.deleteOperator).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('B2 row 3: a colleague already gone (404) leaves the page listing again, without them', async () => {
    open(DEMO_COLLEAGUE_ID, { cue: 'deleteOperator:404' });
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('heading', { level: 2, name: 'Operators' })).toBeTruthy();
  });

  it('B2 row 4: a touch not given deletes no one; the page stays', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID, { cue: 'passkey:notGiven' });
    await userEvent.click(await deleteButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.deleteOperator).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: words.team.deleteMake })).toBeTruthy();
  });

  it('B2 row 5: a failure says they may not have been deleted, since the service may have done it; a 401 opens the prompt', async () => {
    open(DEMO_COLLEAGUE_ID, { cue: 'deleteOperator:503' });
    await userEvent.click(await deleteButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.team.deleteFailed);
    expect(words.team.deleteFailed).toMatch(/may not have been deleted/);
    expect(screen.getByRole('button', { name: words.team.deleteMake })).toBeTruthy();
  });

  it('B2 row 4: a 401 opens the prompt over the page', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID);
    await deleteButton();
    api.deleteOperator.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(await deleteButton());

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: words.team.deleteMake })).toBeTruthy(),
    );
  });

  it('B2: says it all in Vietnamese', async () => {
    open(DEMO_COLLEAGUE_ID, { language: 'vi' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Xóa Minh Quân' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.vi.team.deleteMake }));
    expect(
      await screen.findByRole('heading', { level: 2, name: DICTIONARIES.vi.nav.operators }),
    ).toBeTruthy();
  });
});
