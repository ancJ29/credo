import {
  type ConfirmAct,
  type Confirmation,
  clientCodeSchema,
  type CStorageClient,
  recordKeys,
  type RootPasswordReply,
  rootPasswordRoute,
  setRootPasswordRequestSchema,
  storedClientSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ROOT_NAME } from './clients';
import { HttpError, parse } from './errors';
import { hashPassword, madePassword } from './password';
import { setSignInPassword } from './staff-records';

type Deps = {
  storage: CStorageClient;
  now: () => number;
  /** The operator's live session, or a 401. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string }>;
  /** The fresh touch for an act, or a 403. */
  confirmed: (operator: { id: string }, act: ConfirmAct, confirm: Confirmation) => Promise<void>;
};

/**
 * An operator sets a client's root password anew, with a fresh touch of their own passkey. In
 * order: the operator's session (401), the code (400 if malformed, 404 if unknown, before anything
 * of the client is read), the body (400), the touch (403), then the root's sign-in record alone,
 * through the one write piece 2's person route also uses. Every session of the root ends by its
 * new generation. The answer holds the password the app made, or none.
 */
export function registerRootPasswordRoutes(
  app: FastifyInstance,
  { storage, now, operatorSignedIn, confirmed }: Deps,
) {
  app.post<{ Params: { code: string } }>(
    rootPasswordRoute(':code'),
    async (request): Promise<RootPasswordReply> => {
      const operator = await operatorSignedIn(request);
      const code = clientCodeSchema.safeParse(request.params.code);
      if (!code.success) throw new HttpError(400, 'Bad request');
      const index = await storage.getRecord(recordKeys.client(code.data));
      if (!index) throw new HttpError(404, 'Unknown client');
      const tenantId = storedClientSchema.parse(index.data).id;
      const body = parse(setRootPasswordRequestSchema, request.body);
      await confirmed(operator, 'root-password', body.confirm);
      const password = body.password ?? madePassword();
      const set = await setSignInPassword(
        storage,
        tenantId,
        ROOT_NAME,
        (user) => user.root,
        await hashPassword(password),
        now,
      );
      // A client without its root's record is a fault of the store, not a caller's to settle.
      if (set === 'not owned') throw new Error('a client’s root sign-in record is missing');
      return { made: body.password === null ? password : null };
    },
  );
}
