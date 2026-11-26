import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_PERSON_PASSKEYS } from '@credo/shared/demo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../../../tests/open';
import { dayOf } from '../../day';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
const lan = person('EMP-0001').code;
const [iphone, pc] = DEMO_PERSON_PASSKEYS;
const removeOf = (device: string) =>
  screen.getByRole('button', { name: `${words.ownPasskeys.remove}: ${device}` });
const rows = () => screen.getAllByRole('row').slice(1);

afterEach(() => vi.restoreAllMocks());

describe('14: the passkey list', () => {
  it('draws each passkey of the person with its device, day added and day last used or never, and a Remove each', async () => {
    const { api } = openApp('/passkeys', { as: lan });

    expect(
      await screen.findByRole('heading', { level: 2, name: words.ownPasskeys.title }),
    ).toBeTruthy();
    expect(await screen.findByText(words.ownPasskeys.text)).toBeTruthy();
    expect(api.ownPasskeys).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      words.ownPasskeys.colDevice,
      words.passkey.colAdded,
      words.passkey.colLastUsed,
      '',
    ]);
    expect(rows().map((row) => row.textContent)).toEqual([
      `${iphone.device}${dayOf(iphone.addedAt, 'en')}${dayOf(iphone.lastUsedAt, 'en')}${words.ownPasskeys.remove}`,
      `${pc.device}${dayOf(pc.addedAt, 'en')}${words.passkey.never}${words.ownPasskeys.remove}`,
    ]);
    expect(removeOf(pc.device)).toBeTruthy();
    expect(screen.queryByText(words.ownPasskeys.removeAsk)).toBeNull();
    expect(screen.getByRole('link', { name: words.ownPasskey.submit }).getAttribute('href')).toBe(
      '/passkey',
    );
  });

  it('reads "Device not recorded" for a passkey stored before devices were named', async () => {
    openApp('/passkeys', {
      as: lan,
      override: (spied) => {
        spied.ownPasskeys.mockResolvedValue([
          { id: 'old', device: null, addedAt: iphone.addedAt, lastUsedAt: null },
        ]);
      },
    });

    expect((await screen.findAllByRole('row'))[1]?.textContent).toContain(
      words.ownPasskeys.deviceUnknown,
    );
  });

  it('a person with none sees the line and the way to add, and no table', async () => {
    openApp('/passkeys', { as: person('EMP-0002').code });

    expect(await screen.findByText(words.ownPasskeys.none)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: words.ownPasskey.submit }).getAttribute('href')).toBe(
      '/passkey',
    );
  });

  it('a list that cannot be read says so and offers a retry, which reads it again', async () => {
    const { api } = openApp('/passkeys', { as: lan, cue: 'ownPasskeys:503' });

    await userEvent.click(await screen.findByRole('button', { name: words.common.retry }));

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(api.ownPasskeys).toHaveBeenCalledTimes(2);
  });

  it('where passkeys are off the page says so, as a company’s choice, with no list and no way to add', async () => {
    openApp('/passkeys', { as: lan, cue: 'ownPasskeys:404' });

    expect((await screen.findByRole('alert')).textContent).toBe(words.ownPasskey.off);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('link', { name: words.ownPasskey.submit })).toBeNull();
  });
});

describe('15: removing a passkey', () => {
  it('asks first: Keep it keeps every row, and nothing is sent', async () => {
    const { api } = openApp('/passkeys', { as: lan });
    await screen.findByRole('table');

    await userEvent.click(removeOf(pc.device));
    expect(screen.getByText(words.ownPasskeys.removeAsk)).toBeTruthy();
    expect(api.ownPasskeyRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeCancel }));

    expect(screen.queryByText(words.ownPasskeys.removeAsk)).toBeNull();
    expect(rows()).toHaveLength(2);
    expect(api.ownPasskeyRemove).not.toHaveBeenCalled();
  });

  it('a confirmed removal says so, takes the session that replaces the one held, and drops the row', async () => {
    const { api, device } = openApp('/passkeys', {
      as: lan,
      override: (spied, original) => {
        spied.ownPasskeyRemove.mockImplementation(async (id) => {
          const done = await original.ownPasskeyRemove(id);
          return { ...done, session: { ...done.session, authId: 'fake.session.renewed' } };
        });
      },
    });
    await screen.findByRole('table');

    await userEvent.click(removeOf(pc.device));
    await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeConfirm }));

    expect((await screen.findByRole('status')).textContent).toContain(words.ownPasskeys.removed);
    expect(api.ownPasskeyRemove).toHaveBeenCalledExactlyOnceWith(pc.id);
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText(iphone.device)).toBeTruthy();
    expect(screen.queryByText(words.ownPasskeys.removeAsk)).toBeNull();
    expect(device.authId()).toBe('fake.session.renewed');
  });

  it('the last one removed leaves the line and the way to add', async () => {
    openApp('/passkeys', { as: lan });
    await screen.findByRole('table');
    for (const one of [pc, iphone]) {
      await userEvent.click(removeOf(one.device));
      await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeConfirm }));
      await screen.findByRole('status');
    }

    expect(await screen.findByText(words.ownPasskeys.none)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a failure is told, and the row stays', async () => {
    openApp('/passkeys', { as: lan, cue: 'ownPasskeyRemove:503' });
    await screen.findByRole('table');

    await userEvent.click(removeOf(pc.device));
    await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeConfirm }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.passkey.removeFailed);
    expect(rows()).toHaveLength(2);
  });

  it('a session the service no longer knows signs the person out', async () => {
    openApp('/passkeys', { as: lan, cue: 'ownPasskeyRemove:401' });
    await screen.findByRole('table');

    await userEvent.click(removeOf(pc.device));
    await userEvent.click(screen.getByRole('button', { name: words.ownPasskeys.removeConfirm }));

    expect(await screen.findByLabelText(new RegExp(words.auth.username))).toBeTruthy();
  });
});
