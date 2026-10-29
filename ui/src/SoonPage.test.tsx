import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../tests/render';
import { SoonPage } from './SoonPage';

describe('SoonPage', () => {
  it('shows the section’s name as its title and says it is coming soon, in each language, and nothing else', () => {
    const english = draw(<SoonPage label="nav.usage" />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Usage and costs');
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(english.container.querySelectorAll('button, a, input')).toHaveLength(0);
    english.unmount();

    draw(<SoonPage label="nav.activity" />, 'vi');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Hoạt động');
    expect(screen.getByText('Sắp có')).toBeTruthy();
  });
});
