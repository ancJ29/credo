import { DEMO_COLLEAGUE_ID, DEMO_OPERATOR_ID } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const INVITED_ID = '00000000-0000-4000-8000-000000000202';
const at = (id: string) => `/operator/operators/${id}/link`;
const open = (id: string, options: Parameters<typeof openApp>[1] = {}) =>
  openApp(at(id), { operator: true, ...options });
const makeButton = () => screen.findByRole('button', { name: words.team.linkMake });

describe('a new link for a colleague', () => {
  it('B2 row 1: the page says what the link does to an active colleague, and a touch made for this act then shows the link once with a copy button', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'A new link for Minh Quân' }),
    ).toBeTruthy();
    expect(
      screen.getByText(words.team.linkIntroActive.replace('{{name}}', 'Minh Quân')),
    ).toBeTruthy();
    expect(api.newOperatorLink).not.toHaveBeenCalled();
    await userEvent.click(await makeButton());

    expect(
      await screen.findByRole('heading', { level: 2, name: words.team.linkMadeTitle }),
    ).toBeTruthy();
    expect(api.operatorPasskeyConfirmOptions).toHaveBeenCalledExactlyOnceWith('operator-link');
    expect(api.newOperatorLink).toHaveBeenCalledExactlyOnceWith(DEMO_COLLEAGUE_ID, {
      confirm: expect.objectContaining({ token: 'fake.token' }) as unknown,
    });
    expect(screen.getByRole('alert').textContent).toContain('Minh Quân');
    const link = screen.getByLabelText<HTMLInputElement>(words.team.link).value;
    expect(link).toMatch(new RegExp(`^${window.location.origin}/operator/join#.{43}$`));
    expect(screen.getByRole('button', { name: `Copy: ${words.team.link}` })).toBeTruthy();
  });

  it('B2 row 5: for an invited colleague it says the old link stops, and the link is made the same way', async () => {
    const { api } = open(INVITED_ID);

    expect(
      await screen.findByText(words.team.linkIntroInvited.replace('{{name}}', 'Lan Anh')),
    ).toBeTruthy();
    await userEvent.click(await makeButton());
    await screen.findByLabelText(words.team.link);
    expect(api.newOperatorLink).toHaveBeenCalledOnce();
  });

  it('B2 row 1: the link is held on the page alone: gone once it is left', async () => {
    open(DEMO_COLLEAGUE_ID);
    await userEvent.click(await makeButton());
    await screen.findByLabelText(words.team.link);

    await userEvent.click(screen.getByRole('link', { name: words.team.back }));
    await screen.findAllByRole('row');
    expect(document.body.innerHTML).not.toContain('/operator/join#');
  });

  it('B2 row 4: the list offers New link and Delete on every row but the reader’s, each leading to its page', async () => {
    openApp('/operator/operators', { operator: true });
    await screen.findAllByRole('row');
    const row = (name: string) => within(screen.getByRole('cell', { name }).closest('tr')!);

    expect(
      row('Minh Quân').getByRole('link', { name: `${words.team.newLink}: Minh Quân` }),
    ).toBeTruthy();
    expect(
      row('Minh Quân').getByRole('link', { name: `${words.team.delete}: Minh Quân` }),
    ).toBeTruthy();
    expect(row('Lan Anh').getAllByRole('link')).toHaveLength(2);
    expect(within(screen.getByText('you').closest('tr')!).queryAllByRole('link')).toEqual([]);

    await userEvent.click(
      row('Minh Quân').getByRole('link', { name: `${words.team.newLink}: Minh Quân` }),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'A new link for Minh Quân' }),
    ).toBeTruthy();
  });

  it('B2 row 4: oneself, or one not there, has no page: it says so and offers the list, never the touch', async () => {
    for (const id of [DEMO_OPERATOR_ID, '00000000-0000-4000-8000-000000000999']) {
      const { api, unmount } = open(id);

      expect((await screen.findByRole('alert')).textContent).toBe(words.team.unknown);
      expect(screen.queryByRole('button', { name: words.team.linkMake })).toBeNull();
      expect(screen.getByRole('link', { name: words.team.back })).toBeTruthy();
      expect(api.newOperatorLink).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('B2 row 4: a touch not given makes no link; the page stays for another try', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID, { cue: 'passkey:notGiven' });
    await userEvent.click(await makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(api.newOperatorLink).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: words.team.linkMake })).toBeTruthy();
  });

  it('B2 row 5: a failure says the link may not have been made, since the service may have made it; the colleague gone says so; a 401 opens the prompt', async () => {
    open(DEMO_COLLEAGUE_ID, { cue: 'newOperatorLink:503' });
    await userEvent.click(await makeButton());
    expect((await screen.findByRole('alert')).textContent).toBe(words.team.linkFailed);
    expect(words.team.linkFailed).toMatch(/may not have been made/);
    expect(DICTIONARIES.vi.team.linkFailed).toMatch(/có thể chưa/);
  });

  it('B2 row 3: a colleague already deleted answers 404: the page says they are gone and offers the list', async () => {
    open(DEMO_COLLEAGUE_ID, { cue: 'newOperatorLink:404' });
    await userEvent.click(await makeButton());

    expect((await screen.findByRole('alert')).textContent).toBe(words.team.unknown);
    expect(screen.queryByRole('button', { name: words.team.linkMake })).toBeNull();
  });

  it('B2 row 4: a 401 opens the prompt over the page', async () => {
    const { api } = open(DEMO_COLLEAGUE_ID);
    await makeButton();
    api.newOperatorLink.mockRejectedValueOnce(new ApiError(401));
    await userEvent.click(await makeButton());

    expect(await screen.findByRole('dialog', { name: words.passkey.endedTitle })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: words.team.linkMake })).toBeTruthy(),
    );
  });

  it('B2: says it all in Vietnamese', async () => {
    open(DEMO_COLLEAGUE_ID, { language: 'vi' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Đường dẫn mới cho Minh Quân' }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.vi.team.linkMake }));
    expect(
      await screen.findByRole('heading', { level: 2, name: DICTIONARIES.vi.team.linkMadeTitle }),
    ).toBeTruthy();
  });
});
