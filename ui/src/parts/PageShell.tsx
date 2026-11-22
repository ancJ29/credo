import { Group, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { BackLink } from '../components/atoms/BackLink';
import { StatusBadge, type Status } from '../components/atoms/StatusBadge';
import { PageHeader } from '../components/organisms/PageHeader';
import { TYPE } from '../design-system/tokens';
import { Loaded } from '../frame/Loaded';

/**
 * The shell of a list page: the heading, an optional action row beside it, and the body inside the
 * `Loaded` wrapper. A client's own list page takes this rather than writing the shell again. `status`
 * is the data's load state; `recordStatus` is the status of the record the page shows, a chip beside
 * the title, and `back` the way back, a link above it.
 */
export function PageShell({
  title,
  actions,
  status,
  onRetry,
  back,
  recordStatus,
  children,
}: {
  title: string;
  actions?: ReactNode;
  status: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
  back?: { href: string; children: string };
  recordStatus?: Status;
  children: ReactNode;
}) {
  return (
    <Stack gap="lg">
      {back && <BackLink {...back} />}
      {recordStatus ? (
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Title {...TYPE.pageTitle}>{title}</Title>
            <StatusBadge status={recordStatus} />
          </Group>
          {actions}
        </Group>
      ) : (
        <PageHeader title={title} actions={actions} />
      )}
      <Loaded status={status} onRetry={onRetry}>
        {children}
      </Loaded>
    </Stack>
  );
}
