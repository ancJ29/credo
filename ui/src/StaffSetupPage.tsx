import type { PermissionLayer, SaveStaffSetupRequest, StaffSetup } from '@credo/shared';
import { Alert, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from './api';
import { Loaded } from './Loaded';
import { type PageProps, refusal, useLoad } from './page';
import { PermissionEditor } from './PermissionEditor';

/** A unit being edited: `id` is absent until the BFF mints it, `key` tells the rows apart. */
type Draft = {
  key: number;
  id?: string;
  name: string;
  permissions: PermissionLayer;
  extra: object;
};
type Outcome = 'saved' | 'failed' | 'refused' | 'conflict' | null;

const draftOf = (units: StaffSetup['departments'], from: number): Draft[] =>
  units.map((unit, index) => ({ ...unit, key: from + index }));

/** A department stores what it allows, so a permission left unchecked is not stored at all. */
const stored = (draft: Draft, kind: 'departments' | 'positions') => ({
  ...(draft.id ? { id: draft.id } : {}),
  name: draft.name,
  extra: draft.extra as Record<string, unknown>,
  permissions:
    kind === 'departments'
      ? (Object.fromEntries(
          Object.entries(draft.permissions).filter(([, allowed]) => allowed === true),
        ) as PermissionLayer)
      : draft.permissions,
});

type ListProps = {
  kind: 'departments' | 'positions';
  drafts: Draft[];
  onChange: (drafts: Draft[]) => void;
  nextKey: () => number;
};

function UnitList({ kind, drafts, onChange, nextKey }: ListProps) {
  const { t } = useTranslation();
  const change = (key: number, next: Partial<Draft>) =>
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...next } : draft)));
  return (
    <Stack gap="md">
      <div>
        <Title order={3}>
          {t(kind === 'departments' ? 'setup.departments' : 'setup.positions')}
        </Title>
        <Text c="dimmed" size="sm">
          {t(kind === 'departments' ? 'setup.departmentHint' : 'setup.positionHint')}
        </Text>
      </div>
      {drafts.length === 0 && <Text c="dimmed">{t('setup.none')}</Text>}
      {drafts.map((draft) => (
        <Paper key={draft.key} withBorder p="md">
          <Stack gap="sm">
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label={t('setup.name')}
                required
                flex={1}
                value={draft.name}
                onChange={(event) => change(draft.key, { name: event.currentTarget.value })}
              />
              <Button
                variant="default"
                onClick={() => onChange(drafts.filter((other) => other.key !== draft.key))}
                aria-label={`${t('setup.remove')} ${draft.name}`}
              >
                {t('setup.remove')}
              </Button>
            </Group>
            <PermissionEditor
              mode={kind === 'departments' ? 'allow' : 'each'}
              label={draft.name || t('setup.name')}
              layer={draft.permissions}
              onChange={(permissions) => change(draft.key, { permissions })}
            />
          </Stack>
        </Paper>
      ))}
      <Button
        variant="default"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          onChange([...drafts, { key: nextKey(), name: '', permissions: {}, extra: {} }])
        }
      >
        {t(kind === 'departments' ? 'setup.add' : 'setup.addPosition')}
      </Button>
    </Stack>
  );
}

type FormProps = {
  setup: StaffSetup;
  saving: boolean;
  outcome: Outcome;
  onSave: (setup: SaveStaffSetupRequest['setup']) => void;
  onReload: () => void;
};

function SetupForm({ setup, saving, outcome, onSave, onReload }: FormProps) {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState(() => draftOf(setup.departments, 0));
  const [positions, setPositions] = useState(() => draftOf(setup.positions, 1000));
  const [counter, setCounter] = useState(2000);
  const nextKey = () => {
    setCounter((n) => n + 1);
    return counter;
  };
  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>{t('setup.title')}</Title>
        <Text c="dimmed">{t('setup.intro')}</Text>
      </div>
      {outcome === 'saved' && (
        <Alert color="green" role="alert">
          {t('setup.saved')}
        </Alert>
      )}
      {outcome === 'failed' && (
        <Alert color="red" role="alert">
          {t('setup.saveFailed')}
        </Alert>
      )}
      {outcome === 'refused' && (
        <Alert color="red" role="alert">
          {t('setup.saveRefused')}
        </Alert>
      )}
      {outcome === 'conflict' && (
        <Alert color="orange" role="alert">
          <Stack gap="xs" align="flex-start">
            {t('setup.conflict')}
            <Button variant="default" size="xs" onClick={onReload}>
              {t('setup.conflictReload')}
            </Button>
          </Stack>
        </Alert>
      )}
      <UnitList
        kind="departments"
        drafts={departments}
        onChange={setDepartments}
        nextKey={nextKey}
      />
      <UnitList kind="positions" drafts={positions} onChange={setPositions} nextKey={nextKey} />
      <Button
        loading={saving}
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          onSave({
            departments: departments.map((draft) => stored(draft, 'departments')),
            positions: positions.map((draft) => stored(draft, 'positions')),
            extra: setup.extra,
          })
        }
      >
        {t('setup.save')}
      </Button>
    </Stack>
  );
}

/** The root's page for the company's departments and positions, and what each may do. A save sends
 * the version it was read at; an outcome that is not "saved" keeps what was typed. */
export function StaffSetupPage(page: PageProps) {
  const { api } = page;
  const loaded = useLoad(() => api.getStaffSetup(), page, [api]);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<typeof loaded.data>(null);
  const doc = saved ?? loaded.data;

  async function save(setup: SaveStaffSetupRequest['setup'], version: string) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.saveStaffSetup(setup, version);
      if (result.kind === 'saved') setSaved(result.doc);
      setOutcome(result.kind === 'saved' ? 'saved' : 'conflict');
    } catch (error) {
      refusal(error, page);
      setOutcome(error instanceof ApiError && error.status === 400 ? 'refused' : 'failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Loaded status={doc ? 'ready' : loaded.status} onRetry={loaded.reload}>
      {doc && (
        <SetupForm
          key={doc.version}
          setup={doc.setup}
          saving={saving}
          outcome={outcome}
          onSave={(setup) => void save(setup, doc.version)}
          onReload={() => {
            setSaved(null);
            setOutcome(null);
            loaded.reload();
          }}
        />
      )}
    </Loaded>
  );
}
