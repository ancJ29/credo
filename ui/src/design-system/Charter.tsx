import { Stack, Text, Title } from '@mantine/core';
import { GUIDELINE, type Followed, type HeldBy } from './guideline';
import { TYPE } from './tokens';

/** What holds a rule, in words: its check's file, or review. */
export const heldWords = (heldBy: HeldBy) =>
  heldBy === 'review' ? 'Held by review.' : `Held by ${heldBy.check}.`;

/** Whether the app follows a rule, in words: yes, or the open item that moves the screens that do not. */
export const followedWords = (followed: Followed) =>
  followed === 'yes' ? 'The app follows it.' : `Not yet: open item ${followed.item} moves it.`;

/** The charter drawn as a plate: the guideline's words as `guideline.ts` holds them, the goal first. */
export function Charter() {
  const { goal, credo, readers, lookHere, rules } = GUIDELINE.charter;
  return (
    <Stack gap="lg" w={560} maw="100%">
      <Stack gap={4}>
        <Title order={3} {...TYPE.sectionLabel}>
          The goal
        </Title>
        <Text>{goal}</Text>
      </Stack>
      <Stack gap={4}>
        <Title order={3} {...TYPE.sectionLabel}>
          What credo is
        </Title>
        <Text>{credo}</Text>
      </Stack>
      <Stack gap={4}>
        <Title order={3} {...TYPE.sectionLabel}>
          Who reads it
        </Title>
        {readers.map(({ reader, does }) => (
          <Text key={reader}>
            <Text component="span" {...TYPE.bodyStrong}>
              {reader}.
            </Text>{' '}
            {does}
          </Text>
        ))}
      </Stack>
      <Stack gap={4}>
        <Title order={3} {...TYPE.sectionLabel}>
          Where to look
        </Title>
        {lookHere.map(({ need, where }) => (
          <Text key={need}>
            <Text component="span" {...TYPE.bodyStrong}>
              {need}.
            </Text>{' '}
            {where}
          </Text>
        ))}
      </Stack>
      <Stack gap="sm">
        <Title order={3} {...TYPE.sectionLabel}>
          The rules for every screen
        </Title>
        {rules.map((rule) => (
          <Stack key={rule.says} gap={2}>
            <Text {...TYPE.bodyStrong}>{rule.says}</Text>
            <Text>{rule.why}</Text>
            <Text {...TYPE.caption}>
              {heldWords(rule.heldBy)} {followedWords(rule.followed)}
            </Text>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
