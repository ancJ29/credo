import { type AddProductRequest, type ProductDoc } from '@credo/shared';
import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { type PageProps, refusal } from '../../page';
import { ProductForm } from '../../parts/ProductForm';

type Outcome = 'taken' | 'failed' | 'forbidden' | null;

/** No product yet: the form of a product's page with nothing in it, the stock switch on, as an import's blank stock cell reads. */
const BLANK: ProductDoc = {
  product: { id: '', code: '', name: '', unit: '', price: 0, stocked: true, extra: {} },
  version: '',
};

/**
 * Adding a product: the product's own form with the code box open, over no version, as adding a
 * customer is. The stock switch starts on, as the import reads a blank stock cell (`readStocked`), so the two ways in
 * agree on a product nobody said anything about; the unit and the price are asked, as the import asks
 * them. A product added opens on its own page.
 */
export function AddProductPage(page: PageProps) {
  const { api } = page;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);

  async function add(request: AddProductRequest) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.addProduct(request);
      if (result.kind === 'taken') {
        setOutcome('taken');
      } else {
        void navigate(`/products/${result.doc.product.id}`);
        return;
      }
    } catch (error) {
      setOutcome(refusal(error, page) === 'forbidden' ? 'forbidden' : 'failed');
    }
    setSaving(false);
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t('lists.products.newTitle')}</Title>
        <Text c="dimmed">{t('lists.products.newIntro')}</Text>
      </div>
      <Button component={Link} to="/products" variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t('lists.products.back')}
      </Button>
      {outcome === 'taken' && (
        <Alert color="orange" role="alert">
          {t('lists.products.codeTaken')}
        </Alert>
      )}
      {(outcome === 'failed' || outcome === 'forbidden') && (
        <Alert color="red" role="alert">
          {t(
            outcome === 'failed' ? 'lists.products.createFailed' : 'lists.products.createForbidden',
          )}
        </Alert>
      )}
      <ProductForm
        doc={BLANK}
        editable
        saving={saving}
        adding={{ taken: outcome === 'taken' }}
        onSave={(values, code) => void add({ code, ...values })}
      />
    </Stack>
  );
}
