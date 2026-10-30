import { SCREENS } from '@credo/ui/mock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blockOf,
  fingerprintsOf,
  loadChoices,
  loadGuideSeen,
  loadLabel,
  saveChoices,
  saveGuideSeen,
  saveLabel,
  shareOf,
} from './choices';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const report = await makeReport({
  walks: WALKS.slice(0, 2),
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

  it('keeps what another build’s page left, and adds this page’s choices beside it', () => {
    const other = structuredClone(report);
    other.walks[0].screens[0].languages.vi.fingerprint = 'ffffffffffff';
    const third = 'admin-setup:3-settings:vi';

    saveChoices(other, { [VI]: { answer: 'no', reason: 'their reason' } });
    saveChoices(report, {
      [EN]: { answer: 'yes', reason: '' },
      [third]: { answer: 'yes', reason: '' },
    });

    expect(loadChoices(report)).toEqual({
      [EN]: { answer: 'yes', reason: '' },
      [third]: { answer: 'yes', reason: '' },
    });
    // A screen whose words did not change is the same screen on both pages.
    expect(loadChoices(other)).toEqual({
      [VI]: { answer: 'no', reason: 'their reason' },
      [EN]: { answer: 'yes', reason: '' },
      [third]: { answer: 'yes', reason: '' },
    });
  });

  it('forgets a choice the page took back, and keeps one it did not touch', () => {
    saveChoices(report, {
      [VI]: { answer: 'yes', reason: '' },
      [EN]: { answer: 'no', reason: 'x' },
    });
    saveChoices(report, { [EN]: { answer: 'no', reason: 'x' } });

    expect(loadChoices(report)).toEqual({ [EN]: { answer: 'no', reason: 'x' } });
  });

  it('drops a choice older than 14 days at the next save, and keeps one of 14', () => {
    const day = 24 * 60 * 60 * 1000;
    const start = Date.parse('2026-10-01T00:00:00Z');
    const other = structuredClone(report);
    other.walks[0].screens[0].languages.vi.fingerprint = 'ffffffffffff';
    saveChoices(other, { [VI]: { answer: 'yes', reason: '' } }, start);
    saveChoices(report, { [EN]: { answer: 'yes', reason: '' } }, start + 14 * day);
    expect(loadChoices(other, start + 14 * day)[VI]).toEqual({ answer: 'yes', reason: '' });

    saveChoices(report, { [EN]: { answer: 'yes', reason: '' } }, start + 14 * day + 1);

    expect(loadChoices(other, start + 14 * day + 1)[VI]).toBeUndefined();
    expect(loadChoices(report, start + 14 * day + 1)).toEqual({
      [EN]: { answer: 'yes', reason: '' },
    });
  });

  it('does not read a choice older than 14 days, on a page of the same words either', () => {
    const day = 24 * 60 * 60 * 1000;
    saveChoices(report, { [VI]: { answer: 'yes', reason: '' } }, 0);

    expect(loadChoices(report, 14 * day)).toEqual({ [VI]: { answer: 'yes', reason: '' } });
    expect(loadChoices(report, 14 * day + 1)).toEqual({});
  });

  it('dates a choice when it is made or changed, not each time the page saves', () => {
    const day = 24 * 60 * 60 * 1000;
    const start = Date.parse('2026-10-01T00:00:00Z');
    saveChoices(report, { [VI]: { answer: 'yes', reason: '' } }, start);
    saveChoices(report, { [VI]: { answer: 'yes', reason: '' } }, start + 10 * day);
    const at = () =>
      Object.values(
        JSON.parse(localStorage.getItem('credo-walks-choices')!) as { at: number }[],
      ).map((one) => one.at);
    expect(at()).toEqual([start]);

    saveChoices(report, { [VI]: { answer: 'no', reason: 'x' } }, start + 11 * day);

    expect(at()).toEqual([start + 11 * day]);
  });

  it('reads today’s stored form, a key with its fingerprint and no date, and dates it at the next save', () => {
    const prints = fingerprintsOf(report);
    const old = (key: string, answer: string) => ({
      [key]: { answer, reason: '', fingerprint: prints.get(key) },
    });
    const third = 'admin-setup:3-settings:vi';
    localStorage.setItem(
      'credo-walks-choices',
      JSON.stringify({
        ...old(VI, 'yes'),
        [third]: { answer: 'no', reason: 'old', fingerprint: 'ffffffffffff' },
      }),
    );
    expect(loadChoices(report)).toEqual({ [VI]: { answer: 'yes', reason: '' } });

    const other = structuredClone(report);
    other.walks[0].screens[0].languages.en.fingerprint = 'ffffffffffff';
    saveChoices(other, { ...loadChoices(other), [EN]: { answer: 'no', reason: 'y' } }, 5);

    expect(loadChoices(report, 5)).toEqual({ [VI]: { answer: 'yes', reason: '' } });
    expect(loadChoices(other, 5)).toEqual({
      [VI]: { answer: 'yes', reason: '' },
      [EN]: { answer: 'no', reason: 'y' },
    });
    expect(
      Object.values(
        JSON.parse(localStorage.getItem('credo-walks-choices')!) as { at: number }[],
      ).map((one) => one.at),
    ).toEqual([5, 5, 5]);
  });

  it('drops an entry whose date is not a number', () => {
    const fingerprint = fingerprintsOf(report).get(VI);
    localStorage.setItem(
      'credo-walks-choices',
      JSON.stringify({ [VI]: { answer: 'yes', reason: '', fingerprint, at: 'today' } }),
    );

    expect(loadChoices(report)).toEqual({});
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

describe('the guide’s first visit', () => {
  it('is kept in the browser, and with none the guide is never taken as seen', () => {
    localStorage.removeItem('credo-walks-guide-seen');
    expect(loadGuideSeen()).toBe(false);
    saveGuideSeen();
    expect(loadGuideSeen()).toBe(true);

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadGuideSeen()).toBe(false);
    expect(() => saveGuideSeen()).not.toThrow();
  });
});
