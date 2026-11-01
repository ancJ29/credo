// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { parseBlock } from './block';
import { yesTo } from './bulk';
import { blockOf, shareOf } from './choices';
import { answer, parseArgs, report } from './cli';
import { HUMAN } from './marks';
import { placesOf } from './nav';
import type { Report } from './report';
import { allKeys, WALKS } from './walks';

/**
 * The file's one whole-page draw, made in `beforeAll`: drawing every screen of every walk in both
 * languages takes minutes under load, so it is paid once, here, with the budget of its own, and
 * never charged to whichever test runs first. The report test reads its folder and two lines, and
 * the answers tests that answer on a real screen read the page it wrote (`walks.json`).
 */
let built: { root: string; folder: string; lines: string[]; page: Report };
beforeAll(async () => {
  const { root, worktree } = makeRoot();
  const lines: string[] = [];
  const folder = await report(worktree, (line) => lines.push(line));
  built = {
    root,
    folder,
    lines,
    page: JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8')) as Report,
  };
}, 240_000);

describe('pnpm report', () => {
  it('builds the page from the repository it runs in, with the screens drawn on a DOM of its own, and says where and what waits', () => {
    const { root, folder, lines, page } = built;

    expect(readdirSync(join(root, 'walks'))).toHaveLength(1);
    // The rows come from the committed `answers.json`, which the walks fill, so only the sum is fixed.
    expect(lines[0]).toBe(`walks page: ${folder}`);
    expect(lines).toHaveLength(2);
    const counts = /^(\d+) waiting, (\d+) asked again, (\d+) no, (\d+) yes$/.exec(lines[1])!;
    // Every screen is asked in both languages, whatever the walks hold now.
    const shown = WALKS.flatMap((walk) => walk.screens).length * 2;
    expect(counts.slice(1).reduce((sum, n) => sum + Number(n), 0)).toBe(shown);
    const failedSave = page.walks[0].screens.find((screen) => screen.id === '7-save-failed')!;
    expect(failedSave.languages['en'].words).toContain(
      'alert: The settings were not saved. What you typed is still here: try again.',
    );
    // Groups A, B, C and D of piece 2: their thirty-three screens drawn as scenes, none from the mock, a
    // state for each of the sixty-six (screen, language) pairs whatever the answers file holds now,
    // and the typing and pressing done on the page as a person does them.
    const piece2 = page.walks.slice(
      page.walks.findIndex((walk) => walk.id === 'admin-staff-setup'),
      page.walks.findIndex((walk) => walk.id === 'admin-staff-setup') + 4,
    );
    const screens = piece2.flatMap((walk) => walk.screens);
    expect(piece2.map((walk) => walk.id)).toEqual([
      'admin-staff-setup',
      'admin-staff',
      'office-staff',
      'phone-sign-in',
    ]);
    expect(screens).toHaveLength(33);
    expect(screens.filter((screen) => 'mock' in screen)).toEqual([]);
    expect(screens.filter((screen) => !('scene' in screen))).toEqual([]);
    const asked = screens.flatMap((screen) => Object.values(screen.languages));
    expect(asked).toHaveLength(66);
    const added = piece2[1].screens.find((screen) => screen.id === 'staff-3-added')!;
    expect(added.languages['en'].words).toContain('textbox "First password" = "Fake-password-1!"');
    expect(piece2[1].screens[1].languages['vi'].words).toContain('textbox "Tên" = "Mai Linh"');
    // The driver's walk, drawn there too: the photo is chosen and shown, with no refusal in its place.
    const driver = page.walks.find((walk) => walk.id === 'driver-deliveries')!;
    expect(driver.screens).toHaveLength(6);
    const photo = driver.screens.find((screen) => screen.id === 'driver-3-photo')!;
    expect(photo.languages['en'].words).toContain('heading: Your photo');
    expect(photo.languages['en'].words.filter((line) => line.startsWith('alert'))).toEqual([]);
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

  /** The fingerprints the file's one build holds, to answer on as the human's block does. */
  const fingerprint = (id: string, language: 'vi' | 'en') =>
    built.page.walks[0].screens.find((screen) => screen.id === id)!.languages[language].fingerprint;

  it('writes the answers that hold into the file, on the words the screens draw now, dated in Vietnam’s day, and says what it took and refused', async () => {
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

  /**
   * The page of the one build with every screen set waiting and “Yes to all” pressed. `answer`
   * would draw every screen again to hold a block of all of them, which is the cost of a whole
   * build, so the two tests below hold the whole message by parsing it, and `answer` on a few of
   * its keys.
   */
  function yesToAll() {
    // a copy: this sets every screen waiting, and the others read the page as it was built
    const page = structuredClone(built.page);
    for (const walk of page.walks) {
      for (const screen of walk.screens) {
        for (const language of ['vi', 'en'] as const) {
          screen.languages[language].shown = { kind: 'waiting' };
        }
      }
    }
    const { next, count } = yesTo(placesOf(page), {}, HUMAN);
    expect(count).toBe(allKeys(WALKS).length);
    return { page, next };
  }

  /**
   * A message with all its lines but a few answers: the first, the middle and the last, and the
   * lines of the keys in `also`.
   */
  function fewOf(text: string, also: ReadonlySet<string> = new Set()) {
    const lines = text.split('\n');
    const answers = lines.filter((line) => / \| (yes|no) \| [0-9a-f]{12}$/.test(line));
    const keep = new Set([
      answers[0],
      answers[Math.floor(answers.length / 2)],
      answers.at(-1)!,
      ...answers.filter((line) => also.has(line.split(' | ')[0])),
    ]);
    return {
      text: lines.filter((line) => !answers.includes(line) || keep.has(line)).join('\n'),
      keys: [...keep].map((line) => line.split(' | ')[0]),
    };
  }

  it('takes a block made by “Yes to all” with plain pnpm answers', async () => {
    const { page, next } = yesToAll();
    const { text } = blockOf(page, next);
    const file = FILE();
    writeFileSync(file, '{}');

    // all of it parses, every key once and none refused
    const all = parseBlock(text);
    expect(all.refused).toEqual([]);
    expect(all.entries.map((entry) => entry.key).sort()).toEqual([...allKeys(WALKS)].sort());
    expect(all.entries.filter((entry) => entry.by !== '')).toEqual([]);
    // and a few of its keys, drawn now, hold against the words of the screens: the first four walks
    // (the operator's and the first admin's), which no other test draws a second time, and three more
    const few = fewOf(text, new Set(allKeys(WALKS.slice(0, 4))));
    expect(few.keys).toHaveLength(allKeys(WALKS.slice(0, 4)).length + 2);
    expect(await answer(few.text, () => {}, { file, now: NOW })).toBe(0);

    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')) as object).sort()).toEqual(
      few.keys.sort(),
    );
  });

  it('takes a Share message made by “Yes to all” with --partners, every key under the partner’s label', async () => {
    const { page, next } = yesToAll();
    const { text } = shareOf(page, next, 'p1');
    const file = FILE();
    writeFileSync(file, '{}');

    const all = parseBlock(text, { partners: true });
    expect(all.refused).toEqual([]);
    expect(all.entries.map((entry) => `${entry.key}@${entry.by}`).sort()).toEqual(
      allKeys(WALKS)
        .map((key) => `${key}@p1`)
        .sort(),
    );
    const few = fewOf(text);
    expect(few.keys).toHaveLength(3);
    expect(await answer(few.text, () => {}, { file, now: NOW, partners: true })).toBe(0);

    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')) as object).sort()).toEqual(
      few.keys.map((key) => `${key}@p1`).sort(),
    );
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
