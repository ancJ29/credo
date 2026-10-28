import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MockPage } from './MockPage';
import { SCREENS } from './screens';

// The page's rule is how many frames it draws and which: two screens of two states each hold it as
// well as all of them, at a fraction of the cost. Every real screen and state is held by
// screens.test.tsx. Drawing them all here timed out under load (act's run, 5.8 s of a 5 s limit).
vi.mock('./screens', async (importActual) => {
  const actual = await importActual<typeof import('./screens')>();
  return {
    ...actual,
    SCREENS: actual.SCREENS.slice(0, 2).map((screen) => ({
      ...screen,
      states: screen.states.slice(0, 2),
    })),
  };
});

const states = SCREENS.flatMap((screen) => screen.states).length;

describe('MockPage', () => {
  it('draws every state of every screen in both themes, all three widths and both languages', () => {
    const { container } = render(<MockPage />);
    const titles = [...container.querySelectorAll('iframe')].map((frame) => frame.title);

    expect(titles).toHaveLength(states * 12);
    expect(new Set(titles).size).toBe(states * 12);
  });

  it('narrows to one language, one theme or one width, and back to all', () => {
    const { container } = render(<MockPage />);
    // One query of the iframes' own attribute, not Testing Library's title search over every node.
    const titles = () => [...container.querySelectorAll('iframe')].map((frame) => frame.title);

    fireEvent.click(screen.getByRole('radio', { name: 'vi' }));
    expect(titles()).toHaveLength(states * 6);
    expect(titles().every((title) => / · vi · /.test(title))).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'dark' }));
    expect(titles()).toHaveLength(states * 3);

    fireEvent.click(screen.getByRole('radio', { name: '390' }));
    expect(titles()).toHaveLength(states);

    fireEvent.click(screen.getAllByRole('radio', { name: 'all' })[0]);
    expect(titles()).toHaveLength(states * 2);
  });
});
