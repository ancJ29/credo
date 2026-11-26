import { Box, Button, Divider, Stack, Text, TextInput } from '@mantine/core';
import { IconCircleCheck, IconKeyboard, IconQrcode } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { BackLink } from '../components/atoms/BackLink';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { FormMessage } from '../components/molecules/FormMessage';
import { DoorCard } from '../components/organisms/DoorCard';
import { SAMPLES, useLanguage } from './samples';
import { RADII, SPACING } from './tokens';

/** The scan page's six states after its first view, in drawing order. */
export type ScanState =
  'link' | 'camera' | 'picture' | 'paste' | 'signedIn' | 'refused' | 'noCamera';

/** The camera's window as the page draws it, the frame alone: a bordered square with the hint beneath, no picture from a camera. */
function CameraFrame() {
  const { t } = useTranslation();
  return (
    <Stack gap="xs" align="center" w="100%">
      <Box
        w="100%"
        h={220}
        style={{ border: '2px dashed var(--mantine-color-gray-5)', borderRadius: RADII.md }}
        aria-hidden
      />
      <Text size="sm" c="dimmed" ta="center">
        {t('qrScan.scanning')}
      </Text>
    </Stack>
  );
}

/** A picture to read: the button that would choose one from the device, drawn without its file input. */
function PictureChoice() {
  const { t } = useTranslation();
  return <ActionButton meaning="other">{t('qrScan.choose')}</ActionButton>;
}

/** The link to paste, with the one press that reads it. */
function PasteLink() {
  const { t } = useTranslation();
  return (
    <Stack gap="sm" w="100%">
      <TextInput label={t('qrScan.paste')} />
      <Button variant="gradient" size="md" fullWidth>
        {t('auth.submit')}
      </Button>
    </Stack>
  );
}

/** The QR scan page on the door card, in the dictionary's words: its first view of two choices, then the camera, a picture, the pasted link, the signed-in tick, the refusal and the missing camera. */
export function ScanCard({ state }: { state: ScanState }) {
  const { t } = useTranslation();
  const words = SAMPLES[useLanguage()];
  const way = <BackLink href="#">{t('qrSignIn.password')}</BackLink>;
  return (
    <DoorCard name={words.shop}>
      <Stack gap="md" align="center">
        {state === 'link' && (
          <>
            <Stack gap={0} w="100%">
              <DoorHeading title={t('qrScan.title')} subtitle={t('qrScan.text')} />
            </Stack>
            <Button variant="gradient" size="md" fullWidth leftSection={<IconQrcode size={18} />}>
              {t('qrScan.scan')}
            </Button>
            <Divider label={t('auth.or')} w="100%" />
            <Button variant="default" fullWidth leftSection={<IconKeyboard size={18} />}>
              {t('qrScan.byHand')}
            </Button>
          </>
        )}
        {state === 'camera' && (
          <>
            <DoorHeading title={t('qrScan.camera')} />
            <CameraFrame />
          </>
        )}
        {state === 'picture' && (
          <>
            <DoorHeading title={t('qrScan.picture')} />
            <PictureChoice />
          </>
        )}
        {state === 'paste' && (
          <>
            <DoorHeading title={t('qrScan.byHand')} />
            <PasteLink />
          </>
        )}
        {state === 'signedIn' && (
          <Stack gap="sm" align="center" p={SPACING.md}>
            <IconCircleCheck size={48} color="var(--mantine-color-green-6)" aria-hidden />
            <FormMessage kind="success">{t('qrScan.signedIn')}</FormMessage>
          </Stack>
        )}
        {state === 'refused' && (
          <Stack gap="sm" w="100%">
            <DoorHeading title={t('qrSignIn.refusedTitle')} />
            <FormMessage kind="error">{t('qrSignIn.refusedText')}</FormMessage>
          </Stack>
        )}
        {state === 'noCamera' && (
          <Stack gap="sm" align="center" w="100%">
            <DoorHeading title={t('qrScan.camera')} />
            <FormMessage kind="error">{t('qrScan.noCamera')}</FormMessage>
            <PictureChoice />
            <PasteLink />
          </Stack>
        )}
        {state !== 'signedIn' && way}
      </Stack>
    </DoorCard>
  );
}
