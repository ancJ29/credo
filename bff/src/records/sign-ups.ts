import {
  type CStorageClient,
  KEPT_CODES,
  recordKeys,
  type StoredSignUp,
  storedSignUpSchema,
} from '@credo/shared';
import { recordTools } from './records';

/** A company's sign-up waiting for an operator: one record under its code, beside the client index
 * and never a company, so no company route reaches it. These are its reads and its one write. */

/** Whether a code is spoken for: kept back for the app's own address, a company's, one whose
 * deletion is unfinished, or one a request already waits on. Any of these refuses a new request and
 * the operator's own add alike. */
export async function codeIsHeld(storage: CStorageClient, code: string): Promise<boolean> {
  if (KEPT_CODES.includes(code)) return true;
  if (await storage.getRecord(recordKeys.client(code))) return true;
  if (await storage.getRecord(recordKeys.clientDeletion(code))) return true;
  return (await storage.getRecord(recordKeys.signUp(code))) !== null;
}

/** How many requests wait: every record under the prefix, never a short count. */
export async function countSignUps(storage: CStorageClient): Promise<number> {
  const all = await recordTools(storage).every(
    recordKeys.signUpPrefix,
    storedSignUpSchema,
    'sign-up',
  );
  return all.length;
}

/** A request, written only where none sits under its code: `moved` is a rival that got there first,
 * so two sign-ups of one code leave one. */
export async function addSignUp(
  storage: CStorageClient,
  code: string,
  request: StoredSignUp,
): Promise<'sent' | 'taken'> {
  return (await storage.putRecord(recordKeys.signUp(code), request, null)) === 'saved'
    ? 'sent'
    : 'taken';
}
