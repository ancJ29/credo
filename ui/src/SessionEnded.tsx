import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Idle, waiting on the device, or why the last try did not sign in. */
  status: 'idle' | 'busy' | 'notGiven' | 'refused' | 'unavailable';
  onContinue: () => void;
  onSignOut: () => void;
};

const FAILED = {
  notGiven: 'passkey.notGiven',
  refused: 'passkey.refused',
  unavailable: 'common.unavailable',
} as const;

/** What the operator meets when the sign-in ends mid-task: the page stays beneath, with what was
 * typed, and one touch of the passkey goes on. It cannot be closed, since nothing beneath works
 * until the sign-in is back; signing out instead leaves for the door. */
export function SessionEnded({ status, onContinue, onSignOut }: Props) {
  const { t } = useTranslation();
  const failed = status === 'idle' || status === 'busy' ? null : FAILED[status];
  return (
    <Modal
      opened
      onClose={onSignOut}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withinPortal={false}
      centered
      title={t('passkey.endedTitle')}
    >
      <Stack>
        <Text>{t('passkey.endedText')}</Text>
        {failed && (
          <Alert color="red" role="alert">
            {t(failed)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onSignOut}>
            {t('user.signOut')}
          </Button>
          <Button loading={status === 'busy'} onClick={onContinue}>
            {t('passkey.endedButton')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
