import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ATTEMPTS,
  AUTH_HEADER,
  type CStorageClient,
  type ConfirmAct,
  type Confirmation,
  confirmOptionsRequestSchema,
  DEVICE_HEADER,
  deviceIdSchema,
  joinOptionsRequestSchema,
  joinRequestSchema,
  NO_RENEW_QUERY,
  type OperatorMeReplyBody,
  type OperatorSessionReplyBody,
  passkeyAddRequestSchema,
  type PasskeyListReply,
  passkeyRemoveRequestSchema,
  passkeyRoutes,
  passkeySignInRequestSchema,
  recordKeys,
  ROUTES,
  sha256Hex,
  type StoredAccount,
  type StoredPasskey,
} from '@credo/shared';
import { type Purpose, createChallenges, CHALLENGE_MS } from './challenge';
import { HttpError, parse } from './errors';
import { readAccount, readLiveLink, readRoster } from './operators';
import { createSessions, OPERATOR_SESSION } from './sessions';

const RP_NAME = 'Credo';
/** The COSE algorithms a passkey may use (EdDSA, ES256, RS256), named so the library's default is
 * never read: it asks the runtime about ML-DSA-44, which Node 24 and later warn about as
 * experimental. Held by operator-algorithms.route.test.ts. */
const PASSKEY_ALGORITHMS = [-8, -7, -257];
/** What a sign-in answer's user handle may be: a string, or left out. */
const userHandleSchema = z.string().optional();
const unauthorized = () => new HttpError(401, 'Unauthorized');
/** A touch asked for and not given right: the session stands, the act does not happen. */
const forbidden = () => new HttpError(403, 'Forbidden');
/** A link used, ended or replaced, or whose operator is gone: said alike. */
const gone = () => new HttpError(404, 'This link is no longer good');
const moved = (what: string) => new HttpError(503, `${what} moved on every attempt`);

export type OperatorAuthDeps = {
  storage: CStorageClient;
  now: () => number;
  /** The address the operator opens, from `APP_ORIGIN`: every ceremony is checked against it. */
  origin: string;
  /** The BFF's own service key, which the challenges' signing key is derived from. */
  serviceKey: string;
};

const bytesOf = (base64url: string) => new Uint8Array(Buffer.from(base64url, 'base64url'));
const listOf = (account: StoredAccount): PasskeyListReply => ({
  passkeys: account.passkeys.map(({ id, addedAt, lastUsedAt }) => ({ id, addedAt, lastUsedAt })),
});

/**
 * The operator's sign-in by passkey, the join by a link, one's own passkeys and the session
 * check every operator route runs. Returns that check. Nothing here writes on an options call: the
 * challenge is signed, not stored.
 */
