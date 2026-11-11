import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkCitations,
  declared,
  describeLogs,
  describeRun,
  logCitations,
  type Report,
} from './citations';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('the living documents cite a file and a symbol that resolve', () => {
  it('every cited name resolves, once, in the file that is named', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    const report = checkCitations(tracked, (path) => readFileSync(`${ROOT}${path}`, 'utf8'));
    console.log(describeRun(report));
    expect(report.empty, 'a pattern of the set found no document').toEqual([]);
    expect(report.documents.length).toBeGreaterThan(10);
    expect(report.findings.map((one) => `${one.doc}:${one.line} ${one.cite}: ${one.why}`)).toEqual(
      [],
    );
  });
});

/** The log citations already written. One more is red; one fewer asks for this to come down. */
const LOG_CITATIONS_PINNED = 411;

describe('a record names no log: the log citations written are counted and pinned', () => {
  it('the count equals the pin, so a new citation is red and a removal lowers the pin', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
    const report = logCitations(tracked, (path) => readFileSync(`${ROOT}${path}`, 'utf8'));
    console.log(describeLogs(report));
    expect(
      report.total,
      'A committed record says what ran and how it ended in words and names no log (docs/conventions/documentation.md): a log is a working file on one machine and opens nothing on GitHub. Take the new log path out; if citations were removed, lower LOG_CITATIONS_PINNED.',
    ).toBe(LOG_CITATIONS_PINNED);
  });
});

/** A small repository: its files by path. */
const repo = (files: Record<string, string>) => ({
  tracked: Object.keys(files),
  read: (path: string) => files[path],
});
const run = (files: Record<string, string>) => {
  const made = repo(files);
  return checkCitations(made.tracked, made.read);
};
const whys = (report: Report) => report.findings.map((one) => one.why);

const CODE = [
  'export function replyFor(error: unknown) {',
  '  return error;',
  '}',
  'export const LIMIT = 3;',
].join('\n');

