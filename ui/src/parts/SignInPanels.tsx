import { emailSchema, type EmployeeDoc } from '@credo/shared';
import { Stack, Text, TextInput } from '@mantine/core';
import { ActionRow } from '../components/molecules/ActionRow';
import { ActionButton } from '../components/atoms/ActionButton';
import { IconFingerprint, IconMail, IconQrcode } from '@tabler/icons-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DetailCard } from './DetailCards';
import { type PageProps, refusal } from '../page';
import { QrCode } from './QrCode';
import { CopyText } from '../components/molecules/CopyText';
import { TYPE, WEIGHTS } from '../design-system/tokens';
import { FormMessage } from '../components/molecules/FormMessage';

/** An email: a second name to sign in with, the root's alone to give or take back. No mail is ever
 * sent to it, so it is not checked beyond its shape. */
export function EmailPanel({
  page,
  id,
  version,
  email,
  onChanged,
  onConflict,
}: {
  page: PageProps;
  id: string;
  version: string;
  /** The email the person has now, or none. */
  email: string | null;
  onChanged: (doc: EmployeeDoc) => void;
  onConflict: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<'invalid' | 'taken' | 'failed' | null>(null);
  const [said, setSaid] = useState<'set' | 'removed' | null>(null);

  async function change(next: string | null) {
    setProblem(null);
    setSaid(null);
    try {
      const result = await page.api.setEmail(id, { version, email: next });
      if (result.kind === 'set') {
        setTyped('');
        setSaid(next === null ? 'removed' : 'set');
        onChanged(result.doc);
      } else if (result.kind === 'conflict') onConflict();
      else setProblem('taken');
    } catch (error) {
      refusal(error, page);
      setProblem('failed');
    }
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!emailSchema.safeParse(typed).success) return setProblem('invalid');
    void change(typed);
  };

  return (
    <DetailCard icon={<IconMail size={14} />} title={t('person.emailTitle')}>
      <Text c="dimmed">{t('person.emailText')}</Text>
      <Text>{email ?? t('person.emailNone')}</Text>
      {said !== null && (
        <FormMessage kind="saved">
          {said === 'set' ? t('person.emailChanged', { email }) : t('person.emailRemoved')}
        </FormMessage>
      )}
      {problem !== null && (
        <FormMessage kind="error">
          {t(
            problem === 'invalid'
              ? 'person.emailInvalid'
              : problem === 'taken'
                ? 'person.emailTaken'
                : 'person.emailFailed',
          )}
        </FormMessage>
      )}
      <form onSubmit={submit}>
        <Stack gap="sm" align="flex-start">
          <TextInput
            label={t('person.emailNew')}
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
          />
          <ActionRow>
            <ActionButton meaning="other" submit>
              {t('person.emailSet')}
            </ActionButton>
            {email !== null && (
              <ActionButton meaning="other" onClick={() => void change(null)}>
                {t('person.emailRemove')}
              </ActionButton>
            )}
          </ActionRow>
        </Stack>
      </form>
    </DetailCard>
  );
}

/** A person's passkeys, the root's alone: how many they hold, and one press, asked first, that
 * removes them all, signing the person out everywhere, for a lost phone. It shows while one is
 * held, and after a removal says so, by name. */
export function PasskeysPanel({
  page,
  id,
  name,
  held,
  onRemoved,
}: {
  page: PageProps;
  id: string;
  name: string;
  /** How many passkeys the person holds now. */
  held: number;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [outcome, setOutcome] = useState<'removed' | 'failed' | null>(null);

  async function removeAll() {
    setOutcome(null);
    try {
      await page.api.removePersonPasskeys(id);
      setAsking(false);
      setOutcome('removed');
      onRemoved();
    } catch (error) {
      refusal(error, page);
      setAsking(false);
      setOutcome('failed');
    }
  }

  if (held === 0 && outcome !== 'removed') return null;
  return (
    <DetailCard icon={<IconFingerprint size={14} />} title={t('person.passkeysTitle')}>
      <Stack gap="sm" align="flex-start">
        {outcome === 'removed' ? (
          <FormMessage kind="success">{t('person.passkeysRemoved', { name })}</FormMessage>
        ) : (
          <>
            <Text fw={WEIGHTS.label}>{t('person.passkeysHeld', { count: held })}</Text>
            <Text c="dimmed">{t('person.passkeysText', { name })}</Text>
            {outcome === 'failed' && (
              <FormMessage kind="error">{t('person.passkeysFailed')}</FormMessage>
            )}
            {asking ? (
              <ActionRow>
                <ActionButton meaning="main" onClick={() => void removeAll()}>
                  {t('person.passkeysConfirm', { name })}
                </ActionButton>
                <ActionButton meaning="other" onClick={() => setAsking(false)}>
                  {t('person.passkeysCancel')}
                </ActionButton>
              </ActionRow>
            ) : (
              <ActionButton meaning="other" onClick={() => setAsking(true)}>
                {t('person.passkeysRemove')}
              </ActionButton>
            )}
          </>
        )}
      </Stack>
    </DetailCard>
  );
}

/** A QR code for one sign-in on a phone, within 15 minutes: the root's alone to show, its link
 * copied by a button, and a new code, which cancels the last, asked for first while one is shown.
 * The code and its link are held in this state alone. */
export function QrPanel({ page, id }: { page: PageProps; id: string }) {
  const { t } = useTranslation();
  const [link, setLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);

  async function show() {
    setFailed(false);
    setAsking(false);
    try {
      const issued = await page.api.issueQr(id);
      setLink(new URL(issued.link, window.location.origin).href);
    } catch (error) {
      refusal(error, page);
      setFailed(true);
    }
  }

  return (
    <DetailCard icon={<IconQrcode size={14} />} title={t('person.qrTitle')}>
      <Stack gap="sm" align="flex-start">
        <Text c="dimmed">{t('person.qrText')}</Text>
        {failed && <FormMessage kind="error">{t('person.qrFailed')}</FormMessage>}
        {link !== null && (
          <Stack gap="xs" w="100%">
            <QrCode value={link} label={t('person.qrImage')} />
            <CopyText
              value={link}
              label={t('operator.copyLink')}
              about={t('person.qrTitle')}
              field={t('person.qrLink')}
            />
            <Text {...TYPE.caption}>{t('person.qrOnce')}</Text>
          </Stack>
        )}
        {asking ? (
          <Stack gap="sm">
            <Text>{t('person.qrNewAsk')}</Text>
            <ActionRow>
              <ActionButton meaning="main" onClick={() => void show()}>
                {t('person.qrNewConfirm')}
              </ActionButton>
              <ActionButton meaning="other" onClick={() => setAsking(false)}>
                {t('person.qrNewCancel')}
              </ActionButton>
            </ActionRow>
          </Stack>
        ) : (
          <ActionButton
            meaning="other"
            onClick={() => (link === null ? void show() : setAsking(true))}
          >
            {link === null ? t('person.qrShow') : t('person.qrNew')}
          </ActionButton>
        )}
      </Stack>
    </DetailCard>
  );
}
