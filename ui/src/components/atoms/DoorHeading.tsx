import { Text, Title } from '@mantine/core';
import { TOKENS, TYPE, WEIGHTS } from '../../design-system/tokens';

/** A door's title as a heading, bold and centred, and a small dimmed subtitle beneath only when given. */
export function DoorHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Title order={3} fw={WEIGHTS.title} ta="center">
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
