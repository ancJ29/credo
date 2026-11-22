import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { StatusBadge, type Status } from '../atoms/StatusBadge';
import { TYPE } from '../../design-system/tokens';

/** A page's heading, with what acts on the page beside it. A record's status is a chip beside the title, and a subtitle the line under it, dimmed and close to it. No phone variant. */
export function PageHeader({
  title,
  actions,
  status,
  subtitle,
}: {
  title: string;
  actions?: ReactNode;
  status?: Status;
  subtitle?: string;
}) {
  const heading = status ? (
    <Group gap="xs" align="center">
      <Title {...TYPE.pageTitle}>{title}</Title>
      <StatusBadge status={status} />
    </Group>
  ) : (
    <Title {...TYPE.pageTitle}>{title}</Title>
  );
  const row = (
    <Group justify="space-between" align="center">
      {heading}
      {actions}
    </Group>
  );
  if (!subtitle) return row;
  return (
    <Stack gap="xs">
      {row}
      <Text c="dimmed">{subtitle}</Text>
    </Stack>
  );
}
