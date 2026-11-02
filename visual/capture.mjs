// `pnpm report`: the walks page on the build's data. Every screen of every walk is drawn on a DOM
// in both languages and its markup kept; the stylesheet is kept once; a screen's version is a hash
// of what it draws. The page is `site/`, its data inlined, in one file that opens from disk.
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build as viteBuild } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const LANGUAGES = ['vi', 'en'];
const VERSION_DIGITS = 12;

/** The app's stylesheet, once: Vite builds the styles entry as a production build. The font keeps
 * its Latin and Vietnamese subsets only. */
async function appStyles() {
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    const built = await viteBuild({
      root,
      configFile: false,
      plugins: [react()],
      logLevel: 'warn',
      mode: 'production',
      build: {
        write: false,
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        lib: { entry: join(root, 'site/styles.ts'), formats: ['es'], fileName: 'styles' },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    });
    const css = [built]
      .flat()
      .flatMap((one) => one.output)
      .find((file) => file.fileName.endsWith('.css'));
    return String(css.source).replace(/@font-face\{[^}]*\}/g, (face) =>
      /unicode-range:U\+\?\?,|unicode-range:U\+102-103/.test(face) ? face : '',
    );
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

/** What a build draws that is not the screen's: React's and Mantine's generated ids and the
 * records' random ids, renumbered in the order they appear, and the shell's resizing flag, which
 * is there only while a frame is in flight. Two builds of one commit then hold the same markup. */
function steadied(markup) {
  const seen = new Map();
  return markup
    .replaceAll(' data-resizing="true"', '')
    .replace(
      /(:r[0-9a-z]+:|mantine-[0-9a-z]{9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g,
      (id) => {
        if (!seen.has(id)) seen.set(id, `id-${seen.size + 1}`);
        return seen.get(id);
      },
    );
}

/** Mantine writes its theme's variables into a style element in every screen, the same one for
 * every screen of one company's colour: the page keeps each distinct one once. */
function pooled(markup, pool) {
  return markup.replace(/<style data-mantine-styles="true">([\s\S]*?)<\/style>/g, (_tag, rules) => {
    if (!pool.includes(rules)) pool.push(rules);
    return `<!--style:${pool.indexOf(rules)}-->`;
  });
}

const inline = (text) => text.replaceAll('</script', '<\\/script');

export async function report(server, cwd, log) {
  const { installDom } = await server.ssrLoadModule('/src/dom.ts');
  const { folderName, sourceOf, vietnamTime } = await server.ssrLoadModule('/src/home.ts');
  const questions = JSON.parse(await readFile(join(root, 'site/questions-vi.json'), 'utf8'));
  const source = await sourceOf(cwd);
  const builtAt = new Date();
  const css = await appStyles();

  const restore = installDom();
  const { SCREENS } = await server.ssrLoadModule('@credo/ui/mock');
  const { PARTS, PEOPLE, WALKS, DEVICE_LABEL, DEVICE_WIDTH, resolveDrawn } =
    await server.ssrLoadModule('/src/walks.ts');
  try {
    const captures = {};
    const styles = [];
    const walks = [];
    {
      const { readWords, lastDrawn } = await server.ssrLoadModule('/src/words.tsx');
      const drawn = resolveDrawn(WALKS, SCREENS);
      for (const walk of WALKS) {
        const screens = [];
        for (const screen of walk.screens) {
          const what = drawn.get(`${walk.id}:${screen.id}`);
          const markup = {};
          for (const language of LANGUAGES) {
            await readWords(what, language, screen.navigation === true);
            markup[language] = steadied(lastDrawn.markup);
            captures[`${walk.id}/${screen.id}/${language}`] = pooled(markup[language], styles);
          }
          if (!questions[screen.question]) throw new Error(`no Vietnamese for: ${screen.question}`);
          screens.push({
            id: screen.id,
            number: screen.number,
            path: screen.path,
            sentence: screen.sentence,
            question: { en: screen.question, vi: questions[screen.question] },
            // For now the whole stylesheet is in it: any style change moves every screen.
            version: createHash('sha256')
              .update([css, markup.vi, markup.en].join('\u0000'))
              .digest('hex')
              .slice(0, VERSION_DIGITS),
          });
        }
        walks.push({
          id: walk.id,
          person: walk.person,
          part: walk.part,
          title: walk.title,
          screens,
        });
      }
    }

    const data = {
      title: 'Credo Day Walks',
      build: {
        branch: source.branch,
        commit: source.commit,
        changed: source.changed,
        committed: vietnamTime(source.committedAt).shown,
        built: vietnamTime(builtAt).shown,
      },
      devices: Object.keys(DEVICE_WIDTH).map((id) => ({
        id,
        label: DEVICE_LABEL[id],
        width: DEVICE_WIDTH[id],
      })),
      people: PEOPLE.map((person) => ({ ...person, width: DEVICE_WIDTH[person.device] })),
      parts: PARTS,
      walks,
      css,
      styles,
      captures,
    };
    const site = (file) => readFile(join(root, 'site', file), 'utf8');
    const [template, words, page] = await Promise.all([
      site('index.html'),
      site('words.js'),
      site('page.js'),
    ]);
    const html = template
      .replace('/*DATA*/', () => `window.WALKS_DATA = ${inline(JSON.stringify(data))};`)
      .replace('/*WORDS*/', () => inline(words))
      .replace('/*PAGE*/', () => inline(page));

    const folder = join(source.home, folderName(source, builtAt));
    await mkdir(source.home, { recursive: true });
    const aside = await mkdtemp(join(source.home, '.building-'));
    try {
      await chmod(aside, 0o755);
      await writeFile(join(aside, 'index.html'), html);
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
      `${walks.reduce((n, walk) => n + walk.screens.length, 0)} screens, ${Object.keys(captures).length} captures`,
    );
    return folder;
  } finally {
    restore();
  }
}
