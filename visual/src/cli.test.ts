// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { answer, parseArgs, report } from './cli';

describe('pnpm report', () => {
  it('builds the page from the repository it runs in, with the screens drawn on a DOM of its own, and says where and what waits', async () => {
    const { root, worktree } = makeRoot();
    const lines: string[] = [];

    const folder = await report(worktree, (line) => lines.push(line));

    expect(readdirSync(join(root, 'walks'))).toHaveLength(1);
    // The rows come from the committed `answers.json`, which the walks fill, so only the sum is fixed.
    expect(lines[0]).toBe(`walks page: ${folder}`);
    expect(lines).toHaveLength(2);
    const counts = /^(\d+) waiting, (\d+) asked again, (\d+) no, (\d+) yes$/.exec(lines[1])!;
    expect(counts.slice(1).reduce((sum, n) => sum + Number(n), 0)).toBe(58);
    type Language = { words: string[]; shown: { kind: string } };
    type Screen = {
      id: string;
      mock?: unknown;
      scene?: unknown;
      languages: Record<string, Language>;
    };
    const walks = JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8')) as {
      walks: { id: string; screens: Screen[] }[];
    };
    const failedSave = walks.walks[0].screens.find((screen) => screen.id === '7-save-failed')!;
    expect(failedSave.languages['en'].words).toContain(
      'alert: The settings were not saved. What you typed is still here: try again.',
    );
    // Group A of piece 2: its sixteen screens drawn as scenes, none from the mock, thirty-two answers
    // waiting, and the typing and pressing done on the page as a person does them.
    const piece2 = walks.walks.slice(2);
    const screens = piece2.flatMap((walk) => walk.screens);
    expect(piece2.map((walk) => walk.id)).toEqual([
      'admin-staff-setup',
      'admin-staff',
      'office-staff',
    ]);
    expect(screens).toHaveLength(16);
    expect(screens.filter((screen) => 'mock' in screen)).toEqual([]);
    expect(screens.filter((screen) => !('scene' in screen))).toEqual([]);
    const waiting = screens.flatMap((screen) => Object.values(screen.languages));
    expect(waiting.filter((language) => language.shown.kind === 'waiting')).toHaveLength(32);
    const added = piece2[1].screens.find((screen) => screen.id === 'staff-3-added')!;
    expect(added.languages['en'].words).toContain('textbox "First password" = "Fake-password-1!"');
    expect(piece2[1].screens[1].languages['vi'].words).toContain('textbox "Tên" = "Mai Linh"');
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

describe('the command line', () => {
  it('reads the command and the file, and --partners wherever it stands', () => {
    expect(parseArgs(['answers', 'paste.txt'])).toEqual({
      command: 'answers',
      file: 'paste.txt',
      partners: false,
    });
    expect(parseArgs(['answers', '--partners', 'paste.txt']).partners).toBe(true);
    expect(parseArgs(['--partners', 'answers', 'paste.txt'])).toEqual({
      command: 'answers',
      file: 'paste.txt',
      partners: true,
    });
    expect(parseArgs(['answers', 'paste.txt', '--partners'])).toEqual({
      command: 'answers',
      file: 'paste.txt',
      partners: true,
    });
    expect(parseArgs(['answers', '--partners'])).toEqual({
      command: 'answers',
      file: undefined,
      partners: true,
    });
    expect(parseArgs([])).toEqual({ command: undefined, file: undefined, partners: false });
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

  it('With partners, takes a partner’s Share post under their label, refuses a human’s block among them, and the plain command refuses the partner’s', async () => {
    const fingerprint = await pageFingerprints();
    const print = fingerprint('1-sign-in', 'vi');
    const key = 'admin-setup:1-sign-in:vi';
    const paste = [
      'Credo walks answers',
      'By: p1',
      `${key} | yes | ${print}`,
      'Credo walks answers',
      `${key} | yes | ${print}`,
    ].join('\n');
    const theirs = FILE();
    writeFileSync(theirs, '{}');
    const lines: string[] = [];

    const refused = await answer(paste, (line) => lines.push(line), {
      file: theirs,
      now: NOW,
      partners: true,
    });

    expect(refused).toBe(1);
    expect(Object.keys(JSON.parse(readFileSync(theirs, 'utf8')) as object)).toEqual([`${key}@p1`]);
    expect(lines.at(-1)).toBe('1 written to answers.json, 1 refused');
    const mine = FILE();
    writeFileSync(mine, '{}');
    const plain: string[] = [];
    expect(await answer(paste, (line) => plain.push(line), { file: mine, now: NOW })).toBe(1);
    expect(readFileSync(mine, 'utf8')).toBe('{}');
    expect(plain.at(-1)).toBe('0 written to answers.json, 1 refused');
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
