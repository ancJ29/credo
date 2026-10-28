import { Alert, Button, Paper, Stack, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

type Props = {
  /** The client's sign-in address, `…/login?client-code=<code>`. */
  link: string;
  rootName: string;
  /** The root's first password, shown on this screen and nowhere after it. */
  password: string;
  onAnother: () => void;
};

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/** What the operator sends the client, once: the link, the root's name and its first password. */
export function ClientMade({ link, rootName, password, onAnother }: Props) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg">
      <Title order={2}>{t('operator.madeTitle')}</Title>
      <Alert color="green" role="alert">
        {t('operator.madeIntro')}
      </Alert>
      <Paper withBorder p="md">
        <Stack gap="lg">
          <TextInput label={t('operator.link')} value={link} readOnly styles={READ_ONLY} />
          <TextInput label={t('operator.rootName')} value={rootName} readOnly styles={READ_ONLY} />
          <TextInput
            label={t('operator.firstPassword')}
            value={password}
            readOnly
            styles={READ_ONLY}
          />
        </Stack>
      </Paper>
      <Button variant="default" onClick={onAnother} style={{ alignSelf: 'flex-start' }}>
        {t('operator.another')}
      </Button>
    </Stack>
  );
}
