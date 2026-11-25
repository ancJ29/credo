import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../../../tests/open';
import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en.settings;

describe('the walk’s 17th scene, replayed on the real router and the fake', () => {
  it('25: the root chooses the logo for the coloured header, it is saved at once, and the header and the preview’s header wear it', async () => {
    openApp('/settings', { language: 'en' });
    // the walk's finders: the field by its label, its status, the header's and the preview's picture
    const light = (await screen.findByText(words.logoOnColour, { selector: 'p' })).parentElement!;
    const content = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const saved = `data:image/svg+xml;base64,${btoa(content)}`;
    const mark = new File([content], 'light.svg', {
      type: 'image/svg+xml',
    });

    await userEvent.upload(light.querySelector<HTMLInputElement>('input[type="file"]')!, mark);

    expect((await within(light).findByRole('status')).textContent).toBe(words.saved);
    await waitFor(() =>
      expect(document.querySelector('header img')?.getAttribute('src')).toBe(saved),
    );
    expect(document.querySelector('[data-preview="header"] img')?.getAttribute('src')).toBe(saved);
  });
});
