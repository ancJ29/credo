import {
  type CStorageClient,
  clientLinkPath,
  recordKeys,
  signUpReplySchema,
  signUpRequestSchema,
  SIGN_UPS_WAITING_MAX,
  signUpRoutes,
  storedSignUpSchema,
  type SignUpApprovedReply,
  type SignUpListReply,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { declare, exempt, operatorOf } from '../audit';
import { hashPassword } from '../calling/password';
import { HttpError, parse } from '../errors';
import { createClientFromSignUp } from '../records/clients';
import { recordTools } from '../records/records';
import { addSignUp, codeIsHeld, countSignUps } from '../records/sign-ups';

type Deps = {
  storage: CStorageClient;
  now: () => number;
  /** The signed-in operator a call names, a 401 where it names none: an operator's session, never a
   * company's. */
  operatorSignedIn: (request: FastifyRequest) => Promise<{ id: string; name: string }>;
};

/** The code a request waits under, read off its key. */
const codeOf = (key: string) => key.slice(recordKeys.signUpPrefix.length);

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
export function registerSignUpRoutes(
  app: FastifyInstance,
  { storage, now, operatorSignedIn }: Deps,
) {
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

  /** The waiting requests, oldest first, for the operator: each with its code and no hash. */
  app.get(
    signUpRoutes.list,
    exempt('a list changes no client’s data'),
    async (request): Promise<SignUpListReply> => {
      await operatorSignedIn(request);
      const all = await recordTools(storage).every(
        recordKeys.signUpPrefix,
        storedSignUpSchema,
        'sign-up',
      );
      return {
        signUps: all
          .map(({ key, record }) => ({
            code: codeOf(key),
            name: record.name,
            contactName: record.contactName,
            contactPhone: record.contactPhone,
            sentAt: record.sentAt,
          }))
          .sort((a, b) => a.sentAt - b.sentAt || a.code.localeCompare(b.code)),
      };
    },
  );

  /**
   * An approval makes the company as the operator's add does, but with the root's password hash the
   * request carries, unchanged, so no password is minted or answered; then the request goes. A code
   * made meanwhile is a 409 and the request stays for a refusal. The entry is the add's, "client
   * made", naming the new company and no password. A request that fails to go after the company is
   * made is a harmless leftover: its code is the company's now, so no one can ask it again.
   */
  app.post(
    signUpRoutes.approve(':code'),
    { config: { audit: 'client.create' } },
    async (request, reply): Promise<SignUpApprovedReply> => {
      const operator = await operatorSignedIn(request);
      const { code } = request.params as { code: string };
      const key = recordKeys.signUp(code);
      const waiting = await storage.getRecord(key);
      if (!waiting) throw new HttpError(404, 'Not found');
      const asked = storedSignUpSchema.parse(waiting.data);
      const made = await createClientFromSignUp(
        storage,
        { code, name: asked.name, madeAt: now() },
        asked.passwordHash,
      );
      if (made === 'taken') throw new HttpError(409, 'That code is taken');
      declare(request, operatorOf(operator), made.id, made.id).saved(null, {
        code,
        name: asked.name,
      });
      await storage.removeRecord(key, waiting.tag);
      return reply.status(200).send({ link: clientLinkPath(code) });
    },
  );

  /** A refusal removes the request and frees its address: nothing of a company was ever written. */
  app.delete(
    signUpRoutes.one(':code'),
    exempt('a refused request names no client: it is one waiting request, and no company'),
    async (request, reply) => {
      await operatorSignedIn(request);
      const { code } = request.params as { code: string };
      const key = recordKeys.signUp(code);
      const waiting = await storage.getRecord(key);
      if (!waiting) throw new HttpError(404, 'Not found');
      await storage.removeRecord(key, waiting.tag);
      return reply.status(204).send();
    },
  );
}
