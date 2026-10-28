import { LANGUAGES } from '@credo/shared';
import type { Answers } from './answers';
import { parseBlock } from './block';
import { fingerprintOf } from './fingerprint';

/**
 * What `pnpm answers` does with a pasted block: each answer is held against the screen's words as
 * they are now. A line is refused, by its number and why, when its language or screen is unknown,
 * when its fingerprint is no longer the screen's (the words changed since the page was built), or
 * when a "no" gives no reason. The lines that hold are written over the rows they answer; the rest
 * of the file stays. Without `partners`, a paste holding any partner's mark (a `By:` line) writes
 * nothing. With `partners`, only partners' blocks are taken, held the same way and kept under the
 * screen's key and `@<label>`, so a later answer from one label replaces that label's row alone,
 * never the human's or another partner's.
 *
 * @param current every walk screen's words now, under its key
 * @param day the day the answers are dated, `YYYY-MM-DD`
 * @param options `partners`: the paste holds partners' blocks, never the human's
 */
export function takeAnswers(
  text: string,
  current: ReadonlyMap<string, readonly string[]>,
  existing: Answers,
  day: string,
  { partners = false } = {},
) {
  const { entries, refused } = parseBlock(text, { partners });
  const answers: Answers = { ...existing };
  const taken: string[] = [];
  const refuse = (line: number, why: string) => refused.push({ line, why });

  for (const entry of entries) {
    const words = current.get(entry.key);
    const language = entry.key.split(':').at(-1)!;
    const kept = entry.by === '' ? entry.key : `${entry.key}@${entry.by}`;
    if (!(LANGUAGES as readonly string[]).includes(language)) {
      refuse(entry.line, `${kept}: unknown language "${language}"`);
    } else if (!words) {
      refuse(entry.line, `${kept}: unknown screen`);
    } else if (fingerprintOf(words) !== entry.fingerprint) {
      refuse(
        entry.line,
        `${kept}: stale, its words changed since the page was built; rebuild it and answer again`,
      );
    } else if (entry.answer === 'no' && entry.reason === '') {
      refuse(entry.line, `${kept}: a no needs its reason`);
    } else {
      answers[kept] = {
        answer: entry.answer,
        on: day,
        reason: entry.answer === 'no' ? entry.reason : '',
        words: [...words],
      };
      taken.push(kept);
    }
  }
  const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { answers: sorted, taken, refused: refused.sort((a, b) => a.line - b.line) };
}
