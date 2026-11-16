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

  it('8: draws a part’s legacy picture beside it under “Legacy”, and none beside a part without one', () => {
    render(<Gallery />);

    const tile = screen.getByRole('heading', { name: 'LogoTile' }).parentElement!;
    expect(within(tile).getByText('Legacy')).toBeDefined();
    expect(within(tile).getByRole('img', { name: 'The legacy’s LogoTile' })).toBeDefined();
    const badge = screen.getByRole('heading', { name: 'StatusBadge' }).parentElement!;
    expect(within(badge).queryByText('Legacy')).toBeNull();
    expect(within(badge).queryByRole('img')).toBeNull();
  });

  it('shows the gradient and default buttons and the divider each beside its legacy picture', () => {
    render(<Gallery />);

    for (const name of ['Gradient button', 'Default button', 'Labelled divider']) {
      const section = screen.getByRole('heading', { name }).parentElement!;
      expect(within(section).getByRole('img', { name: `The legacy’s ${name}` })).toBeDefined();
    }
    expect(screen.getByText('hoặc')).toBeDefined();
  });

  it('shows the values, and Mantine’s button and field', () => {
    render(<Gallery />);

    expect(screen.getByRole('heading', { name: 'Values' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDefined();
  });

  it('is light whatever the device asks', () => {
    window.localStorage.setItem('mantine-color-scheme-value', 'dark');
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
