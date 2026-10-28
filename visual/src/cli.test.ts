// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { answer, report } from './cli';

describe('pnpm report', () => {
  it('builds the page from the repository it runs in, with the screens drawn on a DOM of its own, and says where and what waits', async () => {
    const { root, worktree } = makeRoot();
    const lines: string[] = [];

    const folder = await report(worktree, (line) => lines.push(line));

    expect(readdirSync(join(root, 'walks'))).toHaveLength(1);
    expect(lines).toEqual([`walks page: ${folder}`, '26 waiting, 0 asked again, 0 no, 0 yes']);
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

describe('pnpm answers', () => {
  const FILE = () => join(mkdtempSync(join(tmpdir(), 'walks-answers-')), 'answers.json');
  const NOW = new Date('2026-10-28T20:00:00Z');
  type Built = {
    walks: { screens: { id: string; languages: Record<string, { fingerprint: string }> }[] }[];
  };

  /** The fingerprints the page of a real build holds, to answer on as the human's block does. */
  async function pageFingerprints() {
    const { worktree } = makeRoot();
    const folder = await report(worktree, () => {});
    const built = JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8')) as Built;
    return (id: string, language: string) =>
      built.walks[0].screens.find((screen) => screen.id === id)!.languages[language].fingerprint;
  }

  it('writes the answers that hold into the file, on the words the screens draw now, dated in Vietnam’s day, and says what it took and refused', async () => {
    const fingerprint = await pageFingerprints();
    const file = FILE();
    writeFileSync(file, '{}');
    const lines: string[] = [];
    const block = [
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      `admin-setup:1-sign-in:vi | yes | ${fingerprint('1-sign-in', 'vi')}`,
      `admin-setup:7-save-failed:en | no | ${fingerprint('7-save-failed', 'en')} | nothing says what to do`,
      `admin-setup:3-settings:en | yes | ${fingerprint('1-sign-in', 'en')}`,
    ].join('\n');

    const refused = await answer(block, (line) => lines.push(line), { file, now: NOW });

    expect(refused).toBe(1);
    const written = JSON.parse(readFileSync(file, 'utf8')) as Record<
      string,
      { answer: string; on: string; reason: string; words: string[] }
    >;
    expect(Object.keys(written)).toEqual([
      'admin-setup:1-sign-in:vi',
      'admin-setup:7-save-failed:en',
    ]);
    expect(written['admin-setup:1-sign-in:vi']).toMatchObject({
      answer: 'yes',
      on: '2026-10-29',
      reason: '',
    });
    expect(written['admin-setup:7-save-failed:en'].words).toContain(
      'alert: The settings were not saved. What you typed is still here: try again.',
    );
    expect(written['admin-setup:7-save-failed:en'].reason).toBe('nothing says what to do');
    expect(readFileSync(file, 'utf8').endsWith('}\n')).toBe(true);
    expect(lines).toEqual([
      'taken: admin-setup:1-sign-in:vi',
      'taken: admin-setup:7-save-failed:en',
      expect.stringMatching(/^refused, line 5: admin-setup:3-settings:en: stale/),
      '2 written to answers.json, 1 refused',
    ]);
    expect('document' in globalThis).toBe(false);
  });

  it('leaves the file alone when every line is refused', async () => {
    const file = FILE();
    writeFileSync(file, '{}');
    const lines: string[] = [];

    const refused = await answer(
      'Credo walks answers\nadmin-setup:1-sign-in:vi | yes | 000000000000',
      (line) => lines.push(line),
      { file },
    );

    expect(refused).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe('{}');
    expect(lines.at(-1)).toBe('0 written to answers.json, 1 refused');
  });

  it('stops on an answers file that does not parse, and puts the process back', async () => {
    const file = FILE();
    writeFileSync(file, '[');

    await expect(answer('Credo walks answers', () => {}, { file })).rejects.toThrow(
      'answers.json does not parse',
    );
    expect('document' in globalThis).toBe(false);
  });
});
