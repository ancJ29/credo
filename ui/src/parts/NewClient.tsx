import {
  type BoxItem,
  createClientRequestSchema,
  HOME_BOX,
  normaliseClientCode,
} from '@credo/shared';
import { Paper, Stack, Text, TextInput } from '@mantine/core';
import { ActionButton } from '../components/atoms/ActionButton';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoxChoice } from './BoxChoice';
import { FormMessage } from '../components/molecules/FormMessage';
import { PageHeader } from '../components/organisms/PageHeader';

type Props = {
  /** Idle, waiting on the service, the last attempt failed, or the code was already taken. */
  status: 'idle' | 'busy' | 'failed' | 'taken';
  /** Every box a company may be put on; one or none means no choice and no list. */
  boxes?: BoxItem[];
  /** The box is given only when it is not the home box, so a form with no choice sends none. */
  onSubmit: (code: string, name: string, box?: string) => void;
};

/** The operator's form: a code and the company's name, and nothing else a client needs to start. */
export function NewClient({ status, boxes = [], onSubmit }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [box, setBox] = useState(HOME_BOX);

  /** Which fields the last submit found wrong, by the same schema the BFF parses with. */
  const [wrong, setWrong] = useState<{ code: boolean; name: boolean }>({
    code: false,
    name: false,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const checked = createClientRequestSchema.safeParse({
      code: normaliseClientCode(code),
      name,
      ...(box === HOME_BOX ? {} : { box }),
    });
    const fields = new Set(checked.error?.issues.map((issue) => issue.path[0]));
    setWrong({ code: fields.has('code'), name: fields.has('name') });
    if (!checked.success) return;
    if (checked.data.box === undefined) onSubmit(checked.data.code, checked.data.name);
    else onSubmit(checked.data.code, checked.data.name, checked.data.box);
  };

  return (
    <Stack gap="lg">
      <div>
        <PageHeader title={t('operator.newTitle')} />
        <Text c="dimmed">{t('operator.newIntro')}</Text>
      </div>
      {status === 'failed' && <FormMessage kind="error">{t('operator.failed')}</FormMessage>}
      {status === 'taken' && <FormMessage kind="warning">{t('operator.taken')}</FormMessage>}
      <form onSubmit={submit}>
        <Paper withBorder p="md">
          <Stack gap="lg">
            <TextInput
              label={t('operator.code')}
              description={t('operator.codeHint')}
              placeholder={t('operator.codePlaceholder')}
              autoCapitalize="none"
              autoComplete="off"
              required
              error={(wrong.code && t('operator.codeInvalid')) || status === 'taken'}
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <TextInput
              label={t('operator.companyName')}
              required
              error={wrong.name && t('operator.nameInvalid')}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            {boxes.length > 1 && (
              <BoxChoice
                label={t('operator.box')}
                description={t('operator.boxHint')}
                boxes={boxes}
                value={box}
                onChange={setBox}
              />
            )}
            <ActionButton meaning="main" submit busy={status === 'busy'}>
              {t('operator.make')}
            </ActionButton>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
