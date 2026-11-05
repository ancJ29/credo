import { Alert, Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { DetailCard, DetailColumns, FieldPair } from './DetailCards';
import { Loaded } from './Loaded';
import { textIn } from './listSheet';
import { type PageProps, useLoad } from './page';

/**
 * One product as the old app's cards: code and name, the unit and the price, whether its stock is
 * kept on the left, and the note on the right, drawn only when the product has one. Read only: the
 * page reads the products' list, as the list page does, and picks its id.
 */
export function ProductPage(page: PageProps) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const loaded = useLoad(() => api.listProducts(), page, [api]);
  const product = (loaded.data ?? []).find((one) => one.id === id);
  const note = textIn(product?.extra['note']);

  return (
    <Stack gap="lg">
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {product ? (
          <Stack gap="xs">
            <Title order={2}>{product.name}</Title>
            <Text c="dimmed">{product.code}</Text>
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
      {product && (
        <DetailColumns
          main={
            <Stack gap="lg">
              <DetailCard title={t('lists.products.basic')}>
                <FieldPair>
                  <TextInput label={t('lists.columns.code')} readOnly value={product.code} />
                  <TextInput label={t('lists.columns.name')} readOnly value={product.name} />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.products.unitPrice')}>
                <FieldPair>
                  <TextInput label={t('lists.columns.unit')} readOnly value={product.unit} />
                  <TextInput
                    label={t('lists.columns.price')}
                    readOnly
                    value={new Intl.NumberFormat(i18n.language).format(product.price)}
                  />
                </FieldPair>
              </DetailCard>
              <DetailCard title={t('lists.products.stock')}>
                <TextInput
                  label={t('lists.columns.stocked')}
                  readOnly
                  value={t(product.stocked ? 'lists.yes' : 'lists.no')}
                />
              </DetailCard>
            </Stack>
          }
          // undefined, never `false`: only a missing side lets the details take the full width
          side={
            note ? (
              <DetailCard title={t('lists.products.note')}>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{note}</Text>
              </DetailCard>
            ) : undefined
          }
        />
      )}
    </Stack>
  );
}
