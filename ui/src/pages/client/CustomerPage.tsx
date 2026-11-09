import { addCustomerRequestSchema, type CustomerDoc, can } from '@credo/shared';
import { Alert, Button, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { DetailCard, DetailColumns, FieldPair } from '../../parts/DetailCards';
import { Loaded } from '../../frame/Loaded';
import { textIn } from '../../listSheet';
import { mergeExtra } from '../../parts/ownFields';
import { isForbidden, type PageProps, refusal, useLoad } from '../../page';

type Outcome = 'saved' | 'failed' | 'forbidden' | 'conflict' | null;

/**
 * One customer as the old app's cards: code and name, the phone, the address on the left and the
 * note on the right. Whoever may edit orders changes the name, phone, address and note and saves
 * them over the version read, as the person's page does: a conflict, a failure or a refusal keeps
 * what was typed. The note card is drawn for whoever may edit, empty or not, else a note could
 * never be added; for a reader only when it has text. The code is not here: a new code is its
 * own act.
 */
export function CustomerPage(page: PageProps) {
  const { api, user } = page;
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const loaded = useLoad(() => api.getCustomer(id), page, [api, id]);
  const [current, setCurrent] = useState<CustomerDoc | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  // The form starts afresh from the stored customer when this changes: after a save or a reload.
  const [formKey, setFormKey] = useState(0);
  const doc = current ?? loaded.data;

  async function save(read: CustomerDoc, name: string, extra: Record<string, unknown>) {
    setSaving(true);
    setOutcome(null);
    try {
      const result = await api.saveCustomer(id, { version: read.version, name, extra });
      if (result.kind === 'conflict') {
        setOutcome('conflict');
      } else {
        setCurrent(result.doc);
        setFormKey((n) => n + 1);
        setOutcome('saved');
      }
    } catch (error) {
      refusal(error, page);
      setOutcome(isForbidden(error) ? 'forbidden' : 'failed');
    }
    setSaving(false);
  }

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {doc ? (
          <Stack gap="xs">
            <Title order={2}>{doc.customer.name}</Title>
            <Text c="dimmed">{doc.customer.code}</Text>
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
      {doc && outcome === 'saved' && (
        <Alert color="green" role="alert">
          {t('lists.customers.saved')}
        </Alert>
      )}
      {doc && (outcome === 'failed' || outcome === 'forbidden') && (
        <Alert color="red" role="alert">
          {t(outcome === 'failed' ? 'lists.customers.saveFailed' : 'lists.customers.saveForbidden')}
        </Alert>
      )}
      {doc && outcome === 'conflict' && (
        <Alert color="orange" role="alert">
          <Stack gap="xs" align="flex-start">
            {t('lists.customers.conflict')}
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
              {t('lists.customers.conflictReload')}
            </Button>
          </Stack>
        </Alert>
      )}
      {doc && (
        <CustomerForm
          key={formKey}
          doc={doc}
          editable={can(user, 'orders.canEdit')}
          saving={saving}
          onSave={(name, extra) => void save(doc, name, extra)}
        />
      )}
    </Stack>
  );
}

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
