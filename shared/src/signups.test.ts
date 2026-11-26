import { describe, expect, it } from 'vitest';
import { recordKeys } from './records';
import {
  SIGN_UP_WAITING,
  SIGN_UPS_WAITING_MAX,
  signUpApprovedReplySchema,
  signUpListReplySchema,
  signUpReplySchema,
  signUpRequestSchema,
  signUpRoutes,
  storedSignUpSchema,
  waitingSignUpSchema,
} from './signups';

const OK = {
  code: 'phu-quy',
  name: 'Gạch Men Phú Quý',
  contactName: 'Nguyễn Văn An',
  contactPhone: '+84 901 234 567',
  password: 'Correct-horse-9!',
};

describe('a company’s sign-up on the wire', () => {
  it('8: takes the company’s code, name, the contact’s name and phone and the root’s password, and nothing more', () => {
    expect(signUpRequestSchema.parse(OK)).toEqual(OK);
    expect(signUpRequestSchema.safeParse({ ...OK, box: 'home' }).success).toBe(false);
    for (const field of Object.keys(OK)) {
      const { [field as keyof typeof OK]: _left, ...rest } = OK;
      expect(signUpRequestSchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it('8: bounds each field: the code by the company code’s rule, the name 1 to 200, the contact 1 to 100, the phone 1 to 20 of digits, spaces and plus, the password by the app’s rule', () => {
    const bad = (change: object) => signUpRequestSchema.safeParse({ ...OK, ...change }).success;
    expect(bad({ code: 'Phu Quy' })).toBe(false);
    expect(bad({ code: 'a' })).toBe(false);
    expect(bad({ name: '   ' })).toBe(false);
    expect(bad({ name: 'x'.repeat(201) })).toBe(false);
    expect(bad({ name: 'x'.repeat(200) })).toBe(true);
    expect(bad({ contactName: '' })).toBe(false);
    expect(bad({ contactName: 'x'.repeat(101) })).toBe(false);
    expect(bad({ contactPhone: '' })).toBe(false);
    expect(bad({ contactPhone: '0'.repeat(21) })).toBe(false);
    expect(bad({ contactPhone: '0'.repeat(20) })).toBe(true);
    expect(bad({ contactPhone: '090-123' })).toBe(false);
    expect(bad({ contactPhone: '090 12a' })).toBe(false);
    expect(bad({ password: 'weak' })).toBe(false);
    expect(bad({ password: 'no-digit-Here!' })).toBe(false);
    expect(bad({ password: null })).toBe(false);
  });

  it('8: trims the names and the phone', () => {
    const read = signUpRequestSchema.parse({
      ...OK,
      name: '  Phú Quý  ',
      contactName: ' An ',
      contactPhone: ' 0901 ',
    });
    expect([read.name, read.contactName, read.contactPhone]).toEqual(['Phú Quý', 'An', '0901']);
  });

  it('9: the record keeps the password as its hash alone, and the list and the answers carry none', () => {
    const stored = {
      name: OK.name,
      contactName: OK.contactName,
      contactPhone: OK.contactPhone,
      passwordHash: 'scrypt$aa$bb',
      sentAt: 1,
    };
    expect(storedSignUpSchema.parse(stored)).toEqual(stored);
    expect(storedSignUpSchema.safeParse({ ...stored, password: OK.password }).success).toBe(false);
    expect(storedSignUpSchema.safeParse({ ...stored, id: 'x' }).success).toBe(false);
    const { passwordHash: _hash, ...shown } = stored;
    const item = { code: OK.code, ...shown };
    expect(waitingSignUpSchema.parse(item)).toEqual(item);
    expect(waitingSignUpSchema.safeParse({ ...item, passwordHash: 'x' }).success).toBe(false);
    expect(signUpListReplySchema.parse({ signUps: [item] })).toEqual({ signUps: [item] });
    expect(signUpListReplySchema.safeParse({ signUps: [{ ...item, password: 'x' }] }).success).toBe(
      false,
    );
    expect(signUpReplySchema.parse({ code: OK.code })).toEqual({ code: OK.code });
    expect(signUpReplySchema.safeParse({ code: OK.code, password: 'x' }).success).toBe(false);
    expect(signUpApprovedReplySchema.parse({ link: '/login?client-code=phu-quy' })).toEqual({
      link: '/login?client-code=phu-quy',
    });
  });

  it('7: no more than 20 requests wait at once', () => {
    expect(SIGN_UPS_WAITING_MAX).toBe(20);
  });

  it('The routes are the public send, and the operator’s list, approval and refusal, by the code', () => {
    expect(signUpRoutes.send).toBe('/api/sign-up');
    expect(signUpRoutes.list).toBe('/api/operator/sign-ups');
    expect(signUpRoutes.one('phu-quy')).toBe('/api/operator/sign-ups/phu-quy');
    expect(signUpRoutes.approve('phu-quy')).toBe('/api/operator/sign-ups/phu-quy/approve');
    expect(SIGN_UP_WAITING).toBe('waiting');
  });

  it('1: a waiting request is one record beside the client index, under a prefix of its own', () => {
    expect(recordKeys.signUp('phu-quy')).toBe('sign-up.phu-quy');
    expect(recordKeys.signUp('phu-quy').startsWith(recordKeys.clientPrefix)).toBe(false);
    expect(recordKeys.signUp('phu-quy').startsWith(recordKeys.signUpPrefix)).toBe(true);
    expect(recordKeys.client('phu-quy').startsWith(recordKeys.signUpPrefix)).toBe(false);
  });
});
