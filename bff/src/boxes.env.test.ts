import { describe, expect, it } from 'vitest';
import { readStorageEnv } from './env';

const four = {
  C_STORAGE_URL: 'http://127.0.0.1:9000',
  INTERNAL_ACCESS_KEY: 'internal-key-aaaa',
  SERVICE_CODE: 'svc',
  SERVICE_ACCESS_KEY: 'service-key-aaaa',
};
const second = { b2: { url: 'http://10.0.0.2:9000', internalKey: 'i2-key', serviceKey: 's2-key' } };

describe('STORAGE_BOXES hands the back end its other boxes', () => {
  it('is the home box alone with no variable, and reads each box by name with it', () => {
    expect(readStorageEnv(four).STORAGE_BOXES).toBeUndefined();
    expect(
      readStorageEnv({ ...four, STORAGE_BOXES: JSON.stringify(second) }).STORAGE_BOXES,
    ).toEqual(second);
  });

  it('refuses a malformed value at start, naming the variable and none of its text', () => {
    const bad = [
      'not json',
      '[]',
      JSON.stringify({ b2: { url: 'nope', internalKey: 'i2-key', serviceKey: 's2-key' } }),
      JSON.stringify({ B2: second.b2 }),
      JSON.stringify({ home: second.b2 }),
      JSON.stringify({ b2: { ...second.b2, extra: 'x' } }),
    ];
    for (const value of bad) {
      for (const read of [readStorageEnv]) {
        let message = '';
        try {
          read({ ...four, PORT: '1', STORAGE_BOXES: value });
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message.startsWith('invalid environment:'), value).toBe(true);
        expect(message).toContain('STORAGE_BOXES');
        expect(message).not.toContain('i2-key');
      }
    }
  });
});
