import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient, deleteClient, listClients } from '@credo/bff/clients';
import { compareCompany, copyCompany, tenantStorage } from '@credo/bff/company-copy';
import { readAppOrigin, readStorageEnv } from '@credo/bff/env';
import { createOperator, makeLink, readRoster } from '@credo/bff/operators';
import {
  type CStorageClient,
  clientCodeSchema,
  createCStorageClient,
  joinLinkPath,
  normaliseClientCode,
  normaliseSignInName,
  recordKeys,
  sameOperatorName,
  storedClientSchema,
} from '@credo/shared';
import { OPERATOR_NAME } from '@credo/shared/demo';
import { applyAll, applyCopy, MAX_DAYS_PER_RUN } from './demo/apply';
import { vietnamToday } from './demo/days';
import { allCopies, copyOfCode, type MappedCopy } from './demo/mapping';
import { withLocalStore } from './local-store';
import { ensureService, rekeyService } from './register';
import { checkRootPassword, passwordFrom, Refused, setRootPasswords } from './root-password';

export type RidgeIo = {
  /** A line for the caller's output: a log, or a command substitution. */
  out: (line: string) => void;
  /** A line for the human's terminal alone: the operator's link goes only here. */
  show: (line: string) => void;
  err: (line: string) => void;
  fetch?: typeof fetch;
  /** The clock `seed` and `root-password` read the day and the time from; the real one when none. */
  now?: () => number;
  /** Everything on the standard input, which `root-password` reads the new password from. */
  stdin?: () => Promise<string>;
};

/** The codes ops/check.sh gives its client: check-20261107t085500z. */
const CHECK_CODE = /^check-(\d{4})(\d{2})(\d{2})t(\d{2})(\d{2})(\d{2})z$/;

/** How old a check client must be before `clear-checks` deletes it. The check step is capped at 8
 * minutes (.github/workflows/ci.yml), so a live check client is at most that old; two hours is
 * fifteen times it, and a shorter age would take a concurrent deploy's client mid-check. */
const CHECK_AGE_HOURS = 2;

/** When a check client was made, read from its own code (UTC); null for a code that is not a check
 * code, or whose stamp is not a real moment, such as a thirteenth month. */
function checkMadeAt(code: string): number | null {
  const found = CHECK_CODE.exec(code);
  if (!found) return null;
  const parts = found.slice(1).map(Number) as [number, number, number, number, number, number];
  const at = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
  const [year, month, day, hour, minute, second] = [
    at.getUTCFullYear(),
    at.getUTCMonth() + 1,
    at.getUTCDate(),
    at.getUTCHours(),
    at.getUTCMinutes(),
    at.getUTCSeconds(),
  ];
  return [year, month, day, hour, minute, second].every((part, i) => part === parts[i])
    ? at.getTime()
    : null;
}

/** The schema wants an operator's uuid for a deletion's `by`; the terminal has none, so the nil one. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Deletes the check client `code` whole, as the console's delete does but with the nil uuid for
 * `by` (the terminal has no operator); the line to print, or an Error saying what was left. */
async function removeCheckClient(
  storage: CStorageClient,
  code: string,
  now: () => number,
): Promise<string> {
  const held = await storage.getRecord(recordKeys.client(code));
  const index = held ? { ...storedClientSchema.parse(held.data), tag: held.tag } : null;
  // One press: a bound of 200 records is far over the check's three.
  const done = await deleteClient(storage, {
    code,
    index,
    by: NIL_UUID,
    now,
  });
  if (done === 'unknown') return `no client ${code} to delete`;
  if (done === 'busy') {
    throw new Error(
      `nothing was deleted: an earlier deletion under the code ${code} is still unfinished`,
    );
  }
  if (done === 'moved') {
    throw new Error(`nothing was deleted: the client ${code} changed while it was being read`);
  }
  if (done.left !== 0) {
    throw new Error(`the client ${code} is out of the list but ${done.left} records are left`);
  }
  return `client ${code} deleted`;
}

const REMAKE_USAGE =
  'usage: remake [--check] (one line a partner on stdin: the partner’s label, a space, the password) | remake --go-on (the store a stopped run kept, in REMAKE_STORE_DIR)';

/** The file a remake writes in its kept store once all six copies are filled there, holding the day
 * of the fill and the commit that made it, a space between: `--go-on` goes on only from a store that
 * holds it, written today by this commit. */
const FILLED_FILE = 'filled';

