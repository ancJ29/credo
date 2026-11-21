import { MantineProvider, rem } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { FieldLabel } from './FieldLabel';

describe('FieldLabel', () => {
  it('draws its words in capitals, at the legacy’s weight and spacing', () => {
    render(
      <MantineProvider theme={themeOf('#2f7d6d')} env="test">
        <FieldLabel>Name</FieldLabel>
      </MantineProvider>,
    );

    const style = screen.getByText('Name').getAttribute('style') ?? '';
    expect(style).toContain('uppercase');
    expect(style).toContain('font-weight: 600');
    // The spacing is held too (item 513): put the style's 0.3 back at 0.5 and this reddens.
    expect(style).toContain(`letter-spacing: ${rem(0.3)}`);
  });
});
