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

  it('222 case 12: a record’s status is a chip beside the title, in the one heading', () => {
    render(
      <MantineProvider env="test">
        <PageHeader title="Staff member" status="inactive" actions={<button>Edit</button>} />
      </MantineProvider>,
    );

    const title = screen.getByRole('heading', { name: 'Staff member', level: 2 });
    const chip = document.querySelector('[data-status="inactive"]')!;
    expect(chip).not.toBeNull();
    expect(chip.parentElement).toBe(title.parentElement);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('222 case 12: a subtitle is the line under the title, in the same block', () => {
    render(
      <MantineProvider env="test">
        <PageHeader title="Staff member" subtitle="NV-001" />
      </MantineProvider>,
    );

    const title = screen.getByRole('heading', { name: 'Staff member', level: 2 });
    const line = screen.getByText('NV-001');
    expect(title.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.parentElement).toBe(title.closest('div')!.parentElement);
  });
});