/** The day the kept store in `dir` was filled on; refused when no store filled whole is kept there,
 * or when it was filled on another day or by another commit than this one (a store kept from a
 * stopped run days ago would be copied over ridge's current copies). */
async function filledOn(dir: string | undefined, today: string, commit: string) {
  const text = dir ? await readFile(join(dir, FILLED_FILE), 'utf8').catch(() => null) : null;
  if (text === null)
    throw new Refused(
      'remake --go-on: no store filled whole by a stopped run is kept: run ops/demo-remake.sh ridge whole',
    );
  const [day, made = ''] = text.split(' ');
  if (day !== today || made !== commit)
    throw new Refused(
      `remake --go-on: the kept store was filled on ${day} by commit ${made || 'none'}, not today by commit ${commit || 'none'}: run ops/demo-remake.sh ridge whole`,
    );
  return day;
}

/** The passwords as typed, one line a partner of the mapping: the label, a space, the password whole.
 * A partner missing, named twice or outside the mapping, or a password that breaks the rule, is
 * refused before anything is written. The words name the partner and the rule, never a password. */
function partnerPasswords(input: string) {
  const partners = [...new Set(allCopies().map((copy) => copy.partner))];
  const given = new Map<string, string>();
  for (const line of input.split('\n').filter((one) => one !== '')) {
    const partner = line.split(' ', 1)[0];
    if (!partners.includes(partner))
      throw new Refused(`${partner} is not a partner of the mapping`);
    if (given.has(partner)) throw new Refused(`${partner} is named twice`);
    given.set(partner, line.slice(partner.length + 1));
  }
  for (const partner of partners) {
    if (!given.has(partner)) throw new Refused(`no password for ${partner}. ${REMAKE_USAGE}`);
    const codes = allCopies()
      .filter((copy) => copy.partner === partner)
      .map((copy) => copy.code);
    try {
      checkRootPassword(codes, given.get(partner)!);
    } catch (error) {
      throw new Refused(`${partner}: ${(error as Error).message}`);
    }
  }
  return given;
}

/** Deletes a copy whole, if it is on the service: with its index, then without while records are
 * left, a press at a time; an earlier deletion left unfinished is finished the same way. */
async function deleteCopy(storage: CStorageClient, code: string, now: () => number) {
  const held = await storage.getRecord(recordKeys.client(code));
  let index = held ? { ...storedClientSchema.parse(held.data), tag: held.tag } : null;
  for (;;) {
    const done = await deleteClient(storage, {
      code,
      index,
      by: NIL_UUID,
      now,
    });
    if (done === 'unknown') return;
    if (done === 'busy' || done === 'moved') {
      throw new Error(
        `${code}: nothing more was deleted, the deletion is held or the client moved`,
      );
    }
    if (done.left === 0) return;
    index = null;
  }
}

/** The minutes since `since` (a `performance.now()`), to one decimal: a step's length for the log. */
const minutesSince = (since: number) => ((performance.now() - since) / 60_000).toFixed(1);

/** One copy made and filled on this Mac's store: made by the operator's create (its first password
 * dropped), given its partner's password, and filled with the 21 days to yesterday in one run. */
async function fillLocally(
  local: CStorageClient,
  copy: MappedCopy,
  password: string,
  io: { out: (line: string) => void; now: () => number },
) {
  const made = await createClient(local, {
    code: copy.code,
    name: copy.company,
    madeAt: io.now(),
  });
  /* v8 ignore next -- unreachable: the store is new to this run, and each code of the mapping is one copy's */
  if (made === 'taken') throw new Error('this Mac’s new store already holds it');
  await setRootPasswords(local, [copy.code], password, io);
  const report = await applyCopy(local, copy, vietnamToday(io.now()), io.out);
  if (report.status !== 'ok') throw new Error(report.note);
}

/** The company `id`, under `code`, carried from `source` to `target` by `copyCompany`'s loop, the
 * two compared before and after, a line each; a target that still differs after is an error. */
async function carryCompany(
  source: CStorageClient,
  target: CStorageClient,
  id: string,
  code: string,
  out: (line: string) => void,
) {
  const [one, other] = [tenantStorage(source, id), tenantStorage(target, id)];
  const line = async (when: string) => {
    const { records, differ } = await compareCompany(one, other);
    out(`${code} ${when}: the source holds ${records} records, ${differ} differ on the target`);
    return differ;
  };
  await line('before');
  for (
    let step = await copyCompany(one, other);
    ;
    step = await copyCompany(one, other, { after: step.after })
  ) {
    out(`${code}: ${step.copied} written, ${step.removed} removed`);
    if (step.done) break;
  }
  if ((await line('after')) !== 0) throw new Error(`${code}: the target differs after the copy`);
}

