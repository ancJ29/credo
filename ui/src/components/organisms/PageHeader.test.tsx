import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('draws its title as the page’s heading', () => {
    render(
      <MantineProvider env="test">
        <PageHeader title="Staff" />
      </MantineProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Staff', level: 2 })).toBeDefined();
  });

  it('draws what acts on the page beside it', () => {
    render(
      <MantineProvider env="test">
        <PageHeader title="Staff" actions={<button>Add</button>} />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
  });
});