export function registerOperatorAuth(app: FastifyInstance, deps: OperatorAuthDeps) {
  const { storage, now, origin } = deps;
  const rpID = new URL(origin).hostname;
  const challenges = createChallenges({ serviceKey: deps.serviceKey, now });
  const sessions = createSessions({
    storage,
    now,
    keyOf: recordKeys.operatorSession,
    sliding: OPERATOR_SESSION,
  });
  const [renewKey, renewValue] = NO_RENEW_QUERY.split('=');

  /** Who the handle names: the session, an active line in the roster and an account of the
   * generation the session was issued under. A read marked as no use renews nothing. Anything
   * less is a 401; a store that cannot answer throws, and answers 503. */
  async function operatorSignedIn(request: FastifyRequest) {
    const handle = request.headers[AUTH_HEADER];
    const query = request.query as Record<string, unknown>;
    const session =
      typeof handle === 'string'
        ? await sessions.resolve(handle, { renew: query[renewKey] !== renewValue })
        : null;
    if (!session) throw unauthorized();
    const line = (await readRoster(storage)).roster.operators.find(
      (operator) => operator.id === session.user && operator.state === 'active',
    );
    const held = line ? await readAccount(storage, line.id) : null;
    if (!line || !held || String(held.account.generation) !== session.generation)
      throw unauthorized();
    return { id: line.id, name: line.name, account: held.account };
  }

  /** The operator as the answers show them: the id and the name, never the account. */
  async function whoIs(request: FastifyRequest) {
    const { id, name } = await operatorSignedIn(request);
    return { id, name };
  }

  function deviceOf(request: FastifyRequest) {
    const device = deviceIdSchema.safeParse(request.headers[DEVICE_HEADER]);
    if (!device.success) throw new HttpError(400, 'Bad request', { details: DEVICE_HEADER });
    return device.data;
  }

  /** A sign-in ends the session the device's kept handle still names. */
  async function endKept(request: FastifyRequest) {
    const kept = request.headers[AUTH_HEADER];
    if (typeof kept === 'string') await sessions.end(kept);
  }

  async function session(
    request: FastifyRequest,
    operator: { id: string; name: string },
    generation: number,
  ): Promise<OperatorSessionReplyBody> {
    const device = deviceOf(request);
    await endKept(request);
    const { authId, expiresAt } = await sessions.issue(device, operator.id, String(generation));
    return { authId, expiresAt, operator };
  }

  /** Writes the account `change` makes of the one read, with its tag; a moved tag re-reads and
   * changes again, three times at most. A change that returns no account writes nothing and
   * answers its result. An operator with no account is `missing`. */
  async function updateAccount<T>(
    id: string,
    missing: HttpError,
    change: (account: StoredAccount) => { account: StoredAccount | null; result: T },
  ): Promise<T> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await readAccount(storage, id);
      if (!held) throw missing;
      const next = change(held.account);
      if (!next.account) return next.result;
      const saved = await storage.putRecord(recordKeys.operatorAccount(id), next.account, held.tag);
      if (saved === 'saved') return next.result;
    }
    throw moved('the operator’s account');
  }

  const addedPasskey = (info: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
  }): StoredPasskey => ({
    id: info.id,
    publicKey: Buffer.from(info.publicKey).toString('base64url'),
    counter: info.counter,
    transports: info.transports ?? [],
    addedAt: now(),
    lastUsedAt: null,
  });

  async function registrationOptions(
    operator: { id: string; name: string },
    held: StoredPasskey[],
    purpose: Extract<Purpose, 'join' | 'add'>,
    subject: string,
  ) {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userName: operator.name,
      userID: new TextEncoder().encode(operator.id),
      attestationType: 'none',
      excludeCredentials: held.map(({ id, transports }) => ({ id, transports })),
      supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    return { options, token: challenges.mint(options.challenge, purpose, subject) };
  }

  /** The key a registration made, or a 400: a response the library refuses is the caller's. */
  async function verifiedRegistration(response: unknown, expectedChallenge: string) {
    try {
      const result = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
      });
      if (result.verified) return addedPasskey(result.registrationInfo.credential);
    } catch {
      // The library throws for what it refuses; which part is not said.
    }
    throw new HttpError(400, 'Bad request');
  }

  /** A passkey's answer to a challenge, checked against the operator's own passkeys, the origin
   * and the relying party, with user verification; the passkey's counter and last use move on and
   * the challenge is spent in the account, in one write with its tag. Each try reads the account
   * again: a replay that lost the race finds its challenge spent. Only a sign-in (`signsIn`) moves
   * the account's `signedInAt`; a touch for an act leaves it. Returns the account as written.
   * Anything the library refuses is `refuse`'s error, and says no more. */
  async function spendTouch(
    operatorId: string,
    answer: AuthenticationResponseJSON,
    challenge: string,
    refuse: () => HttpError,
    signsIn = false,
  ): Promise<StoredAccount> {
    const spentHash = await sha256Hex(challenge);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const held = await readAccount(storage, operatorId);
      const passkey = held?.account.passkeys.find((candidate) => candidate.id === answer.id);
      if (!held || !passkey) throw refuse();
      if (held.account.spent.some((spent) => spent.hash === spentHash)) throw refuse();
      let counter: number;
      try {
        const result = await verifyAuthenticationResponse({
          response: answer,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: passkey.id,
            publicKey: bytesOf(passkey.publicKey),
            counter: passkey.counter,
            transports: passkey.transports,
          },
          requireUserVerification: true,
        });
        if (!result.verified) throw refuse();
        counter = result.authenticationInfo.newCounter;
      } catch {
        throw refuse();
      }
      const account: StoredAccount = {
        ...held.account,
        signedInAt: signsIn ? now() : held.account.signedInAt,
        passkeys: held.account.passkeys.map((candidate) =>
          candidate === passkey ? { ...candidate, counter, lastUsedAt: now() } : candidate,
        ),
        spent: [
          ...held.account.spent.filter((spent) => spent.at > now() - CHALLENGE_MS),
          { hash: spentHash, at: now() },
        ],
      };
      const saved = await storage.putRecord(
        recordKeys.operatorAccount(operatorId),
        account,
        held.tag,
      );
      if (saved === 'saved') return account;
    }
    throw moved('the operator’s account');
  }

  /** The fresh touch an add or a remove needs, in the same act: a 403 unless it is an answer of one
   * of this operator's own passkeys to a challenge made for this act. */
  async function confirmed(operator: { id: string }, act: ConfirmAct, confirm: Confirmation) {
    const challenge = challenges.open(confirm.token, `confirm-${act}`, operator.id);
    if (!challenge) throw forbidden();
    await spendTouch(
      operator.id,
      confirm.response as unknown as AuthenticationResponseJSON,
      challenge,
      forbidden,
    );
  }

  app.post(ROUTES.operatorPasskeyOptions, async () => {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
    return { options, token: challenges.mint(options.challenge, 'sign-in') };
  });

  app.post(ROUTES.operatorPasskeySignIn, async (request): Promise<OperatorSessionReplyBody> => {
    deviceOf(request);
    const body = parse(passkeySignInRequestSchema, request.body);
    const challenge = challenges.open(body.token, 'sign-in');
    const answer = body.response as unknown as AuthenticationResponseJSON;
    // The handle is read under a schema: anything but a string, or none, is the one 401.
    const handle = userHandleSchema.safeParse(answer.response.userHandle);
    if (!handle.success) throw unauthorized();
    const id = handle.data ? Buffer.from(handle.data, 'base64url').toString() : '';
    const line = (await readRoster(storage)).roster.operators.find(
      (operator) => operator.id === id && operator.state === 'active',
    );
    if (!challenge || !line) throw unauthorized();
    const account = await spendTouch(line.id, answer, challenge, unauthorized, true);
    return await session(request, { id: line.id, name: line.name }, account.generation);
  });

  app.post(ROUTES.operatorJoinOptions, async (request) => {
    const { link } = parse(joinOptionsRequestSchema, request.body);
    const live = await readLiveLink(storage, link, now());
    const { roster } = await readRoster(storage);
    const operator = live && roster.operators.find((line) => line.id === live.link.operatorId);
    if (!live || !operator) throw gone();
    const madeBy = roster.operators.find((line) => line.id === live.link.madeBy)?.name ?? null;
    return {
      ...(await registrationOptions(operator, [], 'join', live.hash)),
      name: operator.name,
      madeBy,
      // A link the terminal made names no maker at all; one whose maker is gone names one that is not there.
      madeByTerminal: live.link.madeBy === null,
    };
  });

  app.post(ROUTES.operatorJoin, async (request): Promise<OperatorSessionReplyBody> => {
    deviceOf(request);
    const body = parse(joinRequestSchema, request.body);
    const live = await readLiveLink(storage, body.link, now());
    if (!live) throw gone();
    const challenge = challenges.open(body.token, 'join', live.hash);
    if (!challenge) throw new HttpError(400, 'Bad request');
    const passkey = await verifiedRegistration(body.response, challenge);
    // The link goes first, with its tag: of two openings at once, one removes it and the other
    // finds it moved.
    const removed = await storage.removeRecord(recordKeys.operatorLink(live.hash), live.tag);
    if (removed === 'moved') throw gone();
    const generation = await updateAccount(live.link.operatorId, gone(), (account) => {
      const next = live.link.kind === 'replace' ? account.generation + 1 : account.generation;
      return {
        account: {
          ...account,
          passkeys: [passkey],
          linkHash: null,
          spent: [],
          generation: next,
          signedInAt: now(),
        },
        result: next,
      };
    });
    const line = await joined(live.link.operatorId);
    if (!line) throw gone();
    return await session(request, line, generation);
  });

  /** The roster's line for an invited operator made active, written with its tag; null if they
   * are no longer there. */
  async function joined(id: string) {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const { roster, tag } = await readRoster(storage);
      const line = roster.operators.find((operator) => operator.id === id);
      if (!line) return null;
      if (line.state === 'active') return { id: line.id, name: line.name };
      const operators = roster.operators.map((operator) =>
        operator === line ? { ...line, state: 'active' as const, joinedAt: now() } : operator,
      );
      const saved = await storage.putRecord(recordKeys.operatorRoster, { operators }, tag);
      if (saved === 'saved') return { id: line.id, name: line.name };
    }
    throw moved('the roster');
  }

  app.post(ROUTES.operatorSignOut, async (request, reply) => {
    const handle = request.headers[AUTH_HEADER];
    if (typeof handle === 'string') await sessions.end(handle);
    return reply.status(204).send();
  });

  app.get(ROUTES.operatorMe, async (request): Promise<OperatorMeReplyBody> => ({
    operator: await whoIs(request),
  }));

  app.get(ROUTES.operatorPasskeys, async (request) =>
    listOf((await operatorSignedIn(request)).account),
  );

  app.post(passkeyRoutes.confirmOptions, async (request) => {
    const operator = await operatorSignedIn(request);
    const { act } = parse(confirmOptionsRequestSchema, request.body);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: operator.account.passkeys.map(({ id, transports }) => ({ id, transports })),
    });
    return { options, token: challenges.mint(options.challenge, `confirm-${act}`, operator.id) };
  });

  app.post(passkeyRoutes.options, async (request) => {
    const operator = await operatorSignedIn(request);
    return await registrationOptions(operator, operator.account.passkeys, 'add', operator.id);
  });

  app.post(ROUTES.operatorPasskeys, async (request, reply) => {
    const operator = await operatorSignedIn(request);
    const body = parse(passkeyAddRequestSchema, request.body);
    await confirmed(operator, 'add', body.confirm);
    const challenge = challenges.open(body.token, 'add', operator.id);
    if (!challenge) throw new HttpError(400, 'Bad request');
    const passkey = await verifiedRegistration(body.response, challenge);
    const outcome = await updateAccount<'duplicate' | PasskeyListReply>(
      operator.id,
      unauthorized(),
      (account) => {
        if (account.passkeys.some((held) => held.id === passkey.id)) {
          return { account: null, result: 'duplicate' };
        }
        const next = { ...account, passkeys: [...account.passkeys, passkey] };
        return { account: next, result: listOf(next) };
      },
    );
    if (outcome === 'duplicate') throw new HttpError(400, 'Bad request');
    return reply.status(201).send(outcome);
  });

  app.delete<{ Params: { id: string } }>(
    `${ROUTES.operatorPasskeys}/:id`,
    async (request, reply) => {
      const operator = await operatorSignedIn(request);
      const body = parse(passkeyRemoveRequestSchema, request.body);
      await confirmed(operator, 'remove', body.confirm);
      const outcome = await updateAccount<'none' | 'last' | PasskeyListReply>(
        operator.id,
        unauthorized(),
        (account) => {
          const held = account.passkeys.find((passkey) => passkey.id === request.params.id);
          if (!held) return { account: null, result: 'none' };
          if (account.passkeys.length === 1) return { account: null, result: 'last' };
          const next = {
            ...account,
            passkeys: account.passkeys.filter((passkey) => passkey !== held),
          };
          return { account: next, result: listOf(next) };
        },
      );
      if (outcome === 'last') return reply.status(409).send({ error: 'Conflict' });
      if (outcome === 'none') throw new HttpError(404, 'Not found');
      return outcome;
    },
  );

  return { operatorSignedIn: whoIs, confirmed };
}
