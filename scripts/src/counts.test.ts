import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { type Io, RULES, type Rules, repoIo, runCounts } from './counts';

/**
 * `runCounts` on a repository whose answers the test controls, so the test pins the command's
 * shape (what each count says, what stands beside it, what the exit is) and not today's numbers,
 * which move every time someone writes a screen. One run over this repository checks only that the
 * command runs and prints all five counts.
 */

const FIXTURE: Rules = {
  decisions: [
    {
      name: 'the bound',
      home: { file: 'home.ts', name: 'HOME' },
      sites: ['a.ts', 'b.ts', 'c.ts'],
      family: /^f\/[^/]+\.ts$/,
      copy: /const COPY\b/,
    },
  ],
  forms: {
    files: ['f1.tsx', 'f2.tsx'],
    fieldError: /\berror=\{/,
    marker: /<form\b/,
    where: /^[^/]+\.tsx$/,
  },
  storage: {
    client: { file: 'client.ts', type: 'Client' },
    where: /^s\/[^/]+\.ts$/,
    registration: /^\s*app\.(get|post)\(/m,
  },
  screens: { where: /^u\/[^/]+\.tsx$/, direct: /from '\.\/api'/ },
  errors: {
    where: /^s\/[^/]+\.ts$/,
    registration: /^\s*app\.(get|post)\(/,
    writes: [/\.status\(4\d\d\)/],
  },
};

const FILES: Record<string, string> = {
  'home.ts': 'export const HOME = 1;',
  'a.ts': 'const x = HOME;',
  'b.ts': 'const COPY = 3;',
  'c.ts': '// const COPY = 3, the old way, named in a comment\nconst y = HOME;',
  'f/one.ts': 'const z = HOME;',
  'f/two.test.ts': 'const COPY = 3;',
  'f1.tsx': '<form><Input error={e} /></form>',
  'f2.tsx': '<form><Input /></form>',
  'f3.tsx': '<form></form>',
  'client.ts': 'export type Client = {\n  get(key: string): void;\n  put(key: string): void;\n};',
  's/routes.ts': [
    "app.get('/x', () => {",
    '  storage.get(1);',
    '  storage.put(2);',
    '  return reply.status(409);',
    '});',
    "app.post('/y', () => {});",
  ].join('\n'),
  's/mod.ts': 'deps.storage.put(1);\nstorage.get(2);\nstorage.remove(3);',
  's/mod.test.ts': 'storage.put(9);',
  'u/a.tsx': "import { x } from './api';",
  'u/b.tsx': 'const b = 1;',
  'u/c.test.tsx': "import { x } from './api';",
};

function run(argv: string[], files: Record<string, string> = FILES, rules: Rules = FIXTURE) {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    tracked: () => Object.keys(files),
    read: (path) => files[path],
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { code: runCounts(argv, io, rules), out, err };
}

describe('counts, on a repository the test controls', () => {
  it('says each count as "C<n>  N of M", with its blind spot and what it saw beside it', () => {
    const { code, out, err } = run(['rules']);
    expect(code).toBe(0);
    expect(err).toEqual([]);
    const lines = out.map((line) => line.replace(/blind spot: .*/, 'blind spot: …'));
    expect(lines).toEqual([
      'counts: how much of the code follows each rule (counted, never red)',
      "C1  3 of 4  named copy sites read their decision's one home",
      '      the bound: 3 of 4 read HOME in home.ts; still holding a copy: b.ts',
      '      blind spot: …',
      'C4  1 of 2  listed forms draw a refusal on the field',
      '      unlisted files that hold a form marker: f3.tsx',
      '      blind spot: …',
      'C5  2 of 4  storage calls are made in a module of their own, not in a file that registers routes',
      "      calls counted: get, put (read from the client's type)",
      '      inline, by file that registers routes: s/routes.ts 2',
      '      blind spot: …',
      'C6  1 of 2  screens take what they need without importing the API module',
      '      importing it: 1',
      '      blind spot: …',
      'C7  1 of 2  route registrations leave an error reply to the one handler',
      '      route registrations counted: 2, as a line that starts with <name>.get|put|post|delete|patch( in bff/src, tests left out',
      '      error replies written in a route: s/routes.ts:4',
      '      blind spot: …',
    ]);
  });

  it('prints a blind spot beside every count, and names what each cannot see', () => {
    const blind = run(['rules']).out.filter((line) => line.includes('blind spot: '));
    expect(blind).toHaveLength(5);
    expect(blind.join('\n')).toMatch(/by not holding the old copy/);
    expect(blind.join('\n')).toMatch(/only through a wrapper or only as a type/);
    expect(blind.join('\n')).toMatch(/can never fire/);
    expect(blind.join('\n')).toMatch(/scope is the `.ts` files in bff\/src at any depth/);
    expect(blind.join('\n')).toMatch(/ui\/src\/mock are not in it/);
    expect(blind.join('\n')).toMatch(/a human judgement/);
    expect(blind.join('\n')).toMatch(/moving a call behind a wrapper/);
    expect(blind.join('\n')).toMatch(/is not importing the client/);
    expect(blind.join('\n')).toMatch(/zero here can sit beside two/);
  });

  it('sees a method the client gains, because the calls are read from its type', () => {
    const files = {
      ...FILES,
      'client.ts':
        'export type Client = {\n  get(k: string): void;\n  put(k: string): void;\n  remove(k: string): void;\n};',
    };
    const out = run(['rules'], files).out.join('\n');
    expect(out).toContain('C5  3 of 5');
    expect(out).toContain('calls counted: get, put, remove');
  });

  it('prints the citation table on its own, with the path set and the documents found', () => {
    const files = { 'CLAUDE.md': "`a.ts`'s `go`", 'a.ts': 'export const go = 1;' };
    const { code, out } = run(['citations'], files);
    expect(code).toBe(0);
    expect(out[0]).toBe('citations: the living documents');
    expect(out.join('\n')).toContain('path set: README.md | CLAUDE.md, at any depth');
    expect(out.join('\n')).toContain('documents found: 1');
    expect(out.join('\n')).toContain('total: 1 named, 0 line citations left, 0 red');
    expect(out.join('\n')).not.toContain('C1');
  });

  it('lists what the citation check would redden without reddening itself', () => {
    const files = { 'CLAUDE.md': "`gone.ts`'s `go`" };
    const { code, out } = run(['citations'], files);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain(
      "would be red: CLAUDE.md:1 gone.ts's go: no single file of that name below the document",
    );
  });

  it('prints both, the rules first, when no verb is given', () => {
    const { code, out } = run([]);
    expect(code).toBe(0);
    expect(out.findIndex((line) => line.startsWith('C1'))).toBeLessThan(
      out.indexOf('citations: the living documents'),
    );
  });

  it('is never red for what it counts: a repository that follows nothing exits 0', () => {
    const files = {
      ...FILES,
      'a.ts': 'const COPY = 1;',
      'c.ts': 'const COPY = 1;',
      'f/one.ts': 'const COPY = 1;',
      'f1.tsx': '<form></form>',
    };
    const { code, out } = run(['rules'], files);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('C1  0 of 4');
    expect(out.join('\n')).toContain('C4  0 of 2');
  });

  it('says none where it saw none: no inline call, no error written in a route', () => {
    const files = { ...FILES, 's/routes.ts': "app.get('/x', () => {});" };
    const out = run(['rules'], files).out.join('\n');
    expect(out).toContain('inline, by file that registers routes: none');
    expect(out).toContain('error replies written in a route: none');
    expect(out).toContain('C7  1 of 1');
  });

  it('counts none of a decision whose home is not declared once', () => {
    const { code, out } = run(['rules'], {
      ...FILES,
      'home.ts': 'export const HOME = 1;\nexport const HOME2 = 2;\nfunction HOME() {}',
    });
    expect(code).toBe(0);
    expect(out.join('\n')).toContain(
      'the bound: 0 of 4 read HOME in home.ts (that home is not declared once: none counts)',
    );
  });

  it('says a call it cannot read is a call to refuse, exit 2, with the usage on stderr', () => {
    for (const argv of [['nope'], ['rules', 'citations']]) {
      const { code, out, err } = run(argv);
      expect(code).toBe(2);
      expect(out).toEqual([]);
      expect(err).toEqual(['usage: counts [rules|citations]']);
    }
  });

  it('stops, exit 1, naming an entry whose file is not there, wherever it is', () => {
    const missing = (path: string, rules: Rules = FIXTURE) => {
      const files = { ...FILES };
      delete files[path];
      return run(['rules'], files, rules);
    };
    for (const [path, id] of [
      ['home.ts', 'C1'],
      ['b.ts', 'C1'],
      ['f2.tsx', 'C4'],
      ['client.ts', 'C5'],
    ]) {
      const { code, err } = missing(path);
      expect(code).toBe(1);
      expect(err).toEqual([`counts: ${id} names ${path}, which is not a tracked file`]);
    }
    const noMethods = run(['rules'], { ...FILES, 'client.ts': 'export type Other = {};' });
    expect(noMethods.code).toBe(1);
    expect(noMethods.err).toEqual(['counts: C5 found no methods in Client in client.ts']);
  });

  it('does not swallow a failure of its own', () => {
    const io: Io = {
      tracked: () => {
        throw new Error('git is not here');
      },
      read: () => '',
      out: () => undefined,
      err: () => undefined,
    };
    expect(() => runCounts([], io, FIXTURE)).toThrow('git is not here');
  });
});

describe('counts, over a made-up git repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'counts-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads the tracked files and what is in them, and writes where it is told', () => {
    mkdirSync(join(root, 'u'));
    writeFileSync(join(root, 'u/a.tsx'), "import { x } from './api';");
    writeFileSync(join(root, 'untracked.txt'), 'x');
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root });
    git('init', '-q');
    git('add', 'u/a.tsx');
    const lines: string[] = [];
    const io = repoIo(root, (line) => lines.push(line));
    expect(io.tracked()).toEqual(['u/a.tsx']);
    expect(io.read('u/a.tsx')).toBe("import { x } from './api';");
    io.out('x');
    io.err('y');
    expect(lines).toEqual(['x']);
    expect(repoIo(root).out('quiet')).toBeUndefined();
  });
});

describe('counts, over this repository', () => {
  it('runs and prints the five counts and the citation table, whatever their numbers', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const out: string[] = [];
    const code = runCounts(
      [],
      repoIo(root, (line) => out.push(line)),
      RULES,
    );
    expect(code).toBe(0);
    const text = out.join('\n');
    for (const id of ['C1', 'C4', 'C5', 'C6', 'C7']) {
      expect(text).toMatch(new RegExp(`^${id}  \\d+ of \\d+  `, 'm'));
    }
    expect(text).toContain('path set:');
    expect(text).toContain('documents found:');
  });
});
