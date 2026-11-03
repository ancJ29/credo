import {
  addedNewestFirst,
  type AddOperatorReply,
  addOperatorRequestSchema,
  type ConfirmAct,
  type Confirmation,
  type CStorageClient,
  joinLinkPath,
  type OperatorItem,
  type OperatorListReply,
  ROUTES,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError, parse } from './errors';
import { createOperator, readAccount, readRoster } from './operators';

type Deps = {
  storage: CStorageClient;
  now: () => number;
  /** The operator's live session, or a 401. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string }>;
  /** The fresh touch for an act, or a 403. */
  confirmed: (operator: { id: string }, act: ConfirmAct, confirm: Confirmation) => Promise<void>;
};

/**
 * The operators, listed and added. Both routes are for an operator's live session (401) and read
 * or write the operators' own records alone, never a client's.
 *
 * The list: each line of the roster with its account's passkey count and last sign-in (the
 * account's `signedInAt`, never a passkey's `lastUsedAt`, which every touch moves), who added them
 * by name (none once that operator is deleted, `addedByTerminal` true for the command line's), and
 * the reader marked. The one added last comes first.
 *
 * The add: the body (400), the touch for `add-operator` (403), then the operator, invited, with a
 * join link that the answer alone holds (201); a name already there, compared trimmed and
 * without case, is a 409. No mail is sent and the link is never logged.
 */
export function registerOperatorTeamRoutes(
  app: FastifyInstance,
  { storage, now, operatorSignedIn, confirmed }: Deps,
) {
  app.get(ROUTES.operatorOperators, async (request, reply): Promise<OperatorListReply> => {
    const reader = await operatorSignedIn(request);
    const { roster } = await readRoster(storage);
    const operators: OperatorItem[] = await Promise.all(
      roster.operators.map(async (one) => {
        const held = await readAccount(storage, one.id);
        return {
          id: one.id,
          name: one.name,
          state: one.state,
          addedBy: roster.operators.find((adder) => adder.id === one.addedBy)?.name ?? null,
          addedByTerminal: one.addedBy === null,
          addedAt: one.addedAt,
          passkeys: held?.account.passkeys.length ?? 0,
          signedInAt: held?.account.signedInAt ?? null,
          you: one.id === reader.id,
        };
      }),
    );
    void reply.header('cache-control', 'no-store');
    return { operators: operators.sort(addedNewestFirst) };
  });

  app.post(ROUTES.operatorOperators, async (request, reply): Promise<AddOperatorReply> => {
    const operator = await operatorSignedIn(request);
    const body = parse(addOperatorRequestSchema, request.body);
    await confirmed(operator, 'add-operator', body.confirm);
    const made = await createOperator(storage, {
      name: body.name,
      addedBy: operator.id,
      now: now(),
    });
    if (made === 'taken') throw new HttpError(409, 'That name is taken');
    void reply.status(201);
    return { id: made.id, link: joinLinkPath(made.token) };
  });
}
