import { waitShown } from '@credo/shared';
import type { TFunction } from 'i18next';

/** A wait told in the reader's words: seconds under a minute, whole minutes from one. */
export function waitWords(t: TFunction, seconds: number): string {
  const { unit, count } = waitShown(seconds);
  return unit === 'second'
    ? t(count === 1 ? 'wait.second' : 'wait.seconds', { count })
    : t(count === 1 ? 'wait.minute' : 'wait.minutes', { count });
}
