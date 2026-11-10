import { randomBytes, randomUUID } from 'node:crypto';
import {
  ATTEMPTS,
  type CStorageClient,
  CStorageError,
  recordKeys,
  sameOperatorName,
  type RosterOperator,
  sha256Hex,
  type StoredAccount,
  storedAccountSchema,
  type StoredLink,
  storedLinkSchema,
  type StoredRoster,
  storedRosterSchema,
} from '@credo/shared';
import { createRecord } from './clients';

/** A link works for a day. */
export const LINK_MS = 24 * 60 * 60 * 1000;

const NO_PASSKEYS: StoredAccount = {
  passkeys: [],
  linkHash: null,
  generation: 0,
  signedInAt: null,
  spent: [],
};

/** The roster with the tag it was read at; an empty one, with no tag, before the first operator. */
export async function readRoster(storage: CStorageClient) {
  const found = await storage.getRecord(recordKeys.operatorRoster);
  return found
    ? { roster: storedRosterSchema.parse(found.data), tag: found.tag }
    : { roster: { operators: [] } as StoredRoster, tag: null };
}

/** An operator's account and its tag, or null when none sits under that id. A record that does
 * not parse throws: the store answers 503, never a sign-in on a half-read account. */
export async function readAccount(storage: CStorageClient, id: string) {
  const found = await storage.getRecord(recordKeys.operatorAccount(id));
  return found ? { account: storedAccountSchema.parse(found.data), tag: found.tag } : null;
}

/** A link's token, 32 random bytes in base64url, and the hash it is kept by. */
async function newToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: await sha256Hex(token) };
}

/** The link a token names, if it is live: stored, not ended, and the newest for its operator. */
export async function readLiveLink(storage: CStorageClient, token: string, now: number) {
  const hash = await sha256Hex(token);
  const found = await storage.getRecord(recordKeys.operatorLink(hash));
  if (!found) return null;
  const link: StoredLink = storedLinkSchema.parse(found.data);
  if (link.endsAt <= now) return null;
  const owner = await readAccount(storage, link.operatorId);
  if (owner?.account.linkHash !== hash) return null;
  return { hash, link, tag: found.tag };
}

/**
 * Makes `operatorId` a link: the link first, written where nothing sits, then the account's
 * `linkHash` moved to it with the account's tag (a 412 re-reads, three times at most), and last the
 * old link removed. A link made while the account's `linkHash` still names another is therefore
 * never live at the same time as it: the newest wins. Returns the token to show once, or null when
 * the operator has no account.
 */
export async function makeLink(
  storage: CStorageClient,
  {
    operatorId,
    kind,
    madeBy,
    now,
  }: { operatorId: string; kind: StoredLink['kind']; madeBy: string | null; now: number },
) {
  const { token, hash } = await newToken();
  const link: StoredLink = { operatorId, kind, madeBy, endsAt: now + LINK_MS };
  await createRecord(storage, recordKeys.operatorLink(hash), link);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const held = await readAccount(storage, operatorId);
    if (!held) return null;
    const saved = await storage.putRecord(
      recordKeys.operatorAccount(operatorId),
      { ...held.account, linkHash: hash },
      held.tag,
    );
    if (saved === 'saved') {
      await dropLink(storage, held.account.linkHash);
      return token;
    }
  }
  throw new CStorageError(412, 'the operator’s account moved on every attempt to give it a link');
}

/** Removes the link a hash names, if it is still there; one that moved or went is left. */
export async function dropLink(storage: CStorageClient, hash: string | null) {
  if (!hash) return;
  const found = await storage.getRecord(recordKeys.operatorLink(hash));
  if (found) await storage.removeRecord(recordKeys.operatorLink(hash), found.tag);
}

export type Created = { id: string; token: string };

/**
 * Adds an operator: the account and the link first, each where nothing sits, then the roster last
 * with its tag, which is what makes the operator. A name is unique among the operators there; the
 * roster is read again after a 412 and the name checked again, three times at most. A failure
 * before the roster leaves an account and a link nothing reaches, and the name free. Returns the
 * operator's id and the link's token, to show once, or `'taken'`.
 */
export async function createOperator(
  storage: CStorageClient,
  { name, addedBy, now }: { name: string; addedBy: string | null; now: number },
): Promise<Created | 'taken'> {
  if ((await readRoster(storage)).roster.operators.some((op) => sameOperatorName(op.name, name)))
    return 'taken';
  const id = randomUUID();
  const { token, hash } = await newToken();
  const link: StoredLink = { operatorId: id, kind: 'join', madeBy: addedBy, endsAt: now + LINK_MS };
  const account: StoredAccount = { ...NO_PASSKEYS, linkHash: hash };
  await createRecord(storage, recordKeys.operatorAccount(id), account);
  await createRecord(storage, recordKeys.operatorLink(hash), link);
  const line: RosterOperator = {
    id,
    name,
    state: 'invited',
    addedBy,
    addedAt: now,
    joinedAt: null,
  };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { roster, tag } = await readRoster(storage);
    if (roster.operators.some((op) => sameOperatorName(op.name, name))) return 'taken';
    const saved = await storage.putRecord(
      recordKeys.operatorRoster,
      { operators: [...roster.operators, line] },
      tag,
    );
    if (saved === 'saved') return { id, token };
  }
  throw new CStorageError(412, 'the roster moved on every attempt to add an operator');
}

/** Removes the record under `key` if `wanted` accepts its data, with the tag it was read at; a
 * record that moved is read again and judged again, `ATTEMPTS` times at most. */
async function removeIf(storage: CStorageClient, key: string, wanted: (data: unknown) => boolean) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const found = await storage.getRecord(key);
    if (!found || !wanted(found.data)) return;
    if ((await storage.removeRecord(key, found.tag)) === 'removed') return;
  }
  throw new CStorageError(412, 'a record of the deleted operator moved on every attempt');
}

/**
 * Deletes an operator, by another who is signed in: their live link and the links they made
 * removed first, each with its tag, then the roster line with its tag, as its write is what makes
 * an operator, and last their account. The roster is read again after a 412 and the actor and the
 * target checked again, three times at most: an actor gone is `'actor'`, a target gone is
 * `'target'`. Sessions are left: the roster check refuses them. A failure among the links leaves
 * the operator listed, so a retry finishes; once the roster line is written no link of theirs or
 * of their making is left, and an account a failure leaves cannot sign in, as the roster refuses it.
 */
export async function deleteOperator(
  storage: CStorageClient,
  { actorId, targetId }: { actorId: string; targetId: string },
): Promise<'deleted' | 'actor' | 'target'> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { roster, tag } = await readRoster(storage);
    if (!roster.operators.some((one) => one.id === actorId && one.state === 'active'))
      return 'actor';
    if (!roster.operators.some((one) => one.id === targetId)) return 'target';
    const rest = roster.operators.filter((one) => one.id !== targetId);
    const held = await readAccount(storage, targetId);
    if (held?.account.linkHash)
      await removeIf(storage, recordKeys.operatorLink(held.account.linkHash), () => true);
    for (const one of rest) {
      const hash = (await readAccount(storage, one.id))?.account.linkHash;
      if (hash)
        await removeIf(
          storage,
          recordKeys.operatorLink(hash),
          (data) => storedLinkSchema.parse(data).madeBy === targetId,
        );
    }
    const saved = await storage.putRecord(recordKeys.operatorRoster, { operators: rest }, tag);
    if (saved !== 'saved') continue;
    await removeIf(storage, recordKeys.operatorAccount(targetId), () => true);
    return 'deleted';
  }
  throw new CStorageError(412, 'the roster moved on every attempt to delete an operator');
}
