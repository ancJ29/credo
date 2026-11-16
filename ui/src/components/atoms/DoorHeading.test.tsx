import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { designThemeOf } from '../../design-system/theme';
import { DoorHeading } from './DoorHeading';

const draw = (subtitle?: string) =>
  render(
    <MantineProvider theme={designThemeOf('#2f7d6d')} env="test">
      <DoorHeading title="Sign in" subtitle={subtitle} />
    </MantineProvider>,
  );

describe('DoorHeading', () => {
  it('3: draws its title as a heading, bold and centred', () => {
    draw();

    const title = screen.getByRole('heading', { name: 'Sign in' });
    expect(title.style.fontWeight).toBe('700');
    expect(title.style.textAlign).toBe('center');
  });

  it('3: draws a subtitle beneath, small and dimmed, only when given', () => {
    const { unmount } = draw('Use your code');

    const subtitle = screen.getByText('Use your code');
    expect(subtitle.style.textAlign).toBe('center');
    expect(subtitle.style.color).toBe('var(--mantine-color-dimmed)');
    expect(screen.getByRole('heading', { name: 'Sign in' }).nextElementSibling).toBe(subtitle);
    expect(subtitle.getAttribute('data-size')).toBe('sm');
    expect(subtitle.style.marginBottom).toContain('2rem');
    unmount();
    draw();

    expect(screen.queryByText('Use your code')).toBeNull();
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });
});
