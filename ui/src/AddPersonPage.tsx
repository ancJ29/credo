import { type EmployeeDoc, employeeCodeIsValid } from '@credo/shared';
import {
  Alert,
  Button,
  NativeSelect,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Loaded } from './Loaded';
import { type PageProps, refusal, useLoad } from './page';

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };

/** Adding a person. Whoever may add gives a name, a code, a phone and a note; only the root also
 * gives a department and a position, and is then shown the sign-in name and first password once. */
export function AddPersonPage(page: PageProps) {
  const { api, user } = page;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loaded = useLoad(async () => (user.root ? (await api.getStaffSetup()).setup : null), page, [
    api,
    user.root,
  ]);
  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    note: '',
    department: '',
    position: '',
  });
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed' | 'taken'>('idle');
  const [codeShown, setCodeShown] = useState(false);
  /** Held in this state alone: the password is shown once and kept nowhere else. */
  const [made, setMade] = useState<{ employee: EmployeeDoc; password: string } | null>(null);
  const change = (next: Partial<typeof form>) => setForm((was) => ({ ...was, ...next }));
  const setup = loaded.data;
  const codeOk = employeeCodeIsValid(form.code);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setCodeShown(true);
    if (!codeOk) return;
    setStatus('busy');
    try {
      const extra = {
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      const result = await api.addEmployee({
        name: form.name,
        code: form.code,
        extra,
        ...(user.root
          ? { departmentId: form.department || null, positionId: form.position || null }
          : {}),
      });
      if (result.kind === 'taken') return setStatus('taken');
      setStatus('idle');
      const { employee, password } = result.reply;
      if (password === null) void navigate(`/staff/${employee.employee.id}`);
      else setMade({ employee, password });
    } catch (error) {
      refusal(error, page);
      setStatus('failed');
    }
  }

  if (made) {
    return (
      <Stack gap="lg">
        <Title order={2}>{t('addPerson.madeTitle')}</Title>
        <Alert color="green" role="alert">
          {t('addPerson.madeIntro')}
        </Alert>
        <Paper withBorder p="md">
          <Stack gap="lg">
            <TextInput
              label={t('addPerson.signInName')}
              value={made.employee.signIn.name}
              readOnly
              styles={READ_ONLY}
            />
            <TextInput
              label={t('addPerson.firstPassword')}
              value={made.password}
              readOnly
              styles={READ_ONLY}
            />
          </Stack>
        </Paper>
        <Stack gap="xs" align="flex-start">
          <Button component={Link} to={`/staff/${made.employee.employee.id}`}>
            {t('addPerson.open')}
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setMade(null);
              setForm({ name: '', code: '', phone: '', note: '', department: '', position: '' });
              setCodeShown(false);
            }}
          >
            {t('addPerson.another')}
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t('addPerson.title')}</Title>
        <Text c="dimmed">{t('addPerson.intro')}</Text>
      </div>
      {status === 'failed' && (
        <Alert color="red" role="alert">
          {t('addPerson.failed')}
        </Alert>
      )}
      {status === 'taken' && (
        <Alert color="orange" role="alert">
          {t('addPerson.taken')}
        </Alert>
      )}
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        <form onSubmit={(event) => void submit(event)}>
          <Paper withBorder p="md">
            <Stack gap="lg">
              <TextInput
                label={t('addPerson.name')}
                required
                value={form.name}
                onChange={(event) => change({ name: event.currentTarget.value })}
              />
              <TextInput
                label={t('addPerson.code')}
                description={t('addPerson.codeHint')}
                required
                autoCapitalize="characters"
                autoComplete="off"
                error={(codeShown && !codeOk && t('addPerson.codeInvalid')) || status === 'taken'}
                value={form.code}
                onChange={(event) => change({ code: event.currentTarget.value })}
              />
              <TextInput
                label={t('addPerson.phone')}
                type="tel"
                value={form.phone}
                onChange={(event) => change({ phone: event.currentTarget.value })}
              />
              {setup && (
                <>
                  <NativeSelect
                    label={t('addPerson.department')}
                    value={form.department}
                    onChange={(event) => change({ department: event.currentTarget.value })}
                    data={[
                      { value: '', label: t('addPerson.noneChosen') },
                      ...setup.departments.map((unit) => ({ value: unit.id, label: unit.name })),
                    ]}
                  />
                  <NativeSelect
                    label={t('addPerson.position')}
                    value={form.position}
                    onChange={(event) => change({ position: event.currentTarget.value })}
                    data={[
                      { value: '', label: t('addPerson.noneChosen') },
                      ...setup.positions.map((unit) => ({ value: unit.id, label: unit.name })),
                    ]}
                  />
                </>
              )}
              <Textarea
                label={t('addPerson.note')}
                value={form.note}
                onChange={(event) => change({ note: event.currentTarget.value })}
              />
              <Button type="submit" loading={status === 'busy'}>
                {t('addPerson.submit')}
              </Button>
            </Stack>
          </Paper>
        </form>
      </Loaded>
    </Stack>
  );
}
