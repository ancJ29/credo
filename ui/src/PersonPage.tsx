import {
  can,
  differences,
  employeeCodeIsValid,
  layersOf,
  type EmployeeDoc,
  type PermissionLayer,
  passwordIsValid,
  type PhotoReply,
  type SaveEmployeeRequest,
  type StaffSetup,
  staffConfig,
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
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from './api';
import { Loaded } from './Loaded';
import {
  mergeExtra,
  OwnFieldInput,
  type OwnTexts,
  ownStored,
  ownTextsOf,
  refusedFields,
} from './ownFields';
import { type PageProps, refusal, useLoad } from './page';
import { PermissionEditor } from './PermissionEditor';
import { PhotoPanel } from './PhotoPanel';
import { EmailPanel, QrPanel } from './SignInPanels';
import { noteOf, personalPhoneOf, phoneOf, unitName } from './staffNames';

const READ_ONLY = { input: { fontFamily: 'ui-monospace, monospace' } };
type SaveOutcome = 'saved' | 'failed' | 'forbidden' | 'conflict' | null;

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

/** A new code: the root's alone. The person signs in with it from then on and is signed out
 * everywhere; the old code is free again. */
function CodePanel({
  page,
  id,
  version,
  changedTo,
  onChanged,
  onConflict,
}: {
  page: PageProps;
  id: string;
  version: string;
  /** The code the person was just given, kept above the form that was redrawn by it. */
  changedTo: string | null;
  onChanged: (doc: EmployeeDoc) => void;
  onConflict: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'failed' | null>(null);

  async function change(event: FormEvent) {
    event.preventDefault();
    if (!employeeCodeIsValid(typed)) return setProblem('invalid');
    setProblem(null);
    try {
      const result = await page.api.changeCode(id, { version, code: typed });
      if (result.kind === 'changed') {
        // The new code is said above the form; the box starts again, as a redrawn form's did.
        setTyped('');
        onChanged(result.doc);
      } else if (result.kind === 'conflict') onConflict();
      else setProblem('taken');
    } catch (error) {
      refusal(error, page);
      setProblem('failed');
    }
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={3}>{t('person.codeTitle')}</Title>
        <Text c="dimmed">{t('person.codeText')}</Text>
        {changedTo !== null && (
          <Alert color="green" role="alert">
            {t('person.codeChanged', { code: changedTo })}
          </Alert>
        )}
        {problem !== null && (
          <Alert color="red" role="alert">
            {t(
              problem === 'invalid'
                ? 'person.codeInvalid'
                : problem === 'taken'
                  ? 'person.codeTaken'
                  : 'person.codeFailed',
            )}
          </Alert>
        )}
        <form onSubmit={(event) => void change(event)}>
          <Stack gap="sm" align="flex-start">
            <TextInput
              label={t('person.codeNew')}
              autoCapitalize="characters"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.currentTarget.value)}
            />
            <Button type="submit" variant="default">
              {t('person.codeSet')}
            </Button>
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
  photo: PhotoReply | null;
  onPhoto: (photo: PhotoReply) => void;
  /** The code the person was just given, or null. */
  codeChanged: string | null;
  onCodeChanged: (doc: EmployeeDoc) => void;
  onEmailChanged: (doc: EmployeeDoc) => void;
  onConflict: () => void;
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
  photo,
  onPhoto,
  codeChanged,
  ...actions
}: FormProps) {
  const { t } = useTranslation();
  const { user } = page;
  const { employee } = doc;
  // The list as it was left, narrowed and searched, when the person was opened from it.
  const listed = (useLocation().state as { list?: unknown } | null)?.list;
  const editable = can(user, 'staff.canEdit') && !employee.archived;
  const [name, setName] = useState(employee.name);
  const { fields, customFields } = staffConfig(setup);
  const [phone, setPhone] = useState(phoneOf(employee));
  const [personalPhone, setPersonalPhone] = useState(personalPhoneOf(employee));
  const [note, setNote] = useState(noteOf(employee));
  const stored = ownTextsOf(customFields, employee.extra);
  const [values, setValues] = useState<OwnTexts>(stored);
  const [tried, setTried] = useState(false);
  // A value refused after a try is said at its field until it fits.
  const refused = tried ? refusedFields(customFields, values, stored) : [];
  const [department, setDepartment] = useState(employee.department?.id ?? '');
  const [position, setPosition] = useState(employee.position?.id ?? '');
  const [own, setOwn] = useState<PermissionLayer>(employee.permissions);
  // What a permission left alone would give: the layers as chosen on the form, with no layer of
  // their own (an empty one adds nothing).
  const below = layersOf(setup, { departmentId: department, positionId: position, own: {} });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (refusedFields(customFields, values, stored).length > 0) return;
    // The form starts from the stored bag: a key it does not show survives, and an emptied field
    // removes its own.
    actions.onSave({
      name,
      extra: mergeExtra(employee.extra, {
        phone: phone.trim() || undefined,
        ...(fields.personalPhone ? { personalPhone: personalPhone.trim() || undefined } : {}),
        note: note.trim() || undefined,
        ...ownStored(customFields, values, { was: stored, extra: employee.extra }),
      }),
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
      <Button
        component={Link}
        to={`/staff${typeof listed === 'string' ? listed : ''}`}
        variant="subtle"
        style={{ alignSelf: 'flex-start' }}
      >
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
      {(outcome === 'failed' || outcome === 'forbidden') && (
        <Alert color="red" role="alert">
          {t(outcome === 'failed' ? 'person.saveFailed' : 'person.saveForbidden')}
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
            {fields.personalPhone && (
              <TextInput
                label={t('person.personalPhone')}
                type="tel"
                readOnly={!editable}
                value={personalPhone}
                onChange={(event) => setPersonalPhone(event.currentTarget.value)}
              />
            )}
            <Textarea
              label={t('person.note')}
              readOnly={!editable}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            {customFields.map((field) => (
              <OwnFieldInput
                key={field.key}
                field={field}
                value={values[field.key]}
                refused={refused.includes(field.key)}
                readOnly={!editable}
                onChange={(value) => setValues((was) => ({ ...was, [field.key]: value }))}
              />
            ))}
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
      {photo && (
        <PhotoPanel
          page={page}
          id={employee.id}
          name={employee.name}
          held={photo}
          onHeld={onPhoto}
          editable={editable}
        />
      )}
      <Paper withBorder p="md">
        <Stack gap="xs">
          <Title order={3}>{t('person.signIn')}</Title>
          <Text>
            {!ready
              ? t('person.signInNotYet')
              : employee.email && fields.email
                ? t('person.signInReadyEmail', { code: employee.code, email: employee.email })
                : t('person.signInReady', { code: employee.code })}
          </Text>
        </Stack>
      </Paper>
      {user.root && !employee.archived && (
        <PasswordPanel page={page} id={employee.id} onGiven={actions.onPasswordGiven} />
      )}
      {user.root && !employee.archived && (
        <CodePanel
          page={page}
          id={employee.id}
          version={doc.version}
          changedTo={codeChanged}
          onChanged={actions.onCodeChanged}
          onConflict={actions.onConflict}
        />
      )}
      {user.root && !employee.archived && fields.email && (
        <EmailPanel
          page={page}
          id={employee.id}
          version={doc.version}
          email={employee.email ?? null}
          onChanged={actions.onEmailChanged}
          onConflict={actions.onConflict}
        />
      )}
      {user.root && !employee.archived && fields.qr && <QrPanel page={page} id={employee.id} />}
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
    async () => {
      const doc = await api.getEmployee(id);
      const { setup } = await api.getStaffSetup();
      const photo = staffConfig(setup).fields.photo ? await api.getPhoto(id) : null;
      return { doc, setup, photo };
    },
    page,
    [api, id],
  );
  const [current, setCurrent] = useState<EmployeeDoc | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome>(null);
  const [saving, setSaving] = useState(false);
  const [gavePassword, setGavePassword] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const [codeChanged, setCodeChanged] = useState<string | null>(null);
  // The photo as last saved or taken from a conflict, held here and not in the form: a save of the
  // details redraws the form, and its photo would go back to the one first read.
  const [photoNow, setPhotoNow] = useState<PhotoReply | null>(null);
  // The form starts afresh from the stored person when this changes: after a save or an archive,
  // not after a new code, so what was typed in the details survives it.
  const [formKey, setFormKey] = useState(0);
  const data = loaded.data;

  async function act<T extends { kind: string }>(
    run: () => Promise<T | { kind: 'conflict' }>,
    onDone: (result: T) => void,
    onFailed: (error: unknown) => void,
  ) {
    try {
      const result = await run();
      if (result.kind === 'conflict') setOutcome('conflict');
      else onDone(result as T);
    } catch (error) {
      refusal(error, page);
      onFailed(error);
    }
  }

  async function save(request: Omit<SaveEmployeeRequest, 'version'>, version: string) {
    setSaving(true);
    setOutcome(null);
    await act(
      () => api.saveEmployee(id, { ...request, version }),
      (result) => {
        setCurrent(result.doc);
        setFormKey((n) => n + 1);
        setOutcome('saved');
      },
      (error) =>
        setOutcome(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'failed'),
    );
    setSaving(false);
  }

  async function archive(version: string) {
    setArchiveFailed(false);
    setOutcome(null);
    await act(
      () => api.archiveEmployee(id, version),
      (result) => {
        setCurrent(result.doc);
        setFormKey((n) => n + 1);
      },
      () => setArchiveFailed(true),
    );
  }

  return (
    <Loaded status={loaded.status} onRetry={loaded.reload}>
      {data && (
        <PersonForm
          key={formKey}
          page={page}
          doc={current ?? data.doc}
          setup={data.setup}
          outcome={outcome}
          saving={saving}
          ready={(current ?? data.doc).signIn.ready || gavePassword}
          archiveFailed={archiveFailed}
          photo={photoNow ?? data.photo}
          onPhoto={setPhotoNow}
          codeChanged={codeChanged}
          onCodeChanged={(next) => {
            setCurrent(next);
            setOutcome(null);
            setCodeChanged(next.employee.code);
          }}
          onEmailChanged={(next) => {
            setCurrent(next);
            setOutcome(null);
          }}
          onConflict={() => setOutcome('conflict')}
          onSave={(request) => void save(request, (current ?? data.doc).version)}
          onReload={() => {
            setCurrent(null);
            setPhotoNow(null);
            setFormKey((n) => n + 1);
            setOutcome(null);
            setCodeChanged(null);
            loaded.reload();
          }}
          onArchive={() => void archive((current ?? data.doc).version)}
          onPasswordGiven={() => setGavePassword(true)}
        />
      )}
    </Loaded>
  );
}
