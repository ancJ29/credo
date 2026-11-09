import {
  addProductRequestSchema,
  can,
  extraInputSchema,
  nameSchema,
  PRICE_MAX,
  priceSchema,
  type ProductDoc,
  type SaveProductRequest,
  unitSchema,
} from '@credo/shared';
import {
  Alert,
  Button,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api';
import { DetailCard, DetailColumns, FieldPair } from '../../parts/DetailCards';
import { Loaded } from '../../frame/Loaded';
import { textIn } from '../../listSheet';
import { mergeExtra } from '../../parts/ownFields';
import { isForbidden, type PageProps, refusal, useLoad } from '../../page';

type Outcome = 'saved' | 'failed' | 'forbidden' | 'refused' | 'conflict' | null;

/**
 * One product as the old app's cards: code and name, the unit and the price, whether its stock is
 * kept on the left and the note on the right. Whoever may edit orders changes the name, unit,
 * price, stock and note and saves them over the version read, as the customer's page does: a
 * conflict, a failure or a refusal keeps what was typed. The note card is drawn for whoever may
 * edit, empty or not, else a note could never be added; for a reader only when it has text. The
 * code is not here: a new code is its own act.
 */
export function ProductPage(page: PageProps) {
  const { api, user } = page;
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const loaded = useLoad(() => api.getProduct(id), page, [api, id]);
  const [current, setCurrent] = useState<ProductDoc | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  // The form starts afresh from the stored product when this changes: after a save or a reload.
  const [formKey, setFormKey] = useState(0);
  const doc = current ?? loaded.data;

  async function save(read: ProductDoc, values: Omit<SaveProductRequest, 'version'>) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.saveProduct(id, { version: read.version, ...values });
      if (result.kind === 'conflict') {
        setOutcome('conflict');
      } else {
        setCurrent(result.doc);
        setFormKey((n) => n + 1);
        setOutcome('saved');
      }
    } catch (error) {
      refusal(error, page);
      const forbidden = isForbidden(error);
      const refused = error instanceof ApiError && error.status === 400;
      setOutcome(forbidden ? 'forbidden' : refused ? 'refused' : 'failed');
    }
    setSaving(false);
  }

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc ? (
          <Stack gap="xs">
            <Title order={2}>{doc.product.name}</Title>
            <Text c="dimmed">{doc.product.code}</Text>
          </Stack>
        ) : (
          <Alert color="gray" role="alert">
            {t('lists.products.notThere')}
          </Alert>
        )}
      </Loaded>
      <Button component={Link} to="/products" variant="subtle" style={{ alignSelf: 'flex-start' }}>
        {t('lists.products.back')}
      </Button>
      {doc && outcome === 'saved' && (
        <Alert color="green" role="alert">
          {t('lists.products.saved')}
        </Alert>
      )}
      {doc && (outcome === 'failed' || outcome === 'forbidden' || outcome === 'refused') && (
        <Alert color="red" role="alert">
          {t(
            outcome === 'failed'
              ? 'lists.products.saveFailed'
              : outcome === 'forbidden'
                ? 'lists.products.saveForbidden'
                : 'lists.products.saveRefused',
          )}
        </Alert>
      )}
      {doc && outcome === 'conflict' && (
        <Alert color="orange" role="alert">
          <Stack gap="xs" align="flex-start">
            {t('lists.products.conflict')}
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
              {t('lists.products.conflictReload')}
            </Button>
          </Stack>
        </Alert>
      )}
      {doc && (
        <ProductForm
          key={formKey}
          doc={doc}
          editable={can(user, 'orders.canEdit')}
          saving={saving}
          onSave={(values) => void save(doc, values)}
        />
      )}
    </Stack>
  );
}

/** The thousands mark and the decimal mark the language writes a number with. */
function marks(language: string) {
  const parts = new Intl.NumberFormat(language).formatToParts(1000.5);
  const mark = (type: string) =>
    parts
      .filter((part) => part.type === type)
      .map((part) => part.value)
      .join('');
  return { group: mark('group'), decimal: mark('decimal') };
}

/**
 * The product's form. An add is this form with the code box open, as the add pages draw it:
 * `adding` says whether the code is already held by another product, and the code is then asked by
 * the import's own rule (`addProductRequestSchema`'s code) and given to `onSave` beside the rest.
 * A save never changes the code.
 */
