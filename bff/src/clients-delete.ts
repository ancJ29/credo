import {
  type ConfirmAct,
  type Confirmation,
  clientCodeSchema,
  clientDeleteRoute,
  type CStorageClient,
  type DeleteClientReply,
  deleteClientRequestSchema,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { deleteClient } from './clients';
import { HttpError, parse } from './errors';

type Deps = {
  storage: CStorageClient;
  now: () => number;
  /** The operator's live session, or a 401. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string }>;
  /** The fresh touch for an act, or a 403. */
  confirmed: (operator: { id: string }, act: ConfirmAct, confirm: Confirmation) => Promise<void>;
};

/**
 * An operator deletes a client whole, with a fresh touch of their own passkey. Every check comes
 * before any write, in the order the root password's route keeps: the operator's session (401), the
 * code (400 if malformed), the index (404 if none and no deletion in progress, before anything of
 * the client is read), the body (400), the touch (403). Then `deleteClient` writes. A press after
 * the index is gone finds a deletion in progress and resumes it on the session alone: the touch
 * was given to begin it. The answer says how many records are left; zero is done.
 */
export function registerDeleteClientRoutes(
  app: FastifyInstance,
  { storage, now, operatorSignedIn, confirmed }: Deps,
) {
  app.delete<{ Params: { code: string } }>(
    clientDeleteRoute(':code'),
    async (request): Promise<DeleteClientReply> => {
      const operator = await operatorSignedIn(request);
      const code = clientCodeSchema.safeParse(request.params.code);
      if (!code.success) throw new HttpError(400, 'Bad request');
      const held = await storage.getRecord(recordKeys.client(code.data));
      const index = held ? storedClientSchema.parse(held.data) : null;
      if (index) {
        const body = parse(deleteClientRequestSchema, request.body);
        await confirmed(operator, 'delete-client', body.confirm);
      }
      const done = await deleteClient(storage, { code: code.data, index, by: operator.id, now });
      if (done === 'unknown') throw new HttpError(404, 'Unknown client');
      return done;
    },
  );
}
