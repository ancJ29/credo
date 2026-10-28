import { readFile } from 'node:fs/promises';
import { LABEL } from './block';

/**
 * One answer, as `visual/answers.json` keeps it, under `<walk>:<screen>:<language>` for the
 * human's and `...@<label>` for a partner's.
 */
export type Answer = {
  answer: 'yes' | 'no';
  /** The day, `YYYY-MM-DD`. */
  on: string;
  /** A "no"'s reason, as the human gave it; empty on a yes. */
  reason: string;
  /** The screen's words it was given on, a line each. */
  words: string[];
};

export type Answers = Record<string, Answer>;

const KEY = new RegExp(`^[a-z0-9-]+:[a-z0-9-]+:(vi|en)(@${LABEL.source.slice(1, -1)})?$`);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ['answer', 'on', 'reason', 'words'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What is wrong with a row, or nothing. */
function problemWith(row: unknown): string | null {
  if (!isObject(row)) return 'is not an object';
  if (Object.keys(row).sort().join() !== [...FIELDS].sort().join()) {
    return `must hold exactly ${FIELDS.join(', ')}`;
  }
  if (row['answer'] !== 'yes' && row['answer'] !== 'no') return 'answer must be yes or no';
  if (typeof row['on'] !== 'string' || !DAY.test(row['on']) || isNaN(Date.parse(row['on']))) {
    return 'on must be a day, YYYY-MM-DD';
  }
  if (typeof row['reason'] !== 'string') return 'reason must be text';
  if ((row['answer'] === 'no') === (row['reason'] === '')) {
    return 'a no needs its reason, and a yes has none';
  }
  if (!Array.isArray(row['words']) || row['words'].some((line) => typeof line !== 'string')) {
    return 'words must be a list of lines';
  }
  return null;
}

/**
 * The answers file's text as answers. A file that does not parse, or a row of no known form, stops
 * the build: it never reads as nothing answered.
 */
export function parseAnswers(text: string): Answers {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`answers.json does not parse: ${(error as Error).message}`, { cause: error });
  }
  if (!isObject(data)) throw new Error('answers.json must hold one object, a row a key');
  for (const [key, row] of Object.entries(data)) {
    if (!KEY.test(key))
      throw new Error(`answers.json: "${key}" is not <walk>:<screen>:<vi|en>[@label]`);
    const problem = problemWith(row);
    if (problem) throw new Error(`answers.json: "${key}" ${problem}`);
  }
  return data as Answers;
}

export async function readAnswers(file: string) {
  return parseAnswers(await readFile(file, 'utf8'));
}
