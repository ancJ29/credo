import {
  type BoxItem,
  createClientRequestSchema,
  HOME_BOX,
  normaliseClientCode,
} from '@credo/shared';
import { Alert, Button, Paper, Radio, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  /** Idle, waiting on the service, the last attempt failed, or the code was already taken. */
  status: 'idle' | 'busy' | 'failed' | 'taken';
  /** Every box a company may be put on; one or none means no choice and no list. */
  boxes?: BoxItem[];
  /** The box is given only when it is not the home box, so a form with no choice sends none. */
  onSubmit: (code: string, name: string, box?: string) => void;
};

const GIB = 1024 ** 3;

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
        <Title order={2}>{t('operator.newTitle')}</Title>
        <Text c="dimmed">{t('operator.newIntro')}</Text>
      </div>
      {status === 'failed' && (
        <Alert color="red" role="alert">
          {t('operator.failed')}
        </Alert>
      )}
      {status === 'taken' && (
        <Alert color="orange" role="alert">
          {t('operator.taken')}
        </Alert>
      )}
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
              <Radio.Group
                label={t('operator.box')}
                description={t('operator.boxHint')}
                value={box}
                onChange={setBox}
              >
                <Stack gap="xs" mt="xs">
                  {boxes.map((item) => (
                    <Radio
                      key={item.name}
                      value={item.name}
                      disabled={item.freeBytes === null}
                      label={
                        item.freeBytes === null
                          ? t('operator.boxDown', { name: item.name })
                          : t('operator.boxLine', {
                              name: item.name,
                              free: Math.floor(item.freeBytes / GIB),
                              companies: item.companies,
                            })
                      }
                    />
                  ))}
                </Stack>
              </Radio.Group>
            )}
            <Button type="submit" loading={status === 'busy'}>
              {t('operator.make')}
            </Button>
          </Stack>
        </Paper>
      </form>
    </Stack>
  );
}
