import {
  clientAddress,
  CLIENT_HEADER,
  clientCodeSchema,
  ownPasskeyAddRequestSchema,
  signInRoutes,
  staffConfig,
} from '@credo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { declare, exempt, personOf } from '../audit';
import { createChallenges } from '../calling/challenge';
import {
  registrationOptions,
  relyingOn,
  storedPasskey,
  verifiedRegistration,
} from '../calling/passkeys';
import { HttpError, parse } from '../errors';
import { addOwnPasskey, readOwnPasskeys } from '../records/passkeys';
import { readSetup } from '../records/staff-records';

/** How long after its issue a session may still add a passkey: a first passkey has nothing to
 * touch, so the sign-in itself must be recent. */
const ADD_FRESH_MS = 10 * 60 * 1000;

type Deps = {
  now: () => number;
  /** The address the operator opens (`APP_ORIGIN`), from which a company's own is made. */
  origin: string;
  /** The BFF's own service key, which the challenges are signed under. */
  serviceKey: string;
  forClient: { onRequest: (request: FastifyRequest) => Promise<void> };
  /** The person the session names, with the time it was issued; the root has no employee id. */
  signedIn: (request: FastifyRequest) => Promise<{
    name: string;
    employeeId: string | null;
    issuedAt: number;
  }>;
};

/**
 * A company's person adds their own passkey: the options, then the add, both behind a session and
 * the company's switch (404 where passkeys are off, the root's too). The add takes a session issued
 * in the last ten minutes, else a 403. The ceremony is checked against the company's own address,
 * made from `APP_ORIGIN` and the code the call names, never the request's host. A person's passkeys
 * are one record under their id (the company's own for the root).
 */
export function registerOwnPasskeyRoutes(
  app: FastifyInstance,
  { now, origin, serviceKey, forClient, signedIn }: Deps,
) {
  const challenges = createChallenges({ serviceKey, now });

  /** The company's own address as a browser opens it: the origin of `clientAddress`. */
  const relyingOf = (request: FastifyRequest) =>
    relyingOn(
      new URL(clientAddress(origin, clientCodeSchema.parse(request.headers[CLIENT_HEADER]))).origin,
    );

  /** A 404 where the company has passkeys switched off. */
  async function mustBeOn(request: FastifyRequest) {
    const { setup } = await readSetup(request.storage, request.tenantId);
    if (!staffConfig(setup).fields.passkey) throw new HttpError(404, 'Not found');
  }

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
      const outcome = await addOwnPasskey(
        request.storage,
        request.tenantId,
        handle,
        storedPasskey(credential, now()),
      );
      if (outcome === 'duplicate') throw new HttpError(400, 'Bad request');
      entry.saved(null, null);
      return reply.status(201).send();
    },
  );
}
