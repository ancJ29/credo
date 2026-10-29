import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { blockText } from './block';
import { fillFrom, fillSays } from './fill';
import { HUMAN } from './marks';
import { makeReport } from './report';
import { shareText } from './share';
import { PARTS, PEOPLE, WALKS } from './walks';

const make = (answers: Answers = {}) =>
  makeReport({
    walks: WALKS.slice(0, 1),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const report = make();
const print = (key: string) => {
  const [, screenId, language] = key.split(':');
  return report.walks[0].screens.find((one) => one.id === screenId)!.languages[
    language as 'vi' | 'en'
  ].fingerprint;
};
const K1 = 'admin-setup:1-sign-in:vi';
const K2 = 'admin-setup:2-sign-in-refused:en';
const K3 = 'admin-setup:3-settings:vi';
const entry = (key: string, answer: 'yes' | 'no' = 'yes', reason = '') => ({
  key,
  answer,
  fingerprint: print(key),
  reason,
});
const build = { branch: 'an-earlier-piece', commit: 'abc123def', changed: false };
const block = (...entries: ReturnType<typeof entry>[]) => blockText(build, entries);
const share = (label: string, ...entries: ReturnType<typeof entry>[]) =>
  shareText(
    build,
    label,
    entries.map((one) => ({ ...one, number: 1, sentence: 'A screen', language: 'English' })),
  );
const p1 = { partner: true as const, label: 'p1' };

describe('what a paste fills', () => {
  it('fills the lines whose key and fingerprint are this page’s, whatever build the block names, a No with its reason', () => {
    const fill = fillFrom(block(entry(K1), entry(K2, 'no', 'too small')), report, {}, HUMAN);

    expect(fill.fills).toEqual({
      [K1]: { answer: 'yes', reason: '' },
      [K2]: { answer: 'no', reason: 'too small' },
    });
    expect(fill).toMatchObject({ total: 2, filled: 2, changed: 0, absent: 0, already: 0 });
    expect(fillSays(fill)).toBe('Fills 2 of 2');
  });

  it('leaves a line whose words changed since, one for a screen not on this page', () => {
    const stale = { ...entry(K1), fingerprint: '000000000000' };
    const gone = { ...entry(K2), key: 'admin-setup:9-gone:en' };

    const fill = fillFrom(block(stale, gone, entry(K3)), report, {}, HUMAN);

    expect(fill).toMatchObject({ total: 3, filled: 1, changed: 1, absent: 1 });
    expect(fillSays(fill)).toBe('Fills 1 of 3; 1 changed since; 1 not on this page');
  });

  it('follows the bulk rule: a choice made, an answer on record and a screen asked again after a No stay', () => {
    const answers = make({
      [K2]: {
        answer: 'yes',
        on: '2026-10-29',
        reason: '',
        words: report.walks[0].screens[1].languages.en.words,
      },
      [K3]: { answer: 'no', on: '2026-10-29', reason: 'x', words: ['moved'] },
    });

    const fill = fillFrom(
      block(entry(K1), entry(K2), entry(K3), entry('admin-setup:4-saved:vi')),
      answers,
      { [K1]: { answer: 'no', reason: 'mine' } },
      HUMAN,
    );

    expect(fill).toMatchObject({ total: 4, filled: 1, already: 3 });
    expect(Object.keys(fill.fills)).toEqual(['admin-setup:4-saved:vi']);
    expect(fillSays(fill)).toBe('Fills 1 of 4; 3 already answered');
  });

  it('names each line it cannot read by its number, and a No that gives no reason', () => {
    const text = [
      block(entry(K1)),
      'admin-setup:2-sign-in-refused:vi | maybe | 000000000000',
      `${K3} | no | ${print(K3)}`,
    ].join('\n');

    const fill = fillFrom(text, report, {}, HUMAN);

    expect(fill.filled).toBe(1);
    expect(fill.unreadable.map(({ line }) => line)).toEqual([4, 5]);
    expect(fillSays(fill)).toContain('line 4: “admin-setup:2-sign-in-refused:vi | maybe');
    expect(fillSays(fill)).toContain('line 5: “admin-setup:3-settings:vi”: a no needs its reason');
  });

  it('refuses text that is no block', () => {
    expect(fillFrom('hello', report, {}, HUMAN).whole).toContain('not an answers block');
    expect(fillSays(fillFrom('hello', report, {}, HUMAN))).toContain('not an answers block');
  });

  it('reads a partner’s page from a Share message under its own label alone, and keeps the paste’s label when none is kept', () => {
    const post = share('p1', entry(K1), entry(K3, 'no', 'bad'));

    const mine = fillFrom(post, report, {}, p1);
    const none = fillFrom(post, report, {}, { partner: true, label: '' });

    expect(mine.fills).toEqual({
      [K1]: { answer: 'yes', reason: '' },
      [K3]: { answer: 'no', reason: 'bad' },
    });
    expect(mine.label).toBeUndefined();
    expect(none.label).toBe('p1');
    expect(none.filled).toBe(2);
  });
});

describe('what a paste reads', () => {
  it('judges a partner’s record under the paste’s own label when it adopts that label', () => {
    const record = make({
      [`${K1}@p1`]: {
        answer: 'no',
        on: '2026-10-29',
        reason: 'too small',
        words: report.walks[0].screens[0].languages.vi.words,
      },
    });

    const fill = fillFrom(share('p1', entry(K1)), record, {}, { partner: true, label: '' });

    expect(fill.fills).toEqual({});
    expect(fill.already).toBe(1);
  });

  it('counts a key given twice, and keeps the later line', () => {
    const text = block(entry(K1, 'no', 'old'), entry(K1), entry(K3));

    const fill = fillFrom(text, report, {}, HUMAN);

    expect(fill).toMatchObject({ total: 3, filled: 2, repeated: 1 });
    expect(fill.fills[K1]).toEqual({ answer: 'yes', reason: '' });
    expect(fillSays(fill)).toBe('Fills 2 of 3; 1 repeated, the later line kept');
    expect(fill.filled + fill.changed + fill.absent + fill.already + fill.repeated).toBe(
      fill.total,
    );
  });
});

describe('whose answers fill', () => {
  it('refuses a partner’s post on the human’s page, whole', () => {
    const fill = fillFrom(share('p1', entry(K1)), report, {}, HUMAN);

    expect(fill.whole).toContain('partner’s post');
    expect(fill.filled).toBe(0);
  });

  it('refuses the human’s block on a partner’s page, whole', () => {
    expect(fillFrom(block(entry(K1)), report, {}, p1).whole).toContain('human’s block');
  });

  it('refuses another partner’s post, saying whose', () => {
    const fill = fillFrom(share('p2', entry(K1)), report, {}, p1);

    expect(fill.whole).toBe('That is p2’s post, not p1’s.');
    expect(fill.filled).toBe(0);
  });

  it('refuses the posts of several people when no label is kept', () => {
    const fill = fillFrom(
      `${share('p1', entry(K1))}\n${share('p2', entry(K3))}`,
      report,
      {},
      {
        partner: true,
        label: '',
      },
    );

    expect(fill.whole).toBe('That holds the posts of several people.');
  });
});
