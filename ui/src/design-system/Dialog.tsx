import { Modal, Stack, Text } from '@mantine/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { ActionRow } from '../components/molecules/ActionRow';

/** The dialog a press opens, in the ended session's words. */
export const DialogStates: { name: string; node: ReactNode }[] = [
  { name: 'The ended session', node: <EndedSession /> },
];

/** A button that opens the ended session's dialog: its title, its text and the two ways on, each of which closes it. */
function EndedSession() {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <>
      <ActionButton meaning="other" onClick={() => setOpened(true)}>
        {t('passkey.endedTitle')}
      </ActionButton>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        withinPortal={false}
        centered
        title={t('passkey.endedTitle')}
      >
        <Stack>
          <Text>{t('passkey.endedText')}</Text>
          <ActionRow>
            <ActionButton meaning="other" onClick={() => setOpened(false)}>
              {t('user.signOut')}
            </ActionButton>
            <ActionButton meaning="main" onClick={() => setOpened(false)}>
              {t('passkey.endedButton')}
            </ActionButton>
          </ActionRow>
        </Stack>
      </Modal>
    </>
  );
}
