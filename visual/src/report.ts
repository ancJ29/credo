import { LANGUAGES, type Language } from '@credo/shared';
import type { MockScreen } from '@credo/ui/mock';
import type { Answers } from './answers';
import { type Source, vietnamTime } from './home';
import { type Orphan, orphansOf, type Shown, shownFor, type Tally, tallyOf } from './states';
import {
  type Bilingual,
  DEVICE_WIDTH,
  type Device,
  type DeviceWidth,
  type Part,
  type Person,
  resolveStates,
  type Walk,
} from './walks';

/** One screen in one language: its words now, and what to show beside it. */
type ScreenInLanguage = { words: string[]; shown: Shown };

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
  /** The width its person's device is drawn at. */
  width: DeviceWidth;
  tally: Tally;
  screens: ReportScreen[];
};

/** Everything the page draws and `walks.json` keeps, computed by the build. */
export type Report = {
  title: string;
  build: { branch: string; commit: string; changed: boolean; committed: string; built: string };
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
  const states = resolveStates(walks, mock);
  const widthOf = (device: Device) => DEVICE_WIDTH[device];

  const reportWalks = walks.map((walk): ReportWalk => {
    const person = people.find((candidate) => candidate.id === walk.person)!;
    const screens = walk.screens.map((screen): ReportScreen => {
      const state = states.get(`${walk.id}:${screen.id}`)!;
      const languages = Object.fromEntries(
        LANGUAGES.map((language) => {
          const words = readWords(state, language, screen.navigation === true);
          const answer = answers[`${walk.id}:${screen.id}:${language}`];
          return [language, { words, shown: shownFor(answer, words) }];
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
      width: widthOf(person.device),
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
    people: people.map((person) => ({ ...person, width: widthOf(person.device) })),
    parts: [...parts],
    walks: reportWalks,
    orphans,
    tally: tallyOf(everything, orphans),
  };
}
