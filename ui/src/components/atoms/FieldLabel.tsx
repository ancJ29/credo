import { Text } from '@mantine/core';

/** A label in small capitals, bold and spaced: the legacy's field and section label. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text component="span" size="xs" fw={700} tt="uppercase" lts={0.5} c="dimmed">
      {children}
    </Text>
  );
}