export function ProductForm({
  doc,
  editable,
  saving,
  adding,
  onSave,
}: {
  doc: ProductDoc;
  editable: boolean;
  saving: boolean;
  adding?: { taken: boolean };
  onSave: (values: Omit<SaveProductRequest, 'version'>, code: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { product } = doc;
  const [code, setCode] = useState(product.code);
  const [name, setName] = useState(product.name);
  const [unit, setUnit] = useState(product.unit);
  const [price, setPrice] = useState<number | string>(adding ? '' : product.price);
  const [stocked, setStocked] = useState(product.stocked);
  const stored = textIn(product.extra['note']);
  const [note, setNote] = useState(stored);
  const [tried, setTried] = useState(false);
  const { group, decimal } = marks(i18n.language);

  // The rule lives in the shared schemas, the BFF's authority too: the form only asks them.
  const nameValue = nameSchema.safeParse(name);
  const unitValue = unitSchema.safeParse(unit);
  const priceValue = priceSchema.safeParse(price);
  // A note left as it was keeps its key, even one that is not text; an emptied one removes it.
  const extra = mergeExtra(
    product.extra,
    note === stored ? {} : { note: note.trim() || undefined },
  );
  const extraValue = extraInputSchema.safeParse(extra);
  const codeValue = addProductRequestSchema.shape.code.safeParse(code.trim());
  const codeError = !adding
    ? undefined
    : tried && !codeValue.success
      ? t('lists.products.codeInvalid')
      : adding.taken || undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (
      !nameValue.success ||
      !unitValue.success ||
      !priceValue.success ||
      !extraValue.success ||
      (adding && !codeValue.success)
    ) {
      return;
    }
    onSave(
      {
        name: nameValue.data,
        unit: unitValue.data,
        price: priceValue.data,
        stocked,
        extra: extraValue.data,
      },
      code.trim(),
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="lg">
        <DetailColumns
          main={
            <Stack gap="lg">
              <DetailCard title={t('lists.products.basic')}>
                <FieldPair>
                  <TextInput
                    label={t('lists.columns.code')}
                    description={adding ? t('lists.write.code') : undefined}
                    autoCapitalize={adding ? 'characters' : undefined}
                    autoComplete={adding ? 'off' : undefined}
                    readOnly={!adding}
                    value={code}
                    error={codeError}
                    onChange={(event) => setCode(event.currentTarget.value)}
                  />
                  <TextInput
                    label={t('lists.columns.name')}
                    readOnly={!editable}
                    value={name}
                    error={tried && !nameValue.success ? t('lists.products.nameNeeded') : undefined}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.products.unitPrice')}>
                <FieldPair>
                  <TextInput
                    label={t('lists.columns.unit')}
                    readOnly={!editable}
                    value={unit}
                    error={tried && !unitValue.success ? t('lists.products.unitNeeded') : undefined}
                    onChange={(event) => setUnit(event.currentTarget.value)}
                  />
                  <NumberInput
                    label={t('lists.columns.price')}
                    description={t('lists.write.price')}
                    readOnly={!editable}
                    // Nothing is cut or clamped by the box: what is typed or pasted stays as it is,
                    // and the shared schema refuses a minus, a decimal or a size out of range.
                    allowDecimal
                    allowNegative
                    clampBehavior="none"
                    min={1}
                    max={PRICE_MAX}
                    thousandSeparator={group}
                    decimalSeparator={decimal}
                    allowedDecimalSeparators={[decimal]}
                    value={price}
                    error={
                      tried && !priceValue.success ? t('lists.products.priceInvalid') : undefined
                    }
                    onChange={setPrice}
                  />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.products.stock')}>
                <Switch
                  label={t('lists.columns.stocked')}
                  disabled={!editable}
                  checked={stocked}
                  onChange={(event) => setStocked(event.currentTarget.checked)}
                />
              </DetailCard>
            </Stack>
          }
          side={
            editable || stored ? (
              <DetailCard title={t('lists.products.note')}>
                <Textarea
                  aria-label={t('lists.products.note')}
                  rows={4}
                  readOnly={!editable}
                  value={note}
                  error={tried && !extraValue.success ? t('lists.products.noteTooLong') : undefined}
                  onChange={(event) => setNote(event.currentTarget.value)}
                />
              </DetailCard>
            ) : undefined
          }
        />
        {editable && (
          <Button type="submit" loading={saving} style={{ alignSelf: 'flex-start' }}>
            {adding ? t('lists.products.create') : t('lists.products.save')}
          </Button>
        )}
      </Stack>
    </form>
  );
}
