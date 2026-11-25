import { FileButton, Group, Image, Stack, Text } from '@mantine/core';
import { ActionButton } from '../components/atoms/ActionButton';
import { FormMessage } from '../components/molecules/FormMessage';
import { TYPE, WEIGHTS } from '../design-system/tokens';

/** A field for one picture of the company: its label, an optional hint, the picture as it stands or its words for none, a button to choose another and, with a picture, one to remove it, then the message of the last try; each word comes from the screen, so the field serves any picture, and what is chosen or removed is told to the screen, which saves it. */
export function PictureField({
  label,
  hint,
  picture,
  none,
  choose,
  remove,
  message,
  onChoose,
  onRemove,
}: {
  label: string;
  hint?: string;
  picture?: string;
  none: string;
  choose: string;
  remove: string;
  message?: { kind: 'saved' | 'error'; text: string };
  onChoose: (file: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <Stack gap={6}>
      <Text size="sm" fw={WEIGHTS.label}>
        {label}
      </Text>
      {hint && <Text {...TYPE.caption}>{hint}</Text>}
      <Group>
        {picture ? (
          <Image src={picture} alt="" h={48} w={48} fit="contain" />
        ) : (
          <Text {...TYPE.caption}>{none}</Text>
        )}
        <FileButton accept="image/*" onChange={onChoose}>
          {(props) => (
            <ActionButton meaning="other" onClick={props.onClick}>
              {choose}
            </ActionButton>
          )}
        </FileButton>
        {picture && (
          <ActionButton meaning="quiet" onClick={onRemove}>
            {remove}
          </ActionButton>
        )}
      </Group>
      {message && <FormMessage kind={message.kind}>{message.text}</FormMessage>}
    </Stack>
  );
}