describe('the check, on made-up repositories', () => {
  it('passes a symbol that is declared once in the named file', () => {
    const report = run({
      'CLAUDE.md': "`bff/src/errors.ts`'s `replyFor`",
      'bff/src/errors.ts': CODE,
    });
    expect(report.findings).toEqual([]);
    expect(report.names.get('CLAUDE.md')).toBe(1);
  });

  it('reds a citation whose file is not there', () => {
    const report = run({ 'CLAUDE.md': "`bff/src/gone.ts`'s `replyFor`" });
    expect(whys(report)).toEqual(['the file is not there']);
  });

  it('reds a symbol that was renamed', () => {
    const report = run({
      'CLAUDE.md': "`bff/src/errors.ts`'s `replyFor`",
      'bff/src/errors.ts': CODE.replace('replyFor', 'replyWith'),
    });
    expect(whys(report)).toEqual(['declared nowhere in that file']);
  });

  it('reds a symbol declared twice, and a name that only another file declares', () => {
    const twice = run({
      'CLAUDE.md': "`bff/src/errors.ts`'s `replyFor`",
      'bff/src/errors.ts': `${CODE}\nexport function replyFor(other: number) {\n  return other;\n}`,
    });
    expect(whys(twice)).toEqual(['declared 2 times in that file']);
    const elsewhere = run({
      'CLAUDE.md': "`bff/src/errors.ts`'s `replyFor`",
      'bff/src/errors.ts': 'export const nothing = 1;',
      'bff/src/app.ts': CODE,
    });
    expect(whys(elsewhere)).toEqual(['declared nowhere in that file']);
  });

  it('reads a use as no declaration', () => {
    const report = run({
      'CLAUDE.md': "`a.ts`'s `LIMIT`",
      'a.ts': 'export const LIMIT = 3;\nconst x = LIMIT + LIMIT;',
    });
    expect(report.findings).toEqual([]);
  });

  const GO = [
    'package server',
    'func Build(key string) *Server {',
    '\treturn nil',
    '}',
    'func (s *Server) handle(pattern string) {',
    '}',
    'type Store struct{}',
    'func (s *Store) Get(code string) {}',
  ].join('\n');

  it('reds a Go method cited the TypeScript way, and passes the Go ways', () => {
    const bare = run({ 'CLAUDE.md': "`s.go`'s `handle`", 's.go': GO });
    expect(whys(bare)).toEqual(['declared nowhere in that file']);
    const good = run({
      'CLAUDE.md': [
        "`s.go`'s `Build`",
        "`s.go`'s `Server.handle`",
        "`s.go`'s `func (s *Server) handle(`",
        '`Store.Get` in `s.go`',
      ].join('\n'),
      's.go': GO,
    });
    expect(good.findings).toEqual([]);
  });

  it('reads a key of YAML and of JSON, and a function of shell', () => {
    const files = {
      'CLAUDE.md': [
        "`env.yml`'s `BoxGroup`",
        "`package.json`'s `scripts.check`",
        "`run.sh`'s `main`",
        "`package.json`'s `scripts.build`",
      ].join('\n'),
      'env.yml': 'Resources:\n  BoxGroup:\n    Type: x\n  Other: !Ref BoxGroup\n',
      'package.json': '{"scripts":{"check":"x"}}',
      'run.sh': 'main() {\n  :\n}\nmain\n',
    };
    expect(whys(run(files))).toEqual(['declared nowhere in that file']);
  });

  it('reads a YAML step by its name, and leaves a log receipt alone', () => {
    const report = run({
      'CLAUDE.md': "`ci.yml`'s `ShellCheck 0.11.0` and `logs/a.log` and `ci.yml`'s `Gone step`",
      'ci.yml': 'steps:\n  - name: ShellCheck 0.11.0\n    run: echo "no ShellCheck 0.11.0 here"\n',
    });
    expect(whys(report)).toEqual(['declared nowhere in that file']);
  });

  it('reds a quoted fragment that is absent or present twice', () => {
    const files = {
      'CLAUDE.md': ["`a.txt`'s `one line`", "`a.txt`'s `two line`", "`a.txt`'s `no line`"].join(
        '\n',
      ),
      'a.txt': 'one line\ntwo line\ntwo line\n',
    };
    expect(whys(run(files))).toEqual([
      'declared 2 times in that file',
      'declared nowhere in that file',
    ]);
  });

  it('counts a line citation instead of reddening it, and reds its file when missing', () => {
    const report = run({
      'CLAUDE.md': '`a.ts#L2` and then `#L5-L7`, and `docs/gone.ts#L1` and `bare.ts#L9`',
      'a.ts': 'x',
    });
    expect(report.lineCitations.get('CLAUDE.md')).toBe(4);
    expect(whys(report)).toEqual(['the file is not there']);
  });

  it('reds a path that is not a file, leaves placeholders and bare names alone', () => {
    const report = run({
      'CLAUDE.md': '`ui/src/<Name>Page.tsx` `staff.ts` `docs/gone.md` `docs/here.md`',
      'docs/here.md': 'x',
    });
    expect(whys(report)).toEqual(['the file is not there']);
  });

  it('finds a bare file name below the document, once, and not when it is ambiguous', () => {
    const files = {
      'bff/CLAUDE.md': "`app.ts`'s `go`",
      'bff/src/app.ts': 'export const go = 1;',
    };
    expect(run(files).findings).toEqual([]);
    expect(whys(run({ ...files, 'bff/src/x/app.ts': 'x' }))).toEqual([
      'no single file of that name below the document',
    ]);
  });

  it('reads a symbol "in" a file', () => {
    const report = run({ 'CLAUDE.md': '`Run` in `a.ts`', 'a.ts': 'export function Run() {}' });
    expect(report.findings).toEqual([]);
    expect(report.names.get('CLAUDE.md')).toBe(1);
  });

  it('knows a dotted key chain of code, and a name of a kind it has no pattern for', () => {
    const report = run({
      'CLAUDE.md': "`c.ts`'s `coverage.exclude` `c.ts`'s `coverage.gone` `n.css`'s `.card`",
      'c.ts': 'export default {\n  coverage: {\n    exclude: [],\n  },\n};',
      'n.css': '.card { x: y }',
    });
    expect(whys(report)).toEqual(['declared nowhere in that file']);
  });

  it('declares re-exports, methods and properties', () => {
    const text = [
      "export { WIDTHS } from '@credo/shared';",
      'class A {',
      '  async run(x: number): Promise<void> {',
      '  }',
      '}',
      'const o = {',
      '  retries: 0,',
      '};',
    ].join('\n');
    expect(declared('a.ts', text, 'WIDTHS')).toBe(1);
    expect(declared('a.ts', text, 'run')).toBe(1);
    expect(declared('a.ts', text, 'retries')).toBe(1);
  });

  it('declares Go values in a block, and a method of a type with a type parameter', () => {
    const text = [
      'var (',
      '\tErrMoved = errors.New("moved")',
      ')',
      'func (s *Box[T]) Put() {}',
    ].join('\n');
    expect(declared('a.go', text, 'ErrMoved')).toBe(1);
    expect(declared('a.go', text, 'Box.Put')).toBe(1);
  });

  it('declares a JSON key, a name in a kind it has no pattern for, and in a file with no extension', () => {
    expect(declared('a.json', '{"scripts": {"check": 1}}', 'check')).toBe(1);
    expect(declared('a.css', '.card { x: y }\n.card {}', 'card')).toBe(2);
    expect(declared('Makefile', 'check:\n\tgo vet', 'check')).toBe(1);
  });

  it('counts a line cited beside a symbol as a line citation too', () => {
    const report = run({ 'CLAUDE.md': "`a.ts#L3`'s `go`", 'a.ts': 'export const go = 1;' });
    expect(report.findings).toEqual([]);
    expect(report.lineCitations.get('CLAUDE.md')).toBe(1);
  });

  it('is red when a pattern of the set finds no document, and prints the set it scanned', () => {
    const report = run({ 'CLAUDE.md': 'x', 'docs/plans/p.md': '`a.ts#L1`' });
    expect(report.empty).toContain('docs/architecture.md');
    expect(report.outside.get('docs/plans')).toBe(1);
    const printed = describeRun(report);
    expect(printed).toContain('documents found: 1');
    expect(printed).toContain('docs/conventions/*.md');
    expect(printed).toContain('docs/plans 1');
  });
});

