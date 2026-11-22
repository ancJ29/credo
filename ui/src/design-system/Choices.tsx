import { Checkbox, Group, Radio, SegmentedControl, Stack, Switch } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from '../i18n';
import { PALETTES } from './palettes';

/** The choices as the settings page and the permission editor draw them, worded by the dictionary where a screen says it. */
export const ChoiceStates: { name: string; node: ReactNode }[] = [
  { name: 'Tick boxes', node: <TickBoxes /> },
  { name: 'Switches', node: <Switches /> },
  { name: 'One of many', node: <OneOfMany /> },
  { name: 'Segmented pick', node: <SegmentedPick /> },
];

/** The settings page's languages: a list of tick boxes, and a permission's tick box with the line under it. */
function TickBoxes() {
  const { t } = useTranslation();
  return (
    <Stack gap="lg">
      <Checkbox.Group label={t('settings.languages')} defaultValue={['vi']}>
        <Group mt="xs">
          <Checkbox value="vi" label={LANGUAGE_NAMES.vi} />
          <Checkbox value="en" label={LANGUAGE_NAMES.en} />
        </Group>
      </Checkbox.Group>
      <Checkbox
        label={t('permissions.orders_canEdit')}
        description={t('permissions.needs', { what: t('permissions.orders_canView') })}
        defaultChecked
      />
    </Stack>
  );
}

/** The settings page's three switches, one on and two off. */
function Switches() {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <Switch label={t('settings.whiteHeader')} defaultChecked />
      <Switch label={t('settings.whiteMenu')} />
      <Switch label={t('settings.menuIcons')} />
    </Stack>
  );
}

/** The settings page's palette: one of six, each a round radio in its own colour. */
function OneOfMany() {
  const { t } = useTranslation();
  return (
    <Radio.Group label={t('settings.palette')} defaultValue={PALETTES[0].name}>
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
              radio: { backgroundColor: palette.shades[7], borderColor: palette.shades[7] },
            }}
          />
        ))}
      </Group>
    </Radio.Group>
  );
}

/** The permission editor's pick: inherit, allow or refuse, one of three at a glance. */
function SegmentedPick() {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      size="xs"
      aria-label={t('permissions.orders_canEdit')}
      defaultValue="inherit"
      data={[
        { value: 'inherit', label: t('permissions.inherit') },
        { value: 'allow', label: t('permissions.allow') },
        { value: 'refuse', label: t('permissions.refuse') },
      ]}
    />
  );
}
