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

  it('draws the gradient button, the default button and the divider worded “hoặc”', () => {
    render(<Gallery />);

    for (const name of ['Gradient button', 'Default button', 'Labelled divider']) {
      expect(screen.getByRole('heading', { name })).toBeDefined();
    }
    expect(screen.getAllByRole('button', { name: 'Quét mã QR' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Nhập mã thủ công' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('hoặc').length).toBeGreaterThan(0);
  });

  it('draws the door card in two states, the sign-in and the link page, in sentence case', () => {
    render(<Gallery />);

    const card = screen.getByRole('heading', { name: 'DoorCard' }).parentElement!;
    expect(
      within(card).getByRole('heading', { name: 'Đăng nhập vào tài khoản của bạn' }),
    ).toBeDefined();
    expect(within(card).getByRole('heading', { name: 'Đăng nhập bằng liên kết' })).toBeDefined();
    expect(within(card).getAllByText('hoặc')).toHaveLength(2);
    expect(within(card).getByRole('link', { name: 'Quay lại đăng nhập' })).toBeDefined();
  });

  it('draws no picture of the old app beside any part', () => {
    render(<Gallery />);

    expect(screen.queryByText('Legacy')).toBeNull();
    expect(screen.queryAllByRole('img', { name: /^The legacy/ })).toHaveLength(0);
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
