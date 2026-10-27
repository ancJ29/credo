// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { report } from './cli';

describe('pnpm report', () => {
  it('builds the page from the repository it runs in, with the screens drawn on a DOM of its own, and says where and what waits', async () => {
    const { root, worktree } = makeRoot();
    const lines: string[] = [];

    const folder = await report(worktree, (line) => lines.push(line));

    expect(readdirSync(join(root, 'walks'))).toHaveLength(1);
    expect(lines).toEqual([`walks page: ${folder}`, '14 waiting, 0 asked again, 0 no, 0 yes']);
    const walks = JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8')) as {
      walks: { screens: { id: string; languages: Record<string, { words: string[] }> }[] }[];
    };
    const failedSave = walks.walks[0].screens.find((screen) => screen.id === '7-save-failed')!;
    expect(failedSave.languages['en'].words).toContain(
      'alert: The settings were not saved. What you typed is still here: try again.',
    );
    // The process has its own globals back.
    expect('document' in globalThis).toBe(false);
  });

  it('puts the process back as it was when the build stops', async () => {
    const lines: string[] = [];

    await expect(
      report('/nonexistent-folder-for-walks', (line) => lines.push(line)),
    ).rejects.toThrow();

    expect(lines).toEqual([]);
    expect('document' in globalThis).toBe(false);
  });
});
