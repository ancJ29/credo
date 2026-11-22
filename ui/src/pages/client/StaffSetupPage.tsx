import type { PermissionLayer, SaveStaffSetupRequest, StaffSetup } from '@credo/shared';
import { Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api';
import { Loaded } from '../../frame/Loaded';
import { type PageProps, refusal, useLoad } from '../../page';
import { PermissionEditor } from '../../parts/PermissionEditor';
import {
  draftOf as fieldsDraftOf,
  FieldsEditor,
  type FieldsDraft,
  savedFrom,
} from '../../parts/StaffFieldsEditor';
import { TYPE } from '../../design-system/tokens';
import { ActionButton } from '../../components/atoms/ActionButton';
import { FormMessage } from '../../components/molecules/FormMessage';
import { PageHeader } from '../../components/organisms/PageHeader';

/** A unit being edited: `id` is absent until the BFF mints it, `key` tells the rows apart. */
type Draft = {
  key: number;
  id?: string;
  name: string;
  permissions: PermissionLayer;
  extra: object;
};
type Outcome =
  'saved' | 'failed' | 'refused' | 'conflict' | 'invalidFields' | 'invalidNumbering' | null;

const draftOf = (units: StaffSetup['departments'], from: number): Draft[] =>
  units.map((unit, index) => ({ ...unit, key: from + index }));

/** A department stores what it allows, so a permission left unchecked, or loaded as `false`, is not
 * stored at all: the one place that is done. */
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
        <Text {...TYPE.caption}>
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
              <ActionButton
                meaning="other"
                onClick={() => onChange(drafts.filter((other) => other.key !== draft.key))}
                label={`${t('setup.remove')} ${draft.name}`}
              >
                {t('setup.remove')}
              </ActionButton>
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
      <ActionButton
        meaning="other"
        onClick={() =>
          onChange([...drafts, { key: nextKey(), name: '', permissions: {}, extra: {} }])
        }
      >
        {t(kind === 'departments' ? 'setup.add' : 'setup.addPosition')}
      </ActionButton>
    </Stack>
  );
}

type FormProps = {
  setup: StaffSetup;
  saving: boolean;
  outcome: Outcome;
  onSave: (setup: SaveStaffSetupRequest['setup']) => void;
  /** The fields or the numbering are not ones the BFF would take: nothing is sent. */
  onRefused: (outcome: 'invalidFields' | 'invalidNumbering') => void;
  onReload: () => void;
};

function SetupForm({ setup, saving, outcome, onSave, onRefused, onReload }: FormProps) {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState(() => draftOf(setup.departments, 0));
  const [positions, setPositions] = useState(() => draftOf(setup.positions, 1000));
  const [fields, setFields] = useState<FieldsDraft>(() => fieldsDraftOf(setup));
  const [counter, setCounter] = useState(3000);
  const nextKey = () => {
    setCounter((n) => n + 1);
    return counter;
  };
  return (
    <Stack gap="xl">
      <div>
        <PageHeader title={t('setup.title')} />
        <Text c="dimmed">{t('setup.intro')}</Text>
      </div>
      {outcome === 'saved' && <FormMessage kind="saved">{t('setup.saved')}</FormMessage>}
      {outcome === 'failed' && <FormMessage kind="error">{t('setup.saveFailed')}</FormMessage>}
      {outcome === 'refused' && <FormMessage kind="error">{t('setup.saveRefused')}</FormMessage>}
      {(outcome === 'invalidFields' || outcome === 'invalidNumbering') && (
        <FormMessage kind="error">
          {t(outcome === 'invalidFields' ? 'setup.ownInvalid' : 'setup.numberingInvalid')}
        </FormMessage>
      )}
      {outcome === 'conflict' && (
        <FormMessage
          kind="warning"
          act={
            <ActionButton meaning="other" onClick={onReload}>
              {t('setup.conflictReload')}
            </ActionButton>
          }
        >
          {t('setup.conflict')}
        </FormMessage>
      )}
      <UnitList
        kind="departments"
        drafts={departments}
        onChange={setDepartments}
        nextKey={nextKey}
      />
      <UnitList kind="positions" drafts={positions} onChange={setPositions} nextKey={nextKey} />
      <FieldsEditor draft={fields} onChange={setFields} nextKey={nextKey} />
      <ActionButton
        meaning="main"
        busy={saving}
        onClick={() => {
          const kept = savedFrom(fields);
          if ('refused' in kept) {
            return onRefused(kept.refused === 'fields' ? 'invalidFields' : 'invalidNumbering');
          }
          onSave({
            departments: departments.map((draft) => stored(draft, 'departments')),
            positions: positions.map((draft) => stored(draft, 'positions')),
            ...kept,
            extra: setup.extra,
          });
        }}
      >
        {t('setup.save')}
      </ActionButton>
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
          onRefused={setOutcome}
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
