import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import {
  appStyles,
  captureWalks,
  matchingRules,
  pageHtml,
  pageScript,
  pooled,
  report,
  versionOf,
} from './capture';
import type { Drawn, Walk } from './walks';
import { WALKS } from './walks';
import type { PageData } from '../site/data';

const CSS =
  '@font-face{font-family:F;src:url(x)}' +
  '.a{color:red}.b{color:blue}.a:hover{color:pink}.c .d,.e{margin:0}' +
  '@media (max-width:600px){.a{color:green}.b{color:teal}}' +
  '@layer base,theme;' +
  '[data-mantine-color-scheme=dark] .a{color:white}' +
  '.f:not(.a){top:0}' +
  '.a::before{content:"}"}' +
  ':hover{x:y}' +
  '[data-mantine-color-scheme=light] .a{color:snow}' +
  '.a:nth-child(foo){z:z}' +
  '.a::after{content:"\\"}"}';

const markup = (vi: string, en = vi) => ({ vi, en });

describe('the walks page’s capture', () => {
  it('Two builds of one commit give every screen the same version', async () => {
    // Each draw carries other random ids, as React's, Mantine's and the records' are.
    const draw = (react: string, mantine: string, uuid: string) => ({
      draw: (_drawn: Drawn, language: string) =>
        `<div id=":r${react}:" class="a __m__-_r_${react}_"><label for="mantine-${mantine}">x ${language}</label>` +
        `<input id="mantine-${mantine}-inherit" name="mantine-${mantine}" aria-controls="123e4567-e89b-12d3-a456-4266141${uuid}">` +
        `<p class="mantine-visible-from-md" style="padding: var(--mantine-spacing-xs); box-shadow: var(--mantine-shadow-md)" data-resizing="true">${language}</p>` +
        `<style data-mantine-styles="inline">.__m__-_r_${react}_{--x:1}:root:not(.a){--y:2}</style></div>`,
    });
    const first = await build(draw('5p', '1ab2c3d4e', '00000'));
    const second = await build(draw('1fp', '9zy8x7w6', '7a7a7'));

    expect(first.walks[0].screens[0].version).toBe(second.walks[0].screens[0].version);
    expect(first.captures).toEqual(second.captures);
    // ids are renumbered, in order, and what is not an id is kept
    const markup = first.captures['w/s/vi'];
    expect(markup).toContain('id="id-1"');
    expect(markup).toContain('class="a __m__-id-1"');
    expect(markup).toContain('.__m__-id-1{--x:1}:root:not(.a){--y:2}');
    expect(markup).toContain('for="id-3"');
    expect(markup).toContain('id="id-3-inherit" name="id-3" aria-controls="id-2"');
    expect(markup).toContain('class="mantine-visible-from-md"');
    // a theme token in a style is not an id
    expect(markup).toContain(
      'style="padding: var(--mantine-spacing-xs); box-shadow: var(--mantine-shadow-md)"',
    );
    expect(markup).not.toContain('data-resizing');
  });

  it('A version moves with the screen’s markup in either language or a rule matching it, and with nothing else', () => {
    const base = versionOf(CSS, markup('<p class="a">x</p>'));
    expect(base).toMatch(/^[0-9a-f]{12}$/);

    // the markup, in either language
    expect(versionOf(CSS, markup('<p class="a">y</p>', '<p class="a">x</p>'))).not.toBe(base);
    expect(versionOf(CSS, markup('<p class="a">x</p>', '<p class="a">y</p>'))).not.toBe(base);
    // a rule that matches it, plain, inside a media block, or reached by the page's own colour scheme
    expect(
      versionOf(CSS.replace('.a{color:red}', '.a{color:orange}'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    expect(
      versionOf(CSS.replace('.a{color:green}', '.a{color:lime}'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    expect(
      versionOf(CSS.replace('color:snow', 'color:ivory'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    // a rule that matches on a state the picture is not in, as on the element
    expect(
      versionOf(CSS.replace('color:pink', 'color:plum'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    expect(
      versionOf(CSS.replace('content:"}"', 'content:"{"'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    // a rule that matches nothing in it, in a media block or not, or only in the dark scheme the
    // picture is not drawn in: the version stays
    expect(versionOf(CSS.replace('color:white', 'color:ivory'), markup('<p class="a">x</p>'))).toBe(
      base,
    );
    expect(
      versionOf(CSS.replace('.b{color:blue}', '.b{color:navy}'), markup('<p class="a">x</p>')),
    ).toBe(base);
    expect(
      versionOf(CSS.replace('.b{color:teal}', '.b{color:aqua}'), markup('<p class="a">x</p>')),
    ).toBe(base);
    expect(
      versionOf(
        CSS.replace('.c .d,.e{margin:0}', '.c .d,.e{margin:1px}'),
        markup('<p class="a">x</p>'),
      ),
    ).toBe(base);
    expect(
      versionOf(
        CSS.replace('.f:not(.a){top:0}', '.f:not(.a){top:1px}'),
        markup('<p class="a">x</p>'),
      ),
    ).toBe(base);
    // a font and a layer statement are definitions every screen is drawn with
    expect(
      versionOf(CSS.replace('font-family:F', 'font-family:G'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
    expect(
      versionOf(CSS.replace('base,theme', 'base,theme,more'), markup('<p class="a">x</p>')),
    ).not.toBe(base);
  });

  it('reads which rules match from the structure: the classes, the nesting and the state-free selector', () => {
    const rules = (html: string) => matchingRules(CSS, markup(html));

    expect(rules('<p class="b">x</p>')).toContain('.b{color:blue}');
    expect(rules('<p class="b">x</p>')).not.toContain('.a{color:red}');
    expect(rules('<p class="a">x</p>')).toContain('.a:hover{color:pink}');
    expect(rules('<p class="a">x</p>')).toContain('@media (max-width:600px){.a{color:green}}');
    expect(rules('<p class="a">x</p>')).not.toContain('.f:not(.a)');
    // a selector list matches by either side; a descendant needs both
    expect(rules('<i class="e">x</i>')).toContain('.c .d,.e{margin:0}');
    expect(rules('<i class="c"><b class="d">x</b></i>')).toContain('.c .d,.e{margin:0}');
    expect(rules('<b class="d">x</b>')).not.toContain('.c .d');
    // a rule on a class the screen has but another element carries: `:not(.a)` matches the one without
    expect(rules('<p class="a f">x</p>')).not.toContain('.f:not(.a)');
    expect(rules('<p class="f">x</p>')).toContain('.f:not(.a)');
    // a selector of a state alone matches any element; one the DOM cannot read is kept
    expect(rules('<p>x</p>')).toContain(':hover{x:y}');
    expect(rules('<p class="a">x</p>')).toContain('.a:nth-child(foo){z:z}');
    // a quote's escaped quote does not end it, nor the brace after it end the rule
    expect(rules('<p class="a">x</p>')).toContain('.a::after{content:"\\"}"}');
    // the frame's root is in the light scheme
    expect(rules('<p class="a">x</p>')).toContain('[data-mantine-color-scheme=light] .a');
    expect(rules('<p class="a">x</p>')).not.toContain('[data-mantine-color-scheme=dark] .a');
    // a font is a definition, kept whatever the screen holds
    expect(rules('<p>x</p>')).toContain('@font-face{font-family:F;src:url(x)}');
  });

  it('A screen drawn in another company’s colour keeps it', async () => {
    const colours = ['#e03131', '#1971c2'];
    const drawing = {
      draw: (_drawn: Drawn, language: string, _navigation: boolean) =>
        `<style data-mantine-styles="true">:root{--c:${colours[language === 'vi' ? 0 : 1]}}</style><p>${language}</p>`,
    };
    const captured = await build(drawing, [screenWalk('w', 's1'), screenWalk('w2', 's2')]);

    expect(captured.styles).toEqual([':root{--c:#e03131}', ':root{--c:#1971c2}']);
    expect(captured.captures['w/s1/vi']).toBe('<!--style:0--><p>vi</p>');
    expect(captured.captures['w2/s2/en']).toBe('<!--style:1--><p>en</p>');
    // the colour is in what the version reads
    const other = await build(
      {
        draw: (what, language, nav) =>
          drawing.draw(what, language, nav).replace('#e03131', '#2f9e44'),
      },
      [screenWalk('w', 's1')],
    );
    expect(other.walks[0].screens[0].version).not.toBe(captured.walks[0].screens[0].version);
  });

  it('holds a Vietnamese question for every question of every walk', () => {
    const questions = JSON.parse(
      readFileSync(join(import.meta.dirname, '../site/questions-vi.json'), 'utf8'),
    ) as Record<string, string>;
    const asked = WALKS.flatMap((walk) => walk.screens.map((screen) => screen.question));

    expect(asked.length).toBeGreaterThan(0);
    for (const question of asked) expect(questions[question], question).toBeTruthy();
  });

  it('keeps each distinct run-time style block of the app once, and a capture points at it', () => {
    const block = (rules: string) => `<style data-mantine-styles="true">${rules}</style>`;
    const pool: string[] = [];

    expect(pooled(`${block('A')}x${block('B')}${block('A')}`, pool)).toBe(
      '<!--style:0-->x<!--style:1--><!--style:0-->',
    );
    expect(pooled(`<p>${block('B')}</p>`, pool)).toBe('<p><!--style:1--></p>');
    expect(pool).toEqual(['A', 'B']);
  });

  it('draws every screen in both languages, asks for navigation where the walk says so, and stops on a question with no Vietnamese', async () => {
    const seen: string[] = [];
    const walks = [screenWalk('w', 's1', { navigation: true }), screenWalk('w', 's2')];
    walks[0].screens.push(walks[1].screens[0]);
    const captured = await captureWalks({
      walks: [walks[0]],
      drawn: new Map([
        ['w:s1', {} as Drawn],
        ['w:s2', {} as Drawn],
      ]),
      drawing: {
        draw: (_drawn, language, navigation) => {
          seen.push(`${language}${navigation ? ' nav' : ''}`);
          return '<p>x</p>';
        },
      },
      questions: { 'Q s1?': 'H s1?', 'Q s2?': 'H s2?' },
      css: CSS,
    });
    expect(seen).toEqual(['vi nav', 'en nav', 'vi', 'en']);
    expect(captured.walks[0].screens.map((screen) => screen.question)).toEqual([
      { en: 'Q s1?', vi: 'H s1?' },
      { en: 'Q s2?', vi: 'H s2?' },
    ]);

    await expect(build({ draw: () => '<p>x</p>' }, [screenWalk('w', 's1')], {})).rejects.toThrow(
      'no Vietnamese for: Q s1?',
    );
  });

  it('keeps the data and the script apart from the template’s own text', () => {
    const data = { title: '$& $1 $`' } as PageData;
    const html = pageHtml(
      '<script>/*DATA*/</script><script>/*PAGE*/</script>',
      data,
      'a("$&</script>");',
    );

    expect(html).toBe(
      `<script>window.WALKS_DATA = {"title":"$& $1 $\`"};</script><script>a("$&<\\/script>");</script>`,
    );
    expect(pageHtml('/*DATA*/', { title: '</script>' } as PageData, '')).toBe(
      'window.WALKS_DATA = {"title":"<\\/script>"};',
    );
  });

  it('builds the app’s stylesheet once, with the font’s Latin and Vietnamese subsets only, and the page’s script as one classic script', async () => {
    const css = await appStyles();
    expect(css).toContain('.m_');
    expect(css).toContain('@font-face');
    const faces = css.match(/@font-face\{[^}]*\}/g)!;
    expect(faces.length).toBeGreaterThan(0);
    expect(
      faces.every((face) => /unicode-range:U\+\?\?,|unicode-range:U\+102-103/.test(face)),
    ).toBe(true);

    const script = await pageScript();
    expect(script).toContain('WALKS_DATA');
    expect(script).not.toMatch(/^\s*(import|export)\b/m);
    expect(script).not.toContain('process.env');
    expect(process.env['NODE_ENV']).toBe('test');

    // a process with none leaves none behind
    delete process.env['NODE_ENV'];
    try {
      await pageScript();
      expect(process.env['NODE_ENV']).toBeUndefined();
    } finally {
      process.env['NODE_ENV'] = 'test';
    }
  });

  it('builds the page into one folder of the credo root’s walks/, written aside, 0 versions moved by a second build', async () => {
    const { root, worktree } = makeRoot('walks-page');
    const lines: string[] = [];
    const small = WALKS.filter((one) => !one.screens.some((screen) => screen.scene)).slice(0, 1);
    const at = new Date('2026-11-03T01:00:00Z');

    const folder = await report(worktree, (line) => lines.push(line), {
      walks: small,
      builtAt: at,
    });

    expect(folder).toBe(join(root, 'walks', readdirSync(join(root, 'walks'))[0]));
    expect(readdirSync(join(root, 'walks'))).toHaveLength(1);
    expect(readdirSync(folder).sort()).toEqual(['index.html', 'walks.json']);
    expect(lines).toEqual([
      `walks page: ${folder}`,
      `${small[0].screens.length} screens, ${small[0].screens.length * 2} captures`,
    ]);
    const first = JSON.parse(readFileSync(join(folder, 'walks.json'), 'utf8')) as PageData;
    const html = readFileSync(join(folder, 'index.html'), 'utf8');
    expect(first.walks[0].screens).toHaveLength(small[0].screens.length);
    expect(Object.keys(first.captures)).toHaveLength(small[0].screens.length * 2);
    expect(first.build).toMatchObject({ branch: 'walks-page', changed: false });
    expect(first.devices.map((device) => device.id)).toEqual(['pc', 'tablet', 'phone']);
    expect(html).toContain('window.WALKS_DATA = {');
    expect(html).not.toContain('/*DATA*/');
    expect(html).not.toContain('/*PAGE*/');
    expect(first.walks[0].screens.every((screen) => screen.question.vi && screen.question.en)).toBe(
      true,
    );

    // a second build of the same commit holds the same versions
    const again = await report(worktree, () => {}, {
      walks: small,
      builtAt: new Date('2026-11-03T01:00:05Z'),
    });
    const second = JSON.parse(readFileSync(join(again, 'walks.json'), 'utf8')) as PageData;
    expect(second.walks.flatMap((one) => one.screens.map((screen) => screen.version))).toEqual(
      first.walks.flatMap((one) => one.screens.map((screen) => screen.version)),
    );

    // one build a second: the folder is there, so the aside is removed and none is left half written
    await expect(report(worktree, () => {}, { walks: small, builtAt: at })).rejects.toThrow(
      'is already there: one build a second',
    );
    expect(
      readdirSync(join(root, 'walks')).filter((name) => name.startsWith('.building-')),
    ).toEqual([]);
  });

  it('says so, and writes nothing, outside a git repository', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'walks-outside-'));
    await expect(report(outside, () => {}, { walks: [] })).rejects.toThrow(
      'not inside a git repository',
    );
  });
});

/** A walk of one screen whose question the fixture's table answers in Vietnamese. */
function screenWalk(id: string, screen: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    person: 'office',
    part: 'daily',
    title: { vi: `${id} vi`, en: `${id} en` },
    screens: [
      {
        id: screen,
        number: 1,
        path: 'main',
        sentence: { vi: `${screen} câu`, en: `${screen} sentence` },
        question: `Q ${screen}?`,
        ...extra,
      },
    ],
  } as unknown as Walk;
}

async function build(
  drawing: { draw: (drawn: Drawn, language: 'vi' | 'en', navigation: boolean) => string },
  walks: Walk[] = [screenWalk('w', 's')],
  questions: Record<string, string> = Object.fromEntries(
    walks.flatMap((walk) => walk.screens.map((one) => [one.question, 'hỏi?'])),
  ),
) {
  return captureWalks({
    walks,
    drawn: new Map(
      walks.flatMap((walk) => walk.screens.map((one) => [`${walk.id}:${one.id}`, {} as Drawn])),
    ),
    drawing,
    questions,
    css: CSS,
  });
}
