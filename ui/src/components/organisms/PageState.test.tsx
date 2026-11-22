import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { DICTIONARIES } from '../../i18n';
import { PageState } from './PageState';

describe('PageState', () => {
  it('222 case 8: each state draws its title and words, at its role', () => {
    for (const state of ['forbidden', 'nothing', 'empty', 'notFound'] as const) {
      const { unmount } = draw(
        <PageState state={state} title={`Title of ${state}`}>
          {`Words of ${state}`}
        </PageState>,
      );
      const spoken = screen.getByRole('status');
      expect(screen.getByRole('heading', { name: `Title of ${state}` }), state).toBeTruthy();
      expect(spoken.textContent, state).toContain(`Words of ${state}`);
      expect(screen.queryByRole('alert'), state).toBeNull();
      unmount();
    }
  });

  it('222 case 8: a title sits above its words', () => {
    draw(
      <PageState state="forbidden" title="Denied">
        Ask the owner.
      </PageState>,
    );
    const title = screen.getByRole('heading', { name: 'Denied' });
    const words = screen.getByText('Ask the owner.');
    expect(title.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('222 case 8: loading draws the loader by its spoken name and no message', () => {
    draw(<PageState state="loading" />);
    expect(screen.getByLabelText(DICTIONARIES.en.common.loading)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('222 case 8: failed speaks an alert with its own words and a retry that acts', async () => {
    const onRetry = vi.fn();
    draw(<PageState state="failed" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toBe(DICTIONARIES.en.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: DICTIONARIES.en.common.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('222 case 8: failed says the words it is given instead', () => {
    draw(
      <PageState state="failed" onRetry={vi.fn()}>
        The service is down.
      </PageState>,
    );
    expect(screen.getByRole('alert').textContent).toBe('The service is down.');
  });

  it('222 case 8: failed with no act offers no retry', () => {
    draw(<PageState state="failed" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('222 case 8: an empty list offers an add only where it is given', () => {
    const { unmount } = draw(
      <PageState state="empty" title="No staff" add={<button type="button">Add staff</button>}>
        None yet.
      </PageState>,
    );
    expect(screen.getByRole('button', { name: 'Add staff' })).toBeTruthy();
    unmount();
    draw(
      <PageState state="empty" title="No staff">
        None yet.
      </PageState>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('222 case 8: the retry is the default look, not the filled one', () => {
    render(
      <MantineProvider env="test">
        <PageState state="failed" onRetry={vi.fn()} />
      </MantineProvider>,
    );
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe('default');
  });
});
