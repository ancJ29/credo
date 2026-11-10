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
import { declare, operatorOf } from '../audit';
import { deleteClient } from '../records/clients';
import { HttpError, parse } from '../errors';

type Deps = {
  storage: CStorageClient;
  now: () => number;
  /** The operator's live session, or a 401. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string; name: string }>;
  /** The fresh touch for an act, or a 403. */
  confirmed: (operator: { id: string }, act: ConfirmAct, confirm: Confirmation) => Promise<void>;
};

/**
 * An operator deletes a client whole, with a fresh touch of their own passkey. Every check comes
 * before any write, in the order the root password's route keeps: the operator's session (401), the
 * code (400 if malformed), the index, the body (400), the touch (403). With an index, the body and
 * the touch come next; with none, the deletion record is read, and with none of that either the
 * answer is 404 (so a malformed body on an unknown code is a 404, nothing written). Then
 * `deleteClient` writes, only over the index and the deletion record as they were read (409 if
 * either moved). A press after the index is gone resumes a deletion in progress on the session
 * alone: the touch was given to begin it, and any live operator may continue it. The answer says
 * how many records are left; zero is done.
 */
export function registerDeleteClientRoutes(
  app: FastifyInstance,
  { storage, now, operatorSignedIn, confirmed }: Deps,
) {
  app.delete<{ Params: { code: string } }>(
    clientDeleteRoute(':code'),
    { config: { audit: 'client.delete' } },
    async (request): Promise<DeleteClientReply> => {
      const operator = await operatorSignedIn(request);
      const code = clientCodeSchema.safeParse(request.params.code);
      if (!code.success) throw new HttpError(400, 'Bad request');
      const held = await storage.getRecord(recordKeys.client(code.data));
      const index = held ? { ...storedClientSchema.parse(held.data), tag: held.tag } : null;
      // From here the client is known, so a refusal of the body or the touch is on its record. A
      // press after the index is gone resumes the deletion and has no client to name.
      const entry = index ? declare(request, operatorOf(operator), index.id, index.id) : null;
      if (!entry) request.audit = []; // declared on purpose: no client to name
      if (index) {
        const body = parse(deleteClientRequestSchema, request.body);
        await confirmed(operator, 'delete-client', body.confirm);
      }
      const done = await deleteClient(storage, { code: code.data, index, by: operator.id, now });
      if (done === 'unknown') throw new HttpError(404, 'Unknown client');
      if (done === 'busy' || done === 'moved') throw new HttpError(409, 'The client changed');
      entry?.saved({ code: code.data }, null);
      return done;
    },
  );
}
