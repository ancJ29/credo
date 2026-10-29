import { emailSchema, type EmployeeDoc } from '@credo/shared';
import { Alert, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PageProps, refusal } from './page';
import { QrCode } from './QrCode';

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/** An email: a second name to sign in with, the root's alone to give or take back. No mail is ever
 * sent to it, so it is not checked beyond its shape. */
export function EmailPanel({
  page,
  id,
  version,
  email,
  onChanged,
  onConflict,
}: {
  page: PageProps;
  id: string;
  version: string;
  /** The email the person has now, or none. */
  email: string | null;
  onChanged: (doc: EmployeeDoc) => void;
  onConflict: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'failed' | null>(null);
  const [said, setSaid] = useState<'set' | 'removed' | null>(null);

  async function change(next: string | null) {
    setProblem(null);
    setSaid(null);
    try {
      const result = await page.api.setEmail(id, { version, email: next });
      if (result.kind === 'set') {
        setTyped('');
        setSaid(next === null ? 'removed' : 'set');
        onChanged(result.doc);
      } else if (result.kind === 'conflict') onConflict();
      else setProblem('taken');
    } catch (error) {
      refusal(error, page);
      setProblem('failed');
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!emailSchema.safeParse(typed).success) return setProblem('invalid');
    void change(typed);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={3}>{t('person.emailTitle')}</Title>
        <Text c="dimmed">{t('person.emailText')}</Text>
        <Text>{email ?? t('person.emailNone')}</Text>
        {said !== null && (
          <Alert color="green" role="alert">
            {said === 'set' ? t('person.emailChanged', { email }) : t('person.emailRemoved')}
          </Alert>
        )}
        {problem !== null && (
          <Alert color="red" role="alert">
            {t(
              problem === 'invalid'
                ? 'person.emailInvalid'
                : problem === 'taken'
                  ? 'person.emailTaken'
                  : 'person.emailFailed',
            )}
          </Alert>
        )}
        <form onSubmit={submit}>
          <Stack gap="sm" align="flex-start">
            <TextInput
              label={t('person.emailNew')}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={typed}
              onChange={(event) => setTyped(event.currentTarget.value)}
            />
            <Group>
              <Button type="submit" variant="default">
                {t('person.emailSet')}
              </Button>
              {email !== null && (
                <Button variant="default" onClick={() => void change(null)}>
                  {t('person.emailRemove')}
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

/** A QR code for one sign-in on a phone, within 15 minutes: the root's alone to show, and a new
 * code cancels the last. The code and its link are held in this state alone. */
export function QrPanel({ page, id }: { page: PageProps; id: string }) {
  const { t } = useTranslation();
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function show() {
    setFailed(false);
    try {
      const issued = await page.api.issueQr(id);
      setLink(new URL(issued.link, window.location.origin).href);
    } catch (error) {
      refusal(error, page);
      setFailed(true);
    }
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm" align="flex-start">
        <Title order={3}>{t('person.qrTitle')}</Title>
        <Text c="dimmed">{t('person.qrText')}</Text>
        {failed && (
          <Alert color="red" role="alert">
            {t('person.qrFailed')}
          </Alert>
        )}
        {link !== null && (
          <Stack gap="xs" w="100%">
            <QrCode value={link} label={t('person.qrImage')} />
            <TextInput label={t('person.qrLink')} value={link} readOnly styles={READ_ONLY} />
            <Text c="dimmed" size="sm">
              {t('person.qrOnce')}
            </Text>
          </Stack>
        )}
        <Button variant="default" onClick={() => void show()}>
          {link === null ? t('person.qrShow') : t('person.qrNew')}
        </Button>
      </Stack>
    </Paper>
  );
}
