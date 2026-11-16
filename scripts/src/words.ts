import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DICTIONARIES } from '@credo/ui/words';
import { Refused } from './root-password';
import { findWords, formatWords, replaceWords, type FoundWord } from './words-files';
import { readWords, type WordsRow } from './words-read';

export type WordsIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** The folder a relative file name is read from when `INIT_CWD` (pnpm's) is not set. */
  cwd: string;
  /** The repository's root, where `ui/src/i18n/en.ts` and `vi.ts` are read from. */
  root: string;
  /** Asks the person a question and gives back the answer typed. */
  ask: (question: string) => Promise<string>;
};

const USAGE =
  'usage: words out <a file that does not exist yet, outside the repository> | words in <the file you sent> <the file returned>';

/** The column names, in order; the file the partners get has exactly these. */
const HEADER = ['key', 'English', 'Vietnamese', 'Note'];

/** The byte-order mark Excel needs to read the file as UTF-8. */
const BYTE_ORDER_MARK = '﻿';

type Tree = { [name: string]: string | Tree };

/** Every word of `tree` as a dotted key and its text, in the object's own order. */
function flatten(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([name, value]) =>
    typeof value === 'string' ? [[`${prefix}${name}`, value]] : flatten(value, `${prefix}${name}.`),
  );
}

/** A field as RFC 4180 writes it: always in double quotes, a quote inside doubled. */
function field(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * The file `words out` writes: the byte-order mark, then a header and a row for each English
 * word in the dictionary's order, fields in double quotes, lines ended CRLF. A key the
 * Vietnamese dictionary lacks gets an empty cell (the type forbids it).
 */
export function wordsCsv(dictionaries: { en: Tree; vi: Tree }): string {
  const vietnamese = new Map(flatten(dictionaries.vi));
  const rows = flatten(dictionaries.en).map(([key, english]) => [
    key,
    english,
    vietnamese.get(key) ?? '',
    '',
  ]);
  return (
    BYTE_ORDER_MARK + [HEADER, ...rows].map((row) => `${row.map(field).join(',')}\r\n`).join('')
  );
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
] as const;

/** The placeholders of a word, `{{name}}` each, sorted and without repeats. */
function placeholders(word: string): string[] {
  return [...new Set(word.match(/\{\{[^}]*\}\}/g) ?? [])].sort();
}

const listOf = (names: string[]) => (names.length > 0 ? names.join(' ') : 'none');

async function readRows(path: string, label: string): Promise<WordsRow[]> {
  const bytes = await readFile(path).catch(() => {
    throw new Refused(`cannot read ${label}: ${path}`);
  });
  return readWords(bytes, label);
}

/** What in the returned file would break the app or cannot be told apart, one line a row. */
function problemsOf(returned: WordsRow[], sent: Map<string, WordsRow>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of returned) {
    const key = row.key || `a row with no key (English: ${row.en})`;
    if (seen.has(row.key)) problems.push(`${key}: the key is there twice`);
    seen.add(row.key);
    const was = sent.get(row.key);
    if (!was) {
      problems.push(`${key}: not in the file you sent`);
      continue;
    }
    for (const { code, name } of LANGUAGES) {
      if (row[code].trim() === '') problems.push(`${key}: the ${name} cell is empty`);
      else if (/[\r\n]/.test(row[code]))
        problems.push(`${key}: the ${name} cell holds a line break`);
      else if (placeholders(row[code]).join() !== placeholders(was[code]).join()) {
        problems.push(
          `${key}: the ${name} placeholders were ${listOf(placeholders(was[code]))}, now ${listOf(placeholders(row[code]))}`,
        );
      }
    }
  }
  return problems;
}

/**
 * `words in <sent> <returned>`: reads the returned file against the one that was sent and against
 * the words now in `ui/src/i18n/en.ts` and `vi.ts`, and prints each change, clash, vanished key and
 * note. A file that would break the app is refused whole. Nothing is written.
 */
