import { addCustomerRequestSchema, type CustomerDoc } from '@credo/shared';
import { Button, Stack, Textarea, TextInput } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { textIn } from '../listSheet';
import { DetailCard, DetailColumns, FieldPair } from './DetailCards';
import { mergeExtra } from './ownFields';

/**
 * The customer's form. An add is this form with the code box open, as the add pages draw it:
 * `adding` says whether the code is already held by another customer, and the code is then asked
 * by the import's own rule (`addCustomerRequestSchema`'s code) and given to `onSave` beside the
 * rest. A save never changes the code.
 */
export function CustomerForm({
  doc,
  editable,
  saving,
  adding,
  onSave,
}: {
  doc: CustomerDoc;
  editable: boolean;
  saving: boolean;
  adding?: { taken: boolean };
  onSave: (name: string, extra: Record<string, unknown>, code: string) => void;
}) {
  const { t } = useTranslation();
  const { customer } = doc;
  const [code, setCode] = useState(customer.code);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(textIn(customer.extra['phone']));
  const [address, setAddress] = useState(textIn(customer.extra['address']));
  const [note, setNote] = useState(textIn(customer.extra['note']));
  const [tried, setTried] = useState(false);
  const stored = textIn(customer.extra['note']);
  const codeValue = addCustomerRequestSchema.shape.code.safeParse(code.trim());
  const codeError = !adding
    ? undefined
    : tried && !codeValue.success
      ? t('lists.customers.codeInvalid')
      : adding.taken || undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!name.trim() || (adding && !codeValue.success)) return;
    // The form starts from the stored bag: a key it does not show survives, and an emptied field
    // removes its own.
    onSave(
      name.trim(),
      mergeExtra(customer.extra, {
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        note: note.trim() || undefined,
      }),
      code.trim(),
    );
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="lg">
        <DetailColumns
          main={
            <Stack gap="lg">
              <DetailCard title={t('lists.customers.basic')}>
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
                    error={tried && !name.trim() ? t('lists.customers.nameNeeded') : undefined}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.customers.contacts')}>
                <TextInput
                  label={t('lists.columns.phone')}
                  type="tel"
                  readOnly={!editable}
                  value={phone}
                  onChange={(event) => setPhone(event.currentTarget.value)}
                />
              </DetailCard>
              <DetailCard title={t('lists.customers.address')}>
                <TextInput
                  aria-label={t('lists.columns.address')}
                  readOnly={!editable}
                  value={address}
                  onChange={(event) => setAddress(event.currentTarget.value)}
                />
              </DetailCard>
            </Stack>
          }
          side={
            editable || stored ? (
              <DetailCard title={t('lists.customers.note')}>
                <Textarea
                  aria-label={t('lists.customers.note')}
                  rows={4}
                  readOnly={!editable}
                  value={note}
                  onChange={(event) => setNote(event.currentTarget.value)}
                />
              </DetailCard>
            ) : undefined
          }
        />
        {editable && (
          <Button type="submit" loading={saving} style={{ alignSelf: 'flex-start' }}>
            {adding ? t('lists.customers.create') : t('lists.customers.save')}
          </Button>
        )}
      </Stack>
    </form>
  );
}
