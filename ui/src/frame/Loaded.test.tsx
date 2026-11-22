import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../tests/render';
import { Loaded } from './Loaded';

const drawn = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('../components/organisms/PageState', () => ({
  PageState: (props: Record<string, unknown>) => {
    drawn.props.push(props);
    return <p>page state</p>;
  },
}));

describe('Loaded', () => {
  it('222 case 9: loading and failed draw through PageState, ready draws its children alone', () => {
    const onRetry = vi.fn();
    drawn.props.length = 0;
    const { rerender } = draw(
      <Loaded status="loading" onRetry={onRetry}>
        <p>the page</p>
      </Loaded>,
    );
    expect(drawn.props.at(-1)).toMatchObject({ state: 'loading' });
    rerender(
      <Loaded status="failed" onRetry={onRetry}>
        <p>the page</p>
      </Loaded>,
    );
    expect(drawn.props.at(-1)).toMatchObject({ state: 'failed', onRetry });
    expect(screen.queryByText('the page')).toBeNull();
    const before = drawn.props.length;
    rerender(
      <Loaded status="ready" onRetry={onRetry}>
        <p>the page</p>
      </Loaded>,
    );
    expect(screen.getByText('the page')).toBeTruthy();
    expect(drawn.props.length).toBe(before);
  });
});
