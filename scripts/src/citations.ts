import { posix } from 'node:path';

/**
 * The citation rule, held: a living document cites a file and a symbol in it, never a line
 * (`docs/conventions/documentation.md`'s "How a living document cites code"). For every citation
 * in a living document this greps THE NAMED FILE, never the repository, for a declaration of the
 * named symbol, key or fragment, and is red on a file that is not there, a name that does not
 * resolve, and a name declared twice. A line citation (`path#L12`) is counted per document and its
 * line is never checked: it converts when a piece touches it, and the count is the conversion's
 * progress. But its FILE is checked like any other: a line citation whose path has gone is red.
 * What it cannot see: a symbol that still exists and has changed its meaning.
 */

/** The living documents, by path. A document outside this set is invisible to the check. */
const LIVING: { show: string; test: RegExp }[] = [
  { show: 'README.md', test: /^README\.md$/ },
  { show: 'CLAUDE.md, at any depth', test: /(^|\/)CLAUDE\.md$/ },
  { show: 'docs/conventions/*.md', test: /^docs\/conventions\/[^/]+\.md$/ },
  { show: 'docs/architecture.md', test: /^docs\/architecture\.md$/ },
  { show: 'docs/activity-log.md', test: /^docs\/activity-log\.md$/ },
  { show: 'docs/README.md', test: /^docs\/README\.md$/ },
  { show: 'docs/client-readiness.md', test: /^docs\/client-readiness\.md$/ },
];

