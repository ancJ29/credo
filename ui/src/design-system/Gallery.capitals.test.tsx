import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Gallery } from './Gallery';

// The app's own colour written in capitals, as a hex colour may be: the gallery reads one spelling.
vi.mock('@credo/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@credo/shared')>()),
  CREDO_COLOUR: '#3E618C',
}));

describe('Gallery, the app’s colour in capitals', () => {
  it('the colour themes: the app’s colour written in capitals still opens the chooser on its own palette, marked', () => {
    render(
      <MemoryRouter initialEntries={['/48b74d079/gallery']}>
        <Gallery />
      </MemoryRouter>,
    );
    const chooser = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Colour theme' });

    expect(chooser.value).toBe('#3e618c');
    expect(within(chooser).getByRole('option', { name: 'Steel · the app’s' })).toBeDefined();
    expect(chooser.selectedOptions[0].textContent).toBe('Steel · the app’s');
  });
});
