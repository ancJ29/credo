import { Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { BackLink } from '../components/atoms/BackLink';
import type { Status } from '../components/atoms/StatusBadge';
import { PageHeader } from '../components/organisms/PageHeader';
import { Loaded } from '../frame/Loaded';

// A page whose data is read elsewhere passes no retry: the failed state's button then does nothing.
const NO_RETRY = () => undefined;

/**
 * The shell of a list page: the heading, an optional action row beside it, and the body inside the
 * `Loaded` wrapper. A client's own list page takes this rather than writing the shell again. `status`
 * is the data's load state; `recordStatus` is the status of the record the page shows, a chip beside
 * the title, `subtitle` the line under it, and `back` the way back, a link above it. The heading is
 * `PageHeader`'s, the one way on every page.
 */
export function PageShell({
  title,
  actions,
  status,
  onRetry,
  back,
  recordStatus,
  subtitle,
  children,
}: {
  title: string;
  actions?: ReactNode;
  status: 'loading' | 'failed' | 'ready';
  onRetry?: () => void;
  back?: { href: string; children: string };
  recordStatus?: Status;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Stack gap="lg">
      {back && <BackLink {...back} />}
      <PageHeader title={title} actions={actions} status={recordStatus} subtitle={subtitle} />
      <Loaded status={status} onRetry={onRetry ?? NO_RETRY}>
        {children}
      </Loaded>
    </Stack>
  );
}
