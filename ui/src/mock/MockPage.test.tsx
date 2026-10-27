import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MockPage } from './MockPage';
import { SCREENS } from './screens';

const states = SCREENS.flatMap((screen) => screen.states).length;
const frames = () => screen.getAllByTitle(/ · /);

describe('MockPage', () => {
  it('draws every state of every screen in both themes, both widths and both languages', () => {
    render(<MockPage />);

    expect(frames()).toHaveLength(states * 8);
    expect(new Set(frames().map((frame) => frame.title)).size).toBe(states * 8);
  });

  it('narrows to one language, one theme or one width, and back to all', async () => {
    render(<MockPage />);

    await userEvent.click(screen.getByRole('radio', { name: 'vi' }));
    expect(frames()).toHaveLength(states * 4);
    expect(
      frames().every((frame) => frame.title.endsWith('vi') || / · vi · /.test(frame.title)),
    ).toBe(true);

    await userEvent.click(screen.getByRole('radio', { name: 'dark' }));
    expect(frames()).toHaveLength(states * 2);

    await userEvent.click(screen.getByRole('radio', { name: '390' }));
    expect(frames()).toHaveLength(states);

    await userEvent.click(screen.getAllByRole('radio', { name: 'all' })[0]);
    expect(frames()).toHaveLength(states * 2);
  });
});
