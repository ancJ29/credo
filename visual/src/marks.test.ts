import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { inPageOrder, labelsOf, markOf, progressOf, screenId } from './marks';
import { makeReport } from './report';
import type { Shown } from './states';
import { PARTS, PEOPLE, WALKS } from './walks';

const reportWith = (answers: Answers = {}) =>
  makeReport({
    walks: WALKS.slice(0, 2),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

describe('a screen’s mark', () => {
  it('A screen’s mark in a language is the choice made on the page, else its answer on record: open, asked again, yes or no', () => {
    const on = '2026-10-29';
    const changed: Shown = { kind: 'changed', answer: 'yes', on, before: [], now: [] };

    expect(markOf({ kind: 'waiting' }, undefined)).toBe('open');
    expect(markOf({ kind: 'waiting' }, { answer: '', reason: '' })).toBe('open');
    expect(markOf(changed, undefined)).toBe('again');
    expect(markOf({ kind: 'yes', on }, undefined)).toBe('yes');
    expect(markOf({ kind: 'no', on, reason: 'too small' }, undefined)).toBe('no');
    // A choice made here stands over the record.
    expect(markOf({ kind: 'yes', on }, { answer: 'no', reason: '' })).toBe('no');
    expect(markOf(changed, { answer: 'yes', reason: '' })).toBe('yes');
  });
});

describe('the progress', () => {
  it('counts as answered each screen in a language with a yes or a no, chosen here or on record, of all there are', async () => {
    const report = await reportWith({
      'admin-setup:2-sign-in-refused:vi': {
        answer: 'no',
        on: '2026-10-29',
        reason: 'too small',
        words: ['text: failed vi'],
      },
      // Its words moved: asked again, so not answered.
      'admin-setup:2-sign-in-refused:en': {
        answer: 'yes',
        on: '2026-10-29',
        reason: '',
        words: ['text: old'],
      },
    });

    const progress = progressOf(report, {
      'admin-setup:1-sign-in:en': { answer: 'yes', reason: '' },
      'admin-setup:3-settings:vi': { answer: '', reason: '' },
    });

    expect(progress).toMatchObject({ answered: 2, total: 26 });
    // The page's order: the main path, then what can go wrong; a screen's languages side by side.
    expect(progress.marks.slice(0, 2)).toEqual([
      { key: 'admin-setup:1-sign-in:vi', mark: 'open' },
      { key: 'admin-setup:1-sign-in:en', mark: 'yes' },
    ]);
    expect(progress.marks.slice(8, 10)).toEqual([
      { key: 'admin-setup:2-sign-in-refused:vi', mark: 'no' },
      { key: 'admin-setup:2-sign-in-refused:en', mark: 'again' },
    ]);
  });

  it('puts a walk’s main path first, then what can go wrong, each screen under its section’s id', async () => {
    const walk = (await reportWith()).walks[0];

    expect(inPageOrder(walk).map((screen) => screenId(walk, screen))).toEqual([
      'admin-setup-1-sign-in',
      'admin-setup-3-settings',
      'admin-setup-4-saved',
      'admin-setup-5-language-menu',
      'admin-setup-2-sign-in-refused',
      'admin-setup-6-service-down',
      'admin-setup-7-save-failed',
      'admin-setup-8-save-conflict',
      'admin-setup-9-unknown-company',
    ]);
  });

  it('names a screen in a language as a person reads it', async () => {
    const labels = labelsOf(await reportWith());

    expect(labels.get('admin-setup:3-settings:en')).toBe('screen 3 in English');
    expect(labels.get('admin-setup:7-save-failed:vi')).toBe('screen 7 in Tiếng Việt');
    expect(labels.size).toBe(26);
  });
});
