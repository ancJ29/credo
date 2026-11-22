import { useTranslation } from 'react-i18next';
import { PageState } from '../../components/organisms/PageState';

/** A page that is only words: a 403 page, or the page for someone no page is open to yet. */
export function Notice({ kind }: { kind: 'forbidden' | 'nothing' }) {
  const { t } = useTranslation();
  return (
    <PageState state={kind} title={t(kind === 'forbidden' ? 'forbidden.title' : 'nothing.title')}>
      {t(kind === 'forbidden' ? 'forbidden.text' : 'nothing.text')}
    </PageState>
  );
}
