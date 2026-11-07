import { createClient, deleteClient } from '@credo/bff/clients';
import { readAppOrigin, readStorageEnv } from '@credo/bff/env';
import { createOperator, makeLink, readRoster } from '@credo/bff/operators';
import {
  clientCodeSchema,
  createCStorageClient,
  joinLinkPath,
  normaliseSignInName,
  recordKeys,
  sameOperatorName,
  storedClientSchema,
} from '@credo/shared';
import { OPERATOR_NAME } from '@credo/shared/demo';
import { applyAll } from './demo/apply';
import { vietnamToday } from './demo/days';
import { ensureService } from './register';
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
const CHECK_CODE = /^check-\d{8}t\d{6}z$/;

const USAGE =
  'usage: register | operator [--replace] [<name>] | tenant <code> <name> | untenant <code> | seed | root-password [--check] <code>…';

/**
 * What `ops/*.sh` asks of a ridge reached through a tunnel, as the product's own functions do it:
 * the BFF's service registered with the super-admin key, the operator's account, and a client made
 * by the operator's create, and `untenant` deletes one whole by the operator's own delete function
 * (the check's client, with the keys the create used; it prints how many records went). The connection comes from the environment (C_STORAGE_URL and the BFF's
 * three keys; X_SUPER_ADMIN_KEY for `register` alone). Nothing it prints holds a key; a password is
 * printed once: the operator's to `show`, a client's root's to `out`. `seed` brings every mapped copy
 * that exists up to yesterday ({@link applyAll}); it makes no client and prints no password, and a
 * copy it had to leave (used first, or too far behind) ends it red after the others are done.
 * `root-password` sets the named demo copies' roots to the password on the standard input and
 * prints no password; `--check` needs no connection. Returns the exit status: 2 for what was
 * refused before anything was written, 1 for a failure.
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

    if (command === 'untenant') {
      const [code] = rest;
      // Only the code ops/check.sh makes (check-<date>t<time>z): a real client's code is refused, as
      // this command has none of the console's gates (a live operator and a fresh passkey touch).
      if (!code || !CHECK_CODE.test(code)) {
        throw new Error(
          'untenant deletes only the deploy check’s own client, check-<date>t<time>z',
        );
      }
      const held = await client().getRecord(recordKeys.client(code));
      const index = held ? { ...storedClientSchema.parse(held.data), tag: held.tag } : null;
      // One press: a bound of 200 records is far over the check's three.
      const done = await deleteClient(client(), {
        code,
        index,
        // the schema wants an operator's uuid; the terminal has none, so the nil one
        by: '00000000-0000-0000-0000-000000000000',
        now: io.now ?? Date.now,
      });
      if (done === 'unknown') {
        io.out(`no client ${code} to delete`);
        return 0;
      }
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
      io.out(`client ${code} deleted`);
      return 0;
    }

    if (command === 'seed') {
      const reports = await applyAll(client(), vietnamToday((io.now ?? Date.now)()), io.out);
      const count = (status: (typeof reports)[number]['status']) =>
        reports.filter((report) => report.status === status).length;
      const days = reports.reduce((sum, report) => sum + report.days.length, 0);
      io.out(
        `seed: ${reports.length} copies mapped, ${count('ok')} up to date, ${count('missing')} not on this service, ${days} days applied`,
      );
      const stopped = reports.filter((r) => r.status === 'refused' || r.status === 'too-far');
      if (stopped.length > 0) {
        throw new Error(`left as they were, see above: ${stopped.map((r) => r.code).join(', ')}`);
      }
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
