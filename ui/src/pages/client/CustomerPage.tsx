import type { PageProps } from '../../page';
import { RecordPage } from './RecordPage';

/** One customer: the record page of the customers kind. */
export function CustomerPage(page: PageProps) {
  return <RecordPage kind="customers" {...page} />;
}
