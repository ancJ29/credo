import {
  type IconKind,
  isHexColour,
  isIconKind,
  type Language,
  LANGUAGES,
  languagesAreValid,
  MAX_LOGO_BYTES,
  type PictureKind,
  type Pictures,
  type TenantConfig,
} from '@credo/shared';
import {
  Checkbox,
  ColorInput,
  Group,
  NativeSelect,
  Radio,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { IconId, IconLanguage, IconPalette, IconPhoto } from '@tabler/icons-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from '../i18n';
import { Loaded } from '../frame/Loaded';
import { ActionButton } from '../components/atoms/ActionButton';
import { FormMessage } from '../components/molecules/FormMessage';
import { makeIcon as makeIconReal, type MadeIcon, smallIcon } from '../icons';
import { BrandPreview } from './BrandPreview';
import { IconPreview } from './IconPreview';
import { PictureField } from './PictureField';
import { IdentityFields } from './IdentityFields';
import { DetailCard, DetailColumns } from './DetailCards';
import { PALETTES, paletteOfColour } from '../design-system/palettes';
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
  /** The company's pictures as the settings' reply names them: each is saved at its choice, never with the rest. */
  pictures: Pictures;
  /** The page takes a picture chosen (a data URL) or removed (none), and saves it at once. */
  onPicture: (kind: PictureKind, picture: string | null, small?: string) => void;
  /** How the last picture's save ended, and which picture it was. */
  pictureOutcome: {
    kind: PictureKind;
    outcome: 'saved' | 'failed' | 'refused' | 'conflict';
  } | null;
  /** Why a logo was refused at the chooser, where the mock draws it before any file is chosen. */
  logoRefusal?: LogoRefusal;
  /** Makes an icon's file the sides its kind asks; the browser's canvas, which the tests put a stand-in for. */
  makeIcon?: (file: File, kind: IconKind) => Promise<MadeIcon>;
};

type LogoRefusal = 'logoNotImage' | 'logoTooLarge' | 'iconTooSmall';

/** What each outcome of a picture's save says, and in which kind of message. */
const PICTURE_OUTCOMES = {
  saved: { kind: 'saved', word: 'settings.saved' },
  failed: { kind: 'error', word: 'settings.saveFailed' },
  refused: { kind: 'error', word: 'settings.saveRefused' },
  conflict: { kind: 'error', word: 'settings.conflict' },
} as const;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

