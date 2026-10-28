// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { folderName, sourceOf, vietnamTime } from './home';

describe('the folder every worktree builds into', () => {
  it('Every worktree’s builds land in one list, the credo root’s walks/, a folder a build, never committed', async () => {
    const { root, worktree } = makeRoot();

    const source = await sourceOf(worktree);

    // The folder that holds `.bare`, not the worktree: one list for every worktree.
    expect(source.home).toBe(join(root, 'walks'));
  });

  it('keeps a plain repository’s list beside its own .git', async () => {
    const { root } = makeRoot();
    const plain = join(root, 'seed');

    expect((await sourceOf(plain)).home).toBe(join(plain, 'walks'));
  });

  it('says the branch and the commit’s short hash and time, never who made it', async () => {
    const { worktree, commit } = makeRoot('some-branch');

    const source = await sourceOf(worktree);

    expect(source.branch).toBe('some-branch');
    expect(source.commit).toBe(commit);
    expect(source.commit).toHaveLength(9);
    expect(source.committedAt.toISOString()).toBe('2026-10-27T18:59:00.000Z');
    expect(JSON.stringify(source)).not.toContain('Zed');
  });

  it('knows a changed tree from a clean one', async () => {
    const { worktree } = makeRoot();
    expect((await sourceOf(worktree)).changed).toBe(false);

    writeFileSync(join(worktree, 'file.txt'), 'two\n');

    expect((await sourceOf(worktree)).changed).toBe(true);
  });

  it('outside a repository none is written, and the build says why', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'walks-outside-'));

    await expect(sourceOf(outside)).rejects.toThrow('not inside a git repository');
  });
});

describe('the folder’s name', () => {
  const source = {
    branch: 'b',
    commit: 'abc123def',
    changed: false,
    committedAt: new Date(0),
    home: '/h',
  };

  it('The folder is named <date>-<time>-<commit> in Vietnam’s time, built from the date’s parts, -changes on a changed tree', () => {
    // 18:30 UTC on the 27th is 01:30 on the 28th in Vietnam, across midnight and a month's turn.
    const builtAt = new Date('2026-10-27T18:30:05Z');
    expect(folderName(source, builtAt)).toBe('2026-10-28-013005-abc123def');
    expect(folderName({ ...source, changed: true }, builtAt)).toBe(
      '2026-10-28-013005-abc123def-changes',
    );
    expect(folderName(source, new Date('2026-12-31T17:00:00Z'))).toBe(
      '2027-01-01-000000-abc123def',
    );
  });

  it('shows a time for the page in Vietnam’s zone', () => {
    expect(vietnamTime(new Date('2026-10-27T18:59:00Z')).shown).toBe('2026-10-28 01:59 +07');
  });
});
