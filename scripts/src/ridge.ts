import { readStorageEnv } from '@credo/bff/env';
import { createClient } from '@credo/bff/clients';
import { hashPassword, newPassword } from '@credo/bff/password';
import {
  clientCodeSchema,
  createCStorageClient,
  normaliseSignInName,
  recordKeys,
  type StoredOperator,
} from '@credo/shared';
import { OPERATOR_NAME } from '@credo/shared/demo';
import { ensureService } from './register';

export type RidgeIo = {
  /** A line for the caller's output: a log, or a command substitution. */
  out: (line: string) => void;
  /** A line for the human's terminal alone: the operator's first password goes only here. */
  show: (line: string) => void;
  err: (line: string) => void;
  fetch?: typeof fetch;
};

const USAGE = 'usage: register | operator [--replace] [<name>] | tenant <code> <name>';

/**
 * What `ops/*.sh` asks of a ridge reached through a tunnel, as the product's own functions do it:
 * the BFF's service registered with the super-admin key, the operator's account, and a client made
 * by the operator's create. The connection comes from the environment (C_STORAGE_URL and the BFF's
 * three keys; X_SUPER_ADMIN_KEY for `register` alone). Nothing it prints holds a key; a password is
 * printed once: the operator's to `show`, a client's root's to `out`. Returns the exit status.
 */
export async function runRidge(
  argv: string[],
  env: Record<string, string | undefined>,
  io: RidgeIo,
): Promise<number> {
  const [command, ...rest] = argv;
  try {
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
      const password = newPassword();
      const record: StoredOperator = { passwordHash: await hashPassword(password) };
      const saved = await client().putRecord(
        recordKeys.operatorUser(name),
        record,
        replace ? undefined : null,
      );
      if (saved === 'moved') {
        throw new Error(`the operator ${name} exists: run it with --replace for a new password`);
      }
      io.out(`operator ${name} ${replace ? 'replaced' : 'made'}`);
      io.show(`the operator is ${name}, first password ${password}`);
      return 0;
    }

    if (command === 'tenant') {
      const [code, name] = rest;
      if (!clientCodeSchema.safeParse(code).success || !name) throw new Error(USAGE);
      const made = await createClient(client(), { code, name });
      if (made === 'taken') throw new Error(`the code ${code} names a client already`);
      io.out(made.password);
      return 0;
    }

    throw new Error(USAGE);
  } catch (error) {
    io.err(`error: ${(error as Error).message}`);
    return 1;
  }
}
