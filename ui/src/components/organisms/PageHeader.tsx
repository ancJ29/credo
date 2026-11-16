import { Group, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/** A page's heading, with what acts on the page beside it. No phone variant. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Title order={2}>{title}</Title>
      {actions}
    </Group>
  );
}
