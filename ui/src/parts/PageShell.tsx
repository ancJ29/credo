import { Group, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Loaded } from '../frame/Loaded';

/**
 * The shell of a list page: the heading, an optional action row beside it, and the body inside the
 * `Loaded` wrapper. A client's own list page takes this rather than writing the shell again.
 */
export function PageShell({
  title,
  actions,
  status,
  onRetry,
  children,
}: {
  title: string;
  actions?: ReactNode;
  status: 'loading' | 'failed' | 'ready';
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{title}</Title>
        {actions}
      </Group>
      <Loaded status={status} onRetry={onRetry}>
        {children}
      </Loaded>
    </Stack>
  );
}
