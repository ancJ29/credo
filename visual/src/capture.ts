// `pnpm report`: the walks page on the build's data. Every screen of every walk is drawn on a DOM
// in both languages and its markup kept; the stylesheet is kept once; a screen's version is a hash
// of what it draws and the style rules that match it. The page is `site/`, its data inlined, in
// one file that opens from disk.
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Language } from '@credo/shared';
import { SCREENS } from '@credo/ui/mock';
import react from '@vitejs/plugin-react';
import { build as viteBuild } from 'vite';
import type { PageData, PageWalk } from '../site/data';
import { installDom } from './dom';
import { folderName, sourceOf, vietnamTime } from './home';
import {
  DEVICE_LABEL,
  DEVICE_WIDTH,
  type Device,
  type Drawn,
  PARTS,
  PEOPLE,
  resolveDrawn,
  type Walk,
  WALKS,
} from './walks';

/** The package's folder, where `site/` is. */
export const PACKAGE = dirname(import.meta.dirname);
const LANGUAGES: Language[] = ['vi', 'en'];
const VERSION_DIGITS = 12;

/** Reads one screen's markup, as `readWords` in `words.tsx` does: the build draws it on a DOM and
 * leaves what it drew in `lastDrawn`. Tests hand in their own. */
export type Drawing = {
  draw: (drawn: Drawn, language: Language, navigation: boolean) => string | Promise<string>;
};

/** Vite builds in production mode whatever `NODE_ENV` this process has, or the page would ship
 * React's development build and every source file's path. */
async function asProduction<T>(work: () => Promise<T>) {
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    return await work();
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

type Output = { output: { fileName: string; source?: string | Uint8Array; code?: string }[] };

/** `write: false` without `watch` answers one output, or one for each build of a list of them. */
const outputOf = (built: unknown) => ([built].flat() as Output[]).flatMap((one) => one.output);

/** The app's stylesheet, once: Vite builds the styles entry as a production build. The font keeps
 * its Latin and Vietnamese subsets only. */
export async function appStyles() {
  const built = await asProduction(() =>
    viteBuild({
      root: PACKAGE,
      configFile: false,
      plugins: [react()],
      logLevel: 'warn',
      mode: 'production',
      build: {
        write: false,
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        lib: { entry: join(PACKAGE, 'site/styles.ts'), formats: ['es'], fileName: 'styles' },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    }),
  );
  const css = outputOf(built).find((file) => file.fileName.endsWith('.css'))!;
  return String(css.source).replace(/@font-face\{[^}]*\}/g, (face) =>
    /unicode-range:U\+\?\?,|unicode-range:U\+102-103/.test(face) ? face : '',
  );
}

/** The page's script, `site/page.ts` and the words it imports, as one classic script. */
export async function pageScript() {
  const built = await asProduction(() =>
    viteBuild({
      root: PACKAGE,
      configFile: false,
      logLevel: 'warn',
      mode: 'production',
      build: {
        write: false,
        lib: { entry: join(PACKAGE, 'site/page.ts'), formats: ['iife'], name: 'WalksPage' },
      },
    }),
  );
  return outputOf(built).find((file) => file.fileName.endsWith('.js'))!.code!;
}

/** What a build draws that is not the screen's: React's and Mantine's generated ids and the
 * records' random ids, renumbered in the order they appear, and the shell's resizing flag, which
 * is there only while a frame is in flight. Two builds of one commit then hold the same markup. */
export function steadied(markup: string) {
  const seen = new Map<string, string>();
  const renumbered = (id: string) => {
    if (!seen.has(id)) seen.set(id, `id-${seen.size + 1}`);
    return seen.get(id)!;
  };
  return (
    markup
      .replaceAll(' data-resizing="true"', '')
      // React's `useId` in a class or a selector Mantine builds from it (`_r_5p_`), and the
      // records' uuids, wherever they stand.
      .replace(
        /(?<![0-9A-Za-z])_r_([0-9a-z]+)_(?![0-9A-Za-z])|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        (found, underscores: string | undefined) =>
          renumbered(underscores === undefined ? found : `:r${underscores}:`),
      )
      // React's own id (`:r5p:`) and Mantine's (`mantine-` and up to nine random base-36 digits)
      // in any attribute but the class, or a class such as `mantine-visible-from-md` would be taken
      // for one, and a style rule such as `:root:not(…)` for the other.
      .replace(/ ([a-z-]+)="([^"]*)"/g, (all, name: string, value: string) =>
        name === 'class'
          ? all
          : ` ${name}="${value.replace(/:r[0-9a-z]+:|mantine-[0-9a-z]{6,9}(?![0-9a-z])/g, renumbered)}"`,
      )
  );
}

/** Mantine writes its theme's variables into a style element in every screen, the same one for
 * every screen of one company's colour: the page keeps each distinct one once. */
