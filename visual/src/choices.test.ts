import { SCREENS } from '@credo/ui/mock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blockOf,
  fingerprintsOf,
  loadChoices,
  loadLabel,
  saveChoices,
  saveLabel,
  shareOf,
} from './choices';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const report = makeReport({
  walks: WALKS,
  people: PEOPLE,
  parts: PARTS,
  mock: SCREENS,
  answers: {},
  source: {
    branch: 'a-piece',
    commit: 'abc123def',
    changed: false,
    committedAt: new Date('2026-10-27T18:59:00Z'),
    home: '/h',
  },
  builtAt: new Date('2026-10-27T19:30:00Z'),
  readWords: (state, language) => [`text: ${state.id} ${language}`],
});
const VI = 'admin-setup:1-sign-in:vi';
const EN = 'admin-setup:1-sign-in:en';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the unsent choices', () => {
  it('holds a fingerprint for each of the twenty-six screens in a language', () => {
    const prints = fingerprintsOf(report);

    expect(prints.size).toBe(26);
    expect(prints.get(VI)).toMatch(/^[0-9a-f]{12}$/);
    expect(prints.get(VI)).not.toBe(prints.get(EN));
  });

  it('keeps them across a reload, in the browser', () => {
    saveChoices(report, { [VI]: { answer: 'no', reason: 'too small' } });

    expect(loadChoices(report)).toEqual({ [VI]: { answer: 'no', reason: 'too small' } });
  });

  it('drops a choice given on words that have since changed', () => {
    saveChoices(report, { [VI]: { answer: 'yes', reason: '' } });
    const moved = structuredClone(report);
    moved.walks[0].screens[0].languages.vi.fingerprint = 'ffffffffffff';

    expect(loadChoices(moved)).toEqual({});
  });

  it('drops what is not a choice', () => {
    const prints = fingerprintsOf(report);
    const fingerprint = prints.get(VI);
    const keep = (value: unknown) =>
      localStorage.setItem('credo-walks-choices', JSON.stringify(value));

    keep({ [VI]: { answer: 'maybe', reason: '', fingerprint } });
    expect(loadChoices(report)).toEqual({});
    keep({ [VI]: { answer: 'yes', reason: 4, fingerprint } });
    expect(loadChoices(report)).toEqual({});
    keep({ [VI]: { answer: '', reason: 'half', fingerprint } });
    expect(loadChoices(report)).toEqual({ [VI]: { answer: '', reason: 'half' } });
  });

  it('works without the browser’s storage: nothing kept, nothing thrown', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });

    expect(loadChoices(report)).toEqual({});
    expect(() => saveChoices(report, { [VI]: { answer: 'yes', reason: '' } })).not.toThrow();
  });

  it('works when the storage holds something else under its key', () => {
    localStorage.setItem('credo-walks-choices', 'not json');
    expect(loadChoices(report)).toEqual({});
    localStorage.setItem('credo-walks-choices', 'null');
    expect(loadChoices(report)).toEqual({});
  });
});

describe('the block from the choices', () => {
  it('names the build and holds each answered screen in the walks’ order, with the fingerprint it was answered on', () => {
    const prints = fingerprintsOf(report);

    const { text, answered, missing } = blockOf(report, {
      [EN]: { answer: 'no', reason: 'too small' },
      [VI]: { answer: 'yes', reason: 'stray' },
      'admin-setup:2-sign-in-refused:vi': { answer: '', reason: 'half' },
    });

    expect(missing).toEqual([]);
    expect(answered).toBe(2);
    expect(text).toBe(
      [
        'Credo walks answers',
        'Build: branch a-piece, commit abc123def',
        `${VI} | yes | ${prints.get(VI)}`,
        `${EN} | no | ${prints.get(EN)} | too small`,
      ].join('\n'),
    );
  });

  it('names a no that lacks its reason', () => {
    expect(blockOf(report, { [EN]: { answer: 'no', reason: '  ' } }).missing).toEqual([EN]);
  });

  it('is empty-handed with nothing chosen', () => {
    expect(blockOf(report, {}).answered).toBe(0);
  });
});

describe('the Share message from the choices', () => {
  it('holds each answered screen in the walks’ order with its number, its sentence and its language, and the label', () => {
    const prints = fingerprintsOf(report);

    const { text, answered, missing } = shareOf(
      report,
      {
        [EN]: { answer: 'no', reason: 'too small' },
        [VI]: { answer: 'yes', reason: 'stray' },
      },
      'p1',
    );

    expect(missing).toEqual([]);
    expect(answered).toBe(2);
    expect(text.split('\n')).toEqual([
      '*Credo walks: answers from p1*',
      'Build: a-piece, commit abc123def',
      `*1. ${report.walks[0].screens[0].sentence.en}* (Tiếng Việt): Yes`,
      `*1. ${report.walks[0].screens[0].sentence.en}* (English): No. too small`,
      '```',
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      'By: p1',
      `${VI} | yes | ${prints.get(VI)}`,
      `${EN} | no | ${prints.get(EN)} | too small`,
      '```',
    ]);
  });

  it('names a no that lacks its reason, as the block does', () => {
    expect(shareOf(report, { [EN]: { answer: 'no', reason: '' } }, 'p1').missing).toEqual([EN]);
    expect(shareOf(report, {}, 'p1').answered).toBe(0);
  });

  it('Copy my answers and its block stay as they are, with no label and no By: line', () => {
    expect(blockOf(report, { [VI]: { answer: 'yes', reason: '' } }).text).not.toContain('By:');
  });
});

describe('the partner’s label', () => {
  it('is kept in the browser, and asked for once', () => {
    saveLabel('p1');

    expect(loadLabel()).toBe('p1');
  });

  it('is lowercased when kept, and a stored text that is no label gives none', () => {
    saveLabel('P1');
    expect(loadLabel()).toBe('p1');
    localStorage.setItem('credo-walks-label', 'not a label!');
    expect(loadLabel()).toBe('');
    localStorage.removeItem('credo-walks-label');
    expect(loadLabel()).toBe('');
  });

  it('works without the browser’s storage: nothing kept, nothing thrown', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });

    expect(loadLabel()).toBe('');
    expect(() => saveLabel('p1')).not.toThrow();
  });
});
