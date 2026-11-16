import { Stack, Text } from '@mantine/core';
import { FieldLabel } from '../atoms/FieldLabel';

/** A label over its value; with no value, a dash. It takes its words as props. */
export function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <Stack gap={2}>
      <FieldLabel>{label}</FieldLabel>
      <Text size="sm">{value === undefined || value === '' ? '—' : value}</Text>
    </Stack>
  );
}
