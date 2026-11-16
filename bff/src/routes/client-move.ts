import {
  type ConfirmAct,
  type Confirmation,
  clientCodeSchema,
  type CStorageClient,
  HOME_BOX,
  moveClientRequestSchema,
  type MoveClientReply,
  moveClientRoute,
  recordKeys,
  storedClientSchema,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { declare, operatorOf } from '../audit';
import {
  beginMove,
  MOVE_WAIT_MS,
  type MoveLine,
  pressMove,
  stopMove,
} from '../records/company-move';
import { HttpError, parse } from '../errors';

type Deps = {
  storage: CStorageClient;
  /** The store of a box this back end holds, or none. */
  boxStorage: (box: string) => CStorageClient | undefined;
  now: () => number;
  /** The operator's live session, or a 401. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string; name: string }>;
  /** The fresh touch for an act, or a 403. */
  confirmed: (operator: { id: string }, act: ConfirmAct, confirm: Confirmation) => Promise<void>;
};

/**
 * An operator moves a client to another box, a press at a time. In order: the operator's session
 * (401), the code (400, or 404 if unknown), the body (400). `{ to, confirm }` begins: the box must
 * be held and not the company's own (400), the line must carry no move (409), the target's status
 * must answer (503), then the fresh touch (403), and only then the mark is written, over the tag
 * it was read under (409 if the line changed). `{}` goes on from the line and `{ stop: true }`
 * stops a copy (409 for any other line), both on the session alone: the touch was given to begin
 * the move, and any live operator may continue it. The mark, the switch and a stop each enter
 * "client moved", naming the company and both boxes; every other press enters none on purpose.
 */
export function registerMoveClientRoutes(
  app: FastifyInstance,
  { storage, boxStorage, now, operatorSignedIn, confirmed }: Deps,
) {
  /** A box this back end holds, or the logged 503 a box not held answers elsewhere. */
  const boxOf = (request: FastifyRequest) => (box: string) => {
    const held = boxStorage(box);
    if (!held) {
      request.log.error({ box }, 'a company names a box this back end does not hold');
      throw new HttpError(503, 'Service unavailable');
    }
    return held;
  };

  app.post<{ Params: { code: string } }>(
    moveClientRoute(':code'),
    { config: { audit: 'client.move' } },
    async (request): Promise<MoveClientReply> => {
      const operator = await operatorSignedIn(request);
      const code = clientCodeSchema.safeParse(request.params.code);
      if (!code.success) throw new HttpError(400, 'Bad request');
      const held = await storage.getRecord(recordKeys.client(code.data));
      if (!held) throw new HttpError(404, 'Unknown client');
      const line: MoveLine = { ...storedClientSchema.parse(held.data), tag: held.tag };
      const body = parse(moveClientRequestSchema, request.body);
      const deps = { storage, code: code.data, line, now, boxOf: boxOf(request) };
      const here = line.box ?? HOME_BOX;
      // Every press declares what it will enter, or on purpose none: a refused begin or stop is
      // entered in its refused form, a press that goes on enters only its switch.
      request.audit = [];

      if ('to' in body) {
        const entry = declare(request, operatorOf(operator), line.id, line.id);
        const target = boxStorage(body.to);
        if (body.to === here || !target) throw new HttpError(400, 'Bad request');
        if (line.move) throw new HttpError(409, 'The client is already moving');
        const reading = await target.status().catch(() => null);
        if (!reading) {
          request.log.warn({ box: body.to }, 'a box did not answer its status');
          throw new HttpError(503, 'Service unavailable');
        }
        await confirmed(operator, 'move-client', body.confirm);
        if ((await beginMove(deps, body.to)) === 'moved')
          throw new HttpError(409, 'The client changed');
        entry.saved({ code: code.data, step: 'mark', from: here, to: body.to }, null);
        return { phase: 'waiting', seconds: MOVE_WAIT_MS / 1000 };
      }

      if ('stop' in body) {
        const entry = declare(request, operatorOf(operator), line.id, line.id);
        const stopped = await stopMove(deps);
        if (stopped === 'idle') throw new HttpError(409, 'The client is not copying');
        if (stopped === 'moved') throw new HttpError(409, 'The client changed');
        entry.saved({ code: code.data, step: 'stop', from: here, to: stopped.to }, null);
        return stopped.reply;
      }

      const pressed = await pressMove(deps);
      if (pressed === 'idle') throw new HttpError(409, 'The client is not moving');
      if (pressed === 'moved') throw new HttpError(409, 'The client changed');
      if (pressed.switchedTo !== null) {
        declare(request, operatorOf(operator), line.id, line.id).saved(
          { code: code.data, step: 'switch', from: here, to: pressed.switchedTo },
          null,
        );
      }
      return pressed.reply;
    },
  );
}
