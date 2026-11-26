import {
  clientAddress,
  CLIENT_HEADER,
  clientCodeSchema,
  deviceNameOf,
  ownPasskeyAddRequestSchema,
  type OwnPasskeyListReply,
  type StoredOwnPasskey,
  type StoredUser,
  passkeySignInRequestSchema,
  sha256Hex,
  type SessionReplyBody,
  signInRoutes,
  staffConfig,
} from '@credo/shared';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { z } from 'zod';
import { declare, type Entry, exempt, personOf } from '../audit';
import { createChallenges } from '../calling/challenge';
import {
  authenticationOptions,
  registrationOptions,
  relyingOn,
  storedPasskey,
  verifiedAuthentication,
  verifiedRegistration,
} from '../calling/passkeys';
import { HttpError, parse } from '../errors';
import {
  addOwnPasskey,
  readOwnPasskeys,
  removeOwnPasskey,
  spendOwnPasskey,
} from '../records/passkeys';
import { readSetup } from '../records/staff-records';

/** How long after its issue a session may still add a passkey: a first passkey has nothing to
 * touch, so the sign-in itself must be recent. */
const ADD_FRESH_MS = 10 * 60 * 1000;

/** The user handle a passkey keeps is the person's minted id, or the company's own for the root:
 * a UUID, read under a schema so anything else is the one 401 and never a record key. */
const handleSchema = z.uuid();
const unauthorized = () => new HttpError(401, 'Unauthorized');

/** What the routes read of a signed-in person: who they are, when the session was issued, and the
 * sign-in record the new generation is written over. */
type Signed = {
  name: string;
  employeeId: string | null;
  issuedAt: number;
  signIn: { user: StoredUser };
};

type Deps<Who extends Signed> = {
  now: () => number;
  /** The address the operator opens (`APP_ORIGIN`), from which a company's own is made. */
  origin: string;
  /** The BFF's own service key, which the challenges are signed under. */
  serviceKey: string;
  forClient: { onRequest: (request: FastifyRequest) => Promise<void> };
  /** The person the session names, with the time it was issued; the root has no employee id. */
  signedIn: (request: FastifyRequest) => Promise<Who>;
  /** The device a call names, a 400 where it names none. */
  deviceOf: (request: FastifyRequest) => string;
  /** The session a passkey's handle is to be signed in with, or null where it names no person who
   * may sign in (the root, or a person there, not archived and still named by their sign-in
   * record); the session is issued as a password's is, when the closure is called. */
  holder: (
    request: FastifyRequest,
    handle: string,
  ) => Promise<(() => Promise<SessionReplyBody>) | null>;
  /** The person's sign-in record written anew, ending their other sessions, and the session that
   * replaces the one this device held: as a password change does. */
  renewed: (
    request: FastifyRequest,
    who: Who,
    device: string,
    entry: Entry,
    changed: StoredUser,
  ) => Promise<SessionReplyBody>;
};

/** A passkey as its owner is shown it: no secret, and no device where none was named. */
const itemOf = (passkey: StoredOwnPasskey) => ({
  id: passkey.id,
  device: passkey.device ?? null,
  addedAt: passkey.addedAt,
  lastUsedAt: passkey.lastUsedAt,
});

/**
 * A company's person adds their own passkey: the options, then the add, both behind a session and
 * the company's switch (404 where passkeys are off, the root's too). The add takes a session issued
 * in the last ten minutes, else a 403. The ceremony is checked against the company's own address,
 * made from `APP_ORIGIN` and the code the call names, never the request's host. A person's passkeys
 * are one record under their id (the company's own for the root).
 */
