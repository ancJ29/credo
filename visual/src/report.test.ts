import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { fingerprintOf } from './fingerprint';
import { makeReport, type ReadWords } from './report';
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
  readWords: ReadWords = (_s, language) => [`text: ${language}`],
) =>
  makeReport({
    walks: WALKS.slice(0, 2),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source,
    builtAt: new Date('2026-10-27T19:30:00Z'),
    readWords,
  });

describe('the report', () => {
  it('holds each walk screen in both languages with its words and nothing asked yet', async () => {
    const report = await reportOf({});
    const screens = report.walks[0].screens;

    expect(screens).toHaveLength(9);
    expect(screens[7].id).toBe('8-save-conflict');
    expect(screens[7].languages.vi.words).toEqual(['text: vi']);
    expect(screens[7].languages.en.shown).toEqual({ kind: 'waiting' });
    expect(report.tally).toEqual({ waiting: 36, yes: 0, no: 0, changed: 0 });
    expect(report.walks[0].tally).toEqual({ waiting: 18, yes: 0, no: 0, changed: 0 });
    expect(report.walks[1].tally).toEqual({ waiting: 18, yes: 0, no: 0, changed: 0 });
  });

  it('draws every screen at three widths, widest first, and keeps each person’s device width for the map', async () => {
    const report = await reportOf({});

    expect(report.devices).toEqual([
      { id: 'pc', label: 'PC', width: 1280 },
      { id: 'tablet', label: 'tablet', width: 768 },
      { id: 'phone', label: 'phone', width: 390 },
    ]);
    expect(report.people.map((person) => person.width)).toEqual([1280, 1280, 1280, 390]);
  });

  it('gives each screen in a language the fingerprint of its words now, the same for the same words', async () => {
    const screens = (await reportOf({})).walks[0].screens;

    expect(screens[0].languages.vi.fingerprint).toBe(fingerprintOf(['text: vi']));
    expect(screens[0].languages.vi.fingerprint).not.toBe(screens[0].languages.en.fingerprint);
    expect(screens[0].languages.vi.fingerprint).toBe(screens[6].languages.vi.fingerprint);
  });

  it('says what it was built from: the branch, the commit and its time, and when', async () => {
    expect((await reportOf({})).build).toEqual({
      branch: 'a-piece',
      commit: 'abc123def',
      changed: false,
      committed: '2026-10-28 01:59 +07',
      built: '2026-10-28 02:30 +07',
    });
  });

  it('holds a yes while its words stay, asks again when they move, and counts an orphan’s no', async () => {
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

    const report = await reportOf(answers);
    const [first, second] = report.walks[0].screens;

    expect(first.languages.vi.shown.kind).toBe('yes');
    expect(first.languages.en.shown.kind).toBe('changed');
    expect(second.languages.vi.shown.kind).toBe('no');
    expect(report.orphans.map((orphan) => orphan.key)).toEqual(['admin-setup:9-gone:vi']);
    expect(report.tally).toEqual({ waiting: 33, yes: 1, no: 2, changed: 1 });
  });

  it('hands the words reader the screen’s state, the language and whether it is about the menu', async () => {
    const asked: string[] = [];
    await reportOf({}, (state, language, navigation) => {
      asked.push(`${state.id} ${language} ${navigation}`);
      return [];
    });

    expect(asked).toHaveLength(36);
    expect(asked).toContain('save-failed en false');
    expect(asked).toContain('conflict en false');
  });

  it('Each screen carries the partners’ answers by label; the human’s alone marks the screen and counts', async () => {
    const row = {
      answer: 'no' as const,
      on: '2026-10-29',
      reason: 'too small',
      words: ['text: vi'],
    };
    const report = await reportOf({
      'admin-setup:1-sign-in:vi@p2': row,
      'admin-setup:1-sign-in:vi@p1': row,
    });

    const vi = report.walks[0].screens[0].languages.vi;

    expect(vi.partners.map((one) => [one.label, one.shown.kind])).toEqual([
      ['p1', 'no'],
      ['p2', 'no'],
    ]);
    expect(vi.shown).toEqual({ kind: 'waiting' });
    expect(report.walks[0].screens[0].languages.en.partners).toEqual([]);
    expect(report.tally).toEqual({ waiting: 36, yes: 0, no: 0, changed: 0 });
    expect(report.walks[0].tally.no).toBe(0);
  });

  it('A partner’s answer whose screen left the walks is listed as an orphan, and counts in no bar', async () => {
    const row = { answer: 'no' as const, on: '2026-10-29', reason: 'too small', words: [] };
    const report = await reportOf({ 'admin-setup:9-gone:vi@p1': row });

    expect(report.orphans.map((one) => one.key)).toEqual(['admin-setup:9-gone:vi@p1']);
    expect(report.tally.no).toBe(0);
  });

  it('says of a screen what it draws, a scene with its steps or a state of the mock, never both', async () => {
    const report = await makeReport({
      walks: WALKS,
      people: PEOPLE,
      parts: PARTS,
      mock: SCREENS,
      answers: {},
      source,
      builtAt: new Date('2026-10-27T19:30:00Z'),
      readWords: (drawn, language) => [`text: ${drawn.id} ${language}`],
    });
    const [mocked, drawn] = [report.walks[0].screens[0], report.walks[3].screens[2]];

    expect(mocked.mock).toEqual({ screen: 1, state: 'empty' });
    expect('scene' in mocked).toBe(false);
    expect(drawn.id).toBe('staff-3-added');
    expect('mock' in drawn).toBe(false);
    expect(drawn.scene!.steps!.at(-1)).toEqual({ press: 'addPerson.submit' });
    expect(drawn.languages.en.words).toEqual(['text: staff-3-added en']);
    expect(report.tally.waiting).toBe(118);
  });

  it('waits for a reader that answers later, as a scene’s does', async () => {
    const report = await reportOf({}, async (_drawn, language) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return [`text: ${language}`];
    });

    expect(report.walks[0].screens[0].languages.vi.words).toEqual(['text: vi']);
  });
});
