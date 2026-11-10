import type { PageProps } from '../../page';
import { RecordPage } from './RecordPage';

/** One product: the record page of the products kind. */
export function ProductPage(page: PageProps) {
  return <RecordPage kind="products" {...page} />;
}
