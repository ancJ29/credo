import { createClient, ROOT_NAME } from '@credo/bff/clients';
import { hashPassword, newPassword } from '@credo/bff/password';
import { type CStorageClient, recordKeys, type StoredOperator } from '@credo/shared';
import { DEMO_CODE, DEMO_CONFIG, OPERATOR_NAME } from '@credo/shared/demo';

export { ROOT_NAME };

/** Random for each stack, so no password is written anywhere in the repository. */
export const newOperatorPassword = newPassword;

/**
 * The stack's data: the operator's account, and the demo client made by the operator's own
 * create function, with the data set's demo settings. Only hashes are stored. Every write is
 * where nothing exists, so a second run over a service stops rather than replaces it. Returns the
 * root's first password, which the create made.
 */
export async function seedDemo(
  storage: CStorageClient,
  { operatorPassword }: { operatorPassword: string },
) {
  const operator: StoredOperator = { passwordHash: await hashPassword(operatorPassword) };
  const saved = await storage.putRecord(recordKeys.operatorUser(OPERATOR_NAME), operator, null);
  const made = await createClient(storage, {
    code: DEMO_CODE,
    name: DEMO_CONFIG.name,
    settings: DEMO_CONFIG,
  });
  if (saved === 'moved' || made === 'taken') {
    throw new Error('the service already holds data: not seeded over');
  }
  return { rootPassword: made.password };
}
