import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TONES } from '../../design-system/tokens';
import { FormMessage } from './FormMessage';

const draw = (node: React.ReactNode) =>
  render(<MantineProvider env="test">{node}</MantineProvider>);

describe('FormMessage', () => {
  it('222 case 2: each kind draws its tone and speaks its role, a standing note as a note', () => {
    const kinds = [
      ['error', 'danger', 'alert'],
      ['warning', 'warning', 'alert'],
      ['success', 'success', 'status'],
      ['info', 'info', 'status'],
      ['saved', 'success', 'status'],
    ] as const;
    for (const [kind, tone, role] of kinds) {
      const { unmount } = draw(<FormMessage kind={kind}>{`Words of ${kind}`}</FormMessage>);
      const spoken = screen.getByRole(role);
      expect(spoken.textContent, kind).toBe(`Words of ${kind}`);
      expect(spoken.getAttribute('style'), kind).toContain(`--mantine-color-${TONES[tone]}-`);
      unmount();
    }
    draw(
      <FormMessage kind="warning" standing>
        Read at load
      </FormMessage>,
    );
    expect(screen.getByRole('note').textContent).toBe('Read at load');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('222 case 20: a message spans the whole column it sits in, even a left-aligned one', () => {
    draw(<FormMessage kind="error">Wide</FormMessage>);
    expect(screen.getByRole('alert').getAttribute('style')).toContain('width: 100%');
  });

  it('222 case 3: a title, where given, sits above the words', () => {
    draw(
      <FormMessage kind="error" title="ACME-01">
        Could not move.
      </FormMessage>,
    );
    const message = screen.getByRole('alert');
    const title = screen.getByText('ACME-01');
    const words = screen.getByText('Could not move.');
    expect(message.contains(title)).toBe(true);
    expect(title.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('222 case 3: with no title, none is drawn', () => {
    draw(<FormMessage kind="info">Plain.</FormMessage>);
    expect(screen.getByRole('status').querySelector('.mantine-Alert-title')).toBeNull();
  });
});
