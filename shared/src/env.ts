/**
 * The names of the environment variables the stack and the demo hand to a command, and the walks
 * read. The one place they are spelled: `scripts/src/cli.ts` builds its blocks from these keys and
 * the walk specs read through them, so a renamed or misspelled name is a type error where it is used.
 */
export const STACK_ENV = {
  CREDO_URL: 'CREDO_URL',
  CREDO_CLIENT_CODE: 'CREDO_CLIENT_CODE',
  CREDO_ROOT_NAME: 'CREDO_ROOT_NAME',
  CREDO_ROOT_PASSWORD: 'CREDO_ROOT_PASSWORD',
  CREDO_OPERATOR_NAME: 'CREDO_OPERATOR_NAME',
  CREDO_OPERATOR_HANDLE: 'CREDO_OPERATOR_HANDLE',
  CREDO_OPERATOR_PASSKEY: 'CREDO_OPERATOR_PASSKEY',
  CREDO_OPERATOR_LINK: 'CREDO_OPERATOR_LINK',
  CREDO_PEOPLE: 'CREDO_PEOPLE',
  CREDO_SEED_URL: 'CREDO_SEED_URL',
  CREDO_COPIES: 'CREDO_COPIES',
} as const;
export type StackEnvName = keyof typeof STACK_ENV;
