import {
  type AddCustomerRequest,
  type AddProductRequest,
  type CustomerDoc,
  type ProductDoc,
} from '@credo/shared';
import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { Api } from '../../api';
import type { ListKind } from '../../listSheet';
import { type PageProps, refusal } from '../../page';
import { CustomerForm } from '../../parts/CustomerForm';
import { ProductForm } from '../../parts/ProductForm';

type Outcome = 'taken' | 'failed' | 'forbidden' | null;

/** What one kind of record gives the add page: its add call, its form over a blank record. */
type Spec<V> = {
  /** The add call: the id of the record added, or null when its code is taken. */
  add: (api: Api, values: V, code: string) => Promise<string | null>;
  form: (props: {
    saving: boolean;
    taken: boolean;
    onSave: (values: V, code: string) => void;
  }) => ReactNode;
};

/** No customer yet: the form of a customer's page with nothing in it. */
const BLANK_CUSTOMER: CustomerDoc = {
  customer: { id: '', code: '', name: '', extra: {} },
  version: '',
};

/** No product yet: the form of a product's page with nothing in it, the stock switch on, as an import's blank stock cell reads. */
const BLANK_PRODUCT: ProductDoc = {
  product: { id: '', code: '', name: '', unit: '', price: 0, stocked: true, extra: {} },
  version: '',
};

type CustomerValues = Pick<AddCustomerRequest, 'name' | 'extra'>;
type ProductValues = Omit<AddProductRequest, 'code'>;

const CUSTOMER: Spec<CustomerValues> = {
  add: async (api, values, code) => {
    const result = await api.addCustomer({ code, ...values });
    return result.kind === 'taken' ? null : result.doc.customer.id;
  },
  form: ({ saving, taken, onSave }) => (
    <CustomerForm
      doc={BLANK_CUSTOMER}
      editable
      saving={saving}
      adding={{ taken }}
      onSave={(name, extra, code) => onSave({ name, extra }, code)}
    />
  ),
};

const PRODUCT: Spec<ProductValues> = {
  add: async (api, values, code) => {
    const result = await api.addProduct({ code, ...values });
    return result.kind === 'taken' ? null : result.doc.product.id;
  },
  form: ({ saving, taken, onSave }) => (
    <ProductForm doc={BLANK_PRODUCT} editable saving={saving} adding={{ taken }} onSave={onSave} />
  ),
};

/**
 * Adding a customer or a product: the kind's own form with the code box open, over no version.
 * Whoever may edit orders types the code and the rest; the import's rule for a row is the rule here,
 * and a code the list already holds is refused with every box as typed. The product's stock switch
 * starts on, as the import reads a blank stock cell (`readStocked`), so the two ways in agree on a
 * product nobody said anything about; its unit and price are asked, as the import asks them. A
 * record added opens on its own page.
 */
export function AddRecordPage({ kind, ...page }: PageProps & { kind: ListKind }) {
  return kind === 'customers' ? (
    <Add kind={kind} spec={CUSTOMER} page={page} />
  ) : (
    <Add kind={kind} spec={PRODUCT} page={page} />
  );
}

function Add<V>({ kind, spec, page }: { kind: ListKind; spec: Spec<V>; page: PageProps }) {
  const { api } = page;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);

  async function add(values: V, code: string) {
    setSaving(true);
    setOutcome(null);
    try {
      const id = await spec.add(api, values, code);
      if (id === null) {
        setOutcome('taken');
      } else {
        void navigate(`/${kind}/${id}`);
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
        <Title order={2}>{t(`lists.${kind}.newTitle`)}</Title>
        <Text c="dimmed">{t(`lists.${kind}.newIntro`)}</Text>
      </div>
      <Button component={Link} to={`/${kind}`} variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t(`lists.${kind}.back`)}
      </Button>
      {outcome === 'taken' && (
        <Alert color="orange" role="alert">
          {t(`lists.${kind}.codeTaken`)}
        </Alert>
      )}
      {(outcome === 'failed' || outcome === 'forbidden') && (
        <Alert color="red" role="alert">
          {t(outcome === 'failed' ? `lists.${kind}.createFailed` : `lists.${kind}.createForbidden`)}
        </Alert>
      )}
      {spec.form({
        saving,
        taken: outcome === 'taken',
        onSave: (values, code) => void add(values, code),
      })}
    </Stack>
  );
}
