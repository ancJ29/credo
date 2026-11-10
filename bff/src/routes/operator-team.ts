import {
  addedNewestFirst,
  type AddOperatorReply,
  addOperatorRequestSchema,
  type ConfirmAct,
  type Confirmation,
  type CStorageClient,
  deleteOperatorRequestSchema,
  joinLinkPath,
  operatorLinkRequestSchema,
  type OperatorLinkReply,
  operatorRoutes,
  type OperatorItem,
  type OperatorListReply,
  ROUTES,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError, parse } from '../errors';
import {
  createOperator,
  deleteOperator,
  makeLink,
  readAccount,
  readRoster,
} from '../records/operators';

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
 *
 * A new link (`POST` on the operator's `/link`): the body (400), the target not oneself (403), the
 * touch for `operator-link` (403), then a link for them, `join` while they are invited and
 * `replace` once active, whose use alone replaces their passkeys and ends their sessions; 404 for
 * an operator who is not there. It removes nothing when made.
 *
 * The delete (`DELETE` on the operator): the same checks for `delete-operator`, then the operator
 * and what they held go (204). Of two deleting each other at once, one stays and the other is
 * a 401; a target already gone is a 404.
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

  app.post<{ Params: { id: string } }>(
    operatorRoutes.link(':id'),
    async (request, reply): Promise<OperatorLinkReply> => {
      const operator = await operatorSignedIn(request);
      const body = parse(operatorLinkRequestSchema, request.body);
      if (request.params.id === operator.id) throw new HttpError(403, 'Forbidden');
      await confirmed(operator, 'operator-link', body.confirm);
      const line = (await readRoster(storage)).roster.operators.find(
        (one) => one.id === request.params.id,
      );
      const token =
        line &&
        (await makeLink(storage, {
          operatorId: line.id,
          kind: line.state === 'invited' ? 'join' : 'replace',
          madeBy: operator.id,
          now: now(),
        }));
      if (!token) throw new HttpError(404, 'Not found');
      void reply.status(201);
      return { link: joinLinkPath(token) };
    },
  );

  app.delete<{ Params: { id: string } }>(operatorRoutes.one(':id'), async (request, reply) => {
    const operator = await operatorSignedIn(request);
    const body = parse(deleteOperatorRequestSchema, request.body);
    if (request.params.id === operator.id) throw new HttpError(403, 'Forbidden');
    await confirmed(operator, 'delete-operator', body.confirm);
    const outcome = await deleteOperator(storage, {
      actorId: operator.id,
      targetId: request.params.id,
    });
    if (outcome === 'actor') throw new HttpError(401, 'Unauthorized');
    if (outcome === 'target') throw new HttpError(404, 'Not found');
    return await reply.status(204).send();
  });
}
