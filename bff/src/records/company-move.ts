import {
  type CStorageClient,
  HOME_BOX,
  type MoveClientReply,
  recordKeys,
  type StoredClient,
} from '@credo/shared';
import { compareCompany, copyCompany } from './company-copy';
import { sweepCompany } from './clients';
import { tenantStorage } from './records';

/** How long a company stays closed from the mark, and from a switch or a stop, before the next
 * step: the function's 10 seconds and the store client's 5, so that every call that read the line
 * earlier has ended. */
export const MOVE_WAIT_MS = 15_000;

/** A client's line as read, with the tag every write of it goes over. */
export type MoveLine = StoredClient & { tag: string };

/** What a press answers, and the box it switched to if it wrote the switch (the route enters that
 * one). `moved` is a
 * line changed since it was read; `idle` a press of a company that carries no move. */
export type Pressed = { reply: MoveClientReply; switchedTo: string | null } | 'moved' | 'idle';

type Deps = {
  /** The home box, where the line sits. */
  storage: CStorageClient;
  code: string;
  line: MoveLine;
  now: () => number;
  /** The store of a box, or a refusal: the caller decides what a box not held answers. */
  boxOf: (box: string) => CStorageClient;
};

const secondsOf = (ms: number) => Math.ceil(ms / 1000);

/** The line written over the tag it was read under. */
async function writeLine({ storage, code, line }: Deps, next: StoredClient) {
  return (await storage.putRecord(recordKeys.client(code), next, line.tag)) === 'saved';
}

/** The line as stored, without its tag. */
const plain = ({ tag: _tag, ...rest }: MoveLine): StoredClient => rest;

/** Marks the line as copying to `to`: from the next write on, every call of the company is told to
 * try again. Written over the tag it was read under. */
export async function beginMove(deps: Deps, to: string): Promise<'saved' | 'moved'> {
  const next: StoredClient = {
    ...plain(deps.line),
    move: { form: 'copying', to, markedAt: deps.now() },
  };
  return (await writeLine(deps, next)) ? 'saved' : 'moved';
}

/** Stops a move that is copying: the line carries no copy, the box it was going to is swept from
 * `sweepAt`, and the company is open on its old box at once. Any other line is `idle`. */
export async function stopMove(
  deps: Deps,
): Promise<{ reply: MoveClientReply; to: string } | 'moved' | 'idle'> {
  const { move } = deps.line;
  if (move?.form !== 'copying') return 'idle';
  const next: StoredClient = {
    ...plain(deps.line),
    move: { form: 'sweeping', box: move.to, sweepAt: deps.now() + MOVE_WAIT_MS, closed: false },
  };
  if (!(await writeLine(deps, next))) return 'moved';
  return { reply: { phase: 'stopped', seconds: secondsOf(MOVE_WAIT_MS) }, to: move.to };
}

/**
 * One press of a move that is on its way, from the line alone. Copying: in the first wait, nothing
 * and the seconds left; then one `copyCompany` from the key the line holds, the key written back
 * over the line's tag, and at `done` a `compareCompany`: at 0 differ the line names the new box,
 * closed for another wait, and otherwise the key is cleared and the next press walks from the
 * start. Sweeping: nothing before `sweepAt`, then one sweep of the box named, and the line loses
 * its mark when a list comes back empty. A press that fails leaves the line as the last press
 * wrote it.
 */
export async function pressMove(deps: Deps): Promise<Pressed> {
  const { line, now, boxOf } = deps;
  const { move } = line;
  if (!move) return 'idle';
  const base = plain(line);
  if (move.form === 'sweeping') {
    const wait = move.sweepAt - now();
    if (wait > 0) {
      const phase = move.closed ? 'switched' : 'stopped';
      return { reply: { phase, seconds: secondsOf(wait) }, switchedTo: null };
    }
    const swept = await sweepCompany(tenantStorage(boxOf(move.box), line.id));
    if (!swept.empty) return { reply: { phase: 'sweeping', left: swept.left }, switchedTo: null };
    return (await writeLine(deps, { ...base, move: undefined }))
      ? { reply: { phase: 'done' }, switchedTo: null }
      : 'moved';
  }
  const wait = move.markedAt + MOVE_WAIT_MS - now();
  if (wait > 0) return { reply: { phase: 'waiting', seconds: secondsOf(wait) }, switchedTo: null };
  const here = line.box ?? HOME_BOX;
  const from = tenantStorage(boxOf(here), line.id);
  const to = tenantStorage(boxOf(move.to), line.id);
  const copy = await copyCompany(from, to, move.after === undefined ? {} : { after: move.after });
  if (!copy.done) {
    if (!(await writeLine(deps, { ...base, move: { ...move, after: copy.after } }))) return 'moved';
    return { reply: { phase: 'copying', left: 1 }, switchedTo: null };
  }
  const { differ } = await compareCompany(from, to);
  if (differ > 0) {
    if (!(await writeLine(deps, { ...base, move: { ...move, after: undefined } }))) return 'moved';
    return { reply: { phase: 'copying', left: differ }, switchedTo: null };
  }
  const switched: StoredClient = {
    ...base,
    box: move.to === HOME_BOX ? undefined : move.to,
    move: { form: 'sweeping', box: here, sweepAt: now() + MOVE_WAIT_MS, closed: true },
  };
  if (!(await writeLine(deps, switched))) return 'moved';
  return { reply: { phase: 'switched', seconds: secondsOf(MOVE_WAIT_MS) }, switchedTo: move.to };
}