function SettingsForm({
  config,
  outcome,
  saving,
  onSave,
  onReload,
  pictures,
  onPicture,
  pictureOutcome,
  logoRefusal,
  makeIcon = makeIconReal,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(config);
  const change = (next: Partial<TenantConfig>) => setDraft((was) => ({ ...was, ...next }));
  /** Why the file just chosen for each picture was not taken: it is told to no one. */
  const [refused, setRefused] = useState<Partial<Record<PictureKind, LogoRefusal | null>>>({
    logo: logoRefusal ?? null,
  });

  const choosePicture = (kind: PictureKind) => (file: File | null) => {
    if (!file) return;
    const refusal = !file.type.startsWith('image/')
      ? 'logoNotImage'
      : file.size > MAX_LOGO_BYTES
        ? 'logoTooLarge'
        : null;
    const refuse = (why: LogoRefusal | null) => setRefused((was) => ({ ...was, [kind]: why }));
    refuse(refusal);
    if (refusal) return;
    if (!isIconKind(kind))
      return void readAsDataUrl(file).then((picture) => onPicture(kind, picture));
    // An icon is made the sides its kind asks, in the browser, and saved at once with its second size.
    void makeIcon(file, kind).then(
      (made) =>
        made === 'tooSmall' ? refuse('iconTooSmall') : onPicture(kind, made.picture, made.small),
      () => refuse('logoNotImage'),
    );
  };

  /** An icon's address where one is stored: the drawn one, which has no version, is no picture to remove. */
  const storedIcon = (kind: IconKind) =>
    pictures[kind]?.version ? pictures[kind].address : undefined;

  /** What sits under a picture's field: its refusal at the chooser, else how its save ended. */
  const messageOf = (kind: PictureKind) => {
    const why = refused[kind];
    if (why) {
      return { kind: 'error' as const, text: t(`settings.${why}`, { max: MAX_LOGO_BYTES / 1024 }) };
    }
    if (pictureOutcome?.kind !== kind) return undefined;
    const said = PICTURE_OUTCOMES[pictureOutcome.outcome];
    return { kind: said.kind, text: t(said.word) };
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

  const submit = (event: SubmitEvent) => {
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
        <DetailColumns
          sideFirst
          side={
            <Stack gap="lg">
              <BrandPreview
                name={draft.name}
                logo={pictures.logo?.address}
                headerLogo={pictures.logo?.address}
                headerLogoOnColour={pictures['logo-on-colour']?.address}
                formatted={draft.formattedName}
                description={draft.description}
                brand={isHexColour(draft.colour) ? draft.colour : config.colour}
                whiteHeader={draft.whiteHeader}
              />
              <IconPreview
                name={draft.name}
                tabIcon={pictures['tab-icon']?.address ?? ''}
                appIcon={smallIcon(pictures['app-icon']?.address ?? '')}
              />
            </Stack>
          }
          main={
            <Stack gap="lg">
              <DetailCard icon={<IconId size={14} />} title={t('settings.identity')}>
                <IdentityFields
                  name={draft.name}
                  formattedName={draft.formattedName}
                  description={draft.description}
                  onChange={(field, value) => change({ [field]: value })}
                />
              </DetailCard>
              <DetailCard icon={<IconPhoto size={14} />} title={t('settings.pictures')}>
                <Stack gap="lg">
                  <PictureField
                    label={t('settings.logo')}
                    picture={pictures.logo?.address}
                    none={t('settings.logoNone')}
                    choose={t('settings.logoChoose')}
                    remove={t('settings.logoRemove')}
                    message={messageOf('logo')}
                    onChoose={choosePicture('logo')}
                    onRemove={() => onPicture('logo', null)}
                  />
                  <PictureField
                    label={t('settings.logoOnColour')}
                    hint={t('settings.logoOnColourHint')}
                    picture={pictures['logo-on-colour']?.address}
                    none={t('settings.logoOnColourNone')}
                    choose={t('settings.logoOnColourChoose')}
                    remove={t('settings.logoOnColourRemove')}
                    message={messageOf('logo-on-colour')}
                    onChoose={choosePicture('logo-on-colour')}
                    onRemove={() => onPicture('logo-on-colour', null)}
                  />
                  <PictureField
                    label={t('settings.tabIcon')}
                    hint={t('settings.tabIconHint')}
                    picture={storedIcon('tab-icon')}
                    none={t('settings.iconDrawn')}
                    choose={t('settings.tabIconChoose')}
                    remove={t('settings.tabIconRemove')}
                    message={messageOf('tab-icon')}
                    onChoose={choosePicture('tab-icon')}
                    onRemove={() => onPicture('tab-icon', null)}
                  />
                  <PictureField
                    label={t('settings.appIcon')}
                    hint={t('settings.appIconHint')}
                    picture={storedIcon('app-icon')}
                    none={t('settings.iconDrawn')}
                    choose={t('settings.appIconChoose')}
                    remove={t('settings.appIconRemove')}
                    message={messageOf('app-icon')}
                    onChoose={choosePicture('app-icon')}
                    onRemove={() => onPicture('app-icon', null)}
                  />
                </Stack>
              </DetailCard>
              <DetailCard icon={<IconPalette size={14} />} title={t('settings.frame')}>
                <Stack gap="lg">
                  <Radio.Group
                    label={t('settings.palette')}
                    value={paletteOfColour(draft.colour)?.name ?? ''}
                    onChange={(name) =>
                      PALETTES.filter((palette) => palette.name === name).forEach((palette) =>
                        change({ colour: palette.shades[7] }),
                      )
                    }
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
                </Stack>
              </DetailCard>
              <DetailCard icon={<IconLanguage size={14} />} title={t('settings.languagesSection')}>
                <Stack gap="lg">
                  <Checkbox.Group
                    label={t('settings.languages')}
                    value={draft.languages}
                    onChange={chooseLanguages}
                  >
                    <Group mt="xs">
                      {LANGUAGES.map((language) => (
                        <Checkbox
                          key={language}
                          value={language}
                          label={LANGUAGE_NAMES[language]}
                        />
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
                </Stack>
              </DetailCard>
              <ActionButton meaning="main" submit busy={saving} disabled={!valid}>
                {t('settings.save')}
              </ActionButton>
            </Stack>
          }
        />
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
