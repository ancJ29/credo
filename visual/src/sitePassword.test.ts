import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestOf } from '../site/gate';
import { readGateHash } from '../site/gate-file';

const SCRIPT = join(import.meta.dirname, '..', '..', 'ops', 'site-password.sh');
const fileIn = () => join(mkdtempSync(join(tmpdir(), 'site-password-')), 'hash');
const run = (file: string, input: string, args: string[] = []) =>
  spawnSync('bash', [SCRIPT, ...args], {
    input,
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', SITE_PASSWORD_FILE: file },
  });

describe('ops/site-password.sh', () => {
  it('writes the hash the browser computes, replaces an earlier one, prints no password and says the change needs a commit and a push', async () => {
    const file = fileIn();
    writeFileSync(file, 'old\n');
    const first = run(file, 'a long enough secret\n');
    expect(first.status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(
      `${await digestOf('a long enough secret', globalThis as never)}\n`,
    );
    expect(readGateHash(file)).toHaveLength(64);
    expect(first.stdout + first.stderr).not.toContain('secret');
    expect(first.stdout.trim().split('\n').at(-1)).toBe(
      "== done: run in pre-merge's worktree (cd <the credo root>/pre-merge); the machine then commits this file alone, checks both sites, moves main and hands you the push; the new password takes effect once both workflows publish. This script commits and pushes nothing.",
    );
    const before = readFileSync(file, 'utf8');
    expect(run(file, 'another one\n').status).toBe(0);
    expect(readFileSync(file, 'utf8')).not.toBe(before);
  });

  it('writes nothing for an empty password or an argument', () => {
    const file = fileIn();
    const empty = run(file, '\n');
    expect(empty.status).toBe(2);
    expect(empty.stderr).toContain('== refused: the password is empty');
    expect(run(file, 'x\n', ['extra']).status).toBe(2);
    expect(existsSync(file)).toBe(false);
  });
});
