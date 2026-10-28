import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockPage } from './MockPage';
import { SCREENS } from './screens';

const states = SCREENS.flatMap((screen) => screen.states).length;

describe('MockPage', () => {
  it('draws every state of every screen in both themes, both widths and both languages', () => {
    const { container } = render(<MockPage />);
    const titles = [...container.querySelectorAll('iframe')].map((frame) => frame.title);

    expect(titles).toHaveLength(states * 8);
    expect(new Set(titles).size).toBe(states * 8);
  });

  it('narrows to one language, one theme or one width, and back to all', () => {
    const { container } = render(<MockPage />);
    // One query of the iframes' own attribute, not Testing Library's title search over every node.
    const titles = () => [...container.querySelectorAll('iframe')].map((frame) => frame.title);

    fireEvent.click(screen.getByRole('radio', { name: 'vi' }));
    expect(titles()).toHaveLength(states * 4);
    expect(titles().every((title) => / · vi · /.test(title))).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'dark' }));
    expect(titles()).toHaveLength(states * 2);

    fireEvent.click(screen.getByRole('radio', { name: '390' }));
    expect(titles()).toHaveLength(states);

    fireEvent.click(screen.getAllByRole('radio', { name: 'all' })[0]);
    expect(titles()).toHaveLength(states * 2);
  });
});
