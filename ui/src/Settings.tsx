import {
  isHexColour,
  type Language,
  LANGUAGES,
  languagesAreValid,
  MAX_LOGO_BYTES,
  type TenantConfig,
} from '@credo/shared';
import {
  Alert,
  Button,
  Checkbox,
  ColorInput,
  FileButton,
  Group,
  Image,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from './i18n';
import { Loaded } from './Loaded';

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
        {outcome === 'saved' && (
          <Alert color="green" role="alert">
            {t('settings.saved')}
          </Alert>
        )}
        {outcome === 'failed' && (
          <Alert color="red" role="alert">
            {t('settings.saveFailed')}
          </Alert>
        )}
        {outcome === 'refused' && (
          <Alert color="red" role="alert">
            {t('settings.saveRefused')}
          </Alert>
        )}
        {outcome === 'conflict' && (
          <Alert color="orange" role="alert">
            <Stack gap="xs" align="flex-start">
              {t('settings.conflict')}
              <Button size="xs" variant="default" onClick={onReload}>
                {t('settings.conflictReload')}
              </Button>
            </Stack>
          </Alert>
        )}
        <Paper withBorder p="md">
          <Stack gap="lg">
            <Group gap={8} wrap="nowrap">
              <ThemeIcon variant="light" color="gray" size={22} radius="sm" aria-hidden>
                <IconBuilding size={14} />
              </ThemeIcon>
              <Title order={3} fz="xs" fw={700} tt="uppercase" lts={0.5}>
                {t('settings.basics')}
              </Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
              <TextInput
                label={t('settings.name')}
                required
                value={draft.name}
                onChange={(event) => change({ name: event.currentTarget.value })}
              />
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  {t('settings.logo')}
                </Text>
                <Group>
                  {draft.logo ? (
                    <Image src={draft.logo} alt="" h={48} w={48} fit="contain" />
                  ) : (
                    <Text size="sm" c="dimmed">
                      {t('settings.logoNone')}
                    </Text>
                  )}
                  <FileButton accept="image/*" onChange={chooseLogo}>
                    {(props) => (
                      <Button variant="default" size="xs" {...props}>
                        {t('settings.logoChoose')}
                      </Button>
                    )}
                  </FileButton>
                  {draft.logo && (
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => change({ logo: null })}
                    >
                      {t('settings.logoRemove')}
                    </Button>
                  )}
                </Group>
                {logoRefused && (
                  <Text size="sm" c="red" role="alert">
                    {t(`settings.${logoRefused}`, { max: MAX_LOGO_BYTES / 1024 })}
                  </Text>
                )}
              </Stack>
              <ColorInput
                label={t('settings.colour')}
                format="hex"
                withEyeDropper={false}
                value={draft.colour}
                onChange={(colour) => change({ colour })}
              />
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
        </Paper>
        <Group>
          <Button type="submit" loading={saving} disabled={!valid}>
            {t('settings.save')}
          </Button>
        </Group>
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
        <Title order={2}>{t('settings.title')}</Title>
        <Text c="dimmed">{t('settings.intro')}</Text>
      </div>
      <Loaded status={props.status} onRetry={props.onRetry}>
        <SettingsForm {...props} />
      </Loaded>
    </Stack>
  );
}