/** One copy carried from this Mac's store to the target: deleted there whole, its records copied,
 * the two compared at zero, and only then its index written, so a half-copied company is never
 * reachable. A copy whose index on the target already names this store's company was carried whole
 * by a stopped run of this store: it is compared and written where it differs, never deleted.
 * Answers the milliseconds of the delete and of the copy. */
async function carryCopy(
  local: CStorageClient,
  target: CStorageClient,
  copy: MappedCopy,
  index: { data: unknown },
  io: { out: (line: string) => void; now: () => number },
) {
  const begun = performance.now();
  const id = storedClientSchema.parse(index.data).id;
  const there = await target.getRecord(recordKeys.client(copy.code));
  const carried = there !== null && storedClientSchema.parse(there.data).id === id;
  if (carried) io.out(`${copy.code}: copied whole by the stopped run, not deleted`);
  else {
    await deleteCopy(target, copy.code, io.now);
    io.out(`${copy.code}: deleted on the target, ${minutesSince(begun)} minutes`);
  }
  const deleted = performance.now();
  await carryCompany(local, target, id, copy.code, io.out);
  if (
    !carried &&
    (await target.putRecord(recordKeys.client(copy.code), index.data, null)) === 'moved'
  )
    throw new Error('the service still holds it');
  io.out(`${copy.code}: copied whole and its index written, ${minutesSince(deleted)} minutes`);
  return { deleting: deleted - begun, copying: performance.now() - deleted };
}

/** The four connection variables of the target, each under its name in the source's environment
 * (`FROM_` before it). */
const storageNames = {
  C_STORAGE_URL: 'C_STORAGE_URL',
  INTERNAL_ACCESS_KEY: 'INTERNAL_ACCESS_KEY',
  SERVICE_CODE: 'SERVICE_CODE',
  SERVICE_ACCESS_KEY: 'SERVICE_ACCESS_KEY',
};

/** The record ops/company-restore.sh writes into a demo copy to tell it restored from its neighbour,
 * under the copy's own prefix, so the copy removes it. */
const DRILL_RECORD = 'drill-restore';

/** The code as the product takes it, when it is one of the demo copies; else a refusal. */
function demoCopy(code: string) {
  const normalised = normaliseClientCode(code);
  if (!copyOfCode(normalised)) throw new Refused(`${code} is not one of the demo copies`);
  return normalised;
}

const USAGE =
  'usage: register | rekey (the new key on stdin) | operator [--replace] [<name>] | tenant <code> <name> | tenant-id <code> | untenant <code> | clear-checks | seed | remake [--check | --go-on] | root-password [--check] <code>… | drill-record put|has|remove <code> | copy-company [--check] <code> (the source in FROM_C_STORAGE_URL, FROM_INTERNAL_ACCESS_KEY, FROM_SERVICE_CODE and FROM_SERVICE_ACCESS_KEY)';

/**
 * What `ops/*.sh` asks of a ridge reached through a tunnel, as the product's own functions do it:
 * the BFF's service registered with the super-admin key (and `rekey`, which replaces its key by the
 * new one on the standard input, the same key), the operator's account, and a client made
 * by the operator's create, and `untenant` deletes one whole by the operator's own delete function
 * (the check's client, with the keys the create used; it prints how many records went), `tenant-id` prints the id a
 * client's code names (the activity log keeps its entries by that id), and
 * `clear-checks` deletes every check client older than {@link CHECK_AGE_HOURS}, by the age in its
 * code, one line each, the rest still going after a failure and the exit 1. The connection comes from the environment (C_STORAGE_URL and the BFF's
 * three keys; X_SUPER_ADMIN_KEY for `register` alone). Nothing it prints holds a key; a password is
 * printed once: the operator's to `show`, a client's root's to `out`. `seed` brings every mapped copy
 * that exists up to yesterday ({@link applyAll}); it makes no client and prints no password, and a
 * copy it had to leave (used first, or held by another run) ends it red after the others are done.
 * `root-password` sets the named demo copies' roots to the password on the standard input and
 * prints no password; `--check` needs no connection. `remake` makes and fills the six copies on a
 * store of this Mac's own ({@link withLocalStore}), kept in REMAKE_STORE_DIR when it names a folder,
 * then carries each to the target whole, one at a time, printing each step's minutes; `--go-on`
 * carries them again from the store a stopped run kept, asking no password. Returns the exit status:
 * 2 for what was refused before anything was written (this Mac's store or its fill stopping
 * included), 1 for a failure.
 */
