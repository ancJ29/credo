import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionTitle } from './SectionTitle';

describe('SectionTitle', () => {
  it('draws its icon in a grey tile beside its label', () => {
    render(
      <MantineProvider env="test">
        <SectionTitle icon={<svg data-testid="glyph" />} label="Basics" />
      </MantineProvider>,
    );

    const tile = screen.getByTestId('section-icon');
    expect(tile.getAttribute('style')).toContain('var(--mantine-color-gray-');
    expect(tile.contains(screen.getByTestId('glyph'))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Basics', level: 3 })).toBeDefined();
  });
});
