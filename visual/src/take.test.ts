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
const take = (text: string, existing: Answers = {}) =>
  takeAnswers(text, current, existing, '2026-10-29');

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

  it('lists the refused in line order, a line that is no answer among them', () => {
    const { refused } = take(
      block(
        `w:9-nope:vi | yes | ${fp('w:1-a:vi')}`,
        'garbage',
        `w:1-a:fr | yes | ${fp('w:1-a:vi')}`,
      ),
    );

    expect(refused.map((one) => one.line)).toEqual([2, 3, 4]);
  });
});
