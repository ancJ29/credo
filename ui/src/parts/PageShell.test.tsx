import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { draw } from '../../tests/render';
import { PageShell } from './PageShell';

const NO_RETRY = () => undefined;

describe('PageShell', () => {
  it('222 case 12: a back link sits above the title and a record’s status beside it', () => {
    draw(
      <PageShell
        title="Staff member"
        status="ready"
        onRetry={NO_RETRY}
        back={{ href: '/staff', children: 'Back to staff' }}
        recordStatus="inactive"
      >
        <p>Body</p>
      </PageShell>,
    );
    const link = screen.getByRole('link', { name: 'Back to staff' });
    expect(link.getAttribute('href')).toBe('/staff');
    const title = screen.getByRole('heading', { name: 'Staff member' });
    expect(link.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const chip = document.querySelector('[data-status="inactive"]')!;
    expect(chip).not.toBeNull();
    expect(chip.parentElement).toBe(title.parentElement);
    expect(screen.getByText('Body')).toBeDefined();
  });

  it('222 case 12: a subtitle sits tight under the title, not a gap below it', () => {
    draw(
      <PageShell title="Staff member" subtitle="NV-001" status="ready" onRetry={NO_RETRY}>
        <p>Body</p>
      </PageShell>,
    );
    const title = screen.getByRole('heading', { name: 'Staff member' });
    expect(screen.getByText('NV-001').parentElement).toBe(title.closest('div')!.parentElement);
  });

  it('222 case 12: given neither, it draws neither', () => {
    draw(
      <PageShell title="Staff" status="ready" onRetry={NO_RETRY}>
        <p>Body</p>
      </PageShell>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('[data-status]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeDefined();
  });

  it('222 case 12: given no retry, a failed page still draws its retry and a press does nothing', async () => {
    draw(
      <PageShell title="Staff" status="failed">
        <p>Body</p>
      </PageShell>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('heading', { name: 'Staff' })).toBeDefined();
    expect(screen.queryByText('Body')).toBeNull();
  });
});
