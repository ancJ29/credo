import { type CustomerDoc, can, type ProductDoc, type SaveProductRequest } from '@credo/shared';
import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError, type Api } from '../../api';
import type { ListKind } from '../../listSheet';
import { Loaded } from '../../frame/Loaded';
import { type PageProps, refusal, useLoad } from '../../page';
import { CustomerForm } from '../../parts/CustomerForm';
import { ProductForm } from '../../parts/ProductForm';

type Outcome = 'saved' | 'failed' | 'forbidden' | 'refused' | 'conflict' | null;

/** What one kind of record gives the page: its read, its save, its form and its outcomes. */
type Spec<D, V> = {
  load: (api: Api, id: string) => Promise<D | null>;
  /** The save over the version read: a conflict, or the document as stored. */
  save: (api: Api, id: string, read: D, values: V) => Promise<{ kind: 'conflict' } | { doc: D }>;
  head: (doc: D) => { name: string; code: string };
  /** The words for a 400, when it is one of this kind's outcomes (a product the server refuses). */
  refusedOn400: boolean;
  refusedWords: 'lists.products.saveRefused' | 'lists.customers.saveFailed';
  form: (props: {
    formKey: number;
    doc: D;
    editable: boolean;
    saving: boolean;
    onSave: (values: V) => void;
  }) => ReactNode;
};

type CustomerValues = { name: string; extra: Record<string, unknown> };
type ProductValues = Omit<SaveProductRequest, 'version'>;

const CUSTOMER: Spec<CustomerDoc, CustomerValues> = {
  load: (api, id) => api.getCustomer(id),
  save: (api, id, read, values) => api.saveCustomer(id, { version: read.version, ...values }),
  head: (doc) => doc.customer,
  refusedOn400: false,
  refusedWords: 'lists.customers.saveFailed', // never shown: a customer has no refused outcome
  form: ({ formKey, doc, editable, saving, onSave }) => (
    <CustomerForm
      key={formKey}
      doc={doc}
      editable={editable}
      saving={saving}
      onSave={(name, extra) => onSave({ name, extra })}
    />
  ),
};

const PRODUCT: Spec<ProductDoc, ProductValues> = {
  load: (api, id) => api.getProduct(id),
  save: (api, id, read, values) => api.saveProduct(id, { version: read.version, ...values }),
  head: (doc) => doc.product,
  refusedOn400: true,
  refusedWords: 'lists.products.saveRefused',
  form: ({ formKey, doc, editable, saving, onSave }) => (
    <ProductForm key={formKey} doc={doc} editable={editable} saving={saving} onSave={onSave} />
  ),
};

/**
 * One customer or product as the old app's cards: the name and code over its form. Whoever may
 * edit orders changes the fields and saves them over the version read: a conflict, a failure or a
 * refusal keeps what was typed. The note card is drawn for whoever may edit, empty or not, else a
 * note could never be added; for a reader only when it has text. The code is not here: a new code
 * is its own act.
 */
export function RecordPage({ kind, ...page }: PageProps & { kind: ListKind }) {
  return kind === 'customers' ? (
    <Record kind={kind} spec={CUSTOMER} page={page} />
  ) : (
    <Record kind={kind} spec={PRODUCT} page={page} />
  );
}

function Record<D extends { version: string }, V>({
  kind,
  spec,
  page,
}: {
  kind: ListKind;
  spec: Spec<D, V>;
  page: PageProps;
}) {
  const { api, user } = page;
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const loaded = useLoad(() => spec.load(api, id), page, [api, id]);
  const [current, setCurrent] = useState<D | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  // The form starts afresh from the stored record when this changes: after a save or a reload.
  const [formKey, setFormKey] = useState(0);
  const doc = current ?? loaded.data;

  async function save(read: D, values: V) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await spec.save(api, id, read, values);
      if ('doc' in result) {
        setCurrent(result.doc);
        setFormKey((n) => n + 1);
        setOutcome('saved');
      } else {
        setOutcome('conflict');
      }
    } catch (error) {
      const forbidden = refusal(error, page) === 'forbidden';
      const refused = spec.refusedOn400 && error instanceof ApiError && error.status === 400;
      setOutcome(forbidden ? 'forbidden' : refused ? 'refused' : 'failed');
    }
    setSaving(false);
  }

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc ? (
          <Stack gap="xs">
            <Title order={2}>{spec.head(doc).name}</Title>
            <Text c="dimmed">{spec.head(doc).code}</Text>
          </Stack>
        ) : (
          <Alert color="gray" role="alert">
            {t(`lists.${kind}.notThere`)}
          </Alert>
        )}
      </Loaded>
      <Button component={Link} to={`/${kind}`} variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t(`lists.${kind}.back`)}
      </Button>
      {doc && outcome === 'saved' && (
        <Alert color="green" role="alert">
          {t(`lists.${kind}.saved`)}
        </Alert>
      )}
      {doc && (outcome === 'failed' || outcome === 'forbidden' || outcome === 'refused') && (
        <Alert color="red" role="alert">
          {t(
            outcome === 'failed'
              ? `lists.${kind}.saveFailed`
              : outcome === 'forbidden'
                ? `lists.${kind}.saveForbidden`
                : spec.refusedWords,
          )}
        </Alert>
      )}
      {doc && outcome === 'conflict' && (
        <Alert color="orange" role="alert">
          <Stack gap="xs" align="flex-start">
            {t(`lists.${kind}.conflict`)}
            <Button
              variant="default"
              size="xs"
              onClick={() => {
                setCurrent(null);
                setOutcome(null);
                setFormKey((n) => n + 1);
                loaded.reload();
              }}
            >
              {t(`lists.${kind}.conflictReload`)}
            </Button>
          </Stack>
        </Alert>
      )}
      {doc &&
        spec.form({
          formKey,
          doc,
          editable: can(user, 'orders.canEdit'),
          saving,
          onSave: (values) => void save(doc, values),
        })}
    </Stack>
  );
}
