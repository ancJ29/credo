import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { designThemeOf } from '../../design-system/theme';
import { FieldLabel } from './FieldLabel';

describe('FieldLabel', () => {
  it('draws its words in capitals, bold', () => {
    render(
      <MantineProvider theme={designThemeOf('#2f7d6d')} env="test">
        <FieldLabel>Name</FieldLabel>
      </MantineProvider>,
    );

    const style = screen.getByText('Name').getAttribute('style') ?? '';
    expect(style).toContain('uppercase');
    expect(style).toContain('700');
  });
});
