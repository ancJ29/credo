import type { LightMyRequestResponse } from 'fastify';
import {
  type ConfirmAct,
  type CStorageClient,
  joinOptionsReplySchema,
  operatorSessionReplySchema,
  optionsReplySchema,
} from '@credo/shared';
import { createOperator } from '../src/operators';
import { SoftwareAuthenticator } from './authenticator';
import { DEVICE, ORIGIN, type bffOn, withAuth } from './tenant';

type T = Awaited<ReturnType<typeof bffOn>>;
type App = T['app'];

const headers = (device: string, extra: Record<string, string> = {}) => ({
  'x-device-id': device,
  ...extra,
});

export const post = (app: App, url: string, payload?: unknown, authId?: string, device = DEVICE) =>
  app.inject({
    method: 'POST',
    url,
    headers: headers(device, authId ? withAuth(authId) : {}),
    payload: payload as object,
  });

/** An operator and their live link, written as the terminal writes them: the account, the link,
 * and the roster last. */
export async function inviteOperator(
  t: T,
  name = 'operator',
  addedBy: string | null = null,
  storage: CStorageClient = t.client,
) {
  const made = await createOperator(storage, { name, addedBy, now: t.time.now() });
  if (made === 'taken') throw new Error('the operator is taken');
  return made;
}

/** Opens a link and answers its options with a passkey made by `authenticator`: the join. */
export async function joinWith(
  t: T,
  token: string,
  authenticator = new SoftwareAuthenticator(ORIGIN),
  claim: Parameters<SoftwareAuthenticator['register']>[1] = {},
  device = DEVICE,
) {
  const opened = await post(t.app, '/api/operator/join/options', { link: token });
  if (opened.statusCode !== 200) return { opened, joined: opened, authenticator };
  const reply = joinOptionsReplySchema.parse(opened.json());
  const joined = await post(
    t.app,
    '/api/operator/join',
    {
      link: token,
      token: reply.token,
      response: authenticator.register(reply.options as never, claim),
    },
    undefined,
    device,
  );
  return { opened, joined, authenticator };
}

/** A signed-in operator: invited, joined by their link with a software authenticator. */
export async function joinedOperator(t: T, name = 'operator', addedBy: string | null = null) {
  const { id, token } = await inviteOperator(t, name, addedBy);
  const { joined, authenticator } = await joinWith(t, token);
  const session = operatorSessionReplySchema.parse(joined.json());
  return { id, name, authenticator, authId: session.authId, session };
}

/** The sign-in options, then the answer `authenticator` gives, sent. */
export async function signInWith(
  t: T,
  authenticator: SoftwareAuthenticator,
  claim: Parameters<SoftwareAuthenticator['authenticate']>[1] = {},
  device = DEVICE,
) {
  const reply = optionsReplySchema.parse(
    (await post(t.app, '/api/operator/passkey/options')).json(),
  );
  const response = authenticator.authenticate(reply.options, claim);
  const sent = await post(
    t.app,
    '/api/operator/passkey/sign-in',
    { token: reply.token, response },
    undefined,
    device,
  );
  return { sent, reply, response };
}

/** The count of every record under the operator's keys, for "an options call writes nothing". */
export async function operatorRecords(t: T) {
  const prefixes = ['operator.'];
  const all = await Promise.all(prefixes.map((p) => t.client.listRecords(p)));
  return all.flatMap((list) => list.records.map((record) => `${record.key}@${record.tag}`)).sort();
}

export const session = (response: LightMyRequestResponse) =>
  operatorSessionReplySchema.parse(response.json());

/** The fresh touch an add, a remove or a client's root password needs: the confirm options for the
 * act, answered by `authenticator` as a sign-in is. */
export async function touchFor(
  t: T,
  authId: string,
  authenticator: SoftwareAuthenticator,
  act: ConfirmAct,
  claim: Parameters<SoftwareAuthenticator['authenticate']>[1] = {},
) {
  const reply = optionsReplySchema.parse(
    (await post(t.app, '/api/operator/passkeys/confirm-options', { act }, authId)).json(),
  );
  return { token: reply.token, response: authenticator.authenticate(reply.options, claim) };
}

/** A remove of the passkey `id`, with a touch of `authenticator` as it must. */
export async function removeWith(
  t: T,
  authId: string,
  authenticator: SoftwareAuthenticator,
  id: string,
) {
  const confirm = await touchFor(t, authId, authenticator, 'remove');
  return t.app.inject({
    method: 'DELETE',
    url: `/api/operator/passkeys/${id}`,
    headers: withAuth(authId),
    payload: { confirm },
  });
}
