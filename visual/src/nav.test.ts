import { SCREENS } from '@credo/ui/mock';
import { describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import {
  addressTo,
  firstWaiting,
  isPartnersPage,
  leftIn,
  neighbour,
  nextLabel,
  nextUnanswered,
  placesOf,
  visibleOf,
} from './nav';
import { HUMAN, markIn, shownIn } from './marks';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const make = (answers: Answers = {}) =>
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

const SHOWN = WALKS.slice(0, 2).reduce((sum, walk) => sum + walk.screens.length, 0);
const plain = await make();
const places = placesOf(plain);
const ids = (list: { id: string }[] | undefined) => list?.map(({ id }) => id);
const yes = (key: string) => ({ [key]: { answer: 'yes' as const, reason: '' } });
const S1 = 'admin-setup:1-sign-in';
const S2 = 'admin-setup:2-sign-in-refused';
const S3 = 'admin-setup:3-settings';

/** The words of each screen now, by answer key. */
const wordsNow = new Map<string, string[]>(
  plain.walks.flatMap((walk) =>
    walk.screens.flatMap((screen) =>
      (['vi', 'en'] as const).map(
        (language) =>
          [`${walk.id}:${screen.id}:${language}`, screen.languages[language].words] as const,
      ),
    ),
  ),
);

/** A report where the human answered the listed keys yes on the words now. */
const answered = (...keys: string[]) =>
  make(
    Object.fromEntries(
      keys.map((key) => [
        key,
        { answer: 'yes' as const, on: '2026-10-29', reason: '', words: wordsNow.get(key)! },
      ]),
    ),
  );

describe('the order and the places', () => {
  it('lists every screen of every walk, the walks as they come, each by number', () => {
    expect(places).toHaveLength(SHOWN);
    expect(ids(places.slice(0, 3))).toEqual([
      'admin-setup-1-sign-in',
      'admin-setup-2-sign-in-refused',
      'admin-setup-3-settings',
    ]);
  });

  it('finds an address: a screen, a walk, or nothing', () => {
    expect(addressTo('#admin-setup-3-settings', places)).toBe('admin-setup-3-settings');
    expect(addressTo('#admin-setup', places)).toBe('admin-setup');
    expect(addressTo('', places)).toBeUndefined();
    expect(addressTo('#nowhere', places)).toBeUndefined();
  });
});

describe('whose page', () => {
  it('is a partner’s when served over the web and the human’s when opened from disk', () => {
    expect(isPartnersPage('https:')).toBe(true);
    expect(isPartnersPage('http:')).toBe(true);
    expect(isPartnersPage('file:')).toBe(false);
    expect(isPartnersPage('about:')).toBe(false);
  });

  it('counts a screen answered, on the human’s page, by the human’s record or a choice, and on a partner’s page by that partner’s alone', async () => {
    const report = await make({
      [`${S1}:vi`]: {
        answer: 'yes',
        on: '2026-10-29',
        reason: '',
        words: wordsNow.get(`${S1}:vi`)!,
      },
      [`${S1}:en@p1`]: { answer: 'yes', on: '2026-10-29', reason: '', words: ['moved'] },
    });
    const entry = (language: 'vi' | 'en') => report.walks[0].screens[0].languages[language];
    const p1 = { partner: true as const, label: 'p1' };
    const p2 = { partner: true as const, label: 'p2' };

    expect(shownIn(entry('vi'), HUMAN).kind).not.toBe('waiting');
    expect(shownIn(entry('vi'), p1)).toEqual({ kind: 'waiting' });
    expect(shownIn(entry('en'), p1).kind).toBe('changed');
    expect(shownIn(entry('en'), p2)).toEqual({ kind: 'waiting' });
    expect(markIn(entry('vi'), { answer: 'yes', reason: '' }, p1)).toBe('yes');
    expect(markIn(entry('vi'), undefined, p1)).toBe('open');
  });
});

describe('what is left', () => {
  it('is a language waiting or asked again, Tiếng Việt first', async () => {
    const report = await answered(`${S1}:vi`);
    const place = placesOf(report)[0];

    expect(leftIn(places[0], {}, HUMAN)).toEqual(['vi', 'en']);
    expect(leftIn(place, {}, HUMAN)).toEqual(['en']);
    expect(leftIn(place, { [`${S1}:en`]: { answer: 'no', reason: '' } }, HUMAN)).toEqual([]);
  });

  it('counts a language asked again, its words changed since the answer, as left', async () => {
    const report = await make({
      [`${S1}:vi`]: { answer: 'yes', on: '2026-10-29', reason: '', words: ['moved'] },
    });

    expect(leftIn(placesOf(report)[0], {}, HUMAN)).toEqual(['vi', 'en']);
    expect(
      nextUnanswered(
        placesOf(report),
        { id: 'admin-setup-1-sign-in', language: 'en' },
        yes(`${S1}:en`),
        HUMAN,
      ),
    ).toEqual({ id: 'admin-setup-1-sign-in', language: 'vi', wrapped: false });
  });

  it('opens on the first screen waiting, in a walk when one is named, else the first there is', async () => {
    const report = await answered(`${S1}:vi`, `${S1}:en`);
    const all = placesOf(report);

    expect(firstWaiting(all, {}, HUMAN).id).toBe('admin-setup-2-sign-in-refused');
    expect(firstWaiting(all, {}, HUMAN, 'admin-setup').id).toBe('admin-setup-2-sign-in-refused');
    const done = Object.fromEntries(
      all.flatMap((place) =>
        ['vi', 'en'].map((language) => [
          `${place.walk.id}:${place.screen.id}:${language}`,
          { answer: 'yes' as const, reason: '' },
        ]),
      ),
    );
    expect(firstWaiting(all, done, HUMAN).id).toBe('admin-setup-1-sign-in');
  });

  it('keeps, under “only unanswered”, the screens with a language left and the one in view', async () => {
    const report = await answered(`${S1}:vi`, `${S1}:en`);
    const all = placesOf(report);

    expect(visibleOf(all, {}, HUMAN, false, undefined)).toHaveLength(SHOWN);
    expect(ids(visibleOf(all, {}, HUMAN, true, undefined))).not.toContain('admin-setup-1-sign-in');
    expect(ids(visibleOf(all, {}, HUMAN, true, 'admin-setup-1-sign-in'))).toContain(
      'admin-setup-1-sign-in',
    );
    expect(visibleOf(all, {}, HUMAN, true, undefined)).toHaveLength(SHOWN - 1);
  });

  it('steps to the screen before or after among those shown, and to none past an end', () => {
    const shown = places.slice(0, 3);

    expect(neighbour(shown, shown[1].id, 1)).toBe(shown[2]);
    expect(neighbour(shown, shown[1].id, -1)).toBe(shown[0]);
    expect(neighbour(shown, shown[0].id, -1)).toBeUndefined();
    expect(neighbour(shown, shown[2].id, 1)).toBeUndefined();
    expect(neighbour(shown, 'elsewhere', 1)).toBe(shown[0]);
  });
});

describe('next unanswered', () => {
  const from = (id: string, language: 'vi' | 'en') => ({ id, language });

  it('goes to this screen’s other language first', () => {
    expect(nextUnanswered(places, from('admin-setup-1-sign-in', 'vi'), {}, HUMAN)).toEqual({
      id: 'admin-setup-1-sign-in',
      language: 'en',
      wrapped: false,
    });
  });

  it('then to the next screen waiting or asked again in the page’s order, Tiếng Việt first', async () => {
    const report = await answered(`${S1}:vi`, `${S1}:en`, `${S2}:vi`);
    const all = placesOf(report);

    expect(nextUnanswered(all, from('admin-setup-1-sign-in', 'vi'), {}, HUMAN)).toEqual({
      id: 'admin-setup-2-sign-in-refused',
      language: 'en',
      wrapped: false,
    });
    expect(
      nextUnanswered(all, from('admin-setup-2-sign-in-refused', 'en'), yes(`${S2}:en`), HUMAN),
    ).toEqual({ id: 'admin-setup-3-settings', language: 'vi', wrapped: false });
  });

  it('skips a screen the choices answered, and wraps at the end', () => {
    const last = places[places.length - 1];
    const choices = yes(`${S3}:vi`);
    const wrapped = nextUnanswered(places, from(last.id, 'vi'), choices, HUMAN);
    const second = nextUnanswered(places, from(places[0].id, 'vi'), yes(`${S1}:en`), HUMAN);

    expect(wrapped).toEqual({ id: last.id, language: 'en', wrapped: false });
    expect(second).toEqual({ id: 'admin-setup-2-sign-in-refused', language: 'vi', wrapped: false });
    const lastBoth = Object.fromEntries(
      ['vi', 'en'].map((language) => [
        `${last.walk.id}:${last.screen.id}:${language}`,
        { answer: 'yes' as const, reason: '' },
      ]),
    );
    expect(nextUnanswered(places, from(last.id, 'en'), lastBoth, HUMAN)).toEqual({
      id: 'admin-setup-1-sign-in',
      language: 'vi',
      wrapped: true,
    });
  });

  it('says so when none waits', () => {
    const everything = Object.fromEntries(
      places.flatMap((place) =>
        ['vi', 'en'].map((language) => [
          `${place.walk.id}:${place.screen.id}:${language}`,
          { answer: 'yes' as const, reason: '' },
        ]),
      ),
    );

    expect(nextUnanswered(places, from(places[0].id, 'vi'), everything, HUMAN)).toBeUndefined();
    expect(nextLabel(undefined, places, places[0].id)).toBe('Nothing left to answer');
  });

  it('names where it goes: the other language here, else the screen', () => {
    const here = nextUnanswered(places, from('admin-setup-1-sign-in', 'vi'), {}, HUMAN);
    const there = nextUnanswered(
      places,
      from('admin-setup-1-sign-in', 'vi'),
      yes(`${S1}:en`),
      HUMAN,
    );

    expect(nextLabel(here, places, 'admin-setup-1-sign-in')).toBe('Next: English');
    expect(nextLabel(there, places, 'admin-setup-1-sign-in')).toBe('Next unanswered: screen 2');
  });

  it('reads a partner’s page by that partner’s answers alone', async () => {
    const report = await answered(`${S1}:vi`);
    const all = placesOf(report);
    const partner = { partner: true as const, label: 'p1' };

    expect(leftIn(all[0], {}, HUMAN)).toEqual(['en']);
    expect(leftIn(all[0], {}, partner)).toEqual(['vi', 'en']);
  });
});
