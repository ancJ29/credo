/**
 * The names of the environment variables the stack and the demo hand to a command, and the walks
 * read. The one place they are spelled: `scripts/src/cli.ts` builds its blocks from these keys and
 * the walk specs read through them, so a renamed or misspelled name is a type error where it is used.
 * Each value is branded, so a name typed out by hand, even a right one, is not accepted where an
 * environment name is asked for: only these are.
 */
export type EnvName = string & { readonly stackEnv: true };
const envName = (name: string) => name as EnvName;

export const STACK_ENV = {
  CREDO_URL: envName('CREDO_URL'),
  CREDO_CLIENT_CODE: envName('CREDO_CLIENT_CODE'),
  CREDO_ROOT_NAME: envName('CREDO_ROOT_NAME'),
  CREDO_ROOT_PASSWORD: envName('CREDO_ROOT_PASSWORD'),
  CREDO_OPERATOR_NAME: envName('CREDO_OPERATOR_NAME'),
  CREDO_OPERATOR_HANDLE: envName('CREDO_OPERATOR_HANDLE'),
  CREDO_OPERATOR_PASSKEY: envName('CREDO_OPERATOR_PASSKEY'),
  CREDO_OPERATOR_LINK: envName('CREDO_OPERATOR_LINK'),
  CREDO_PEOPLE: envName('CREDO_PEOPLE'),
  CREDO_SEED_URL: envName('CREDO_SEED_URL'),
  CREDO_COPIES: envName('CREDO_COPIES'),
};
export type StackEnvName = keyof typeof STACK_ENV;
