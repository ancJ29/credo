import { MAX_LOGO_BYTES, type TenantConfig } from '@credo/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../tests/render';
import { Settings } from './Settings';

const config: TenantConfig = {
  name: 'Minh Phát',
  logo: 'data:image/png;base64,AAAA',
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

type Props = Parameters<typeof Settings>[0];

const props = (more: Partial<Props> = {}): Props => ({
  status: 'ready',
  config,
  outcome: null,
  saving: false,
  onSave: vi.fn(),
  onRetry: vi.fn(),
  onReload: vi.fn(),
  ...more,
});

const save = () => screen.getByRole('button', { name: 'Save' });

describe('Settings', () => {
  it('waits while the settings load', () => {
    draw(<Settings {...props({ status: 'loading' })} />);

    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByLabelText('Company name')).toBeNull();
  });

  it('offers a retry when the settings did not load', async () => {
    const onRetry = vi.fn();
    draw(<Settings {...props({ status: 'failed', onRetry })} />);

    expect(screen.getByRole('alert').textContent).toBe('This page could not be loaded. Try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('A failed save says so and keeps what was typed', async () => {
    const p = props();
    const { rerender } = draw(<Settings {...p} />);
    const name = screen.getByLabelText<HTMLInputElement>(/Company name/);

    await userEvent.clear(name);
    await userEvent.type(name, 'Minh Phát Sài Gòn');
    await userEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    rerender(<Settings {...{ ...p, outcome: 'failed' as const }} />);

    expect(screen.getByRole('alert').textContent).toContain('were not saved');
    expect(screen.getByLabelText<HTMLInputElement>(/Company name/).value).toBe('Minh Phát Sài Gòn');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'English' }).checked).toBe(false);
  });

  it('a save over a newer one offers the newer settings', async () => {
    const onReload = vi.fn();
    draw(<Settings {...props({ outcome: 'conflict', onReload })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show the newer settings' }));

    expect(onReload).toHaveBeenCalledOnce();
  });

  it('a saved settings page says so, and a fresh one says nothing', () => {
    const { rerender } = draw(<Settings {...props({ outcome: 'saved' })} />);
    expect(screen.getByRole('alert').textContent).toContain('Saved');

    rerender(<Settings {...props()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends the whole draft on save', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.clear(screen.getByLabelText(/Company name/));
    await userEvent.type(screen.getByLabelText(/Company name/), 'New name');
    await userEvent.click(save());

    expect(onSave).toHaveBeenCalledExactlyOnceWith({ ...config, name: 'New name' });
  });

  it('refuses a save without a name, or with a colour that is not #rrggbb', async () => {
    draw(<Settings {...props()} />);
    expect(save().hasAttribute('disabled')).toBe(false);

    await userEvent.clear(screen.getByLabelText(/Company name/));
    expect(save().hasAttribute('disabled')).toBe(true);
    await userEvent.type(screen.getByLabelText(/Company name/), 'Name');
    expect(save().hasAttribute('disabled')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Brand colour'));
    await userEvent.type(screen.getByLabelText('Brand colour'), '#12');
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('moves the default to a language still offered, and refuses none', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tiếng Việt' }));
    expect(screen.getByLabelText<HTMLSelectElement>(/Language when/).value).toBe('en');
    await userEvent.click(save());
    expect(onSave).toHaveBeenCalledWith({ ...config, languages: ['en'], defaultLanguage: 'en' });

    await userEvent.click(screen.getByRole('checkbox', { name: 'English' }));
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('picks the default among the languages offered', async () => {
    const onSave = vi.fn();
    draw(<Settings {...props({ onSave })} />);

    await userEvent.selectOptions(screen.getByLabelText(/Language when/), 'en');
    await userEvent.click(save());

    expect(onSave).toHaveBeenCalledWith({ ...config, defaultLanguage: 'en' });
  });

  it('shows the logo, lets it be replaced by an image, and removed', async () => {
    draw(<Settings {...props({ config: { ...config, logo: null } })} />);
    expect(screen.getByText('No logo yet')).toBeTruthy();

    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await userEvent.upload(input, new File(['x'], 'logo.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove the logo' })).toBeTruthy(),
    );
    expect(document.querySelector('img')!.getAttribute('src')).toMatch(/^data:image\/png;base64,/);

    await userEvent.click(screen.getByRole('button', { name: 'Remove the logo' }));
    expect(screen.getByText('No logo yet')).toBeTruthy();
  });

  it('refuses a logo over the limit at the chooser, says why, and keeps the draft’s logo', async () => {
    draw(<Settings {...props()} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    await userEvent.upload(
      input,
      new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'big.png', { type: 'image/png' }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain('larger than 200 KB');
    expect(document.querySelector('img')!.getAttribute('src')).toBe(config.logo);
  });

  it('takes a logo of exactly the limit, and the refusal goes with it', async () => {
    draw(<Settings {...props()} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    const choose = (bytes: number) =>
      userEvent.upload(input, new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' }));

    await choose(MAX_LOGO_BYTES + 1);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await choose(MAX_LOGO_BYTES);

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await waitFor(() =>
      expect(document.querySelector('img')!.getAttribute('src')).not.toBe(config.logo),
    );
  });

  it('refuses a file that is not an image at the chooser, in either language', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { unmount } = draw(<Settings {...props()} />);
    const choose = () =>
      user.upload(
        document.querySelector<HTMLInputElement>('input[type=file]')!,
        new File(['hello'], 'notes.txt', { type: 'text/plain' }),
      );

    await choose();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That file is not an image, so it was not used. The logo is as it was.',
    );
    expect(document.querySelector('img')!.getAttribute('src')).toBe(config.logo);
    unmount();

    draw(<Settings {...props()} />, 'vi');
    await choose();
    expect((await screen.findByRole('alert')).textContent).toContain('không phải là ảnh');
  });

  it('says a refused save was refused, in its own words', () => {
    draw(<Settings {...props({ outcome: 'refused' })} />);

    expect(screen.getByRole('alert').textContent).toContain('were refused as they are');
  });

  it('ignores a file chooser closed without a file', () => {
    draw(<Settings {...props({ config: { ...config, logo: null } })} />);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;

    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(screen.getByText('No logo yet')).toBeTruthy();
  });
});
