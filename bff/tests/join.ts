import type { FastifyInstance } from 'fastify';
import { joinOptionsReplySchema, operatorSessionReplySchema } from '@credo/shared';
import { SoftwareAuthenticator } from './authenticator';

/** An operator joins by their link with a software authenticator, through the app's own routes,
 * as a browser would: the options, then the passkey made. Answers the session and the
 * authenticator, which signs in again. */
export async function joinByLink(
  app: Pick<FastifyInstance, 'inject'>,
  token: string,
  origin: string,
  device = 'device-aaaa-0001',
) {
  const opened = await app.inject({
    method: 'POST',
    url: '/api/operator/join/options',
    payload: { link: token },
  });
  const reply = joinOptionsReplySchema.parse(opened.json());
  const authenticator = new SoftwareAuthenticator(origin);
  const joined = await app.inject({
    method: 'POST',
    url: '/api/operator/join',
    headers: { 'x-device-id': device },
    payload: {
      link: token,
      token: reply.token,
      response: authenticator.register(reply.options as never),
    },
  });
  return { session: operatorSessionReplySchema.parse(joined.json()), authenticator };
}
