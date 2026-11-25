import { Group, Stack, Text } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { DoorCard } from '../components/organisms/DoorCard';
import { SectionCard } from '../components/organisms/SectionCard';
import { ColourScope } from '../design-system/ColourScope';
import { TYPE } from '../design-system/tokens';
import { headerLook, HeaderBrand } from '../frame/Shell';

/** A block titled Preview that shows a company header and the title of its sign-in card in the colour given, with the formatted name and the description where given, before anything is saved; both pictures are hidden from a reader and take no focus, only the title and two captions are read. */
export function BrandPreview({
  name,
  logo,
  formatted,
  description,
  brand,
  whiteHeader,
}: {
  name: string;
  logo?: string;
  formatted?: string;
  description?: string;
  brand: string;
  whiteHeader?: boolean;
}) {
  const { t } = useTranslation();
  const white = !!whiteHeader;
  return (
    <SectionCard icon={<IconEye size={14} />} title={t('settings.preview')}>
      <ColourScope colour={brand}>
        <Stack gap="lg">
          <Stack gap="xs">
            <Text {...TYPE.caption}>{t('settings.previewHeader')}</Text>
            <div aria-hidden inert data-preview="header" {...headerLook(white)}>
              <Group h={56} px="md" wrap="nowrap">
                <HeaderBrand name={name} formatted={formatted} white={white} />
              </Group>
            </div>
          </Stack>
          <Stack gap="xs">
            <Text {...TYPE.caption}>{t('settings.previewCard')}</Text>
            <div aria-hidden inert data-preview="card">
              <DoorCard name={name} logo={logo} formatted={formatted} description={description}>
                <DoorHeading title={t('auth.title')} />
              </DoorCard>
            </div>
          </Stack>
        </Stack>
      </ColourScope>
    </SectionCard>
  );
}
