import { Badge } from '@mantine/core';

/** A record's state as a chip: green when active, grey when not. It takes its word as a prop. */
export function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge variant="light" color={active ? 'green' : 'gray'} data-active={active}>
      {label}
    </Badge>
  );
}
