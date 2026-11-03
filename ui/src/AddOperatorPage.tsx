import { operatorNameSchema } from '@credo/shared';
import { Alert, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Api } from './api';
import { CopyText } from './CopyText';
import { refusal } from './page';
import { PasskeyNotGiven, type Passkeys } from './passkeys';
import { touch } from './touch';

type Props = { api: Api; passkeys: Passkeys; onSignedOut: () => void };

type Problem = 'invalid' | 'taken' | 'notGiven' | 'failed';

const PROBLEM = {
  invalid: 'team.nameInvalid',
  taken: 'team.taken',
  notGiven: 'passkey.notGiven',
  failed: 'team.failed',
} as const;

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/**
 * Adding an operator, at `/operator/operators/new`: a name, then a fresh touch of the operator's own
 * passkey, then the join link shown once to copy and send. The link is held in this page's state
 * alone, so a reload or a step away loses it. A name already there is refused and the name stays.
 */
export function AddOperatorPage({ api, passkeys, onSignedOut }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once the operator is added: the name as made and the link to send. */
  const [made, setMade] = useState<{ name: string; link: string } | null>(null);

  async function give(checked: string) {
    setBusy(true);
    try {
      const confirm = await touch(api, passkeys, 'add-operator');
      const result = await api.addOperator({ name: checked, confirm });
      if (result.kind === 'taken') setProblem('taken');
      else {
        setName('');
        setMade({ name: checked, link: `${window.location.origin}${result.link}` });
      }
    } catch (error) {
      refusal(error, { onSignedOut });
      setProblem(error instanceof PasskeyNotGiven ? 'notGiven' : 'failed');
    }
    setBusy(false);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    const checked = operatorNameSchema.safeParse(name);
    if (!checked.success) return setProblem('invalid');
    void give(checked.data);
  };

  const back = (
    <Button component={Link} to="/operator/operators" variant={made ? 'filled' : 'default'}>
      {t('team.back')}
    </Button>
  );

  return made ? (
    <Stack gap="lg">
      <Title order={2}>{t('team.addedTitle')}</Title>
      <Alert color="green" role="alert">
        {t('team.addedIntro', { name: made.name })}
      </Alert>
      <Paper withBorder p="md">
        <TextInput
          label={t('team.link')}
          value={made.link}
          readOnly
          styles={READ_ONLY}
          rightSectionWidth={96}
          rightSection={
            <CopyText value={made.link} label={t('operator.copy')} about={t('team.link')} />
          }
        />
      </Paper>
      <Group>
        {back}
        <Button variant="default" onClick={() => setMade(null)}>
          {t('team.another')}
        </Button>
      </Group>
    </Stack>
  ) : (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t('team.newTitle')}</Title>
        <Text c="dimmed">{t('team.newIntro')}</Text>
      </div>
      {problem !== null && (
        <Alert color={problem === 'taken' ? 'orange' : 'red'} role="alert">
          {t(PROBLEM[problem])}
        </Alert>
      )}
      <form onSubmit={submit}>
        <Paper withBorder p="md">
          <Stack gap="lg">
            <TextInput
              label={t('team.nameLabel')}
              description={t('team.nameHint')}
              autoComplete="off"
              required
              error={problem === 'invalid' || problem === 'taken'}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Text size="sm" c="dimmed">
              {t('team.touch')}
            </Text>
            <Group>
              <Button type="submit" loading={busy}>
                {t('team.make')}
              </Button>
              {back}
            </Group>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
