// @vitest-environment node
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTHOR, makeRoot } from '../tests/repo';
import { build, onePage, PACKAGE } from './build';
import { inlineJson } from './page-data';
import type { Report } from './report';

const ANSWERS = join(PACKAGE, 'answers.json');
const BUILT_AT = new Date('2026-10-27T19:30:00Z');
const readWords = () => ['text: a word'];

const statMode = (path: string) => statSync(path).mode & 0o777;
const reportOf = (text: string) => ({ title: text }) as unknown as Report;

describe('one page', () => {
  const output = [
    {
      type: 'asset' as const,
      fileName: 'page.html',
      source: [
        '<html><head>',
        '<script type="module" crossorigin src="./assets/page.js"></script>',
        '<link rel="stylesheet" crossorigin href="./assets/page.css">',
        '</head><body><script type="application/json" id="report"></script></body></html>',
      ].join(''),
    },
    { type: 'chunk' as const, fileName: 'assets/page.js', code: 'run("</script>", "$&");' },
    { type: 'asset' as const, fileName: 'assets/page.css', source: 'p{color:red}' },
  ];

  it('inlines the script, the styles and the data, reading a $ in any of them as text', () => {
    const html = onePage(output, reportOf('a $& b $1'));

    expect(html).toContain('<style>p{color:red}</style>');
    expect(html).toContain('<script type="module">run("<\\/script>", "$&");</script>');
    expect(html).toContain('"title":"a $& b $1"}</script>');
    expect(html).not.toMatch(/src="|href="/);
  });

  it('The page’s data is inlined with every < escaped, so no text of the walks or the answers ends its script', () => {
    const html = onePage(output, reportOf('</script><img src=x onerror=alert(1)>'));

    const data = html.slice(
      html.indexOf('id="report">') + 12,
      html.lastIndexOf('</script></body>'),
    );
    expect(data).toBe(inlineJson(reportOf('</script><img src=x onerror=alert(1)>')));
    expect(data).not.toContain('<');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
});

describe('the build', () => {
  it('writes one folder in the credo root’s walks/, named for the time and the commit, holding the page and walks.json', async () => {
    const { root, worktree, commit } = makeRoot();

    const { folder, report } = await build({
      cwd: worktree,
      answersFile: ANSWERS,
      builtAt: BUILT_AT,
      readWords,
    });

    expect(folder).toBe(join(root, 'walks', `2026-10-28-023000-${commit}`));
    expect(readdirSync(join(root, 'walks'))).toEqual([`2026-10-28-023000-${commit}`]);
    expect(readdirSync(folder).sort()).toEqual(['index.html', 'walks.json']);
    expect(JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8'))).toEqual(
      JSON.parse(JSON.stringify(report)),
    );
    expect(report.build.branch).toBe('a-piece');
    expect(statMode(folder)).toBe(0o755);
  });

  it('The page is one file that opens from disk or as a claude.ai page, with no network: no font or script from elsewhere', async () => {
    const { worktree } = makeRoot();
    const { folder } = await build({ cwd: worktree, answersFile: ANSWERS, readWords });

    const html = readFileSync(join(folder, 'index.html'), 'utf8');

    // Every script and style is inline: nothing is fetched, from a host or from beside the page.
    expect(html.match(/<script[^>]*\bsrc=/g)).toBeNull();
    expect(html.match(/<link\b/g)).toBeNull();
    expect(html.match(/@import|url\(\s*["']?(https?:)?\/\//g)).toBeNull();
    expect(html.match(/(src|href)=["']https?:/g)).toBeNull();
    expect(html).toContain('<title>Credo Day Walks</title>');
    // The font is inside the one file.
    expect(html).toMatch(/@font-face\{[^}]*Noto Sans Variable[^}]*url\(data:/);
    // React's production build, not the development one with its links to react.dev/link.
    expect(html).not.toContain('react.dev/link');
  });

  it('Nothing in the published page names a key, a person or a path on one machine', async () => {
    const { root, worktree } = makeRoot();
    const { folder } = await build({ cwd: worktree, answersFile: ANSWERS, readWords });

    for (const file of ['index.html', 'walks.json']) {
      const text = readFileSync(join(folder, file), 'utf8');
      expect(text, file).not.toContain(AUTHOR.name);
      expect(text, file).not.toContain(AUTHOR.email);
      expect(text, file).not.toContain(root);
      expect(text, file).not.toContain(worktree);
      expect(text, file).not.toContain(PACKAGE);
      expect(text, file).not.toContain(homedir());
      expect(text, file).not.toMatch(/\/Users\/|\/home\/[a-z]/);
      expect(text, file).not.toMatch(/AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*KEY|ghp_[A-Za-z0-9]{30,}/);
    }
  });

  it('A folder is written aside and renamed, so a stopped build leaves none half written', async () => {
    const { root, worktree } = makeRoot();
    const stopped = join(root, 'stopped-answers.json');
    writeFileSync(stopped, '{ not json');

    await expect(
      build({ cwd: worktree, answersFile: stopped, builtAt: BUILT_AT, readWords }),
    ).rejects.toThrow('does not parse');
    expect(existsSync(join(root, 'walks'))).toBe(false);

    // The same when the words cannot be read, after the folder's home was made.
    await expect(
      build({
        cwd: worktree,
        answersFile: ANSWERS,
        builtAt: BUILT_AT,
        readWords: () => {
          throw new Error('a screen did not draw');
        },
      }),
    ).rejects.toThrow('a screen did not draw');
    expect(existsSync(join(root, 'walks'))).toBe(false);
  });

  it('leaves no half-written folder when the rename is refused, and says the folder is there', async () => {
    const { root, worktree } = makeRoot();
    const first = await build({
      cwd: worktree,
      answersFile: ANSWERS,
      builtAt: BUILT_AT,
      readWords,
    });

    await expect(
      build({ cwd: worktree, answersFile: ANSWERS, builtAt: BUILT_AT, readWords }),
    ).rejects.toThrow('is already there: one build a second');

    expect(readdirSync(join(root, 'walks'))).toEqual([first.folder.split('/').pop()]);
  });

  it('builds the page as a production build whatever NODE_ENV the process has, and leaves it as it found it', async () => {
    const was = process.env['NODE_ENV'];
    try {
      for (const value of ['development', undefined]) {
        if (value === undefined) delete process.env['NODE_ENV'];
        else process.env['NODE_ENV'] = value;
        const { worktree } = makeRoot();

        const { folder } = await build({ cwd: worktree, answersFile: ANSWERS, readWords });

        expect(process.env['NODE_ENV']).toBe(value);
        const html = readFileSync(join(folder, 'index.html'), 'utf8');
        // Development React links to react.dev/link; its JSX transform names every source file.
        expect(html).not.toContain('react.dev/link');
        expect(html).not.toContain('jsxDEV');
      }
    } finally {
      process.env['NODE_ENV'] = was;
    }
  });

  it('outside a repository none is written, and the build says why', async () => {
    await expect(
      build({
        cwd: mkdtempSync(join(tmpdir(), 'walks-outside-')),
        answersFile: ANSWERS,
        readWords,
      }),
    ).rejects.toThrow('not inside a git repository');
  });

  it('marks the folder of a changed tree', async () => {
    const { worktree, commit } = makeRoot();
    writeFileSync(join(worktree, 'file.txt'), 'two\n');

    const { folder } = await build({
      cwd: worktree,
      answersFile: ANSWERS,
      builtAt: BUILT_AT,
      readWords,
    });

    expect(folder.endsWith(`2026-10-28-023000-${commit}-changes`)).toBe(true);
  });
});
