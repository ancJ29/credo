import {
  isHexColour,
  type Language,
  LANGUAGES,
  languagesAreValid,
  MAX_LOGO_BYTES,
  type TenantConfig,
} from '@credo/shared';
import {
  Checkbox,
  ColorInput,
  FileButton,
  Group,
  Image,
  NativeSelect,
  Radio,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from '../i18n';
import { Loaded } from '../frame/Loaded';
import { ActionButton } from '../components/atoms/ActionButton';
import { FormMessage } from '../components/molecules/FormMessage';
import { DetailCard } from './DetailCards';
import { PALETTES, paletteOfColour } from '../design-system/palettes';
import { TYPE, WEIGHTS } from '../design-system/tokens';
import { PageHeader } from '../components/organisms/PageHeader';

type Props = {
  status: 'loading' | 'failed' | 'ready';
  /** The stored settings, or what was typed when the last save failed. */
  config: TenantConfig;
  /** How the last save ended; a save over a newer one is a conflict. */
  outcome: 'saved' | 'failed' | 'refused' | 'conflict' | null;
  saving: boolean;
  onSave: (config: TenantConfig) => void;
  onRetry: () => void;
  /** Shows the newer settings after a conflict. */
  onReload: () => void;
  /** Why a logo was refused at the chooser, where the mock draws it before any file is chosen. */
  logoRefusal?: LogoRefusal;
};

type LogoRefusal = 'logoNotImage' | 'logoTooLarge';

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

function SettingsForm({ config, outcome, saving, onSave, onReload, logoRefusal }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(config);
  const change = (next: Partial<TenantConfig>) => setDraft((was) => ({ ...was, ...next }));
  /** Why the file just chosen was not taken as the logo; the draft's logo is as it was. */
  const [logoRefused, setLogoRefused] = useState<LogoRefusal | null>(logoRefusal ?? null);

  const chooseLogo = (file: File | null) => {
    if (!file) return;
    const refusal = !file.type.startsWith('image/')
      ? 'logoNotImage'
      : file.size > MAX_LOGO_BYTES
        ? 'logoTooLarge'
        : null;
    setLogoRefused(refusal);
    if (!refusal) void readAsDataUrl(file).then((logo) => change({ logo }));
  };

  const chooseLanguages = (languages: string[]) => {
    const offered = LANGUAGES.filter((language) => languages.includes(language));
    change({
      languages: offered,
      defaultLanguage: offered.includes(draft.defaultLanguage)
        ? draft.defaultLanguage
        : (offered[0] ?? draft.defaultLanguage),
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(draft);
  };

  const valid = draft.name.trim() !== '' && isHexColour(draft.colour) && languagesAreValid(draft);

  return (
    <form onSubmit={submit}>
      <Stack gap="lg">
        {outcome === 'saved' && <FormMessage kind="saved">{t('settings.saved')}</FormMessage>}
        {outcome === 'failed' && <FormMessage kind="error">{t('settings.saveFailed')}</FormMessage>}
        {outcome === 'refused' && (
          <FormMessage kind="error">{t('settings.saveRefused')}</FormMessage>
        )}
        {outcome === 'conflict' && (
          <FormMessage
            kind="warning"
            act={
              <ActionButton meaning="other" onClick={onReload}>
                {t('settings.conflictReload')}
              </ActionButton>
            }
          >
            {t('settings.conflict')}
          </FormMessage>
        )}
        <DetailCard icon={<IconBuilding size={14} />} title={t('settings.basics')}>
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
              <TextInput
                label={t('settings.name')}
                required
                value={draft.name}
                onChange={(event) => change({ name: event.currentTarget.value })}
              />
              <Stack gap={6}>
                <Text size="sm" fw={WEIGHTS.label}>
                  {t('settings.logo')}
                </Text>
                <Group>
                  {draft.logo ? (
                    <Image src={draft.logo} alt="" h={48} w={48} fit="contain" />
                  ) : (
                    <Text {...TYPE.caption}>{t('settings.logoNone')}</Text>
                  )}
                  <FileButton accept="image/*" onChange={chooseLogo}>
                    {(props) => (
                      <ActionButton meaning="other" onClick={props.onClick}>
                        {t('settings.logoChoose')}
                      </ActionButton>
                    )}
                  </FileButton>
                  {draft.logo && (
                    <ActionButton meaning="quiet" onClick={() => change({ logo: null })}>
                      {t('settings.logoRemove')}
                    </ActionButton>
                  )}
                </Group>
                {logoRefused && (
                  <FormMessage kind="error">
                    {t(`settings.${logoRefused}`, { max: MAX_LOGO_BYTES / 1024 })}
                  </FormMessage>
                )}
              </Stack>
              <Radio.Group
                label={t('settings.palette')}
                value={paletteOfColour(draft.colour)?.name ?? ''}
                onChange={(name) =>
                  PALETTES.filter((palette) => palette.name === name).forEach((palette) =>
                    change({ colour: palette.shades[7] }),
                  )
                }
                style={{ gridColumn: '1 / -1' }}
              >
                <Group mt="xs" gap="lg" align="flex-start">
                  {PALETTES.map((palette) => (
                    <Radio
                      key={palette.name}
                      value={palette.name}
                      label={t(`settings.palettes.${palette.name}`)}
                      color={palette.shades[7]}
                      size="lg"
                      radius="xl"
                      styles={{
                        body: { flexDirection: 'column', alignItems: 'center', gap: 4 },
                        labelWrapper: { alignItems: 'center' },
                        radio: {
                          backgroundColor: palette.shades[7],
                          borderColor: palette.shades[7],
                        },
                      }}
                    />
                  ))}
                </Group>
              </Radio.Group>
              <Stack gap="md">
                <ColorInput
                  label={t('settings.colour')}
                  format="hex"
                  withEyeDropper={false}
                  value={draft.colour}
                  onChange={(colour) => change({ colour })}
                />
                <Switch
                  label={t('settings.whiteHeader')}
                  checked={draft.whiteHeader}
                  onChange={(event) => change({ whiteHeader: event.currentTarget.checked })}
                />
                <Switch
                  label={t('settings.whiteMenu')}
                  checked={draft.whiteMenu}
                  onChange={(event) => change({ whiteMenu: event.currentTarget.checked })}
                />
                <Switch
                  label={t('settings.menuIcons')}
                  checked={draft.menuIcons}
                  onChange={(event) => change({ menuIcons: event.currentTarget.checked })}
                />
              </Stack>
              <Checkbox.Group
                label={t('settings.languages')}
                value={draft.languages}
                onChange={chooseLanguages}
              >
                <Group mt="xs">
                  {LANGUAGES.map((language) => (
                    <Checkbox key={language} value={language} label={LANGUAGE_NAMES[language]} />
                  ))}
                </Group>
              </Checkbox.Group>
              <NativeSelect
                label={t('settings.defaultLanguage')}
                value={draft.defaultLanguage}
                data={draft.languages.map((language) => ({
                  value: language,
                  label: LANGUAGE_NAMES[language],
                }))}
                onChange={(event) =>
                  change({ defaultLanguage: event.currentTarget.value as Language })
                }
              />
            </SimpleGrid>
          </Stack>
        </DetailCard>
        <ActionButton meaning="main" submit busy={saving} disabled={!valid}>
          {t('settings.save')}
        </ActionButton>
      </Stack>
    </form>
  );
}

/** The company's settings: name, logo, colour and the languages offered. */
export function Settings(props: Props) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg">
      <div>
        <PageHeader title={t('settings.title')} />
        <Text c="dimmed">{t('settings.intro')}</Text>
      </div>
      <Loaded status={props.status} onRetry={props.onRetry}>
        <SettingsForm {...props} />
      </Loaded>
    </Stack>
  );
}
