import { Group, Image, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { TYPE } from '../design-system/tokens';

/** The company's tab icon in a browser tab beside its plain name, and its phone-app icon in a home-screen tile under the name cut at one line, each under its caption; both pictures are hidden from a reader and take no focus, only the two captions are read. */
export function IconPreview({
  name,
  tabIcon,
  appIcon,
}: {
  name: string;
  tabIcon: string;
  appIcon: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text {...TYPE.caption}>{t('settings.iconPreviewTab')}</Text>
        <Paper withBorder radius="md" px="sm" py="xs" w={220} maw="100%">
          <Group gap="xs" wrap="nowrap" aria-hidden inert data-preview="tab">
            <Image src={tabIcon} alt="" h={16} w={16} fit="contain" />
            <Text size="sm" truncate="end">
              {name}
            </Text>
          </Group>
        </Paper>
      </Stack>
      <Stack gap="xs">
        <Text {...TYPE.caption}>{t('settings.iconPreviewHome')}</Text>
        <Stack gap={4} align="center" w={80} aria-hidden inert data-preview="home">
          <Image src={appIcon} alt="" h={60} w={60} fit="contain" radius="lg" />
          <Text size="xs" lineClamp={1} ta="center" w="100%">
            {name}
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
}
