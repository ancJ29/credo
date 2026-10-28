import { LANGUAGES, type Language } from '@credo/shared';
import type { MockScreen } from '@credo/ui/mock';
import type { Answers } from './answers';
import { fingerprintOf } from './fingerprint';
import { type Source, vietnamTime } from './home';
import {
  type Orphan,
  orphansOf,
  partnersFor,
  type Held,
  type Shown,
  shownFor,
  type Tally,
  tallyOf,
} from './states';
import {
  answerKey,
  type Bilingual,
  DEVICE_LABEL,
  DEVICE_WIDTH,
  type Device,
  type DeviceWidth,
  type Part,
  type Person,
  resolveStates,
  type Walk,
} from './walks';

/**
 * One screen in one language: its words now, the fingerprint of them, and what to show beside it:
 * the human's answer, which alone marks the screen, and the partners' by label.
 */
type ScreenInLanguage = {
  words: string[];
  fingerprint: string;
  shown: Shown;
  partners: { label: string; shown: Held }[];
};

export type ReportScreen = {
  id: string;
  number: number;
  path: 'main' | 'wrong';
  mock: { screen: number; state: string };
  sentence: Bilingual;
  question: string;
  languages: Record<Language, ScreenInLanguage>;
};

export type ReportWalk = {
  id: string;
  person: string;
  part: string;
  title: Bilingual;
  tally: Tally;
  screens: ReportScreen[];
};

/** Everything the page draws and `walks.json` keeps, computed by the build. */
export type Report = {
  title: string;
  build: { branch: string; commit: string; changed: boolean; committed: string; built: string };
  /** The widths every screen is drawn at, widest first. */
  devices: { id: Device; label: string; width: DeviceWidth }[];
  people: (Person & { width: DeviceWidth })[];
  parts: Part[];
  walks: ReportWalk[];
  /** Answers whose screen left the walks, listed and counted, never dropped. */
  orphans: Orphan[];
  tally: Tally;
};

/** Reads one screen's words: the build draws it on a DOM; tests hand in their own. */
export type ReadWords = (
  state: MockScreen['states'][number],
  language: Language,
  navigation: boolean,
) => string[];

/**
 * Every walk screen's words now, in each language, under its answer's key: the one reader both the
 * page and the answers command hold an answer's fingerprint against.
 */
export function currentWords(
  walks: readonly Walk[],
  mock: readonly MockScreen[],
  readWords: ReadWords,
) {
  const states = resolveStates(walks, mock);
  const words = new Map<string, string[]>();
  for (const walk of walks) {
    for (const screen of walk.screens) {
      const state = states.get(`${walk.id}:${screen.id}`)!;
      for (const language of LANGUAGES) {
        words.set(
          answerKey(walk.id, screen.id, language),
          readWords(state, language, screen.navigation === true),
        );
      }
    }
  }
  return words;
}

export function makeReport(input: {
  walks: readonly Walk[];
  people: readonly Person[];
  parts: readonly Part[];
  mock: readonly MockScreen[];
  answers: Answers;
  source: Source;
  builtAt: Date;
  readWords: ReadWords;
}): Report {
  const { walks, people, parts, mock, answers, source, builtAt, readWords } = input;
  const words = currentWords(walks, mock, readWords);
  const widthOf = (device: Device) => DEVICE_WIDTH[device];

  const reportWalks = walks.map((walk): ReportWalk => {
    const screens = walk.screens.map((screen): ReportScreen => {
      const languages = Object.fromEntries(
        LANGUAGES.map((language) => {
          const key = answerKey(walk.id, screen.id, language);
          const now = words.get(key)!;
          return [
            language,
            {
              words: now,
              fingerprint: fingerprintOf(now),
              shown: shownFor(answers[key], now),
              partners: partnersFor(answers, key, now),
            },
          ];
        }),
      ) as Record<Language, ScreenInLanguage>;
      return {
        id: screen.id,
        number: screen.number,
        path: screen.path,
        mock: screen.mock,
        sentence: screen.sentence,
        question: screen.question,
        languages,
      };
    });
    const shown = screens.flatMap((screen) => LANGUAGES.map((l) => screen.languages[l].shown));
    return {
      id: walk.id,
      person: walk.person,
      part: walk.part,
      title: walk.title,
      tally: tallyOf(shown),
      screens,
    };
  });

  const orphans = orphansOf(answers, walks);
  const everything = reportWalks.flatMap((walk) =>
    walk.screens.flatMap((screen) => LANGUAGES.map((l) => screen.languages[l].shown)),
  );
  return {
    title: 'Credo Day Walks',
    build: {
      branch: source.branch,
      commit: source.commit,
      changed: source.changed,
      committed: vietnamTime(source.committedAt).shown,
      built: vietnamTime(builtAt).shown,
    },
    devices: (Object.keys(DEVICE_WIDTH) as Device[]).map((id) => ({
      id,
      label: DEVICE_LABEL[id],
      width: widthOf(id),
    })),
    people: people.map((person) => ({ ...person, width: widthOf(person.device) })),
    parts: [...parts],
    walks: reportWalks,
    orphans,
    tally: tallyOf(everything, orphans),
  };
}
