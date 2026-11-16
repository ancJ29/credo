import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gallery } from './Gallery';

// Every component file of the three folders, by level and name: the gallery must show each.
const FILES = Object.keys(
  import.meta.glob(['../components/*/*.tsx', '!../components/*/*.test.tsx']),
);
const found = FILES.map((path) => path.split('/').slice(-2)).map(([level, file]) => ({
  level: level,
  name: file.replace('.tsx', ''),
}));

const HEADINGS: Record<string, string> = {
  atoms: 'Atoms',
  molecules: 'Molecules',
  organisms: 'Organisms',
};

describe('Gallery', () => {
  it('shows every component of the three folders under its level’s heading', () => {
    render(<Gallery />);

    expect(found.length).toBeGreaterThan(0);
    for (const { level, name } of found) {
      const heading = screen.getByRole('heading', { name: HEADINGS[level] });
      const section = heading.parentElement!;
      expect(within(section).getByRole('heading', { name })).toBeDefined();
    }
  });

  it('shows the values, Mantine’s button and field, and says where a level has none', () => {
    render(<Gallery />);

    expect(screen.getByRole('heading', { name: 'Values' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDefined();
    expect(
      within(screen.getByRole('heading', { name: 'Molecules' }).parentElement!).getByText(
        'Nothing yet.',
      ),
    ).toBeDefined();
  });

  it('is light whatever the device asks', () => {
    render(<Gallery />);

    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  });
});

describe('the entry', () => {
  it('mounts the gallery on #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');

    await waitFor(() =>
      expect(document.querySelector('#root')?.textContent).toContain('Design system'),
    );
  });
});
