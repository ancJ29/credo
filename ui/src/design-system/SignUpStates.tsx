import { Box, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconLock, IconPhone, IconUser } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/atoms/ActionButton';
import { DoorHeading } from '../components/atoms/DoorHeading';
import { ActionRow } from '../components/molecules/ActionRow';
import { DataTable } from '../components/molecules/DataTable';
import { FormMessage } from '../components/molecules/FormMessage';
import { DoorCard } from '../components/organisms/DoorCard';
import { PageShell } from '../parts/PageShell';
import { UnknownClient } from '../pages/client/UnknownClient';
import { WaitingClient } from '../pages/client/WaitingClient';
import { Panel } from '../components/organisms/Panel';
import { CREDO_BRAND } from '../brand';
import { dayOf } from '../day';
import { SAMPLES, useLanguage } from './samples';
import { WEIGHTS } from './tokens';

/** The company the sign-up samples name, and the address it asked for: invented, no client's. */
const COMPANY = 'Gạch Men Phú Quý';
const CODE = 'phu-quy';
const ADDRESS = 'phu-quy.example.test';
/** The day the console's waiting row was asked on, at noon UTC. */
const ASKED = Date.UTC(2026, 10, 24, 12);

/** A company's sign-up on credo's own card, no company's logo: the form with its fields and one press, an address that was taken said on its field, or the card that says it was sent and what happens next. */
export function SignUpCard({ state }: { state: 'form' | 'taken' | 'sent' }) {
  const { t } = useTranslation();
  return (
    <DoorCard name={CREDO_BRAND.name}>
      {state === 'sent' ? (
        <Stack gap="md">
          <DoorHeading title={t('signUp.sentTitle')} />
          <FormMessage kind="success">
            {t('signUp.sentText', { name: COMPANY, address: ADDRESS })}
          </FormMessage>
        </Stack>
      ) : (
        <Stack gap="md">
          <DoorHeading title={t('signUp.title')} subtitle={t('signUp.intro')} />
          <TextInput label={t('signUp.name')} defaultValue={COMPANY} required />
          <TextInput
            label={t('signUp.code')}
            description={t('signUp.codeHint')}
            defaultValue={CODE}
            error={state === 'taken' ? t('signUp.taken') : undefined}
            required
          />
          <TextInput
            label={t('signUp.contactName')}
            leftSection={<IconUser size={18} />}
            required
          />
          <TextInput
            label={t('signUp.contactPhone')}
            type="tel"
            leftSection={<IconPhone size={18} />}
            required
          />
          <PasswordInput
            label={t('signUp.password')}
            description={t('person.passwordHint')}
            leftSection={<IconLock size={18} />}
            required
          />
          <Button variant="gradient" size="md" fullWidth>
            {t('signUp.submit')}
          </Button>
        </Stack>
      )}
    </DoorCard>
  );
}

/** The screen at an address no company holds, or one that signed up and waits, as the app draws them, on a door's page cut to the plate's height. */
export function UnknownAddressSample({ waiting }: { waiting?: boolean }) {
  return (
    <Box style={{ '--door-page-height': '360px' }}>
      {waiting ? <WaitingClient /> : <UnknownClient />}
    </Box>
  );
}

/** The console's Clients page with one company waiting above the list: its name, address, contact and the day asked, with Approve and Refuse; `asked` puts the refusal's question under the row. */
export function WaitingRows({ asked }: { asked?: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const words = SAMPLES[language];
  return (
    <Stack p="md">
      <PageShell
        title={t('nav.clients')}
        status="ready"
        actions={
          <ActionButton meaning="main" to="/operator/clients/new">
            {t('operator.add')}
          </ActionButton>
        }
      >
        <Stack gap="sm">
          <Title order={3}>{t('operator.waitingTitle')}</Title>
          <DataTable
            columns={[
              { heading: t('operator.colName') },
              { heading: t('operator.colCode') },
              { heading: t('operator.colContact') },
              { heading: t('operator.colAsked') },
              { heading: '' },
            ]}
            rows={[
              {
                key: CODE,
                cells: [
                  <Text fw={WEIGHTS.label}>{COMPANY}</Text>,
                  CODE,
                  `${words.person} · ${words.phone}`,
                  dayOf(ASKED, language),
                  <ActionRow>
                    <ActionButton meaning="other" label={`${t('operator.approve')}: ${COMPANY}`}>
                      {t('operator.approve')}
                    </ActionButton>
                    <ActionButton meaning="quiet" label={`${t('operator.refuse')}: ${COMPANY}`}>
                      {t('operator.refuse')}
                    </ActionButton>
                  </ActionRow>,
                ],
              },
            ]}
          />
          {asked && (
            <Panel>
              <Stack gap="sm">
                <Text>{t('operator.refuseAsk', { name: COMPANY })}</Text>
                <ActionRow>
                  <ActionButton meaning="other">{t('operator.refuseConfirm')}</ActionButton>
                  <ActionButton meaning="quiet">{t('operator.refuseCancel')}</ActionButton>
                </ActionRow>
              </Stack>
            </Panel>
          )}
        </Stack>
      </PageShell>
    </Stack>
  );
}
