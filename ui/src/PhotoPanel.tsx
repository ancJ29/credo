import type { PhotoReply } from '@credo/shared';
import {
  Alert,
  Avatar,
  Button,
  FileButton,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PageProps, refusal } from './page';
import { shrinkToPhoto } from './photo';

type Outcome = 'saved' | 'failed' | 'unusable' | 'conflict' | null;

type Props = {
  page: PageProps;
  id: string;
  name: string;
  /** The photo as it stands, with its version: the page's, since a save of the details redraws the
   * form and must not take the photo's version back to the one first read. */
  held: PhotoReply;
  /** The page takes the photo just saved, or the newer one a conflict carried. */
  onHeld: (photo: PhotoReply) => void;
  /** Whether this person may change photos. */
  editable: boolean;
};

/** A person's photo: shown, and for whoever may change a person, chosen from a file. The picture
 * is made small in the browser; a save sends the version it was read at. */
export function PhotoPanel({ page, id, name, held, onHeld, editable }: Props) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function choose(file: File | null) {
    if (!file) return;
    setOutcome(null);
    let photo: string;
    try {
      photo = await shrinkToPhoto(file);
    } catch {
      return setOutcome('unusable');
    }
    try {
      const result = await page.api.savePhoto(id, { photo, version: held.version });
      if (result.kind === 'conflict') {
        // The newer photo is shown and its version held, so the next try is over it.
        if (result.current) onHeld(result.current);
        return setOutcome('conflict');
      }
      onHeld(result.reply);
      setOutcome('saved');
    } catch (error) {
      refusal(error, page);
      setOutcome('failed');
    }
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={3}>{t('person.photo')}</Title>
        <Group>
          {held.photo ? (
            <Image src={held.photo} alt={name} h={96} w={96} fit="cover" radius="md" />
          ) : (
            <Avatar name={name} color="initials" size={96} radius="md" aria-hidden />
          )}
          {!held.photo && <Text c="dimmed">{t('person.photoNone')}</Text>}
        </Group>
        {outcome === 'saved' && (
          <Alert color="green" role="alert">
            {t('person.photoSaved')}
          </Alert>
        )}
        {outcome !== null && outcome !== 'saved' && (
          <Alert color="red" role="alert">
            {t(
              outcome === 'failed'
                ? 'person.photoFailed'
                : outcome === 'unusable'
                  ? 'person.photoUnusable'
                  : 'person.photoConflict',
            )}
          </Alert>
        )}
        {editable && (
          <Stack gap={4} align="flex-start">
            <FileButton accept="image/*" onChange={(file) => void choose(file)}>
              {(props) => (
                <Button variant="default" {...props}>
                  {t('person.photoChoose')}
                </Button>
              )}
            </FileButton>
            <Text size="xs" c="dimmed">
              {t('person.photoHint')}
            </Text>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
