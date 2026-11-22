import { PageState } from '../components/organisms/PageState';
import type { ReactNode } from 'react';

type Props = {
  status: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
  children: ReactNode;
};

/** A page's data is one state: loading, failed with a way to retry, or ready. */
export function Loaded({ status, onRetry, children }: Props) {
  if (status === 'ready') return children;
  return <PageState state={status} onRetry={onRetry} />;
}
