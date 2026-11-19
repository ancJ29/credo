import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Gallery } from './Gallery';

// The app's own colour written in capitals, as a hex colour may be: the gallery reads one spelling.
vi.mock('@credo/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@credo/shared')>()),
  CREDO_COLOUR: '#3E618C',
}));

describe('Gallery, the app’s colour in capitals', () => {
  it('the colour themes: the app’s colour written in capitals still opens the chooser on its own palette, marked', async () => {
    render(
      <MemoryRouter initialEntries={['/48b74d079/gallery']}>
        <Gallery test />
      </MemoryRouter>,
    );
    const chooser = screen.getByRole<HTMLInputElement>('combobox', { name: 'Colour theme' });

    expect(chooser.value).toBe('Steel · the app’s');
    await userEvent.setup().click(chooser);
    const marked = within(await screen.findByRole('listbox')).getByRole('option', {
      selected: true,
    });
    expect(marked.textContent).toBe('Steel · the app’s');
  });
});