export async function runRidge(
  argv: string[],
  env: Record<string, string | undefined>,
  io: RidgeIo,
): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'root-password' && rest[0] === '--check') {
      const password = passwordFrom((await io.stdin?.()) ?? '');
      const codes = checkRootPassword(rest.slice(1), password);
      io.out(`checked: the password follows the rule, ${codes.length} demo copies named`);
      return 0;
    }
    if (command === 'remake' && rest[0] === '--check') {
      partnerPasswords((await io.stdin?.()) ?? '');
      io.out('checked: every partner has a password that follows the rule');
      return 0;
    }
    if (command === 'copy-company' && rest[0] === '--check') {
      const [code, ...extra] = rest.slice(1);
      if (!code || extra.length > 0) throw new Refused(USAGE);
      const demo = demoCopy(code);
      const neighbour = allCopies().find((copy) => copy.code !== demo)!;
      io.out(`checked: ${demo} is a demo copy, ${neighbour.code} is its neighbour for the drill`);
      return 0;
    }
    const storage = readStorageEnv(env);
    const connection = {
      baseUrl: storage.C_STORAGE_URL,
      internalAccessKey: storage.INTERNAL_ACCESS_KEY,
      fetch: io.fetch,
    };
    const service = { code: storage.SERVICE_CODE, accessKey: storage.SERVICE_ACCESS_KEY };
    const client = () =>
      createCStorageClient({ ...connection, ...service, serviceCode: service.code });

    if (command === 'register') {
      const superAdminKey = env['X_SUPER_ADMIN_KEY'];
      if (!superAdminKey) throw new Error('invalid environment: X_SUPER_ADMIN_KEY');
      io.out(`service ${await ensureService({ ...connection, superAdminKey }, service)}`);
      return 0;
    }

    if (command === 'rekey') {
      const superAdminKey = env['X_SUPER_ADMIN_KEY'];
      if (!superAdminKey) throw new Error('invalid environment: X_SUPER_ADMIN_KEY');
      const accessKey = ((await io.stdin?.()) ?? '').split('\n', 1).join('');
      if (!accessKey)
        throw new Refused('rekey: the new key is read from the standard input, one line');
      io.out(
        `service ${await rekeyService({ ...connection, superAdminKey }, { code: service.code, accessKey })}`,
      );
      return 0;
    }

    if (command === 'operator') {
      const replace = rest[0] === '--replace';
      const name = normaliseSignInName((replace ? rest[1] : rest[0]) ?? OPERATOR_NAME);
      if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(name))
        throw new Error('that is not an operator name');
      const origin = readAppOrigin(env);
      const now = Date.now();
      let token: string | null;
      if (replace) {
        const line = (await readRoster(client())).roster.operators.find((op) =>
          sameOperatorName(op.name, name),
        );
        if (!line) throw new Error(`there is no operator ${name}: run it without --replace`);
        token = await makeLink(client(), {
          operatorId: line.id,
          kind: 'replace',
          madeBy: null,
          now,
        });
      } else {
        const made = await createOperator(client(), { name, addedBy: null, now });
        if (made === 'taken') {
          throw new Error(
            `the operator ${name} exists: run it with --replace for a new-passkey link`,
          );
        }
        token = made.token;
      }
      if (token === null) throw new Error(`the operator ${name} has no account to give a link`);
      io.out(`operator ${name} ${replace ? 'replaced' : 'made'}`);
      io.show(
        `the operator is ${name}, ${replace ? 'new-passkey' : 'join'} link ${origin}${joinLinkPath(token)}`,
      );
      return 0;
    }

    if (command === 'tenant') {
      const [code, name] = rest;
      if (!clientCodeSchema.safeParse(code).success || !name) throw new Error(USAGE);
      const made = await createClient(client(), { code, name, madeAt: Date.now() });
      if (made === 'taken') throw new Error(`the code ${code} names a client already`);
      io.out(made.password);
      return 0;
    }

    if (command === 'tenant-id') {
      const [code] = rest;
      if (!clientCodeSchema.safeParse(code).success) throw new Error(USAGE);
      const found = await client().getRecord(recordKeys.client(code));
      if (!found) throw new Error(`no client ${code} here`);
      io.out(storedClientSchema.parse(found.data).id);
      return 0;
    }

    if (command === 'untenant') {
      const [code] = rest;
      // Only the code ops/check.sh makes (check-<date>t<time>z): a real client's code is refused, as
      // this command has none of the console's gates (a live operator and a fresh passkey touch).
      if (!code || !CHECK_CODE.test(code)) {
        throw new Error(
          'untenant deletes only the deploy check’s own client, check-<date>t<time>z',
        );
      }
      io.out(await removeCheckClient(client(), code, io.now ?? Date.now));
      return 0;
    }

    if (command === 'clear-checks') {
      const now = io.now ?? Date.now;
      const oldest = now() - CHECK_AGE_HOURS * 60 * 60 * 1000;
      const stale = (await listClients(client())).filter((item) => {
        const madeAt = checkMadeAt(item.code);
        return madeAt !== null && madeAt < oldest;
      });
      let failed = 0;
      for (const { code } of stale) {
        try {
          io.out(await removeCheckClient(client(), code, now));
        } catch (error) {
          failed += 1;
          io.err(`error: ${(error as Error).message}`);
        }
      }
      io.out(`clear-checks: ${stale.length - failed} deleted, ${failed} failed`);
      return failed === 0 ? 0 : 1;
    }

    if (command === 'remake') {
      const goOn = rest[0] === '--go-on';
      const keptDir = env['REMAKE_STORE_DIR'];
      const passwords = goOn ? null : partnerPasswords((await io.stdin?.()) ?? '');
      const now = io.now ?? Date.now;
      const commit = env['REMAKE_COMMIT'] ?? '';
      const filled = goOn ? await filledOn(keptDir, vietnamToday(now()), commit) : null;
      const copies = allCopies();
      const target = client();
      const begun = performance.now();
      // Until the first copy is begun on the target, a stop has deleted nothing there: a refusal.
      let reached = false;
      const carryAll = async (local: CStorageClient, dir: string) => {
        if (passwords) {
          // Filled here first, all six side by side, each let end before the store stops.
          const fills = await Promise.allSettled(
            copies.map((copy) =>
              fillLocally(local, copy, passwords.get(copy.partner)!, { out: io.out, now }),
            ),
          );
          const failed = fills.flatMap((fill, at) =>
            fill.status === 'rejected'
              ? [`${copies[at].code}: ${(fill.reason as Error).message}`]
              : [],
          );
          if (failed.length > 0)
            throw new Refused(`nothing was deleted on the target: ${failed.join('; ')}`);
          await writeFile(join(dir, FILLED_FILE), `${vietnamToday(now())} ${commit}`);
          io.out(
            `remake: this Mac's store built and the ${copies.length} copies filled on it, ${minutesSince(begun)} minutes`,
          );
        } else {
          io.out(
            `remake --go-on: the store the stopped run filled on ${filled} started again, ${minutesSince(begun)} minutes`,
          );
        }
        // A kept store from an older mapping lacks a copy: refused before any delete, never a crash
        // after the first.
        const indexes = new Map<string, { data: unknown }>();
        for (const copy of copies) {
          const index = await local.getRecord(recordKeys.client(copy.code));
          if (!index)
            throw new Refused(
              `nothing was deleted on the target: this Mac's store holds no copy ${copy.code}: run ops/demo-remake.sh ridge whole`,
            );
          indexes.set(copy.code, index);
        }
        reached = true;
        const spent = { deleting: 0, copying: 0 };
        // One copy at a time, each unreachable on the target only between its delete and its index.
        for (const copy of copies) {
          const one = await carryCopy(local, target, copy, indexes.get(copy.code)!, {
            out: io.out,
            now,
          }).catch((error: unknown) => {
            throw new Error(`${copy.code}: ${(error as Error).message}`, { cause: error });
          });
          spent.deleting += one.deleting;
          spent.copying += one.copying;
        }
        const minutes = (ms: number) => (ms / 60_000).toFixed(1);
        io.out(
          `remake: the deletes ${minutes(spent.deleting)} minutes, the copies ${minutes(spent.copying)} minutes`,
        );
      };
      await withLocalStore(carryAll, keptDir ? { dir: keptDir, reuse: goOn } : undefined).catch(
        (error: unknown) => {
          if (reached || error instanceof Refused) throw error;
          throw new Refused(
            `nothing was deleted on the target, this Mac's store stopped first: ${(error as Error).message}`,
          );
        },
      );
      io.out(
        `remake: ${copies.length} copies deleted, filled on this Mac and copied whole, ${minutesSince(begun)} minutes in all`,
      );
      return 0;
    }

    if (command === 'seed') {
      const reports = await applyAll(
        client(),
        vietnamToday((io.now ?? Date.now)()),
        io.out,
        undefined,
        MAX_DAYS_PER_RUN,
      );
      const count = (status: (typeof reports)[number]['status']) =>
        reports.filter((report) => report.status === status).length;
      const days = reports.reduce((sum, report) => sum + report.days.length, 0);
      // Only a copy that ended ok is behind: a refused one can carry a count too (the ledger moved under
      // the run after the days were counted), and it is named in the error below, not subtracted from ok.
      const behind = reports.filter((report) => report.status === 'ok' && report.remaining > 0);
      // Ends green, and says so where a person reading the log looks: before the summary line.
      if (behind.length > 0) {
        const most = Math.max(...behind.map((report) => report.remaining));
        io.out(
          `seed: STILL BEHIND, ${behind.length} copies have days left (${behind.map((r) => `${r.code} ${r.remaining}`).join(', ')}); this run applied ${MAX_DAYS_PER_RUN} days at most a copy, run it again to go on: ${Math.ceil(most / MAX_DAYS_PER_RUN)} more runs`,
        );
      }
      io.out(
        `seed: ${reports.length} copies mapped, ${count('ok') - behind.length} up to date, ${count('missing')} not on this service, ${days} days applied`,
      );
      const stopped = reports.filter((r) => r.status === 'refused');
      if (stopped.length > 0) {
        throw new Error(`left as they were, see above: ${stopped.map((r) => r.code).join(', ')}`);
      }
      return 0;
    }

    if (command === 'copy-company') {
      // The code as the product takes it, as --check and drill-record read it: Demo-A is demo-a.
      const code = normaliseClientCode(rest[0] ?? '');
      if (!clientCodeSchema.safeParse(code).success || rest.length !== 1) throw new Refused(USAGE);
      const from = readStorageEnv(
        Object.fromEntries(
          Object.entries(storageNames).map(([name, source]) => [name, env[`FROM_${source}`]]),
        ),
      );
      if (
        from.C_STORAGE_URL === storage.C_STORAGE_URL &&
        from.SERVICE_CODE === storage.SERVICE_CODE
      )
        throw new Refused('the source and the target are the same service');
      const source = createCStorageClient({
        baseUrl: from.C_STORAGE_URL,
        internalAccessKey: from.INTERNAL_ACCESS_KEY,
        serviceCode: from.SERVICE_CODE,
        accessKey: from.SERVICE_ACCESS_KEY,
        fetch: io.fetch,
      });
      const held = await source.getRecord(recordKeys.client(code));
      if (!held) throw new Refused(`the source holds no company with the code ${code}`);
      const id = storedClientSchema.parse(held.data).id;
      // A target remade since the moment restored names the code under another id: the records would go under an
      // id no index there names. An absent index is allowed (the company is moved onto a store that lacks it).
      const target = client();
      const there = await target.getRecord(recordKeys.client(code));
      if (there && storedClientSchema.parse(there.data).id !== id)
        throw new Refused(`the target names ${code} under another company id: nothing was written`);
      await carryCompany(source, target, id, code, io.out);
      return 0;
    }

    if (command === 'drill-record') {
      const [what, code, ...extra] = rest;
      if (!['put', 'has', 'remove'].includes(what ?? '') || !code || extra.length > 0)
        throw new Refused(USAGE);
      const store = client();
      const held = await store.getRecord(recordKeys.client(demoCopy(code)));
      if (!held) throw new Refused(`${code} is not on this service`);
      const key = `${recordKeys.tenant(storedClientSchema.parse(held.data).id).all}${DRILL_RECORD}`;
      if (what === 'put') await store.putRecord(key, { drill: true });
      if (what === 'remove') await store.removeRecord(key);
      io.out(what === 'has' ? ((await store.getRecord(key)) ? 'yes' : 'no') : `${what} ${code}`);
      return 0;
    }

    if (command === 'root-password') {
      const password = passwordFrom((await io.stdin?.()) ?? '');
      await setRootPasswords(client(), rest, password, { out: io.out, now: io.now ?? Date.now });
      return 0;
    }

    throw new Error(USAGE);
  } catch (error) {
    io.err(`error: ${(error as Error).message}`);
    return error instanceof Refused ? 2 : 1;
  }
}
