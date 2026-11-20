import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_HASH_PATH, readGateHash } from './gate-file';

const folder = mkdtempSync(join(tmpdir(), 'gate-file-'));
const write = (name: string, text: string) => {
  const file = join(folder, name);
  writeFileSync(file, text);
  return file;
};

describe('the password hash file', () => {
  it('reads one SHA-256 hash, a final newline allowed', () => {
    expect(readGateHash(write('good', `${'0f'.repeat(32)}\n`))).toBe('0f'.repeat(32));
    expect(GATE_HASH_PATH).toBe('ops/site-password.sha256');
  });

  it('refuses a missing file, naming the command', () => {
    expect(() => readGateHash(join(folder, 'none'))).toThrow(
      /is missing\. Run bash ops\/site-password\.sh/,
    );
  });

  it.each([
    ['empty', ''],
    ['a stand-in word', 'changeme\n'],
    ['too short', 'ab'.repeat(31)],
    ['upper case', 'AB'.repeat(32)],
    ['two hashes', `${'ab'.repeat(32)}\n${'cd'.repeat(32)}\n`],
  ])('refuses %s, naming the command', (name, text) => {
    expect(() => readGateHash(write(name, text))).toThrow(
      /does not hold one SHA-256 hash\. Run bash ops\/site-password\.sh/,
    );
  });
});
