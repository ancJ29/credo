import { DEMO_JOIN_TOKEN } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { DICTIONARIES } from './i18n';

/**
 * The walk spec's screens 5, 6 and 7, which it shoots right after the sign-in screen and before it
 * makes a client, and the join by the stack's link that the full run does before them, replayed on the fake with the real router: each opens at an address of its own,
 * is checked by whole labels, and is not waited for with anything but an expect.
 */
describe.each(['en', 'vi'] as const)('the operator’s screens 5 to 7, in %s', (language) => {
  const words = DICTIONARIES[language];
  const open = (path: string, cue?: string) => openApp(path, { language, cue, operator: true });

  it('Screen 5 lists the data set’s three clients, newest first, under the five sections', async () => {
    open('/operator/clients');

    expect(await screen.findByRole('heading', { level: 2, name: words.nav.clients })).toBeTruthy();
    expect(await screen.findByRole('cell', { name: 'Bình An' })).toBeTruthy();
    const menus = screen.getAllByRole('navigation', { name: words.nav.menu });
    expect(within(menus[0]).getAllByRole('link')).toHaveLength(5);
    expect(screen.queryByText('minh-phat')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
  });

  it('Screen 6 is the coming-soon page, reached after the list without a reload', async () => {
    open('/operator/usage');

    expect(await screen.findByRole('heading', { level: 2, name: words.nav.usage })).toBeTruthy();
    expect(screen.getByText(words.operator.soon, { exact: true })).toBeTruthy();
  });

  it('Screen 7 says the list could not be loaded when the list answers 503 once', async () => {
    open('/operator/clients', 'listClients:503');

    expect((await screen.findByRole('alert')).textContent).toBe(words.common.loadFailed);
  });

  it('The join by the link, which the full run does first, ends on the dashboard with the handle kept on the device', async () => {
    const { device } = openApp(`/operator/join#${DEMO_JOIN_TOKEN}`, { language });
    expect(device.operatorAuthId()).toBeNull();

    await userEvent.click(await screen.findByRole('button', { name: words.passkey.makeButton }));

    expect(await screen.findByRole('heading', { level: 2, name: words.nav.clients })).toBeTruthy();
    expect(device.operatorAuthId()).toBeTruthy();
  });
});
