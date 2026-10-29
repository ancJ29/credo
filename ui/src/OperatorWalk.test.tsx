import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { DICTIONARIES } from './i18n';

/**
 * The walk spec's screens 5, 6 and 7, which it shoots right after the sign-in screen and before it
 * makes a client, replayed on the fake with the real router: each opens at an address of its own,
 * is checked by whole labels, and is not waited for with anything but an expect.
 */
describe.each(['en', 'vi'] as const)('the operator’s screens 5 to 7, in %s', (language) => {
  const words = DICTIONARIES[language];
  const open = (path: string, cue?: string) => openApp(path, { language, cue, operator: true });

  it('Screen 5 lists the data set’s three clients, newest first, under the five sections', async () => {
    open('/operator/clients');

    expect(await screen.findByRole('heading', { level: 2, name: words.nav.clients })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Bình An' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: words.nav.menu })).toBeTruthy();
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
});
