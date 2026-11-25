import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../../../tests/open';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en.settings;

const TAB = 'data:image/png;base64,TAB';
const APP = 'data:image/png;base64,APP';
const SMALL = 'data:image/png;base64,SMALL';

// jsdom has no canvas: the browser's resizing is stood in for, the rest is the app on the fake.
vi.mock('../../icons', async (original) => ({
  ...(await original<typeof import('../../icons')>()),
  makeIcon: vi.fn((_file: File, kind: string) =>
    Promise.resolve(kind === 'tab-icon' ? { picture: TAB } : { picture: APP, small: SMALL }),
  ),
}));

describe('the walk’s 18th scene, replayed on the real router and the fake', () => {
  it('19: the root chooses both icons, each is saved at once, and the fields, the preview and the head wear them', async () => {
    openApp('/settings', { language: 'en' });
    // the walk's finders: each field by its label, its status, the preview's two pictures, the head's links
    const fieldOf = async (label: string) =>
      (await screen.findByText(label, { selector: 'p' })).parentElement!;
    const file = (name: string) => new File(['x'], name, { type: 'image/png' });

    const tab = await fieldOf(words.tabIcon);
    await userEvent.upload(
      tab.querySelector<HTMLInputElement>('input[type="file"]')!,
      file('t.png'),
    );
    expect((await within(tab).findByRole('status')).textContent).toBe(words.saved);
    const app = await fieldOf(words.appIcon);
    await userEvent.upload(
      app.querySelector<HTMLInputElement>('input[type="file"]')!,
      file('a.png'),
    );
    expect((await within(app).findByRole('status')).textContent).toBe(words.saved);

    await waitFor(() =>
      expect(document.querySelector('[data-preview="tab"] img')?.getAttribute('src')).toBe(TAB),
    );
    expect(document.querySelector('[data-preview="home"] img')?.getAttribute('src')).toBe(APP);
    expect(document.querySelector('head link[rel="icon"]')?.getAttribute('href')).toBe(TAB);
    expect(document.querySelector('head link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe(
      APP,
    );
  });
});
