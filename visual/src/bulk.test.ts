import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { clearIn, fillIn, openToBulk, yesTo } from './bulk';
import { HUMAN } from './marks';
import { placesOf } from './nav';
import { makeReport } from './report';
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

const plain = make();
const wordsOf = (key: string) => {
  const [, screenId, language] = key.split(':');
  return plain.walks[0].screens.find((one) => one.id === screenId)!.languages[
    language.split('@')[0] as 'vi' | 'en'
  ].words;
};
const record = (key: string, answer: 'yes' | 'no', words?: string[]) =>
  [
    `admin-setup:${key}`,
    {
      answer,
      on: '2026-10-29',
      reason: answer === 'no' ? 'too small' : '',
      words: words ?? wordsOf(`admin-setup:${key}`),
    },
  ] as const;
const S1 = 'admin-setup:1-sign-in';
const S2 = 'admin-setup:2-sign-in-refused';
const S3 = 'admin-setup:3-settings';
const yes = { answer: 'yes' as const, reason: '' };

describe('Yes to the unanswered', () => {
  it('answers every language waiting, and counts them first', () => {
    const places = placesOf(plain);

    const bulk = yesTo(places, {}, HUMAN);

    expect(bulk.count).toBe(18);
    expect(Object.keys(bulk.next)).toHaveLength(18);
    expect(bulk.next[`${S1}:vi`]).toEqual(yes);
    expect(yesTo(places.slice(0, 1), {}, HUMAN).count).toBe(2);
  });

  it('answers a language asked again after a yes, and leaves one asked again after a no', () => {
    const report = make(
      Object.fromEntries([
        record('1-sign-in:vi', 'yes', ['moved']),
        record('1-sign-in:en', 'no', ['moved']),
      ]),
    );
    const entry = (language: 'vi' | 'en') => report.walks[0].screens[0].languages[language];

    expect(openToBulk(entry('vi'), undefined, HUMAN)).toBe(true);
    expect(openToBulk(entry('en'), undefined, HUMAN)).toBe(false);
  });

  it('never changes a choice made here or an answer on record', () => {
    const report = make(
      Object.fromEntries([record('1-sign-in:vi', 'yes'), record('2-sign-in-refused:en', 'no')]),
    );
    const choices = { [`${S1}:en`]: { answer: 'no' as const, reason: 'x' }, [`${S3}:vi`]: yes };

    const bulk = yesTo(placesOf(report), choices, HUMAN);

    expect(bulk.count).toBe(18 - 4);
    expect(bulk.next[`${S1}:en`]).toEqual({ answer: 'no', reason: 'x' });
    expect(bulk.next[`${S1}:vi`]).toBeUndefined();
    expect(bulk.next[`${S2}:en`]).toBeUndefined();
  });

  it('treats a choice half made, with no answer yet, as unanswered', () => {
    const half = { [`${S1}:vi`]: { answer: '' as const, reason: 'half' } };

    expect(yesTo(placesOf(plain).slice(0, 1), half, HUMAN).next[`${S1}:vi`]).toEqual(yes);
  });

  it('reads a partner’s page by that partner’s answers, not the human’s', () => {
    const report = make(
      Object.fromEntries([record('1-sign-in:vi', 'yes'), record('1-sign-in:en@p1', 'yes')]),
    );
    const places = placesOf(report).slice(0, 1);

    expect(yesTo(places, {}, { partner: true, label: 'p1' }).count).toBe(1);
    expect(yesTo(places, {}, HUMAN).count).toBe(1);
    expect(yesTo(places, {}, { partner: true, label: 'p2' }).count).toBe(2);
  });
});

describe('Clear', () => {
  it('takes back the choices made here for the screens given, and counts them', () => {
    const places = placesOf(plain);
    const choices = {
      [`${S1}:vi`]: yes,
      [`${S2}:en`]: { answer: 'no' as const, reason: 'x' },
      [`${S3}:vi`]: { answer: '' as const, reason: 'half' },
    };

    const bulk = clearIn(places.slice(0, 1), choices);

    expect(bulk.count).toBe(1);
    expect(bulk.next).toEqual({
      [`${S2}:en`]: choices[`${S2}:en`],
      [`${S3}:vi`]: choices[`${S3}:vi`],
    });
    expect(clearIn(places, choices).count).toBe(2);
  });
});

describe('undo', () => {
  it('holds exactly the choices before the action, and the action leaves them as they were', () => {
    const before = { [`${S1}:vi`]: yes };
    const frozen = structuredClone(before);

    const added = yesTo(placesOf(plain), before, HUMAN);
    const cleared = clearIn(placesOf(plain), before);
    const filled = fillIn({ [`${S2}:vi`]: yes }, before);

    for (const bulk of [added, cleared, filled]) {
      expect(bulk.undo).toEqual(frozen);
      expect(bulk.undo).toBe(before);
    }
    expect(before).toEqual(frozen);
    expect(cleared.next).toEqual({});
    expect(filled.next).toEqual({ ...frozen, [`${S2}:vi`]: yes });
    expect(filled.count).toBe(1);
  });
});
