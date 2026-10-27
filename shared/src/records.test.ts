import { describe, expect, it } from 'vitest';
import { deviceIdSchema, normaliseSignInName, recordKeys } from './records';

describe('the record keys', () => {
  it('name the config, a user by its sign-in name and a session by its device', () => {
    expect(recordKeys.config).toBe('config');
    expect(recordKeys.user('root')).toBe('user.root');
    expect(recordKeys.session('device-0001')).toBe('session.device-0001');
  });
});

describe('a sign-in name', () => {
  it('is one user whatever its case, spacing or Unicode form', () => {
    expect(normaliseSignInName('  Root ')).toBe('root');
    expect(normaliseSignInName('Đạt'.normalize('NFD'))).toBe(normaliseSignInName('ĐẠT'));
  });
});

describe('a device id', () => {
  it('is 8 to 64 letters, digits, dashes or underscores, never a dot', () => {
    expect(deviceIdSchema.safeParse('3f2a-91bc_ok').success).toBe(true);
    for (const bad of ['short', 'has.a.dot-1234', 'has space 1234', 'x'.repeat(65)]) {
      expect(deviceIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
