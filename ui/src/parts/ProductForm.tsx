import {
  addProductRequestSchema,
  extraInputSchema,
  nameSchema,
  PRICE_MAX,
  priceSchema,
  type ProductDoc,
  type SaveProductRequest,
  unitSchema,
} from '@credo/shared';
import { Button, NumberInput, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { textIn } from '../listSheet';
import { DetailCard, DetailColumns, FieldPair } from './DetailCards';
import { mergeExtra } from './ownFields';

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
