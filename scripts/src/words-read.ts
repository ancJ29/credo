import { Refused } from './root-password';

/** A row of a words file: the key, both wordings and the partner's note. */
export type WordsRow = { key: string; en: string; vi: string; note: string };

/**
 * The fields of `text` as RFC 4180 reads them, whatever the line ends (CRLF, LF, a bare CR): a
 * quoted field may hold the delimiter, a line break and a doubled quote. Empty rows stay in.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let at = 0; at < text.length; at++) {
    const char = text[at];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[at + 1] === '"') {
        cell += '"';
        at++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[at + 1] === '\n') at++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows;
}

const COLUMNS = ['key', 'English', 'Vietnamese'] as const;

/**
 * The rows of a words file as bytes, from a file `words out` wrote or one a spreadsheet saved:
 * UTF-8 with or without its mark, `,` or `;` between fields (the header line says which), any
 * line ends, columns found by their names, empty rows and extra columns dropped. `label` names the
 * file in a refusal ("the file you sent").
 *
 * @throws Refused for bytes that are not UTF-8 or a header without the key, English or Vietnamese column
 */
export function readWords(bytes: Uint8Array, label: string): WordsRow[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Refused(`${label} is not UTF-8: save it as CSV UTF-8 and send it again`);
  }
  const delimiter = /^[^\r\n]*,/.test(text) ? ',' : ';';
  const [header = [], ...records] = parseCsv(text, delimiter);
  const column = (name: string) =>
    header.findIndex((cell) => cell.trim().toLowerCase() === name.toLowerCase());
  const missing = COLUMNS.filter((name) => column(name) < 0);
  if (missing.length > 0) {
    throw new Refused(`${label} has no ${missing.join(', ')} column: the first row must name them`);
  }
  const [key, en, vi, note] = [...COLUMNS, 'Note'].map(column) as [number, number, number, number];
  return records
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => ({
      key: cells[key]?.trim() ?? '',
      en: cells[en] ?? '',
      vi: cells[vi] ?? '',
      note: cells[note]?.trim() ?? '',
    }));
}
