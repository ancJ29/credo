import { Avatar, FileButton, Group, Image, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { QrCode } from '../parts/QrCode';
import { SAMPLES, useLanguage } from './samples';
import { SPACING } from './tokens';

/** A plain picture for a photo sample, no real person's or company's. */
export const PICTURE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='lightgray'/%3E%3Cpath d='M6 34 20 6l14 28z' fill='teal'/%3E%3C/svg%3E";

/** What the sign-in QR code carries in the sample: a link, never a real one. */
const SIGN_IN_LINK = 'https://an-phat.example/login?qr=a.b';

/** The photos and the QR code as the screens draw them, worded by the dictionary where a screen says it. */
export const PhotoStates: { name: string; node: ReactNode }[] = [
  { name: 'A person’s photo', node: <PersonPhoto /> },
  { name: 'A delivery’s proof', node: <DeliveryProof /> },
  { name: 'A company’s logo', node: <CompanyLogo /> },
  { name: 'The sign-in QR code', node: <SignInQr /> },
];

/** A person's photo at 96 with the button that chooses another, and the avatar drawn where none is held. */
function PersonPhoto() {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  return (
    <Stack gap="sm" align="flex-start">
      <Group>
        <Image src={PICTURE} alt={words.person} h={96} w={96} fit="cover" radius="md" />
        <Avatar name={words.person} color="initials" size={96} radius="md" aria-hidden />
      </Group>
      <FileButton accept="image/*" onChange={() => undefined}>
        {(props) => (
          <ActionButton meaning="other" onClick={props.onClick}>
            {t('person.photoChoose')}
          </ActionButton>
        )}
      </FileButton>
      <Text size="xs" c="dimmed">
        {t('person.photoHint')}
      </Text>
    </Stack>
  );
}

/** A delivery's proof, the picture the driver took, under its title in a panel. */
function DeliveryProof() {
  const { t } = useTranslation();
  return (
    <Paper withBorder p={SPACING.md} maw={320}>
      <Stack gap="sm">
        <Title order={3}>{t('orders.proofTitle')}</Title>
        <Image src={PICTURE} alt={t('orders.proofAlt')} radius="md" />
      </Stack>
    </Paper>
  );
}

/** A company's logo at 48, kept whole, with the button that chooses another. */
function CompanyLogo() {
  const { t } = useTranslation();
  return (
    <Group>
      <Image src={PICTURE} alt="" h={48} w={48} fit="contain" />
      <FileButton accept="image/*" onChange={() => undefined}>
        {(props) => (
          <ActionButton meaning="other" onClick={props.onClick}>
            {t('settings.logoChoose')}
          </ActionButton>
        )}
      </FileButton>
    </Group>
  );
}

/** The sign-in QR code a person shows a phone, named for a screen reader. */
function SignInQr() {
  const { t } = useTranslation();
  return <QrCode value={SIGN_IN_LINK} label={t('person.qrImage')} />;
}
