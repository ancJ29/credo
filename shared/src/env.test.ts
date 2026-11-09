import { describe, expect, it } from 'vitest';
import { STACK_ENV } from './env';

describe('the stack environment names', () => {
  it('are the eleven the stack and demo hand over, each key its own name', () => {
    // pinned as literals on purpose: a test that read the object would follow it to any value
    expect(Object.keys(STACK_ENV).sort()).toEqual(
      [
        'CREDO_CLIENT_CODE',
        'CREDO_COPIES',
        'CREDO_OPERATOR_HANDLE',
        'CREDO_OPERATOR_LINK',
        'CREDO_OPERATOR_NAME',
        'CREDO_OPERATOR_PASSKEY',
        'CREDO_PEOPLE',
        'CREDO_ROOT_NAME',
        'CREDO_ROOT_PASSWORD',
        'CREDO_SEED_URL',
        'CREDO_URL',
      ].sort(),
    );
    for (const [key, name] of Object.entries(STACK_ENV)) expect(name).toBe(key);
  });
});
