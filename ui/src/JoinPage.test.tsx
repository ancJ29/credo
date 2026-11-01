import { DEMO_INVITED_NAME, DEMO_JOIN_TOKEN, OPERATOR_NAME } from '@credo/shared/demo';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';

const words = DICTIONARIES.en;
const PATH = `/operator/join#${DEMO_JOIN_TOKEN}`;

describe('the join page', () => {
  it('names whose link it is and who made it, with one button to make a passkey; the page asks for no name and no password', async () => {
    const { api } = openApp(PATH);

    expect(await screen.findByText(`This link is for ${DEMO_INVITED_NAME}.`)).toBeTruthy();
    expect(screen.getByText(`It was made by ${OPERATOR_NAME}.`)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(words.passkey.joinTitle);
    expect(screen.getByRole('button', { name: 'Make a passkey' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(api.operatorJoinOptions).toHaveBeenCalledExactlyOnceWith(DEMO_JOIN_TOKEN);
    expect(api.operatorMe).not.toHaveBeenCalled();
  });

  it('says so when the operator who made the link has been deleted', async () => {
    openApp(PATH, {
      override: (api, original) =>
        api.operatorJoinOptions.mockImplementation(async (link) => ({
          ...(await original.operatorJoinOptions(link)),
          madeBy: null,
        })),
    });

    expect(await screen.findByText(words.passkey.joinMadeByNone)).toBeTruthy();
  });

  it('says so when the link was made from the command line, not by an operator', async () => {
    openApp(PATH, {
      override: (api, original) =>
        api.operatorJoinOptions.mockImplementation(async (link) => ({
          ...(await original.operatorJoinOptions(link)),
          madeBy: null,
          madeByTerminal: true,
        })),
    });

    expect(await screen.findByText(words.passkey.joinMadeByTerminal)).toBeTruthy();
    expect(screen.queryByText(words.passkey.joinMadeByNone)).toBeNull();
  });

  it('reads the link from the address’s fragment alone, and speaks Vietnamese on a device that chose it', async () => {
    openApp(PATH, { language: 'vi' });

    expect(await screen.findByRole('button', { name: 'Tạo khóa truy cập' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      DICTIONARIES.vi.passkey.joinTitle,
    );
  });

  it('Making the passkey asks the options afresh, makes it on the device, joins, keeps the new handle and lands on the dashboard signed in', async () => {
    const { api, device, passkeys } = openApp(PATH);
    const register = vi.spyOn(passkeys, 'register');
    await userEvent.click(await screen.findByRole('button', { name: 'Make a passkey' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    expect(api.operatorJoinOptions).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledExactlyOnceWith({ challenge: 'fake-challenge' });
    expect(api.operatorJoin).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ link: DEMO_JOIN_TOKEN, token: 'fake.token' }),
    );
    expect(device.operatorAuthId()).toBe('fake.operator.joined');
    expect(screen.getByRole('button', { name: DEMO_INVITED_NAME })).toBeTruthy();
  });

  it('A passkey not given says so and offers the button again; any other failure says the service is unavailable', async () => {
    openApp(PATH, { cue: 'passkey:notGiven' });
    await userEvent.click(await screen.findByRole('button', { name: 'Make a passkey' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.notGiven);
    expect(screen.getByText(`This link is for ${DEMO_INVITED_NAME}.`)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Make a passkey' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
  });

  it('A join that fails for the service says it is unavailable, and the link is still offered', async () => {
    openApp(PATH, { cue: 'operatorJoin:503' });
    await userEvent.click(await screen.findByRole('button', { name: 'Make a passkey' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);
    expect(screen.getByRole('button', { name: 'Make a passkey' })).toBeTruthy();
  });

  it('A link used, too old or replaced says so in one sentence, however it died: at the opening, or between the opening and the button', async () => {
    openApp(PATH, { cue: 'operatorJoinOptions:404' });
    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.dead);
    expect(screen.queryByRole('button', { name: 'Make a passkey' })).toBeNull();
  });

  it('A link that dies after the page opened is a dead link when the button is pressed', async () => {
    const { api } = openApp(PATH);
    await screen.findByRole('button', { name: 'Make a passkey' });
    api.operatorJoinOptions.mockRejectedValueOnce(new ApiError(404));
    await userEvent.click(screen.getByRole('button', { name: 'Make a passkey' }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.dead);
  });

  it('An address with no token, or a wrong one, is a dead link without asking the service', async () => {
    for (const path of ['/operator/join', '/operator/join#short']) {
      const { api, unmount } = openApp(path);
      expect((await screen.findByRole('alert')).textContent, path).toBe(words.passkey.dead);
      expect(api.operatorJoinOptions).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('A service that does not answer the opening says it is unavailable and tries again on request', async () => {
    const { api } = openApp(PATH, { cue: 'operatorJoinOptions:503' });
    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);

    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));

    expect(await screen.findByRole('button', { name: 'Make a passkey' })).toBeTruthy();
    expect(api.operatorJoinOptions).toHaveBeenCalledTimes(2);
  });

  it('A page left before the opening answers is not drawn into', async () => {
    const { unmount, api } = openApp(PATH);
    unmount();
    await waitFor(() => expect(api.operatorJoinOptions).toHaveBeenCalledOnce());
  });
});
