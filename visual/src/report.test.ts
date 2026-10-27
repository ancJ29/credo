import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const source = {
  branch: 'a-piece',
  commit: 'abc123def',
  changed: false,
  committedAt: new Date('2026-10-27T18:59:00Z'),
  home: '/h',
};

const reportOf = (
  answers: Answers,
  readWords = (_s: unknown, language: string) => [`text: ${language}`],
) =>
  makeReport({
    walks: WALKS,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source,
    builtAt: new Date('2026-10-27T19:30:00Z'),
    readWords,
  });

describe('the report', () => {
  it('holds each walk screen in both languages with its words and nothing asked yet', () => {
    const report = reportOf({});
    const screens = report.walks[0].screens;

    expect(screens).toHaveLength(7);
    expect(screens[6].id).toBe('7-save-failed');
    expect(screens[6].languages.vi.words).toEqual(['text: vi']);
    expect(screens[6].languages.en.shown).toEqual({ kind: 'waiting' });
    expect(report.tally).toEqual({ waiting: 14, yes: 0, no: 0, changed: 0 });
    expect(report.walks[0].tally).toEqual(report.tally);
  });

  it('draws each walk at its person’s device width', () => {
    const report = reportOf({});

    expect(report.walks[0].width).toBe(1280);
    expect(report.people.map((person) => person.width)).toEqual([1280, 1280, 390]);
  });

  it('says what it was built from: the branch, the commit and its time, and when', () => {
    expect(reportOf({}).build).toEqual({
      branch: 'a-piece',
      commit: 'abc123def',
      changed: false,
      committed: '2026-10-28 01:59 +07',
      built: '2026-10-28 02:30 +07',
    });
  });

  it('holds a yes while its words stay, asks again when they move, and counts an orphan’s no', () => {
    const words = ['text: vi'];
    const answers: Answers = {
      'admin-setup:1-sign-in:vi': { answer: 'yes', on: '2026-10-29', reason: '', words },
      'admin-setup:1-sign-in:en': {
        answer: 'yes',
        on: '2026-10-29',
        reason: '',
        words: ['text: before'],
      },
      'admin-setup:2-sign-in-refused:vi': {
        answer: 'no',
        on: '2026-10-29',
        reason: 'too small',
        words,
      },
      'admin-setup:9-gone:vi': { answer: 'no', on: '2026-10-29', reason: 'r', words },
    };

    const report = reportOf(answers);
    const [first, second] = report.walks[0].screens;

    expect(first.languages.vi.shown.kind).toBe('yes');
    expect(first.languages.en.shown.kind).toBe('changed');
    expect(second.languages.vi.shown.kind).toBe('no');
    expect(report.orphans.map((orphan) => orphan.key)).toEqual(['admin-setup:9-gone:vi']);
    expect(report.tally).toEqual({ waiting: 11, yes: 1, no: 2, changed: 1 });
  });

  it('hands the words reader the screen’s state, the language and whether it is about the menu', () => {
    const asked: string[] = [];
    reportOf({}, ((state: { id: string }, language: string, navigation: boolean) => {
      asked.push(`${state.id} ${language} ${navigation}`);
      return [];
    }) as never);

    expect(asked).toHaveLength(14);
    expect(asked).toContain('save-failed en false');
  });
});
