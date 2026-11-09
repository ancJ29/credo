import { type AddCustomerRequest, type CustomerDoc } from '@credo/shared';
import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { CustomerForm } from './CustomerPage';
import { isForbidden, type PageProps, refusal } from '../../page';

type Outcome = 'taken' | 'failed' | 'forbidden' | null;

/** No customer yet: the form of a customer's page with nothing in it. */
const BLANK: CustomerDoc = { customer: { id: '', code: '', name: '', extra: {} }, version: '' };

/**
 * Adding a customer: the customer's own form with the code box open, over no version. Whoever may
 * edit orders types the code and the name and whatever else they know; the import's rule for a row
 * is the rule here, and a code the list already holds is refused with every box as typed. A
 * customer added opens on its own page, as a person added does.
 */
export function AddCustomerPage(page: PageProps) {
  const { api } = page;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);

  async function add(request: AddCustomerRequest) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.addCustomer(request);
      if (result.kind === 'taken') {
        setOutcome('taken');
      } else {
        void navigate(`/customers/${result.doc.customer.id}`);
        return;
      }
    } catch (error) {
      refusal(error, page);
      setOutcome(isForbidden(error) ? 'forbidden' : 'failed');
    }
    setSaving(false);
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t('lists.customers.newTitle')}</Title>
        <Text c="dimmed">{t('lists.customers.newIntro')}</Text>
      </div>
      <Button component={Link} to="/customers" variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t('lists.customers.back')}
      </Button>
      {outcome === 'taken' && (
        <Alert color="orange" role="alert">
          {t('lists.customers.codeTaken')}
        </Alert>
      )}
      {(outcome === 'failed' || outcome === 'forbidden') && (
        <Alert color="red" role="alert">
          {t(
            outcome === 'failed'
              ? 'lists.customers.createFailed'
              : 'lists.customers.createForbidden',
          )}
        </Alert>
      )}
      <CustomerForm
        doc={BLANK}
        editable
        saving={saving}
        adding={{ taken: outcome === 'taken' }}
        onSave={(name, extra, code) => void add({ code, name, extra })}
      />
    </Stack>
  );
}