async function wordsIn(
  sentPath: string,
  returnedPath: string,
  io: WordsIo,
  formatter: Formatter,
): Promise<number> {
  const sent = new Map(
    (await readRows(sentPath, 'the file you sent')).map((row) => [row.key, row]),
  );
  const returned = await readRows(returnedPath, 'the file returned');
  const problems = problemsOf(returned, sent);
  if (problems.length > 0) {
    throw new Refused(
      `refused, nothing read in: ${problems.length} problems\n${problems.map((p) => `  ${p}`).join('\n')}`,
    );
  }
  const now = {
    en: findWords(await readFile(join(io.root, 'ui/src/i18n/en.ts'), 'utf8')),
    vi: findWords(await readFile(join(io.root, 'ui/src/i18n/vi.ts'), 'utf8')),
  };
  const found = (key: string, code: 'en' | 'vi'): FoundWord => now[code].get(key)!;
  const edits: Record<'en' | 'vi', Map<string, string>> = { en: new Map(), vi: new Map() };
  let changes = 0;
  const counts = { clashes: 0, gone: 0, notes: 0 };
  for (const row of returned) {
    const was = sent.get(row.key)!;
    if (!now.en.has(row.key) || !now.vi.has(row.key)) {
      counts.gone++;
      io.out(`gone ${row.key}: no longer in the app, not written`);
    } else {
      for (const { code, name } of LANGUAGES) {
        if (row[code] === was[code]) continue;
        const app = found(row.key, code);
        const place = `${name} ${row.key} (${code}.ts line ${app.line})`;
        if (app.text === row[code]) io.out(`already so ${place}`);
        else if (app.text === was[code]) {
          changes++;
          edits[code].set(row.key, row[code]);
          io.out(`change ${place}\n  now:    ${app.text}\n  theirs: ${row[code]}`);
        } else {
          counts.clashes++;
          io.out(
            `clash ${place}, not written\n  sent:   ${was[code]}\n  now:    ${app.text}\n  theirs: ${row[code]}`,
          );
        }
      }
    }
    if (row.note) {
      counts.notes++;
      io.out(`note ${row.key}: ${row.note}`);
    }
  }
  io.out(
    `${changes} changes, ${counts.clashes} clashes, ${counts.gone} keys gone, ${counts.notes} notes`,
  );
  if (changes === 0) return 0;
  const answer = await io.ask(`Write these ${changes} changes? (y/N)`);
  if (answer.trim().toLowerCase() !== 'y') {
    io.out('nothing written');
    return 0;
  }
  return writeEdits(edits, io, formatter);
}

/** How a word file is formatted: the repository's formatter; a test hands another. */
type Formatter = (source: string, path: string) => Promise<string>;

/**
 * Puts `edits` into the two word files in place, formats each and reads it back: every key in
 * `edits` must read its new word and every other key its old one, in both files, or neither file is
 * written. Exit 1 when the read-back differs.
 */
async function writeEdits(
  edits: Record<'en' | 'vi', Map<string, string>>,
  io: WordsIo,
  formatter: Formatter,
): Promise<number> {
  const done = [];
  for (const { code } of LANGUAGES) {
    const path = join(io.root, `ui/src/i18n/${code}.ts`);
    const before = await readFile(path, 'utf8');
    const after = await formatter(replaceWords(before, edits[code]), path);
    const was = findWords(before);
    const now = findWords(after);
    const wrong = [...was].filter(
      ([key, word]) => now.get(key)?.text !== (edits[code].get(key) ?? word.text),
    );
    if (wrong.length > 0 || now.size !== was.size) {
      io.err(
        `nothing written: ${code}.ts did not read back as intended (${wrong.map(([key]) => key).join(', ') || 'its keys moved'})`,
      );
      return 1;
    }
    done.push({ path, after, code });
  }
  for (const { path, after } of done) await writeFile(path, after);
  io.out(`wrote ${done.map(({ code }) => `${code}.ts`).join(' and ')}`);
  return 0;
}

/**
 * `pnpm words out <file>`: writes every word of the app, English and Vietnamese, into one
 * spreadsheet file a row a word, for a partner to correct. It refuses a file that exists, since the
 * sent file is what every return is read against.
 *
 * `words in <sent> <returned>` reads a returned file against the one sent and the words now, shows
 * what would change and, when the answer to the question is y, writes it into the two word files.
 *
 * Exit 0 done, 2 refused before anything was written (no file, an unknown verb, a file that
 * exists, a returned file that would break the app).
 */
export async function runWords(
  argv: string[],
  env: Record<string, string | undefined>,
  io: WordsIo,
  dictionaries: { en: Tree; vi: Tree } = DICTIONARIES,
  formatter: Formatter = formatWords,
): Promise<number> {
  const [verb, file, second, ...extra] = argv;
  const base = env.INIT_CWD ?? io.cwd;
  try {
    if (verb === 'in' && file && second && extra.length === 0) {
      return await wordsIn(resolve(base, file), resolve(base, second), io, formatter);
    }
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    io.err(error.message);
    return 2;
  }
  if (verb !== 'out' || !file || second) {
    io.err(USAGE);
    return 2;
  }
  const path = resolve(base, file);
  try {
    await writeFile(path, wordsCsv(dictionaries), { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    io.err(`refused: ${path} already exists; the file you sent is kept, name a new one`);
    return 2;
  }
  io.out(`wrote ${path}`);
  return 0;
}
