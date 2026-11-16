import { Text } from '@mantine/core';
import { TOKENS } from '../../design-system/tokens';

/** A label in small capitals, bold and spaced: the legacy's field and section label. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text component="span" size="xs" tt="uppercase" c="dimmed" {...TOKENS.fieldLabel}>
      {children}
    </Text>
  );
}
