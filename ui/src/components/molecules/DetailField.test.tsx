import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailField } from './DetailField';

const draw = (value?: string) =>
  render(
    <MantineProvider env="test">
      <DetailField label="Phone" value={value} />
    </MantineProvider>,
  );

describe('DetailField', () => {
  it('shows its label over its value', () => {
    draw('0901 234 567');

    expect(screen.getByText('Phone')).toBeDefined();
    expect(screen.getByText('0901 234 567')).toBeDefined();
  });

  it('shows a dash when it has no value', () => {
    draw(undefined);

    expect(screen.getByText('–')).toBeDefined();
  });

  it('shows a dash for an empty value', () => {
    draw('');

    expect(screen.getByText('–')).toBeDefined();
  });
});