export function pooled(markup: string, pool: string[]) {
  return markup.replace(
    /<style data-mantine-styles="true">([\s\S]*?)<\/style>/g,
    (_tag, rules: string) => {
      if (!pool.includes(rules)) pool.push(rules);
      return `<!--style:${pool.indexOf(rules)}-->`;
    },
  );
}

/** Splits `text` at each `separator` outside brackets, parentheses and quotes, and a block's
 * braces: the top-level pieces of a stylesheet, or of a selector list. A piece that ends in a
 * block ends at its closing brace, with no separator after it. */
function topLevel(text: string, separator: ';' | ',') {
  const pieces: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let at = 0; at < text.length; at++) {
    const char = text[at];
    if (quote) {
      if (char === '\\') at++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '{' || char === '(' || char === '[') depth++;
    else if (char === '}' || char === ')' || char === ']') {
      depth--;
      if (char === '}' && depth === 0 && separator === ';') {
        pieces.push(text.slice(start, at + 1));
        start = at + 1;
      }
    } else if (char === separator && depth === 0) {
      pieces.push(text.slice(start, at));
      start = at + 1;
    }
  }
  pieces.push(text.slice(start));
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== '');
}

/** The pseudo-classes that only test the structure, kept for matching. The others (`:hover`,
 * `:focus`, `::before`…) hold for an element in a state the picture is not in, so they are taken
 * off: a rule matches if its element does. */
const STRUCTURAL = new Set([
  'not',
  'is',
  'where',
  'has',
  'root',
  'empty',
  'first-child',
  'last-child',
  'only-child',
  'nth-child',
  'nth-last-child',
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'nth-of-type',
  'nth-last-of-type',
]);

type Selector = { query: string; classes: string[] };

/** A selector as the matching reads it: the query with its state pseudo-classes and pseudo-elements
 * off (`*` if nothing is left), and the classes every match must carry, which are those outside
 * attribute brackets and outside `:not(…)`, `:is(…)` and the other functional pseudo-classes. */
function selectorOf(text: string): Selector {
  const query =
    text.replace(/::?([a-zA-Z-]+)(\([^()]*\))?/g, (all, name: string) =>
      STRUCTURAL.has(name) ? all : '',
    ) || '*';
  let bare = text.replace(/\[[^\]]*\]/g, '');
  for (let before = ''; before !== bare;) {
    before = bare;
    bare = bare.replace(/:[a-zA-Z-]+\([^()]*\)/g, '');
  }
  return { query, classes: [...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]) };
}

type Matcher = (selector: Selector) => boolean;

/** A rule block's text, kept when something in it matches: a style rule when one of its selectors
 * does; a conditional block (`@media`, `@supports`, `@layer`…) when a rule inside does, cut to
 * those; a statement or a block of definitions (`@font-face`, `@keyframes`) always. */
function kept(statement: string, matches: Matcher): string {
  const open = statement.indexOf('{');
  if (open < 0) return statement;
  const prelude = statement.slice(0, open).trim();
  const body = statement.slice(open + 1, statement.lastIndexOf('}'));
  if (!prelude.startsWith('@')) {
    return topLevel(prelude, ',').some((one) => matches(selectorOf(one))) ? statement : '';
  }
  if (/^@(font-face|keyframes|property|counter-style)\b/.test(prelude)) return statement;
  const inside = topLevel(body, ';')
    .map((one) => kept(one, matches))
    .join('');
  return inside ? `${prelude}{${inside}}` : '';
}

/** The style rules that match something in the screen, in either language: the stylesheet cut to
 * them. A selector the DOM cannot read is kept, since a rule dropped wrongly hides a change. */
export function matchingRules(css: string, markup: Record<Language, string>) {
  const documents = LANGUAGES.map((language) =>
    new DOMParser().parseFromString(
      `<!doctype html><html lang="${language}" data-mantine-color-scheme="light"><head></head><body>${markup[language]}</body></html>`,
      'text/html',
    ),
  );
  const classes = new Set(
    documents.flatMap((doc) =>
      [...doc.querySelectorAll('[class]')].flatMap((element) => [...element.classList]),
    ),
  );
  const matches: Matcher = ({ query, classes: needed }) =>
    needed.every((name) => classes.has(name)) &&
    documents.some((doc) => {
      try {
        return doc.querySelector(query) !== null;
      } catch {
        return true;
      }
    });
  return topLevel(css, ';')
    .map((statement) => kept(statement, matches))
    .join('');
}

/** A screen's version: twelve hex digits over its markup in both languages and the style rules
 * that match it, so a change to anything else in the stylesheet does not re-ask it. */
export function versionOf(css: string, markup: Record<Language, string>) {
  return createHash('sha256')
    .update([matchingRules(css, markup), markup.vi, markup.en].join('\u0000'))
    .digest('hex')
    .slice(0, VERSION_DIGITS);
}

