import type { ConfirmAct, Confirmation } from '@credo/shared';
import type { Api } from './api';
import type { Passkeys } from './passkeys';

/** The fresh touch of a passkey the operator already holds, asked for before the act it allows: a
 * session alone does not add or remove a passkey, or set a client's root password. */
export async function touch(
  api: Pick<Api, 'operatorPasskeyConfirmOptions'>,
  passkeys: Passkeys,
  act: ConfirmAct,
): Promise<Confirmation> {
  const { options, token } = await api.operatorPasskeyConfirmOptions(act);
  return { token, response: await passkeys.authenticate(options) };
}
