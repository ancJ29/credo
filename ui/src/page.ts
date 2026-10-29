import type { UserView } from '@credo/shared';
import { type DependencyList, useEffect, useState } from 'react';
import { type Api, ApiError } from './api';

/** What every page of the staff area is given. */
export type PageProps = {
  api: Api;
  user: UserView;
  onSignedOut: () => void;
  /** A 403 means what the person may do changed: the app reads who they are again. */
  onForbidden: () => void;
};

/** What a refusal needs of its page: a 401 signs out, and a 403, where the page has one to answer,
 * reads who the person is again. */
export type Refusal = Pick<PageProps, 'onSignedOut'> & Partial<Pick<PageProps, 'onForbidden'>>;

/** A refusal is the app's to answer, whatever the page was doing: a 401 signs the person out, and a
 * 403 reads `me` again, since what they may do has changed. The redraw replaces this page if it is
 * no longer theirs; if it still is, the page shows its failure and offers another try. */
export function refusal(error: unknown, { onSignedOut, onForbidden }: Refusal) {
  if (error instanceof ApiError && error.status === 401) onSignedOut();
  if (error instanceof ApiError && error.status === 403) onForbidden?.();
}

/** A page's data as one state, read again when `deps` change or `reload` is called. */
export function useLoad<T>(
  load: () => Promise<T>,
  page: Refusal,
  deps: DependencyList,
): { status: 'loading' | 'failed' | 'ready'; data: T | null; reload: () => void } {
  const [state, setState] = useState<{ status: 'loading' | 'failed' | 'ready'; data: T | null }>({
    status: 'loading',
    data: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void load()
      .then(
        (data) => ({ status: 'ready' as const, data }),
        (error: unknown) => {
          refusal(error, page);
          return { status: 'failed' as const, data: null };
        },
      )
      .then((next) => {
        // A read that ends after its page left, or after a newer read began, is not drawn.
        if (live) setState(next);
      });
    return () => {
      live = false;
    };
    // `load` and `page` are new each render; the caller names what a new read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return {
    status: state.status,
    data: state.data,
    reload: () => {
      setState({ status: 'loading', data: null });
      setAttempt((n) => n + 1);
    },
  };
}
