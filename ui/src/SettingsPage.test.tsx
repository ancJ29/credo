import type { ConfigDoc, TenantConfig } from '@credo/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { ApiError, type Api } from './api';
import { SettingsPage } from './SettingsPage';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: 'data:image/png;base64,AAAA',
  colour: '#2f7d6d',
  whiteHeader: false,
  whiteMenu: false,
  menuIcons: false,
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

describe('a save the BFF refuses on the settings page', () => {
  it('A 401 signs the person out and also leaves the failed outcome on the page', async () => {
    const onSignedOut = vi.fn();
    const onForbidden = vi.fn();
    const api = { saveConfig: vi.fn().mockRejectedValue(new ApiError(401)) } as unknown as Api;
    const doc: ConfigDoc = { config, version: 'v1' };
    draw(
      <SettingsPage
        api={api}
        doc={doc}
        onDoc={vi.fn()}
        onSignedOut={onSignedOut}
        onForbidden={onForbidden}
      />,
    );
    await userEvent.type(await screen.findByLabelText(/^Company name/), 'x');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(onForbidden).not.toHaveBeenCalled();
    // The failed outcome after a 401 is the deliberate consequence of deciding a 403 once, in
    // `refusal`: the page no longer re-checks the 401 to withhold it, and the sign-out redraws
    // the app over this page anyway. Do not add a status check here to remove it.
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
