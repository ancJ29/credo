import { LANGUAGES, type Language } from '@credo/shared';
import type { Choices } from './choices';
import { inPageOrder, LANGUAGE_LABEL, markIn, screenId, type Whose } from './marks';
import type { Report, ReportScreen, ReportWalk } from './report';
import { answerKey } from './walks';

/** A page served over the web is a partner's; one opened from disk (or from nowhere) is the human's. */
export const isPartnersPage = (protocol: string) => protocol === 'http:' || protocol === 'https:';

/** One screen of the walks, with the walk it belongs to and the id of its section. */
export type Place = { id: string; walk: ReportWalk; screen: ReportScreen };

/** Every screen of every walk, in the page's order: the walks as they come, each by number. */
export const placesOf = (report: Report): Place[] =>
  report.walks.flatMap((walk) =>
    inPageOrder(walk).map((screen) => ({ id: screenId(walk, screen), walk, screen })),
  );

/** The languages of a screen still to answer: waiting, or asked again. Tiếng Việt first. */
export function leftIn(place: Place, choices: Choices, whose: Whose): Language[] {
  return LANGUAGES.filter((language) => {
    const mark = markIn(
      place.screen.languages[language],
      choices[answerKey(place.walk.id, place.screen.id, language)],
      whose,
    );
    return mark === 'open' || mark === 'again';
  });
}

/**
 * The screens the list, Prev, Next, J and K walk. With only the unanswered, those with a language
 * left, and the screen in view whatever it holds: one answered while in view stays until the person
 * moves.
 */
export function visibleOf(
  places: readonly Place[],
  choices: Choices,
  whose: Whose,
  only: boolean,
  current: string | undefined,
) {
  return only
    ? places.filter((place) => place.id === current || leftIn(place, choices, whose).length > 0)
    : [...places];
}

/** The first screen with a language left; in the walk when one is named; else the first there is. */
export function firstWaiting(
  places: readonly Place[],
  choices: Choices,
  whose: Whose,
  walkId?: string,
) {
  const among = walkId ? places.filter(({ walk }) => walk.id === walkId) : places;
  return among.find((place) => leftIn(place, choices, whose).length > 0) ?? among[0];
}

/** Where an address points: a screen, or a walk (its first screen waiting); nothing else. */
export function addressTo(hash: string, places: readonly Place[]) {
  const name = decodeURIComponent(hash.replace(/^#/, ''));
  return (
    places.find(({ id }) => id === name)?.id ?? places.find(({ walk }) => walk.id === name)?.walk.id
  );
}

export type Stand = { id: string; language: Language };
export type Next = Stand & { wrapped: boolean };

/**
 * Next unanswered: this screen's other language if it is left, else the next screen with a
 * language left in the page's order, its first left language (Tiếng Việt first); past the end it
 * wraps. None when nothing else is left.
 */
export function nextUnanswered(
  places: readonly Place[],
  from: Stand,
  choices: Choices,
  whose: Whose,
): Next | undefined {
  const at = places.findIndex(({ id }) => id === from.id);
  const other = LANGUAGES.find(
    (language) =>
      language !== from.language && leftIn(places[at], choices, whose).includes(language),
  );
  if (other) return { id: from.id, language: other, wrapped: false };
  for (let step = 1; step < places.length; step++) {
    const place = places[(at + step) % places.length];
    const [language] = leftIn(place, choices, whose);
    if (language) return { id: place.id, language, wrapped: at + step >= places.length };
  }
  return undefined;
}

/** What the Next unanswered button says it does, and where. */
export function nextLabel(next: Next | undefined, places: readonly Place[], current: string) {
  if (!next) return 'Nothing left to answer';
  if (next.id === current) return `Next: ${LANGUAGE_LABEL[next.language]}`;
  return `Next unanswered: screen ${places.find(({ id }) => id === next.id)!.screen.number}`;
}

/** The screen before or after the one in view among those shown; none past an end. */
export function neighbour(
  shown: readonly Place[],
  current: string,
  step: 1 | -1,
): Place | undefined {
  return shown[shown.findIndex(({ id }) => id === current) + step];
}

/**
 * Where the page opens, from its address: the screen it names, else the first screen waiting (in
 * the walk it names, if it names one). An address naming an answered screen turns "only
 * unanswered" off, and says so.
 */
export function opening(
  places: readonly Place[],
  choices: Choices,
  whose: Whose,
  hash: string,
  only: boolean,
) {
  const target = addressTo(hash, places);
  const named = places.find(({ id }) => id === target);
  if (!named) return { id: firstWaiting(places, choices, whose, target).id, only, said: '' };
  if (only && leftIn(named, choices, whose).length === 0) {
    return {
      id: named.id,
      only: false,
      said: 'That screen is answered, so every screen is shown.',
    };
  }
  return { id: named.id, only, said: '' };
}