describe('logCitations', () => {
  const count = (files: Record<string, string>) => {
    const made = repo(files);
    return logCitations(made.tracked, made.read);
  };

  it('counts a logs/ path with its document and line, whatever stands before it', () => {
    const report = count({
      'docs/a.md':
        'ran `logs/2026-11-01-x.log`\nand $ROOT_DIR/logs/y.log, and /home/u/credo/logs/z.log.\n',
    });
    expect(report.items).toEqual([
      { doc: 'docs/a.md', line: 1, text: 'logs/2026-11-01-x.log' },
      { doc: 'docs/a.md', line: 2, text: 'logs/y.log' },
      { doc: 'docs/a.md', line: 2, text: 'logs/z.log' },
    ]);
    expect(report.byDoc.get('docs/a.md')).toBe(3);
  });

  it('leaves a pattern, the folder alone and a longer word alone', () => {
    const report = count({
      'a.md': 'logs/<name>.log logs/*.log logs/{a,b} logs/ logs/archive/ catalogs/x.log logs',
    });
    expect(report.total).toBe(0);
  });

  it('counts a file in a subfolder of logs/ and reads only Markdown', () => {
    const report = count({
      'a.md': 'see logs/archive/old.log',
      'run.sh': 'echo logs/run.log',
    });
    expect(report.items.map((one) => one.text)).toEqual(['logs/archive/old.log']);
  });

  it('counts a log name in either of qa.md shapes with no logs/ before it', () => {
    const report = count({
      'a.md':
        'the gate (2026-11-11-175845-gate-scripts.log) and 20261108-1809-ridge-read.log#L12 ran',
    });
    expect(report.items.map((one) => one.text)).toEqual([
      '2026-11-11-175845-gate-scripts.log',
      '20261108-1809-ridge-read.log',
    ]);
  });

  it('counts one citation once: a shaped name inside a logs/ path, or any path, is not counted again', () => {
    const report = count({
      'a.md':
        'logs/20261108-1809-ridge-read.log and $ROOT/logs/2026-11-11-175845-gate-x.log and tmp/20261108-1809-a.log',
    });
    expect(report.items.map((one) => one.text)).toEqual([
      'logs/20261108-1809-ridge-read.log',
      'logs/2026-11-11-175845-gate-x.log',
    ]);
  });

  it('leaves a lookalike alone: a date-shaped name that is not a log, a pattern', () => {
    const report = count({
      'a.md':
        '20261108-1809-notes.md 2026-11-11-175845-<script>.log <YYYYMMDD-HHMM>-<stem>.log 20261108-18-x.log',
    });
    expect(report.total).toBe(0);
  });

  it('reads the same with no logs/ folder: it opens no log', () => {
    const files = { 'a.md': 'logs/gone.log' };
    expect(count(files).total).toBe(1);
  });

  it('prints the forms it sees, those it cannot, and a row a document', () => {
    const text = describeLogs(count({ 'a.md': 'logs/x.log\nlogs/y.log', 'b.md': 'logs/z.log' }));
    expect(text).toContain('not counted: a pattern');
    expect(text).toContain('cannot see');
    expect(text).toMatch(/a\.md\s+2\n/);
    expect(text).toContain('total: 3 citations in 2 documents');
  });
});
