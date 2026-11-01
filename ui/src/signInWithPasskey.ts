import type { OperatorSessionReply } from '@credo/shared';
import { type Api, ApiError, type Hop, hopOf } from './api';
import { PasskeyNotGiven, type Passkeys } from './passkeys';

/** How a passkey sign-in ended, in the words a page needs: signed in, the passkey not given, a
 * passkey that opens nothing here, or the service unavailable, at the BFF or at its storage when the BFF's call says which. */
export type PasskeySignIn =
  | { kind: 'in'; session: OperatorSessionReply }
  | { kind: 'notGiven' }
  | { kind: 'refused' }
  | { kind: 'unavailable'; hop?: Hop };

/** The sign-in's whole ceremony: options, the device's touch, the answer. Only the device's
 * "not given" and the BFF's 401 are told apart from the service failing, since a failure of the
 * service must never read as "no passkey". */
export async function signInWithPasskey(api: Api, passkeys: Passkeys): Promise<PasskeySignIn> {
  try {
    const { options, token } = await api.operatorPasskeyOptions();
    const response = await passkeys.authenticate(options);
    return { kind: 'in', session: await api.operatorPasskeySignIn({ token, response }) };
  } catch (error) {
    if (error instanceof PasskeyNotGiven) return { kind: 'notGiven' };
    if (error instanceof ApiError && error.status === 401) return { kind: 'refused' };
    // A failure that is not the BFF's answer, the device's own, names no hop.
    return { kind: 'unavailable', hop: error instanceof ApiError ? hopOf(error) : undefined };
  }
}
