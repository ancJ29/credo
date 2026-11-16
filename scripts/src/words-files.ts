import ts from 'typescript';

/** One word of a dictionary file: its text as the app reads it and the line it starts on. */
export type FoundWord = { text: string; line: number };

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
        found.set(key, { text: value.text, line });
      } else walk(value as ts.ObjectLiteralExpression, `${key}.`);
    }
  };
  walk(root, '');
  return found;
}
