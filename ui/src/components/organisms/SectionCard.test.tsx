import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionCard } from './SectionCard';

describe('SectionCard', () => {
  it('draws its title and its content in a bordered section', () => {
    render(
      <MantineProvider env="test">
        <SectionCard icon={<svg />} title="Basics">
          <p>Inside</p>
        </SectionCard>
      </MantineProvider>,
    );

    const section = screen.getByRole('heading', { name: 'Basics' }).closest('section');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-with-border')).toBe('true');
    expect(section?.textContent).toContain('Inside');
  });
});
