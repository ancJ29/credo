import { describe, expect, it } from 'vitest';
import type { Answer } from './answers';
import { orphansOf, partnersFor, shownFor, tallyOf } from './states';
import { WALKS } from './walks';

const yes: Answer = { answer: 'yes', on: '2026-10-29', reason: '', words: ['heading: Hello'] };
const no: Answer = {
  answer: 'no',
  on: '2026-10-29',
  reason: 'the message is too small',
  words: ['heading: Hello'],
};

describe('what a screen shows beside its picture', () => {
  it('Each drawn screen shows its language’s answer: not yet asked, a dated yes, or a "no" with its reason', () => {
    const words = ['heading: Hello'];

    expect(shownFor(undefined, words)).toEqual({ kind: 'waiting' });
    expect(shownFor(yes, words)).toEqual({ kind: 'yes', on: '2026-10-29' });
    expect(shownFor(no, words)).toEqual({
      kind: 'no',
      on: '2026-10-29',
      reason: 'the message is too small',
    });
  });

  it('A yes holds while the screen’s words stay the same', () => {
    expect(shownFor(yes, ['heading: Hello']).kind).toBe('yes');
  });

  it('A changed word asks again, showing the words before and now', () => {
    expect(shownFor(yes, ['heading: Hello there'])).toEqual({
      kind: 'changed',
      answer: 'yes',
      on: '2026-10-29',
      before: ['heading: Hello'],
      now: ['heading: Hello there'],
    });
  });

  it('asks again for an added or a removed line, and for a "no" whose words changed', () => {
    expect(shownFor(yes, ['heading: Hello', 'text: More']).kind).toBe('changed');
    expect(shownFor(yes, []).kind).toBe('changed');
    expect(shownFor(no, ['heading: Hi']).kind).toBe('changed');
  });
});

describe('the count', () => {
  it('An answer whose screen left the walks is listed on the page, never dropped from the count', () => {
    const gone = { 'admin-setup:9-gone:en': no, 'admin-setup:1-sign-in:vi': yes };

    const orphans = orphansOf(gone, WALKS);

    expect(orphans).toEqual([{ key: 'admin-setup:9-gone:en', ...no }]);
    expect(tallyOf([{ kind: 'waiting' }], orphans)).toEqual({
      waiting: 1,
      yes: 0,
      no: 1,
      changed: 0,
    });
    // A yes whose screen left is listed, and is no open "no".
    expect(tallyOf([], [{ key: 'x:y:vi', ...yes }]).no).toBe(0);
  });

  it('counts each state', () => {
    expect(
      tallyOf([
        { kind: 'waiting' },
        { kind: 'waiting' },
        { kind: 'yes', on: 'd' },
        { kind: 'no', on: 'd', reason: 'r' },
        { kind: 'changed', answer: 'yes', on: 'd', before: [], now: [] },
      ]),
    ).toEqual({ waiting: 2, yes: 1, no: 1, changed: 1 });
  });
});

describe('the partners’ answers', () => {
  const words = ['heading: Hello'];

  it('Each screen lists the partners’ answers by label, in label order, as the human’s are read', () => {
    const answers = {
      'admin-setup:1-sign-in:vi': yes,
      'admin-setup:1-sign-in:vi@p2': no,
      'admin-setup:1-sign-in:vi@p1': yes,
      'admin-setup:1-sign-in:en@p1': yes,
    };

    expect(partnersFor(answers, 'admin-setup:1-sign-in:vi', words)).toEqual([
      { label: 'p1', shown: { kind: 'yes', on: '2026-10-29' } },
      {
        label: 'p2',
        shown: { kind: 'no', on: '2026-10-29', reason: 'the message is too small' },
      },
    ]);
    expect(
      partnersFor({ 'admin-setup:1-sign-in:vi': yes }, 'admin-setup:1-sign-in:vi', words),
    ).toEqual([]);
  });

  it('A partner’s answer whose words changed shows as asked again', () => {
    const [one] = partnersFor({ 'w:1-a:vi@p1': yes }, 'w:1-a:vi', ['heading: Hi']);

    expect(one.shown.kind).toBe('changed');
  });

  it('A partner’s answer whose screen left the walks is an orphan, as the human’s are, but counts in no tally', () => {
    const gone = { 'admin-setup:9-gone:en@p1': no, 'admin-setup:1-sign-in:vi@p1': yes };

    const orphans = orphansOf(gone, WALKS);

    expect(orphans).toEqual([{ key: 'admin-setup:9-gone:en@p1', ...no }]);
    expect(tallyOf([], orphans).no).toBe(0);
  });
});
