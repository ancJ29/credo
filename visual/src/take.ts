import { LANGUAGES } from '@credo/shared';
import type { Answers } from './answers';
import { parseBlock } from './block';
import { fingerprintOf } from './fingerprint';

/**
 * What `pnpm answers` does with a pasted block: each answer is held against the screen's words as
 * they are now. A line is refused, by its number and why, when its language or screen is unknown,
 * when its fingerprint is no longer the screen's (the words changed since the page was built), or
 * when a "no" gives no reason. The lines that hold are written over the rows they answer; the rest
 * of the file stays.
 *
 * @param current every walk screen's words now, under its key
 * @param day the day the answers are dated, `YYYY-MM-DD`
 */
export function takeAnswers(
  text: string,
  current: ReadonlyMap<string, readonly string[]>,
  existing: Answers,
  day: string,
) {
  const { entries, refused } = parseBlock(text);
  const answers: Answers = { ...existing };
  const taken: string[] = [];
  const refuse = (line: number, why: string) => refused.push({ line, why });

  for (const entry of entries) {
    const words = current.get(entry.key);
    const language = entry.key.split(':').at(-1)!;
    if (!(LANGUAGES as readonly string[]).includes(language)) {
      refuse(entry.line, `${entry.key}: unknown language "${language}"`);
    } else if (!words) {
      refuse(entry.line, `${entry.key}: unknown screen`);
    } else if (fingerprintOf(words) !== entry.fingerprint) {
      refuse(
        entry.line,
        `${entry.key}: stale, its words changed since the page was built; rebuild it and answer again`,
      );
    } else if (entry.answer === 'no' && entry.reason === '') {
      refuse(entry.line, `${entry.key}: a no needs its reason`);
    } else {
      answers[entry.key] = {
        answer: entry.answer,
        on: day,
        reason: entry.answer === 'no' ? entry.reason : '',
        words: [...words],
      };
      taken.push(entry.key);
    }
  }
  const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { answers: sorted, taken, refused: refused.sort((a, b) => a.line - b.line) };
}
