import { recordKeys } from '@credo/shared';
import { z } from 'zod';
import { recordTools, type TenantStorage } from './records';

/** How many writes of a copy run at once, as the deletion sweep's removals do. */
const COPY_AT_ONCE = 20;

/**
 * Copies one company's records from one box to another: every record under the company's prefix
 * on `from` is written into `to`, page after page. Both are company clients, so neither reaches
 * another company's records. The source is only read; a record is copied as stored, its meaning
 * being the route modules'.
 */
export async function copyCompany(from: TenantStorage, to: TenantStorage) {
  const records = await recordTools(from).every(
    recordKeys.tenant(from.tenantId).all,
    z.unknown(),
    'company',
  );
  for (let at = 0; at < records.length; at += COPY_AT_ONCE) {
    await Promise.all(
      records.slice(at, at + COPY_AT_ONCE).map(({ key, record }) => to.putRecord(key, record)),
    );
  }
  return { copied: records.length };
}
