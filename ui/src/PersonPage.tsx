import {
  can,
  differences,
  layersOf,
  type EmployeeDoc,
  type PermissionLayer,
  passwordIsValid,
  type SaveEmployeeRequest,
  type StaffSetup,
} from '@credo/shared';
import {
  Alert,
  Badge,
  Button,
  Group,
  NativeSelect,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Loaded } from './Loaded';
import { type PageProps, refusal, useLoad } from './page';
import { PermissionEditor } from './PermissionEditor';
import { noteOf, phoneOf, unitName } from './staffNames';

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };
type SaveOutcome = 'saved' | 'failed' | 'conflict' | null;

/** The password the root gives, typed twice or made by the app, and shown once. */
function PasswordPanel({
  page,
  id,
  onGiven,
}: {
  page: PageProps;
  id: string;
  onGiven: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState({ first: '', again: '' });
  const [problem, setProblem] = useState<'invalid' | 'mismatch' | 'failed' | null>(null);
  /** Held in this state alone: the password is shown once and kept nowhere else. */
  const [shown, setShown] = useState<string | null>(null);

  async function give(password: string | null) {
    setProblem(null);
    try {
      const reply = await page.api.setPassword(id, password);
      setTyped({ first: '', again: '' });
      setShown(reply.password);
      onGiven();
    } catch (error) {
      refusal(error, page);
      setProblem('failed');
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!passwordIsValid(typed.first)) return setProblem('invalid');
    if (typed.first !== typed.again) return setProblem('mismatch');
    void give(typed.first);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Title order={3}>{t('person.password')}</Title>
        {shown !== null && (
          <Alert color="green" role="alert">
            <Stack gap="xs">
              {t('person.passwordOnce')}
              <TextInput
                label={t('person.passwordShown')}
                value={shown}
                readOnly
                styles={READ_ONLY}
              />
            </Stack>
          </Alert>
        )}
        {problem !== null && (
          <Alert color="red" role="alert">
            {t(
              problem === 'invalid'
                ? 'person.passwordInvalid'
                : problem === 'mismatch'
                  ? 'person.passwordMismatch'
                  : 'person.passwordFailed',
            )}
          </Alert>
        )}
        <form onSubmit={submit}>
          <Stack gap="sm">
            <PasswordInput
              label={t('person.passwordNew')}
              description={t('person.passwordHint')}
              autoComplete="new-password"
              value={typed.first}
              onChange={(event) => setTyped({ ...typed, first: event.currentTarget.value })}
            />
            <PasswordInput
              label={t('person.passwordAgain')}
              autoComplete="new-password"
              value={typed.again}
              onChange={(event) => setTyped({ ...typed, again: event.currentTarget.value })}
            />
            <Group>
              <Button type="submit">{t('person.passwordSet')}</Button>
              <Button variant="default" onClick={() => void give(null)}>
                {t('person.passwordMake')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

/** Archiving, after a check: someone who left is stopped at their next step, and no one comes back. */
function ArchivePanel({
  name,
  onArchive,
  failed,
}: {
  name: string;
  onArchive: () => void;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  return (
    <Paper withBorder p="md">
      <Stack gap="sm" align="flex-start">
        <Title order={3}>{t('person.archive')}</Title>
        <Text c="dimmed">{t('person.archiveText')}</Text>
        {failed && (
          <Alert color="red" role="alert">
            {t('person.archiveFailed')}
          </Alert>
        )}
        {asking ? (
          <Group>
            <Button color="red" onClick={onArchive}>
              {t('person.archiveConfirm', { name })}
            </Button>
            <Button variant="default" onClick={() => setAsking(false)}>
              {t('person.archiveCancel')}
            </Button>
          </Group>
        ) : (
          <Button variant="default" onClick={() => setAsking(true)}>
            {t('person.archive')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

type FormProps = {
  page: PageProps;
  doc: EmployeeDoc;
  setup: StaffSetup;
  outcome: SaveOutcome;
  saving: boolean;
  ready: boolean;
  archiveFailed: boolean;
  onSave: (request: Omit<SaveEmployeeRequest, 'version'>) => void;
  onReload: () => void;
  onArchive: () => void;
  onPasswordGiven: () => void;
};

function PersonForm({
  page,
  doc,
  setup,
  outcome,
  saving,
  ready,
  archiveFailed,
  ...actions
}: FormProps) {
  const { t } = useTranslation();
  const { user } = page;
  const { employee } = doc;
  const editable = can(user, 'staff.canEdit') && !employee.archived;
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(phoneOf(employee));
  const [note, setNote] = useState(noteOf(employee));
  const [department, setDepartment] = useState(employee.department?.id ?? '');
  const [position, setPosition] = useState(employee.position?.id ?? '');
  const [own, setOwn] = useState<PermissionLayer>(employee.permissions);
  // What a permission left alone would give: the layers as chosen on the form, with no layer of
  // their own (an empty one adds nothing).
  const below = layersOf(setup, { departmentId: department, positionId: position, own: {} });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The form starts from the stored bag: a key it does not show survives, and an emptied field
    // removes its own.
    const { phone: _phone, note: _note, ...kept } = employee.extra;
    actions.onSave({
      name,
      extra: {
        ...kept,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      ...(user.root
        ? {
            departmentId: department || null,
            positionId: position || null,
            permissions: differences(own, below),
          }
        : {}),
    });
  };

  const unitSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    units: StaffSetup['departments'],
  ) => (
    <NativeSelect
      label={label}
      value={value}
      disabled={employee.archived}
      onChange={(event) => onChange(event.currentTarget.value)}
      data={[
        { value: '', label: t('person.noneChosen') },
        ...units.map((unit) => ({ value: unit.id, label: unit.name })),
      ]}
    />
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Stack gap={0}>
          <Title order={2}>{employee.name}</Title>
          <Text c="dimmed">{employee.code}</Text>
        </Stack>
        {employee.archived && <Badge color="gray">{t('staff.left')}</Badge>}
      </Group>
      <Button component={Link} to="/staff" variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t('staff.back')}
      </Button>
      {employee.archived && (
        <Alert color="gray" role="alert">
          {t('person.archived')}
        </Alert>
      )}
      {outcome === 'saved' && (
        <Alert color="green" role="alert">
          {t('person.saved')}
        </Alert>
      )}
      {outcome === 'failed' && (
        <Alert color="red" role="alert">
          {t('person.saveFailed')}
        </Alert>
      )}
      {outcome === 'conflict' && (
        <Alert color="orange" role="alert">
          <Stack gap="xs" align="flex-start">
            {t('person.conflict')}
            <Button variant="default" size="xs" onClick={actions.onReload}>
              {t('person.conflictReload')}
            </Button>
          </Stack>
        </Alert>
      )}
      <form onSubmit={submit}>
        <Paper withBorder p="md">
          <Stack gap="lg">
            <Title order={3}>{t('person.details')}</Title>
            <TextInput
              label={t('person.name')}
              required
              readOnly={!editable}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <TextInput
              label={t('person.phone')}
              type="tel"
              readOnly={!editable}
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
            />
            <Textarea
              label={t('person.note')}
              readOnly={!editable}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            {user.root ? (
              <>
                {unitSelect(t('person.department'), department, setDepartment, setup.departments)}
                {unitSelect(t('person.position'), position, setPosition, setup.positions)}
              </>
            ) : (
              <>
                <TextInput
                  label={t('person.department')}
                  readOnly
                  value={unitName(employee.department, setup.departments) ?? ''}
                />
                <TextInput
                  label={t('person.position')}
                  readOnly
                  value={unitName(employee.position, setup.positions) ?? ''}
                />
              </>
            )}
            {user.root && !employee.archived && (
              <Stack gap="xs">
                <Title order={4}>{t('person.permissions')}</Title>
                <Text c="dimmed" size="sm">
                  {t('person.permissionsIntro')}
                </Text>
                <PermissionEditor
                  mode="each"
                  label={t('person.permissions')}
                  layer={own}
                  below={below}
                  onChange={setOwn}
                />
              </Stack>
            )}
            {editable && (
              <Button type="submit" loading={saving} style={{ alignSelf: 'flex-start' }}>
                {t('person.save')}
              </Button>
            )}
          </Stack>
        </Paper>
      </form>
      <Paper withBorder p="md">
        <Stack gap="xs">
          <Title order={3}>{t('person.signIn')}</Title>
          <Text>
            {ready ? t('person.signInReady', { code: employee.code }) : t('person.signInNotYet')}
          </Text>
        </Stack>
      </Paper>
      {user.root && !employee.archived && (
        <PasswordPanel page={page} id={employee.id} onGiven={actions.onPasswordGiven} />
      )}
      {can(user, 'staff.canDelete') && !employee.archived && (
        <ArchivePanel name={employee.name} onArchive={actions.onArchive} failed={archiveFailed} />
      )}
    </Stack>
  );
}

/** One person: their details, how they sign in and, for whoever may, changes. A save sends the
 * version it was read at; a conflict, a failure or a refusal keeps what was typed. */
export function PersonPage(page: PageProps) {
  const { api } = page;
  const { id = '' } = useParams();
  const loaded = useLoad(
    async () => ({ doc: await api.getEmployee(id), setup: (await api.getStaffSetup()).setup }),
    page,
    [api, id],
  );
  const [current, setCurrent] = useState<EmployeeDoc | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome>(null);
  const [saving, setSaving] = useState(false);
  const [gavePassword, setGavePassword] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const data = loaded.data;

  async function act<T extends { kind: string }>(
    run: () => Promise<T | { kind: 'conflict' }>,
    onDone: (result: T) => void,
    onFailed: () => void,
  ) {
    try {
      const result = await run();
      if (result.kind === 'conflict') setOutcome('conflict');
      else onDone(result as T);
    } catch (error) {
      refusal(error, page);
      onFailed();
    }
  }

  async function save(request: Omit<SaveEmployeeRequest, 'version'>, version: string) {
    setSaving(true);
    setOutcome(null);
    await act(
      () => api.saveEmployee(id, { ...request, version }),
      (result) => {
        setCurrent(result.doc);
        setOutcome('saved');
      },
      () => setOutcome('failed'),
    );
    setSaving(false);
  }

  async function archive(version: string) {
    setArchiveFailed(false);
    setOutcome(null);
    await act(
      () => api.archiveEmployee(id, version),
      (result) => setCurrent(result.doc),
      () => setArchiveFailed(true),
    );
  }

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {data && (
        <PersonForm
          key={(current ?? data.doc).version}
          page={page}
          doc={current ?? data.doc}
          setup={data.setup}
          outcome={outcome}
          saving={saving}
          ready={(current ?? data.doc).signIn.ready || gavePassword}
          archiveFailed={archiveFailed}
          onSave={(request) => void save(request, (current ?? data.doc).version)}
          onReload={() => {
            setCurrent(null);
            setOutcome(null);
            loaded.reload();
          }}
          onArchive={() => void archive((current ?? data.doc).version)}
          onPasswordGiven={() => setGavePassword(true)}
        />
      )}
    </Loaded>
  );
}
