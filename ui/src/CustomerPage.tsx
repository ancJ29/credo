import { Alert, Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { DetailCard, DetailColumns, FieldPair } from './DetailCards';
import { Loaded } from './Loaded';
import { textIn } from './listSheet';
import { type PageProps, useLoad } from './page';

/**
 * One customer as the old app's cards: code and name, the phone, the address on the left and the
 * note on the right, drawn only when the customer has one. Read only: the page reads the
 * customers' list, as the list page does, and picks its id.
 */
export function CustomerPage(page: PageProps) {
  const { api } = page;
  const { t } = useTranslation();
  const { id } = useParams();
  const loaded = useLoad(() => api.listCustomers(), page, [api]);
  const customer = (loaded.data ?? []).find((one) => one.id === id);
  const note = textIn(customer?.extra['note']);

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {customer ? (
          <Stack gap="xs">
            <Title order={2}>{customer.name}</Title>
            <Text c="dimmed">{customer.code}</Text>
          </Stack>
        ) : (
          <Alert color="gray" role="alert">
            {t('lists.customers.notThere')}
          </Alert>
        )}
      </Loaded>
      <Button component={Link} to="/customers" variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t('lists.customers.back')}
      </Button>
      {customer && (
        <DetailColumns
          main={
            <Stack gap="lg">
              <DetailCard title={t('lists.customers.basic')}>
                <FieldPair>
                  <TextInput label={t('lists.columns.code')} readOnly value={customer.code} />
                  <TextInput label={t('lists.columns.name')} readOnly value={customer.name} />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.customers.contacts')}>
                <TextInput
                  label={t('lists.columns.phone')}
                  readOnly
                  value={textIn(customer.extra['phone'])}
                />
              </DetailCard>
              <DetailCard title={t('lists.customers.address')}>
                <TextInput
                  aria-label={t('lists.columns.address')}
                  readOnly
                  value={textIn(customer.extra['address'])}
                />
              </DetailCard>
            </Stack>
          }
          side={
            note ? (
              <DetailCard title={t('lists.customers.note')}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{note}</Text>
              </DetailCard>
            ) : undefined
          }
        />
      )}
    </Stack>
  );
}
