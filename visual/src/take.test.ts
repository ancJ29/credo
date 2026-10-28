// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { fingerprintOf } from './fingerprint';
import { takeAnswers } from './take';

const WORDS = ['heading: Sign in'];
const current = new Map([
  ['w:1-a:vi', WORDS],
  ['w:1-a:en', ['heading: Sign in', 'button: Go']],
]);
const fp = (key: string) => fingerprintOf(current.get(key)!);
const block = (...lines: string[]) => ['Credo walks answers', ...lines].join('\n');
const take = (text: string, existing: Answers = {}, partners = false) =>
  takeAnswers(text, current, existing, '2026-10-29', { partners });

describe('taking a pasted block', () => {
  it('writes each answer on the words it was given on, dated, a no with its reason, keys sorted', () => {
    const { answers, taken, refused } = take(
      block(`w:1-a:vi | yes | ${fp('w:1-a:vi')}`, `w:1-a:en | no | ${fp('w:1-a:en')} | too small`),
    );

    expect(refused).toEqual([]);
    expect(taken).toEqual(['w:1-a:vi', 'w:1-a:en']);
    expect(Object.keys(answers)).toEqual(['w:1-a:en', 'w:1-a:vi']);
    expect(answers['w:1-a:vi']).toEqual({
      answer: 'yes',
      on: '2026-10-29',
      reason: '',
      words: WORDS,
    });
    expect(answers['w:1-a:en']).toEqual({
      answer: 'no',
      on: '2026-10-29',
      reason: 'too small',
      words: ['heading: Sign in', 'button: Go'],
    });
  });

  it('keeps the rows of other screens, and a yes with a reason drops it', () => {
    const other: Answers[string] = { answer: 'yes', on: '2026-10-01', reason: '', words: ['x'] };

    const { answers } = take(block(`w:1-a:vi | yes | ${fp('w:1-a:vi')} | ignored`), {
      'w:9-z:vi': other,
    });

    expect(answers['w:9-z:vi']).toEqual(other);
    expect(answers['w:1-a:vi'].reason).toBe('');
  });

  it('A stale fingerprint is refused by its line, naming the screen, and nothing of it is written', () => {
    const { answers, taken, refused } = take(
      block(`w:1-a:vi | yes | ${fp('w:1-a:vi')}`, `w:1-a:en | yes | ${fp('w:1-a:vi')}`),
    );

    expect(taken).toEqual(['w:1-a:vi']);
    expect(answers['w:1-a:en']).toBeUndefined();
    expect(refused).toHaveLength(1);
    expect(refused[0].line).toBe(3);
    expect(refused[0].why).toContain('w:1-a:en: stale');
  });

  it('An unknown screen is refused by its line, saying so', () => {
    const { taken, refused } = take(block(`w:9-nope:vi | yes | ${fp('w:1-a:vi')}`));

    expect(taken).toEqual([]);
    expect(refused).toEqual([{ line: 2, why: 'w:9-nope:vi: unknown screen' }]);
  });

  it('An unknown language is refused by its line, saying so', () => {
    const { refused } = take(block(`w:1-a:fr | yes | ${fp('w:1-a:vi')}`));

    expect(refused).toEqual([{ line: 2, why: 'w:1-a:fr: unknown language "fr"' }]);
  });

  it('A no without its reason is refused by its line', () => {
    const { taken, refused } = take(block(`w:1-a:vi | no | ${fp('w:1-a:vi')}`));

    expect(taken).toEqual([]);
    expect(refused).toEqual([{ line: 2, why: 'w:1-a:vi: a no needs its reason' }]);
  });

  it('A partner’s answer is kept under the screen’s key and their label, beside the human’s and every other partner’s', () => {
    const human: Answers[string] = { answer: 'yes', on: '2026-10-01', reason: '', words: WORDS };

    const { answers, taken, refused } = take(
      ['Credo walks answers', 'By: p1', `w:1-a:vi | no | ${fp('w:1-a:vi')} | too small`].join('\n'),
      { 'w:1-a:vi': human, 'w:1-a:vi@p2': { ...human, on: '2026-10-02' } },
      true,
    );

    expect(refused).toEqual([]);
    expect(taken).toEqual(['w:1-a:vi@p1']);
    expect(Object.keys(answers)).toEqual(['w:1-a:vi', 'w:1-a:vi@p1', 'w:1-a:vi@p2']);
    expect(answers['w:1-a:vi']).toEqual(human);
    expect(answers['w:1-a:vi@p2'].on).toBe('2026-10-02');
    expect(answers['w:1-a:vi@p1']).toEqual({
      answer: 'no',
      on: '2026-10-29',
      reason: 'too small',
      words: WORDS,
    });
  });

  it('A later answer from one label replaces only that label’s', () => {
    const old: Answers[string] = { answer: 'yes', on: '2026-10-01', reason: '', words: WORDS };

    const { answers } = take(
      ['Credo walks answers', 'By: p1', `w:1-a:vi | yes | ${fp('w:1-a:vi')}`].join('\n'),
      { 'w:1-a:vi': old, 'w:1-a:vi@p1': old, 'w:1-a:vi@p2': old },
      true,
    );

    expect(answers['w:1-a:vi@p1'].on).toBe('2026-10-29');
    expect(answers['w:1-a:vi'].on).toBe('2026-10-01');
    expect(answers['w:1-a:vi@p2'].on).toBe('2026-10-01');
  });

  it('A partner’s line is held as the human’s: stale, unknown and a no without a reason are refused, naming the label', () => {
    const { taken, refused } = take(
      [
        'Credo walks answers',
        'By: p1',
        `w:1-a:en | yes | ${fp('w:1-a:vi')}`,
        `w:9-nope:vi | yes | ${fp('w:1-a:vi')}`,
        `w:1-a:vi | no | ${fp('w:1-a:vi')}`,
      ].join('\n'),
      {},
      true,
    );

    expect(taken).toEqual([]);
    expect(refused.map((one) => one.why)).toEqual([
      expect.stringContaining('w:1-a:en@p1: stale'),
      'w:9-nope:vi@p1: unknown screen',
      'w:1-a:vi@p1: a no needs its reason',
    ]);
  });

  it('A Share message posted in Slack and copied back, several posts in one paste, is taken whole: every answer, its label and its fingerprint', () => {
    const post = (label: string, ...lines: string[]) => [
      `${label}  10:42`,
      `Credo walks: answers from ${label}`,
      'Build: main, commit 1a2b3c4d5',
      '1. Sign in (Tiếng Việt): Yes',
      'Credo walks answers',
      'Build: branch main, commit 1a2b3c4d5',
      `By: ${label}`,
      ...lines,
    ];
    const paste = [
      ...post('p1', `w:1-a:vi | yes | ${fp('w:1-a:vi')}`),
      ...post(
        'p2',
        `w:1-a:vi | no | ${fp('w:1-a:vi')} | a & b <c> :smile:`,
        `w:1-a:en | yes | ${fp('w:1-a:en')}`,
      ),
    ].join('\r\n');

    const { answers, taken, refused } = take(paste, {}, true);

    expect(refused).toEqual([]);
    expect(taken).toEqual(['w:1-a:vi@p1', 'w:1-a:vi@p2', 'w:1-a:en@p2']);
    expect(answers['w:1-a:vi@p2'].reason).toBe('a & b <c> :smile:');
  });

  it('A block with no By: line is the human’s, taken by plain pnpm answers alone', () => {
    const { taken } = take(block(`w:1-a:vi | yes | ${fp('w:1-a:vi')}`));

    expect(taken).toEqual(['w:1-a:vi']);
  });

  it('A partner’s Share post followed by another poster’s “Copy my answers” block: plain writes nothing at all, --partners takes the partner’s alone', () => {
    const human: Answers[string] = { answer: 'yes', on: '2026-10-01', reason: '', words: WORDS };
    const paste = [
      'Credo walks answers',
      'By: p1',
      `w:1-a:vi | no | ${fp('w:1-a:vi')} | partner`,
      'Sam  10:44',
      'Credo walks answers',
      'Build: branch main, commit 1a2b3c4d5',
      `w:1-a:vi | no | ${fp('w:1-a:vi')} | pasted as a partner’s`,
      `w:1-a:en | yes | ${fp('w:1-a:en')}`,
    ].join('\n');

    const partners = takeAnswers(paste, current, { 'w:1-a:vi': human }, '2026-10-29', {
      partners: true,
    });
    const mine = take(paste, { 'w:1-a:vi': human });

    expect(partners.taken).toEqual(['w:1-a:vi@p1']);
    expect(partners.answers['w:1-a:vi']).toEqual(human);
    expect(partners.refused).toHaveLength(2);
    expect(mine.taken).toEqual([]);
    expect(mine.answers).toEqual({ 'w:1-a:vi': human });
    expect(mine.refused).toHaveLength(1);
    expect(mine.refused[0].why).toContain('--partners');
  });

  it('lists the refused in line order, a line that starts like an answer and is none among them', () => {
    const { refused } = take(
      block(
        `w:9-nope:vi | yes | ${fp('w:1-a:vi')}`,
        'w:garbage:vi | maybe | 1',
        `w:1-a:fr | yes | ${fp('w:1-a:vi')}`,
      ),
    );

    expect(refused.map((one) => one.line)).toEqual([2, 3, 4]);
  });
});
