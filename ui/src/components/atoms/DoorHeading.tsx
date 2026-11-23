import { Text, Title } from '@mantine/core';
import { TOKENS, TYPE, WEIGHTS } from '../../design-system/tokens';

/** A door's title as the second heading, in the third's size, bold and centred, and a small dimmed subtitle beneath only when given. */
export function DoorHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Title order={2} size="h3" fw={WEIGHTS.title} ta="center">
        {title}
      </Title>
      {subtitle !== undefined && (
        <Text {...TYPE.caption} ta="center" mb={TOKENS.doorSubtitleGap}>
          {subtitle}
        </Text>
      )}
    </>
  );
}
