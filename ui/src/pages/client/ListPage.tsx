import { can, type Language } from '@credo/shared';
import {} from '@mantine/core';
import { ActionRow } from '../../components/molecules/ActionRow';
import { PageState } from '../../components/organisms/PageState';
import { useTranslation } from 'react-i18next';
import { LISTS, type ListKind } from '../../listSheet';
import { type PageProps, useLoad } from '../../page';
import { ListTable } from '../../parts/ListTable';
import { PageShell } from '../../parts/PageShell';
import { ActionButton } from '../../components/atoms/ActionButton';

/**
 * The company's customers or products as the BFF lists them, in code order, with the root's way to
 * import more from Excel and an Add for whoever may edit orders. Whoever may see orders has these pages (the root alone imports), and the
 * BFF checks the same on every call. A price is shown as the language writes a number.
 */
export function ListPage({ kind, ...page }: PageProps & { kind: ListKind }) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const list = LISTS[kind];
  const loaded = useLoad(() => list.load(api, language), page, [api, kind, language]);
  const rows = loaded.data ?? [];

  return (
    <PageShell
      title={t(`nav.${kind}`)}
      status={loaded.status}
      onRetry={loaded.reload}
      actions={
        <ActionRow>
          {page.user.root && (
            <ActionButton meaning="other" to={`/${kind}/import`}>
              {t('lists.import')}
            </ActionButton>
          )}
          {can(page.user, 'orders.canEdit') && (
            <ActionButton meaning="main" to={`/${kind}/new`}>
              {t(`lists.${kind}.newButton`)}
            </ActionButton>
          )}
        </ActionRow>
      }
    >
      {rows.length === 0 ? (
        <PageState state="empty">{t(`lists.${kind}.empty`)}</PageState>
      ) : (
        <ListTable kind={kind} shown={list.shown} rows={rows} language={language} />
      )}
    </PageShell>
  );
}
