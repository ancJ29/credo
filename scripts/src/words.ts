import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DICTIONARIES } from '@credo/ui/words';

export type WordsIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  /** The folder a relative file name is read from when `INIT_CWD` (pnpm's) is not set. */
  cwd: string;
};

const USAGE = 'usage: words out <a file that does not exist yet, outside the repository>';

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

/**
 * `pnpm words out <file>`: writes every word of the app, English and Vietnamese, into one
 * spreadsheet file a row a word, for a partner to correct. It refuses a file that exists, since the
 * sent file is what every return is read against.
 *
 * Exit 0 written, 2 refused before anything was written (no file, an unknown verb, a file that
 * exists).
 */
export async function runWords(
  argv: string[],
  env: Record<string, string | undefined>,
  io: WordsIo,
  dictionaries: { en: Tree; vi: Tree } = DICTIONARIES,
): Promise<number> {
  const [verb, file, ...extra] = argv;
  if (verb !== 'out' || !file || extra.length > 0) {
    io.err(USAGE);
    return 2;
  }
  const path = resolve(env.INIT_CWD ?? io.cwd, file);
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
