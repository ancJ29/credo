import {
  type CStorageClient,
  signUpReplySchema,
  signUpRequestSchema,
  SIGN_UPS_WAITING_MAX,
  signUpRoutes,
} from '@credo/shared';
import type { FastifyInstance } from 'fastify';
import { exempt } from '../audit';
import { hashPassword } from '../calling/password';
import { HttpError, parse } from '../errors';
import { addSignUp, codeIsHeld, countSignUps } from '../records/sign-ups';

type Deps = { storage: CStorageClient; now: () => number };

/**
 * A company asks for its address and root, with no session and no company: the one route anyone
 * can call that writes a record, so its limits are the whole of its defence. In this order, each
 * before the next costs anything: the body under its schema (a code by a company's rule, the
 * fields bounded, the password by the app's rule), the queue counted (at most
 * `SIGN_UPS_WAITING_MAX` wait, else 503, writing nothing), the code looked up (kept, taken, being
 * deleted or waiting: 409), then the password hashed and the request written only where none
 * sits (a rival that got there first is a 409). The request holds the hash alone, and the answer
 * names the code and nothing else. It makes no company: no index line, settings or root.
 */
export function registerSignUpRoutes(app: FastifyInstance, { storage, now }: Deps) {
  app.post(
    signUpRoutes.send,
    exempt('a sign-up makes no company and writes no client’s data: it is one waiting request'),
    async (request, reply) => {
      const body = parse(signUpRequestSchema, request.body);
      if ((await countSignUps(storage)) >= SIGN_UPS_WAITING_MAX) {
        throw new HttpError(503, 'Please try again later');
      }
      if (await codeIsHeld(storage, body.code)) throw new HttpError(409, 'That code is taken');
      const sent = await addSignUp(storage, body.code, {
        name: body.name,
        contactName: body.contactName,
        contactPhone: body.contactPhone,
        passwordHash: await hashPassword(body.password),
        sentAt: now(),
      });
      if (sent === 'taken') throw new HttpError(409, 'That code is taken');
      return reply.status(201).send(signUpReplySchema.parse({ code: body.code }));
    },
  );
}
