import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

/** One word of a dictionary file: its text as the app reads it, the line it starts on and the
 * span of its literal in the source. */
export type FoundWord = { text: string; line: number; start: number; end: number };

/**
 * Every word of a dictionary file (`ui/src/i18n/en.ts` or `vi.ts`) by its dotted key, found by
 * TypeScript's own parser in the first exported object: a nested object adds a key part, a string
 * literal is a word. `text` is the literal's value, so an escaped apostrophe reads as the app reads it.
 */
export function findWords(source: string): Map<string, FoundWord> {
  const file = ts.createSourceFile('words.ts', source, ts.ScriptTarget.Latest, true);
  const root = file.statements.find(ts.isVariableStatement)!.declarationList.declarations[0]
    .initializer as ts.ObjectLiteralExpression;
  const found = new Map<string, FoundWord>();
  const walk = (object: ts.ObjectLiteralExpression, prefix: string) => {
    for (const member of object.properties as ts.NodeArray<ts.PropertyAssignment>) {
      const key = `${prefix}${(member.name as ts.Identifier).text}`;
      const value = member.initializer;
      if (ts.isStringLiteralLike(value)) {
        const line = file.getLineAndCharacterOfPosition(value.getStart(file)).line + 1;
        found.set(key, { text: value.text, line, start: value.getStart(file), end: value.end });
      } else walk(value as ts.ObjectLiteralExpression, `${key}.`);
    }
  };
  walk(root, '');
  return found;
}

/** `text` as a single-quoted literal, a backslash and a quote escaped. */
function literal(text: string): string {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/**
 * `source` with the literal of each key in `changes` replaced by the new word, nothing else touched.
 * Every key must be in the file.
 */
export function replaceWords(source: string, changes: Map<string, string>): string {
  const found = findWords(source);
  return [...changes]
    .map(([key, text]) => ({ ...found.get(key)!, text }))
    .sort((a, b) => b.start - a.start)
    .reduce(
      (done, word) => done.slice(0, word.start) + literal(word.text) + done.slice(word.end),
      source,
    );
}

/** `source` as the repository's formatter writes it, under the config found for `path`. */
export async function formatWords(source: string, path: string): Promise<string> {
  return format(source, { ...(await resolveConfig(path)), filepath: path });
}
