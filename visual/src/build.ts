import { chmod, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS } from '@credo/ui/mock';
import { build as viteBuild } from 'vite';
import { readAnswers } from './answers';
import { folderName, sourceOf } from './home';
import { inlineJson, REPORT_ELEMENT } from './page-data';
import { type ReadWords, makeReport, type Report } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

/** The package's folder, where `page.html` and the Vite config are. */
export const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

type Asset = {
  type: 'asset' | 'chunk';
  fileName: string;
  source?: string | Uint8Array;
  code?: string;
};

const textOf = (file: Asset | undefined) =>
  String(file?.type === 'chunk' ? file.code : file?.source);

/**
 * Vite's output as one HTML file: the script and the styles inlined, and the report's data in its
 * element. A browser refuses module scripts and fonts fetched from `file://`, and the page must
 * open from disk or as a claude.ai page with no network. Replacements are functions, so a `$` in
 * the data or the script is never read as a pattern.
 */
export function onePage(output: readonly Asset[], report: Report) {
  const take = (path: string) =>
    output.find((file) => file.fileName === path.replace(/^\.?\//, ''));
  const html = output.find((file) => file.fileName.endsWith('.html'));
  return textOf(html)
    .replace(
      /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
      (_tag, href: string) => `<style>${textOf(take(href))}</style>`,
    )
    .replace(
      /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
      (_tag, src: string) =>
        `<script type="module">${textOf(take(src)).replaceAll('</script', '<\\/script')}</script>`,
    )
    .replace(
      new RegExp(`<script type="application/json" id="${REPORT_ELEMENT}"></script>`),
      () => `<script type="application/json" id="${REPORT_ELEMENT}">${inlineJson(report)}</script>`,
    );
}

/**
 * Vite builds the page, in memory, as a production build. Vite and the React plugin read
 * `NODE_ENV` for that, and this process is a dev server's or a test's, with it set to something
 * else: left so, the page would ship React's development build and every source file's path.
 */
async function bundle() {
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    const built = await viteBuild({
      root: PACKAGE,
      configFile: join(PACKAGE, 'vite.config.ts'),
      logLevel: 'warn',
      mode: 'production',
      build: { write: false },
    });
    // `write: false` without `watch` answers one output, or one for each build of a list of them.
    return ([built].flat() as { output: Asset[] }[]).flatMap((one) => one.output);
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

export type BuildOptions = {
  /** Where the build runs: its repository gives the branch, the commit and the folder's home. */
  cwd: string;
  /** `visual/answers.json`. */
  answersFile: string;
  builtAt?: Date;
  readWords: ReadWords;
};

/**
 * The walks page and `walks.json`, in one folder of the credo root's `walks/`. The folder is
 * written aside and renamed, so a stopped build leaves none half written.
 */
export async function build({ cwd, answersFile, builtAt = new Date(), readWords }: BuildOptions) {
  const source = await sourceOf(cwd);
  const answers = await readAnswers(answersFile);
  const report = await makeReport({
    walks: WALKS,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source,
    builtAt,
    readWords,
  });
  const html = onePage(await bundle(), report);

  const folder = join(source.home, folderName(source, builtAt));
  await mkdir(source.home, { recursive: true });
  const aside = await mkdtemp(join(source.home, '.building-'));
  try {
    await chmod(aside, 0o755);
    await writeFile(join(aside, 'index.html'), html);
    await writeFile(join(aside, 'walks.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (
      await stat(folder).then(
        () => true,
        () => false,
      )
    ) {
      throw new Error(
        `the folder ${folderName(source, builtAt)} is already there: one build a second`,
      );
    }
    await rename(aside, folder);
  } catch (error) {
    await rm(aside, { recursive: true, force: true });
    throw error;
  }
  return { folder, report };
}
