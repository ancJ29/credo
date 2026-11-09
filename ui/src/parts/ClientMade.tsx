import { Alert, Button, Group, Paper, Stack, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CopyText } from './CopyText';

type Props = {
  /** The client's sign-in address, `…/login?client-code=<code>`. */
  link: string;
  rootName: string;
  /** The root's first password, shown on this screen and nowhere after it. */
  password: string;
  onAnother: () => void;
};

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/** A read-only field with a button that copies it. */
function Field({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  return (
    <TextInput
      label={label}
      value={value}
      readOnly
      styles={READ_ONLY}
      rightSectionWidth={96}
      rightSection={<CopyText value={value} label={t('operator.copy')} about={label} />}
    />
  );
}

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
          <Field label={t('operator.link')} value={link} />
          <Field label={t('operator.rootName')} value={rootName} />
          <Field label={t('operator.firstPassword')} value={password} />
        </Stack>
      </Paper>
      <Group>
        <Button component={Link} to="/operator/clients">
          {t('operator.back')}
        </Button>
        <Button variant="default" onClick={onAnother}>
          {t('operator.another')}
        </Button>
      </Group>
    </Stack>
  );
}