export type Captured = {
  walks: PageWalk[];
  captures: Record<string, string>;
  styles: string[];
};

/** Every screen of `walks` drawn in both languages: its markup kept under `walk/screen/language`,
 * its version, and the Vietnamese of its question from `questions`. A question with no Vietnamese
 * stops the build, naming it. */
export async function captureWalks(input: {
  walks: readonly Walk[];
  drawn: Map<string, Drawn>;
  drawing: Drawing;
  questions: Record<string, string>;
  css: string;
}): Promise<Captured> {
  const { walks, drawn, drawing, questions, css } = input;
  const captures: Record<string, string> = {};
  const styles: string[] = [];
  const captured: PageWalk[] = [];
  for (const walk of walks) {
    const screens: PageWalk['screens'] = [];
    for (const screen of walk.screens) {
      const what = drawn.get(`${walk.id}:${screen.id}`)!;
      const markup = {} as Record<Language, string>;
      for (const language of LANGUAGES) {
        markup[language] = steadied(await drawing.draw(what, language, screen.navigation === true));
        captures[`${walk.id}/${screen.id}/${language}`] = pooled(markup[language], styles);
      }
      const vietnamese = questions[screen.question];
      if (!vietnamese) throw new Error(`no Vietnamese for: ${screen.question}`);
      screens.push({
        id: screen.id,
        number: screen.number,
        path: screen.path,
        sentence: screen.sentence,
        question: { en: screen.question, vi: vietnamese },
        version: versionOf(css, markup),
      });
    }
    captured.push({
      id: walk.id,
      person: walk.person,
      part: walk.part,
      title: walk.title,
      screens,
    });
  }
  return { walks: captured, captures, styles };
}

const inline = (text: string) => text.replaceAll('</script', '<\\/script');

/** The page's one file: its template with the data and the script put in. Replacements are
 * functions, so a `$` in either is never read as a pattern. */
export function pageHtml(template: string, data: PageData, script: string) {
  return template
    .replace('/*DATA*/', () => `window.WALKS_DATA = ${inline(JSON.stringify(data))};`)
    .replace('/*PAGE*/', () => inline(script));
}

/**
 * Builds the walks page from the repository `cwd` is in, into one folder of the credo root's
 * `walks/`, and says where it landed. The folder is written aside and renamed, so a stopped build
 * leaves none half written. The screens are drawn on a DOM made for the run.
 */
export async function report(
  cwd: string,
  log: (line: string) => void,
  { walks = WALKS, builtAt = new Date() }: { walks?: readonly Walk[]; builtAt?: Date } = {},
) {
  const questions = JSON.parse(
    await readFile(join(PACKAGE, 'site/questions-vi.json'), 'utf8'),
  ) as Record<string, string>;
  const source = await sourceOf(cwd);
  const [css, script, template] = await Promise.all([
    appStyles(),
    pageScript(),
    readFile(join(PACKAGE, 'site/index.html'), 'utf8'),
  ]);

  const restore = installDom();
  try {
    // Loaded once the DOM stands: React's DOM renderer asks at its first load whether there is a
    // window, and with none it never listens for a text field's `input` event.
    const { readWords, lastDrawn } = await import('./words');
    const {
      walks: captured,
      captures,
      styles,
    } = await captureWalks({
      walks,
      drawn: resolveDrawn(walks, SCREENS),
      drawing: {
        draw: async (what, language, navigation) => {
          await readWords(what, language, navigation);
          return lastDrawn.markup;
        },
      },
      questions,
      css,
    });
    const data: PageData = {
      title: 'Credo Day Walks',
      build: {
        branch: source.branch,
        commit: source.commit,
        changed: source.changed,
        committed: vietnamTime(source.committedAt).shown,
        built: vietnamTime(builtAt).shown,
      },
      devices: (Object.keys(DEVICE_WIDTH) as Device[]).map((id) => ({
        id,
        label: DEVICE_LABEL[id],
        width: DEVICE_WIDTH[id],
      })),
      people: PEOPLE.map((person) => ({ ...person, width: DEVICE_WIDTH[person.device] })),
      parts: [...PARTS],
      walks: captured,
      css,
      styles,
      captures,
    };

    const folder = join(source.home, folderName(source, builtAt));
    await mkdir(source.home, { recursive: true });
    const aside = await mkdtemp(join(source.home, '.building-'));
    try {
      await chmod(aside, 0o755);
      await writeFile(join(aside, 'index.html'), pageHtml(template, data, script));
      await writeFile(join(aside, 'walks.json'), `${JSON.stringify(data, null, 2)}\n`);
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
    log(`walks page: ${folder}`);
    log(
      `${captured.reduce((n, walk) => n + walk.screens.length, 0)} screens, ${Object.keys(captures).length} captures`,
    );
    return folder;
  } finally {
    restore();
  }
}