export function registerOwnPasskeyRoutes<Who extends Signed>(
  app: FastifyInstance,
  { now, origin, serviceKey, forClient, signedIn, deviceOf, holder, renewed }: Deps<Who>,
) {
  const challenges = createChallenges({ serviceKey, now });

  /** The company's own address as a browser opens it: the origin of `clientAddress`. */
  const relyingOf = (request: FastifyRequest) =>
    relyingOn(
      new URL(clientAddress(origin, clientCodeSchema.parse(request.headers[CLIENT_HEADER]))).origin,
    );

  /** A 404 where the company has passkeys switched off. */
  async function mustBeOn(request: FastifyRequest) {
    if (!(await isOn(request))) throw new HttpError(404, 'Not found');
  }

  /** Whether the company has passkeys on. */
  async function isOn(request: FastifyRequest) {
    const { setup } = await readSetup(request.storage, request.tenantId);
    return staffConfig(setup).fields.passkey;
  }

  app.post(
    signInRoutes.passkeyOptions,
    exempt('a sign-in changes no client’s data', forClient),
    async (request) => {
      await mustBeOn(request);
      const options = await authenticationOptions(relyingOf(request));
      return { options, token: challenges.mint(options.challenge, 'sign-in', request.tenantId) };
    },
  );

  /**
   * A passkey signs in the person it was made for, nothing typed. Every refusal is the same 401:
   * no company switch on, a challenge spent, ended or made for another company or purpose, a handle
   * naming no person who may sign in, a passkey the person does not hold, an answer the library
   * refuses. The challenge is spent and the counter moved in one write over the record's tag, before
   * the session is issued.
   */
  app.post(
    signInRoutes.passkeySignIn,
    exempt('a sign-in changes no client’s data', forClient),
    async (request): Promise<SessionReplyBody> => {
      deviceOf(request);
      const body = parse(passkeySignInRequestSchema, request.body);
      const answer = body.response as unknown as AuthenticationResponseJSON;
      const challenge = challenges.open(body.token, 'sign-in', request.tenantId);
      const given = z.string().safeParse(answer.response.userHandle);
      const handle = handleSchema.safeParse(
        given.success ? Buffer.from(given.data, 'base64url').toString() : '',
      );
      if (!challenge || !handle.success || !(await isOn(request))) throw unauthorized();
      const issue = await holder(request, handle.data);
      if (!issue) throw unauthorized();
      const relying = relyingOf(request);
      const spent = await spendOwnPasskey(
        request.storage,
        request.tenantId,
        handle.data,
        answer.id,
        await sha256Hex(challenge),
        now,
        (passkey) => verifiedAuthentication(relying, answer, challenge, passkey),
      );
      if (spent === 'refused') throw unauthorized();
      return await issue();
    },
  );

  app.post(
    signInRoutes.ownPasskeyOptions,
    exempt('a passkey’s options change no client’s data', forClient),
    async (request) => {
      const who = await signedIn(request);
      await mustBeOn(request);
      const handle = who.employeeId ?? request.tenantId;
      const held = await readOwnPasskeys(request.storage, request.tenantId, handle);
      const options = await registrationOptions(
        relyingOf(request),
        { id: handle, name: who.name },
        held?.record.passkeys ?? [],
      );
      return {
        options,
        token: challenges.mint(options.challenge, 'own-add', `${request.tenantId}.${handle}`),
      };
    },
  );

  app.post(
    signInRoutes.ownPasskeyAdd,
    { ...forClient, config: { audit: 'employee.passkey' } },
    async (request, reply) => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who));
      await mustBeOn(request);
      if (now() - who.issuedAt > ADD_FRESH_MS) throw new HttpError(403, 'Forbidden');
      const handle = who.employeeId ?? request.tenantId;
      const body = parse(ownPasskeyAddRequestSchema, request.body);
      const challenge = challenges.open(body.token, 'own-add', `${request.tenantId}.${handle}`);
      if (!challenge) throw new HttpError(400, 'Bad request');
      const credential = await verifiedRegistration(relyingOf(request), body.response, challenge);
      if (!credential) throw new HttpError(400, 'Bad request');
      const outcome = await addOwnPasskey(request.storage, request.tenantId, handle, {
        ...storedPasskey(credential, now()),
        device: deviceNameOf(request.headers['user-agent']),
      });
      if (outcome === 'duplicate') throw new HttpError(400, 'Bad request');
      entry.saved(null, null);
      return reply.status(201).send();
    },
  );

  app.get(
    signInRoutes.ownPasskeys,
    exempt('a list changes no client’s data', forClient),
    async (request): Promise<OwnPasskeyListReply> => {
      const who = await signedIn(request);
      await mustBeOn(request);
      const held = await readOwnPasskeys(
        request.storage,
        request.tenantId,
        who.employeeId ?? request.tenantId,
      );
      return { passkeys: (held?.record.passkeys ?? []).map(itemOf) };
    },
  );

  /**
   * One's own passkey removed, by the session alone: an add can let a thief in, a removal only takes
   * a way in away, and the password stays. The passkey goes first, so a failure after leaves it
   * refused; then the sign-in record's new generation ends every other session of the person, and
   * this device gets the one that replaces its own. A passkey the person does not hold is a 404.
   */
  app.delete(
    signInRoutes.ownPasskey(':id'),
    { ...forClient, config: { audit: 'employee.passkeyRemove' } },
    async (
      request,
    ): Promise<{ passkeys: OwnPasskeyListReply['passkeys']; session: SessionReplyBody }> => {
      const who = await signedIn(request);
      const entry = declare(request, personOf(who));
      const device = deviceOf(request);
      await mustBeOn(request);
      const { id } = parse(z.object({ id: z.string().max(1024) }), request.params);
      const left = await removeOwnPasskey(
        request.storage,
        request.tenantId,
        who.employeeId ?? request.tenantId,
        id,
      );
      if (left === null) throw new HttpError(404, 'Not found');
      const session = await renewed(request, who, device, entry, {
        ...who.signIn.user,
        generation: randomUUID(),
      });
      return { passkeys: left.map(itemOf), session };
    },
  );
}
