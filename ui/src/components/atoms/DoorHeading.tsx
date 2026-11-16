import { Text, Title } from '@mantine/core';
import { TOKENS } from '../../design-system/tokens';

/** A door's title as a heading, bold and centred, and a small dimmed subtitle beneath only when given. */
export function DoorHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Title order={3} fw={700} ta="center">
        {title}
      </Title>
      {subtitle !== undefined && (
        <Text size="sm" c="dimmed" ta="center" mb={TOKENS.doorSubtitleGap}>
          {subtitle}
        </Text>
      )}
    </>
  );
}
