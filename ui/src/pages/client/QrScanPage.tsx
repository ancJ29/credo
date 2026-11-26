import { type SessionReply, parseQr } from '@credo/shared';
import type { Language } from '@credo/shared';
import { Box, Divider, FileButton, Stack, Text, TextInput } from '@mantine/core';
import { IconCircleCheck, IconKeyboard, IconQrcode } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, type Api } from '../../api';
import type { Brand } from '../../brand';
import { ActionButton } from '../../components/atoms/ActionButton';
import { BackLink } from '../../components/atoms/BackLink';
import { FormMessage } from '../../components/molecules/FormMessage';
import { RADII, TONES } from '../../design-system/tokens';
import { type Pixels, readQr } from '../../qrRead';
import { SignInFrame } from '../SignIn';

/** How often the camera's picture is read, and how long the green tick stays before the first page opens. */
const FRAME_MS = 250;
const TICK_MS = 700;
const SIGNED_OUT = 401;

type View = 'link' | 'camera' | 'paste';
type Told = 'noCode' | 'notACode' | 'refused' | 'failed' | 'noCamera' | null;

/** The code a pasted text carries: a whole sign-in link's `qr` part, or the code part alone. */
function codeIn(text: string) {
  let part = text.trim();
  try {
    part = new URL(part).searchParams.get('qr') ?? part;
  } catch {
    // Not a link: it may be the code part alone.
  }
  return parseQr(part);
}

/** A picture's or a camera frame's pixels, read off a canvas; null where the browser gives no canvas. */
function pixelsOf(source: CanvasImageSource, width: number, height: number): Pixels | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

type Props = {
  brand: Brand;
  api: Api;
  /** A session read from a code: the app signs in with it, as the camera link's boot does. */
  onSession: (session: SessionReply) => void;
  languages?: readonly Language[];
  onLanguage?: (language: Language) => void;
};

/** The QR sign-in's own page: scan the root's code with the camera, read a picture of it, or paste its link;
 * a code read signs in as the camera link does, with a green tick before the first page. */
export function QrScanPage({ brand, api, onSession, languages, onLanguage }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('link');
  const [told, setTold] = useState<Told>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pasted, setPasted] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  /** The text the camera last read that was refused or failed: not asked again while it stays in view. */
  const turnedAway = useRef<string | null>(null);

  /** Signs in by the text a code or a link carried; the camera stops and the tick shows. */
  async function enter(text: string) {
    const qr = codeIn(text);
    if (!qr) {
      turnedAway.current = text;
      return setTold('notACode');
    }
    if (busy.current) return;
    busy.current = true;
    try {
      const session = await api.signInQr(qr.id, qr.secret);
      setTold(null);
      setSignedIn(true);
      setTimeout(() => onSession(session), TICK_MS);
    } catch (error) {
      busy.current = false;
      turnedAway.current = text;
      setTold(error instanceof ApiError && error.status === SIGNED_OUT ? 'refused' : 'failed');
    }
  }

  async function readPicture(file: File) {
    const bitmap = await createImageBitmap(file);
    const pixels = pixelsOf(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    const text = pixels ? await readQr(pixels) : null;
    if (text === null) return setTold('noCode');
    await enter(text);
  }

  useEffect(() => {
    if (view !== 'camera' || signedIn) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let left = false;
    void (async () => {
      try {
        const opened = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        stream = opened;
        if (left) return opened.getTracks().forEach((track) => track.stop());
        video.current!.srcObject = opened;
        void video.current!.play();
        timer = setInterval(() => {
          const frame = video.current!;
          if (frame.videoWidth === 0) return;
          const pixels = pixelsOf(frame, frame.videoWidth, frame.videoHeight);
          if (!pixels) return;
          void readQr(pixels).then((text) => {
            // A code turned away is asked again only after another is read, or none is in view.
            if (text === null || text !== turnedAway.current) turnedAway.current = null;
            if (text !== null && text !== turnedAway.current) void enter(text);
          });
        }, FRAME_MS);
      } catch {
        setTold('noCamera');
        setView('paste');
      }
    })();
    return () => {
      left = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // `enter` reads only state it sets itself; the camera starts once a view is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, signedIn]);

  const picture = (
    <FileButton accept="image/*" onChange={(file) => file && void readPicture(file)}>
      {(props) => (
        <ActionButton meaning="other" onClick={props.onClick}>
          {t('qrScan.choose')}
        </ActionButton>
      )}
    </FileButton>
  );

  return (
    <SignInFrame
      brand={brand}
      title={t('qrScan.title')}
      languages={languages}
      onLanguage={onLanguage}
    >
      <Stack gap="md" align="center">
        {signedIn ? (
          <Stack gap="sm" align="center">
            <Box c={TONES.success}>
              <IconCircleCheck size={48} aria-hidden />
            </Box>
            <FormMessage kind="success">{t('qrScan.signedIn')}</FormMessage>
          </Stack>
        ) : (
          <>
            {told === 'refused' && (
              <Stack gap="sm" w="100%">
                <FormMessage kind="error">{t('qrSignIn.refusedText')}</FormMessage>
              </Stack>
            )}
            {told === 'failed' && <FormMessage kind="error">{t('common.unavailable')}</FormMessage>}
            {told === 'noCamera' && <FormMessage kind="error">{t('qrScan.noCamera')}</FormMessage>}
            {told === 'noCode' && <FormMessage kind="error">{t('qrScan.noCode')}</FormMessage>}
            {told === 'notACode' && <FormMessage kind="error">{t('qrScan.notACode')}</FormMessage>}
            {view === 'link' && (
              <>
                <Text size="sm" c="dimmed" ta="center">
                  {t('qrScan.text')}
                </Text>
                <ActionButton
                  meaning="main"
                  icon={<IconQrcode size={18} />}
                  onClick={() => {
                    setTold(null);
                    setView('camera');
                  }}
                >
                  {t('qrScan.scan')}
                </ActionButton>
                <Divider label={t('auth.or')} w="100%" />
                <ActionButton
                  meaning="other"
                  icon={<IconKeyboard size={18} />}
                  onClick={() => setView('paste')}
                >
                  {t('qrScan.byHand')}
                </ActionButton>
              </>
            )}
            {view === 'camera' && (
              <Stack gap="xs" align="center" w="100%">
                <Box
                  w="100%"
                  h={220}
                  style={{ borderRadius: RADII.md, overflow: 'hidden', background: 'black' }}
                >
                  <video
                    ref={video}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Text size="sm" c="dimmed" ta="center">
                  {t('qrScan.scanning')}
                </Text>
              </Stack>
            )}
            {(view === 'camera' || view === 'paste') && picture}
            {view === 'paste' && (
              <Stack gap="sm" w="100%">
                <TextInput
                  label={t('qrScan.paste')}
                  value={pasted}
                  onChange={(event) => setPasted(event.currentTarget.value)}
                />
                <ActionButton meaning="main" onClick={() => void enter(pasted)}>
                  {t('auth.submit')}
                </ActionButton>
              </Stack>
            )}
            <BackLink href="/">{t('qrSignIn.password')}</BackLink>
          </>
        )}
      </Stack>
    </SignInFrame>
  );
}
