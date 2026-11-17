import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { themeOf } from '../../design-system/appTheme';
import { StatusBadge } from './StatusBadge';

const draw = (active: boolean) =>
  render(
    <MantineProvider theme={themeOf('#2f7d6d')} env="test">
      <StatusBadge active={active} label={active ? 'Active' : 'Inactive'} />
    </MantineProvider>,
  );

describe('StatusBadge', () => {
  it('is green when active', () => {
    draw(true);

    expect(screen.getByText('Active').closest('[data-active]')?.getAttribute('style')).toContain(
      'var(--mantine-color-green-',
    );
  });

  it('is grey when not', () => {
    draw(false);

    expect(screen.getByText('Inactive').closest('[data-active]')?.getAttribute('style')).toContain(
      'var(--mantine-color-gray-',
    );
  });
});