type Span = { text: string; start: number; end: number };
type Citation =
  | { kind: 'name'; line: number; file: string; name: string }
  | { kind: 'line'; line: number; file: string | null; text: string }
  | { kind: 'file'; line: number; file: string };

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FILE = /^([\w@./-]+\.[A-Za-z0-9]+|\.[\w.-]+)((?:#L\d+(?:-L?\d+)?)*)$/;
const LINE_ONLY = /^#L\d+(?:-L?\d+)?$/;
const NAME = /^[A-Za-z_$][\w$]*$/;
const DOTTED = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/;
// logs/ is the credo root's folder of run receipts, outside the repository: no tracked file is there.
const PLACEHOLDER = /[<>*{}$~]|^\/|^https?:|^logs\//;

/** Every citation of one document: a file and its symbol, a symbol "in" a file, a line, a file alone. */
function citationsOf(text: string): Citation[] {
  const found: Citation[] = [];
  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const spans: Span[] = [...raw.matchAll(/`([^`]+)`/g)].map((m) => ({
      text: m[1],
      start: m.index,
      end: m.index + m[0].length,
    }));
    const used = new Set<number>();
    spans.forEach((span, at) => {
      if (used.has(at)) return;
      if (LINE_ONLY.test(span.text)) {
        found.push({ kind: 'line', line, file: null, text: span.text });
        return;
      }
      const next = spans[at + 1];
      const file = FILE.exec(span.text);
      if (file && next && raw.slice(span.end, next.start) === "'s ") {
        used.add(at + 1);
        found.push({ kind: 'name', line, file: file[1], name: next.text });
        if (file[2]) found.push({ kind: 'line', line, file: file[1], text: file[2] });
        return;
      }
      if (file) {
        if (file[2]) found.push({ kind: 'line', line, file: file[1], text: file[2] });
        else if (file[1].includes('/') && !PLACEHOLDER.test(file[1]))
          found.push({ kind: 'file', line, file: file[1] });
        return;
      }
      const target = next ? FILE.exec(next.text) : null;
      if (target && next && raw.slice(span.end, next.start) === ' in ' && !target[2]) {
        used.add(at + 1);
        found.push({ kind: 'name', line, file: target[1], name: span.text });
      }
    });
  });
  return found;
}

/** Where a cited file is: from the root, from the document's folder, or the one file of that name below it. */
function locate(tracked: Set<string>, doc: string, file: string): string | null {
  const folder = posix.dirname(doc);
  for (const candidate of [file, posix.join(folder, file)]) {
    if (tracked.has(candidate)) return candidate;
  }
  if (file.includes('/')) return null;
  const below = [...tracked].filter(
    (path) => path.endsWith(`/${file}`) && (folder === '.' || path.startsWith(`${folder}/`)),
  );
  return below.length === 1 ? below[0] : null;
}

/** The lines of `text` that match any of `patterns`, counted once each. */
const lines = (text: string, patterns: RegExp[]) =>
  text.split('\n').filter((row) => patterns.some((pattern) => pattern.test(row))).length;

/** How many times `name` is DECLARED in a file of this kind (a use is not a declaration). */
export function declared(path: string, text: string, name: string): number {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? '';
  const n = escapeRe(name);
  if (DOTTED.test(name)) {
    const parts = name.split('.');
    if (ext === 'json') {
      let at: unknown = JSON.parse(text);
      for (const part of parts) {
        if (typeof at !== 'object' || at === null || !(part in at)) return 0;
        at = (at as Record<string, unknown>)[part];
      }
      return 1;
    }
    if (ext === 'go') {
      const [type, method] = parts;
      return lines(text, [
        new RegExp(
          `^func\\s+\\(\\s*\\w*\\s*\\*?${escapeRe(type)}(\\[[^\\]]*\\])?\\s*\\)\\s*${escapeRe(method)}\\s*[\\[(]`,
        ),
      ]);
    }
    const each = parts.map((part) => declared(path, text, part));
    return each.includes(0) ? 0 : Math.max(...each);
  }
  if (!NAME.test(name)) {
    // A YAML step is cited by its name, the value of its `- name:` entry; any other fragment is literal.
    const steps =
      ext === 'yml' || ext === 'yaml'
        ? lines(text, [new RegExp(`^\\s*-\\s*name:\\s*${n}\\s*$`)])
        : 0;
    return steps > 0 ? steps : text.split(name).length - 1;
  }
  if (['ts', 'tsx', 'js', 'mjs', 'cjs'].includes(ext)) {
    return lines(text, [
      new RegExp(
        `^\\s*(export\\s+)?(default\\s+)?(declare\\s+)?(async\\s+)?(function\\s*\\*?|const|let|var|class|abstract\\s+class|interface|type|enum|namespace)\\s+${n}\\b`,
      ),
      new RegExp(`^\\s*${n}\\??\\s*:`),
      new RegExp(
        `^\\s*(public\\s+|private\\s+|static\\s+|async\\s+)*${n}\\s*\\([^)]*\\)\\s*(:[^{;]+)?\\{`,
      ),
      new RegExp(`^\\s*export\\s*(type\\s*)?\\{[^}]*\\b${n}\\b[^}]*\\}`),
    ]);
  }
  if (ext === 'sh') {
    return lines(text, [
      new RegExp(`^\\s*(function\\s+)?${n}\\s*\\(\\)`),
      new RegExp(`^\\s*((export|readonly|local)\\s+)*${n}=`),
    ]);
  }
  if (ext === 'yml' || ext === 'yaml') {
    return lines(text, [
      new RegExp(`^\\s*(-\\s+)?${n}\\s*:`),
      new RegExp(`^\\s*-\\s*name:\\s*${n}\\s*$`),
    ]);
  }
  if (ext === 'json') return lines(text, [new RegExp(`"${n}"\\s*:`)]);
  if (ext === 'go') {
    return lines(text, [
      new RegExp(`^func\\s+${n}\\s*[\\[(]`),
      new RegExp(`^(type|var|const)\\s+${n}\\b`),
      new RegExp(`^\\t+${n}\\s*=\\s`),
      new RegExp(`^\\t+${n}\\s+[\\w[*]`),
    ]);
  }
  return text.split(name).length - 1;
}

type Found = { doc: string; line: number; cite: string; why: string };
export type Report = {
  documents: string[];
  findings: Found[];
  names: Map<string, number>;
  lineCitations: Map<string, number>;
  empty: string[];
  outside: Map<string, number>;
};

/** The whole check over a set of tracked files; `read` gives a file's text. */
export function checkCitations(tracked: string[], read: (path: string) => string): Report {
  const set = new Set(tracked);
  const documents = tracked.filter((path) => LIVING.some((one) => one.test.test(path))).sort();
  const empty = LIVING.filter((one) => !tracked.some((path) => one.test.test(path))).map(
    (one) => one.show,
  );
  const outside = new Map<string, number>();
  for (const path of tracked) {
    if (!path.endsWith('.md') || documents.includes(path)) continue;
    const folder = posix.dirname(path);
    outside.set(folder, (outside.get(folder) ?? 0) + 1);
  }
  const findings: Found[] = [];
  const names = new Map<string, number>();
  const lineCitations = new Map<string, number>();
  for (const doc of documents) {
    names.set(doc, 0);
    lineCitations.set(doc, 0);
    for (const cite of citationsOf(read(doc))) {
      if (cite.kind === 'line') lineCitations.set(doc, lineCitations.get(doc)! + 1);
      const file =
        cite.kind === 'line' && cite.file === null ? null : (cite as { file: string }).file;
      if (file === null) continue;
      const shown = cite.kind === 'name' ? `${file}'s ${cite.name}` : file;
      const path = locate(set, doc, file);
      if (path === null) {
        // A line citation to a bare file name is left to its conversion; any other citation to a
        // file that no tracked path matches, or that two match, is red.
        if (cite.kind === 'line' && !file.includes('/')) continue;
        const why = file.includes('/')
          ? 'the file is not there'
          : 'no single file of that name below the document';
        findings.push({ doc, line: cite.line, cite: shown, why });
        continue;
      }
      if (cite.kind !== 'name') continue;
      names.set(doc, names.get(doc)! + 1);
      const count = declared(path, read(path), cite.name);
      if (count === 0)
        findings.push({ doc, line: cite.line, cite: shown, why: 'declared nowhere in that file' });
      if (count > 1)
        findings.push({
          doc,
          line: cite.line,
          cite: shown,
          why: `declared ${count} times in that file`,
        });
    }
  }
  return { documents, findings, names, lineCitations, empty, outside };
}

/** The run's own account of what it covered, so a document outside the set cannot hide. */
export function describeRun(report: Report): string {
  const rows = report.documents.map(
    (doc) =>
      `  ${doc.padEnd(34)} ${String(report.names.get(doc)).padStart(4)} named   ${String(report.lineCitations.get(doc)).padStart(4)} line`,
  );
  const total = (map: Map<string, number>) => [...map.values()].reduce((a, b) => a + b, 0);
  const outside = [...report.outside].map(([folder, count]) => `${folder} ${count}`).join(', ');
  return [
    'citations: the living documents',
    `  path set: ${LIVING.map((one) => one.show).join(' | ')}`,
    `  documents found: ${report.documents.length}`,
    '  checked: a file and its symbol, key or quoted fragment, a symbol "in" a file, a file path alone;',
    '  counted only: line citations (path#L12), whose line is never checked and which convert when a piece touches them; a line citation whose file has gone is red;',
    '  not covered: Markdown links and heading anchors, and any document outside the set;',
    `  markdown outside the set (folder count): ${outside}`,
    '  document                           named citations   line citations left',
    ...rows,
    `  total: ${total(report.names)} named, ${total(report.lineCitations)} line citations left, ${report.findings.length} red`,
  ].join('\n');
}
