// Case 11 of docs/plans/2026-11-20-design-fixes.md: no resolved style of any screen moves on any of
// the ten colours. Every screen of the walks page is drawn once, as the capture draws it, in both
// languages; each element's declarations are resolved (the cascade, the variables), class names
// left out since a stylesheet's are hashed from its text; and the theme's variables, which are all
// a colour changes, are read for each of ten colours (the theme's own style element, as Mantine
// writes it). One hash a screen and colour is held against `resolved.pinned.txt`. Equal resolved
// styles draw equal pixels only for what is hashed: text and attributes (an SVG's `fill`, an image's
// `src`) are not, so the walks run stays the verdict. `RESOLVED_WRITE=1` rewrites the file, its diff to be read.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Language } from '@credo/shared';
import { SCREENS } from '@credo/ui/mock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { PACKAGE, steadied, topLevel } from './capture';
import { drawnWords, lastDrawn, readWords } from './words';
import { resolveDrawn, WALKS } from './walks';

/** The six stock colours (their shade 7, `ui/src/design-system/palettes.ts`) and four typed ones:
 * the walks' company, a terracotta that fails as a link, pure red, and amber. */
const COLOURS = [
  ['steel', '#3e618c'],
  ['emerald', '#047857'],
  ['brick', '#9e2d20'],
  ['bronze', '#854a00'],
  ['plum', '#863b70'],
  ['indigo', '#484dae'],
  ['company', '#2f7d6d'],
  ['terracotta', '#d97757'],
  ['red', '#ff0000'],
  ['amber', '#ffbf00'],
] as const;

const PINNED = join(PACKAGE, 'src/resolved.pinned.txt');
const WRITE = process.env['RESOLVED_WRITE'] === '1';
const LANGUAGES: Language[] = ['vi', 'en'];
/** An element's inline style stands above every rule; a rule outside any layer above every layer. */
const INLINE = Infinity;
const THEME_STYLE = /<style data-mantine-styles="true">([\s\S]*?)<\/style>/;
const SEP = '\u0001';

type Declaration = { property: string; value: string; important: boolean };
type Rule = {
  selector: string;
  /** The pseudo-element the rule paints, `''` for the element itself. */
  pseudo: string;
  /** The conditional blocks the rule stands in, written out. */
  context: string;
  layer: number;
  specificity: number;
  order: number;
  declarations: Declaration[];
  /** What the rule's last compound asks of an element, to find the rules an element can match. */
  key: string;
};

/** Whether `element` matches `selector`; one the DOM cannot read matches none. */
const reads = (element: Element, selector: string) => {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
};

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** `a: b; c: d !important` as declarations; a nested block is no declaration. */
function declarationsOf(body: string): Declaration[] {
  return topLevel(body, ';').flatMap((piece) => {
    const colon = piece.indexOf(':');
    if (colon < 0 || piece.includes('{')) return [];
    const important = /!\s*important\s*$/.test(piece);
    return [
      {
        property: piece.slice(0, colon).trim().toLowerCase(),
        value: squash(piece.slice(colon + 1).replace(/!\s*important\s*$/, '')),
        important,
      },
    ];
  });
}

/** A selector's weight as one number, ids over classes, attributes and pseudo-classes over tags;
 * `:where(…)` weighs nothing. Rough: it orders rules that name one element, and the order is the
 * same before and after a class is renamed. */
function weightOf(selector: string) {
  const bare = selector.replace(/:where\([^()]*\)/g, '');
  const ids = (bare.match(/#[\w-]+/g) ?? []).length;
  const classes = (bare.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const tags = (
    bare.replace(/\[[^\]]*\]|[.#:][\w-]+/g, ' ').match(/(^|[\s>+~(])[a-z][\w-]*/gi) ?? []
  ).length;
  return ids * 1e6 + classes * 1e3 + tags;
}

/** What the last compound of a selector asks of its element: a class, else an attribute, else a tag,
 * else nothing. Functional pseudo-classes (`:not(.a)`) are left out: they ask nothing sure. */
function keyOf(selector: string) {
  let bare = selector.replace(/\[\s*([\w-]+)[^\]]*\]/g, '[$1]');
  for (let before = ''; before !== bare;) {
    before = bare;
    bare = bare.replace(/:[a-zA-Z-]+\([^()]*\)/g, '');
  }
  const last = bare
    .trim()
    .split(/\s*[>+~]\s*|\s+/)
    .pop()!;
  const cls = /\.(-?[_a-zA-Z][\w-]*)/.exec(last);
  if (cls) return `c.${cls[1]}`;
  const attribute = /\[([\w-]+)\]/.exec(last);
  if (attribute) return `a.${attribute[1]}`;
  const tag = /^[a-zA-Z][\w-]*/.exec(last);
  return tag ? `t.${tag[0].toLowerCase()}` : 'x';
}

/** The style rules of a stylesheet, flattened in source order: each selector of a list its own
 * rule, a conditional block's prelude its `context`, a named layer its place in the layer order. */
function rulesOf(css: string, layers: string[] = [], start = 0): Rule[] {
  const rules: Rule[] = [];
  const layerAt = (name: string) => {
    if (!layers.includes(name)) layers.push(name);
    return layers.indexOf(name);
  };
  const walk = (text: string, context: string, layer: number) => {
    for (const statement of topLevel(text, ';')) {
      const open = statement.indexOf('{');
      if (open < 0) {
        const named = /^@layer\s+([^;]+)$/.exec(statement);
        if (named) for (const name of named[1].split(',')) layerAt(name.trim());
        continue;
      }
      const prelude = squash(statement.slice(0, open));
      const body = statement.slice(open + 1, statement.lastIndexOf('}'));
      if (prelude.startsWith('@')) {
        if (/^@(font-face|keyframes|property|counter-style)\b/.test(prelude)) continue;
        const layered = /^@layer\s+([\w.-]+)$/.exec(prelude);
        walk(
          body,
          layered ? context : `${context}${prelude}{`,
          layered ? layerAt(layered[1]) : layer,
        );
        continue;
      }
      const declarations = declarationsOf(body);
      for (const one of topLevel(prelude, ',')) {
        const pseudo = /::?(before|after|placeholder|selection|marker)$/.exec(one);
        const selector = pseudo ? one.slice(0, pseudo.index) || '*' : one;
        rules.push({
          selector,
          pseudo: pseudo ? pseudo[1] : '',
          context,
          layer,
          specificity: weightOf(selector),
          order: start + rules.length,
          declarations,
          key: keyOf(selector),
        });
      }
    }
  };
  walk(css, '', INLINE);
  return rules;
}

/** Whether rank `a` wins over `b`: the first part that differs decides, a tie goes to the later rule. */
const beats = (a: number[], b: number[]) => {
  const at = a.findIndex((part, index) => part !== b[index]);
  return at < 0 || a[at] > b[at];
};

type Winners = Map<string, { rank: number[]; value: string }>;
const offer = (winners: Winners, key: string, rank: number[], value: string) => {
  const held = winners.get(key);
  if (!held || beats(rank, held.rank)) winners.set(key, { rank, value });
};

type Custom = Map<string, string>;
type Styled = { parent: number; depth: number; tag: string; plain: Winners; own: Custom }[];

const rootDocument = (language: Language, body = '') =>
  new DOMParser().parseFromString(
    `<!doctype html><html lang="${language}" data-mantine-color-scheme="light"><head></head><body>${body}</body></html>`,
    'text/html',
  );

/** The custom properties a theme's style element gives the root: its rules that match `<html>`. */
function themeVariables(themeCss: string): Custom {
  const html = rootDocument('en').documentElement;
  const winners: Winners = new Map();
  for (const rule of rulesOf(themeCss)) {
    if (!reads(html, rule.selector) || rule.context !== '') continue;
    for (const { property, value, important } of rule.declarations) {
      offer(
        winners,
        property,
        [important ? 2 : 0, rule.layer, rule.specificity, rule.order],
        value,
      );
    }
  }
  return new Map([...winners].map(([property, { value }]) => [property, value]));
}

/** Each element of `markup` with the declarations that win its cascade, variables not yet read.
 * The theme's own style element is left out: it is what a colour changes. */
function styledOf(app: Rule[], layers: string[], markup: string, language: Language) {
  const doc = rootDocument(language, steadied(markup));
  const rules = [...app];
  for (const style of doc.body.querySelectorAll('style:not([data-mantine-styles="true"])')) {
    rules.push(...rulesOf(style.textContent ?? '', layers, rules.length));
  }
  const index = new Map<string, Rule[]>();
  for (const rule of rules) index.set(rule.key, [...(index.get(rule.key) ?? []), rule]);
  const styled: Styled = [];
  const visit = (element: Element, parent: number, depth: number) => {
    const keys = [
      'x',
      `t.${element.localName}`,
      ...[...element.classList].map((name) => `c.${name}`),
      ...element.getAttributeNames().map((name) => `a.${name}`),
    ];
    const plain: Winners = new Map();
    const own: Custom = new Map();
    const take = (key: string, rank: number[], value: string) => {
      const [, , property] = key.split(SEP);
      if (property.startsWith('--')) {
        if (key.startsWith(SEP + SEP)) offer(plainCustom, property, rank, value);
      } else offer(plain, key, rank, value);
    };
    const plainCustom: Winners = new Map();
    for (const rule of keys.flatMap((key) => index.get(key) ?? [])) {
      if (!reads(element, rule.selector)) continue;
      for (const { property, value, important } of rule.declarations) {
        take(
          `${rule.pseudo}${SEP}${rule.context}${SEP}${property}`,
          [important ? 2 : 0, rule.layer, rule.specificity, rule.order],
          value,
        );
      }
    }
    for (const { property, value, important } of declarationsOf(
      element.getAttribute('style') ?? '',
    )) {
      take(`${SEP}${SEP}${property}`, [important ? 3 : 1, INLINE, INLINE, INLINE], value);
    }
    for (const [property, { value }] of plainCustom) own.set(property, value);
    styled.push({ parent, depth, tag: element.localName, plain, own });
    const at = styled.length - 1;
    for (const child of element.children) {
      if (!['style', 'script', 'head'].includes(child.localName)) visit(child, at, depth + 1);
    }
  };
  visit(doc.documentElement, -1, 0);
  return styled;
}

/** `var(--x, fallback)` read from the element's custom properties, nested ones too. */
function substitute(value: string, custom: Custom, depth = 0): string {
  if (!value.includes('var(') || depth > 12) return value;
  let out = '';
  for (let at = 0; at < value.length;) {
    const found = value.indexOf('var(', at);
    if (found < 0) {
      out += value.slice(at);
      break;
    }
    out += value.slice(at, found);
    let level = 0;
    let end = found + 3;
    do {
      if (value[end] === '(') level++;
      else if (value[end] === ')') level--;
      end++;
    } while (level > 0 && end < value.length);
    const inner = value.slice(found + 4, end - 1);
    const comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    const held = custom.get(name) ?? fallback;
    out += held === undefined ? `var(${name})` : substitute(held, custom, depth + 1);
    at = end;
  }
  return squash(out);
}

/** The resolved style of each element, as lines: its depth, its tag and the declarations that win,
 * the variables read from the theme's `root` and what the elements above set. */
function linesOf(styled: Styled, root: Custom) {
  const customs: Custom[] = [];
  return styled.map((element, at) => {
    // On `<html>` the theme's style element comes after the app's stylesheet in the page, so its
    // variables win over the stylesheet's own `:root` ones; below, an element's own win.
    const custom = new Map(
      element.parent < 0 ? [...element.own, ...root] : [...customs[element.parent], ...element.own],
    );
    customs[at] = custom;
    const plain = [...element.plain]
      .map(([key, { value }]) => `${key.replaceAll(SEP, '|')}=${substitute(value, custom)}`)
      .sort();
    return `${element.depth} ${element.tag} ${plain.join(';')}`;
  });
}

/** One markup's lines under the theme its own style element carries (or the one given). */
function resolvedLines(css: string, markup: string, language: Language, theme?: string) {
  const layers: string[] = [];
  const app = rulesOf(css, layers);
  const own = THEME_STYLE.exec(markup)?.[1] ?? '';
  return linesOf(styledOf(app, layers, markup, language), themeVariables(theme ?? own));
}

/** The app's stylesheet as the walks page builds it (`appStyles` in `capture.ts`), but with the class
 * names of CSS modules as this suite's own loader gives them (`_name_` and six digits of the path's
 * sha1, as Vitest names them), since the screens drawn here carry those, not the build's. */
async function stylesheet() {
  const before = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    const built = await build({
      root: PACKAGE,
      configFile: false,
      plugins: [react()],
      logLevel: 'warn',
      mode: 'production',
      css: {
        modules: {
          generateScopedName: (name: string, file: string) =>
            `_${name}_${createHash('sha1')
              .update(relative(PACKAGE, file.split('?')[0]))
              .digest('hex')
              .slice(0, 6)}`,
        },
      },
      build: {
        write: false,
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        lib: { entry: join(PACKAGE, 'site/styles.ts'), formats: ['es'], fileName: 'styles' },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    });
    const files = (
      [built].flat() as { output: { fileName: string; source?: unknown }[] }[]
    ).flatMap((one) => one.output);
    return String(files.find((file) => file.fileName.endsWith('.css'))!.source);
  } finally {
    if (before === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = before;
  }
}

const hashOf = (lines: string[]) =>
  createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);

describe('the resolved style of a screen', () => {
  const sheet =
    '.a{color:var(--c);padding:4px}.a:hover{color:red}.b{margin:0}@media (max-width:600px){.a{padding:2px}}' +
    '@layer base{.a{color:blue}}.a::before{content:"x"}';
  const theme = (value: string) => `<style data-mantine-styles="true">:root{--c:${value}}</style>`;
  const page = (name: string, value = '#111') =>
    `<div class="${name}" style="top:1px"><span class="b">t</span></div>${theme(value)}`;
  const rename = (text: string) => text.replaceAll('.a', '.z');

  it('leaves class names out: a class renamed in a stylesheet and its markup moves nothing', () => {
    const before = hashOf(resolvedLines(sheet, page('a'), 'en'));
    const after = hashOf(resolvedLines(rename(sheet), page('z'), 'en'));
    expect(after).toBe(before);
  });

  it('moves with a value of a role, read through its variable', () => {
    const before = hashOf(resolvedLines(sheet, page('a'), 'en'));
    expect(hashOf(resolvedLines(sheet, page('a', '#222'), 'en'))).not.toBe(before);
    expect(hashOf(resolvedLines(sheet, page('a'), 'en', ':root{--c:#222}'))).not.toBe(before);
  });

  it('lets the theme win a root variable the app stylesheet also writes, as the page does', () => {
    const lines = resolvedLines(
      ':root{--c:#aaa;--d:#ddd}.a{color:var(--c);margin:var(--d)}',
      `<p class="a">t</p>${theme('#222')}`,
      'en',
    );
    const mine = lines.find((line) => line.includes(' p '))!;
    expect(mine).toContain('|color=#222');
    expect(mine).toContain('|margin=#ddd');
  });

  it('reads the cascade: inline over a rule, a layer under none, a fallback for a missing variable', () => {
    const lines = resolvedLines(
      '.a{color:var(--none, green);margin:1px !important}.a{margin:2px}@layer base{.a{padding:3px}}.a{padding:4px}',
      `<p class="a" style="margin:9px">t</p>`,
      'en',
    );
    const mine = lines.find((line) => line.includes(' p '))!;
    expect(mine).toContain('|color=green');
    expect(mine).toContain('|margin=1px');
    expect(mine).toContain('|padding=4px');
  });
});

describe('every screen of the walks page, on ten colours', () => {
  const pinned = new Map<string, string>();
  const found = new Map<string, string>();
  const screens: { key: string; styled: Styled[] }[] = [];
  const themes = new Map<string, Custom>();
  beforeAll(async () => {
    const css = await stylesheet();
    const layers: string[] = [];
    const app = rulesOf(css, layers);
    if (!WRITE) {
      for (const line of readFileSync(PINNED, 'utf8').split('\n')) {
        const at = line.lastIndexOf(' ');
        if (at > 0) pinned.set(line.slice(0, at), line.slice(at + 1));
      }
    }
    for (const [name, colour] of COLOURS) {
      drawnWords(null, colour, 'en');
      themes.set(name, themeVariables(THEME_STYLE.exec(lastDrawn.markup)![1]));
    }
    const drawn = resolveDrawn(WALKS, SCREENS);
    for (const walk of WALKS) {
      for (const screen of walk.screens) {
        const what = drawn.get(`${walk.id}:${screen.id}`)!;
        const styled: Styled[] = [];
        for (const language of LANGUAGES) {
          await readWords(what, language, screen.navigation === true);
          styled.push(styledOf(app, layers, lastDrawn.markup, language));
        }
        screens.push({ key: `${walk.id}/${screen.id}`, styled });
      }
    }
  }, 900_000);
  afterAll(() => {
    if (WRITE) {
      writeFileSync(PINNED, [...found].map(([key, hash]) => `${key} ${hash}`).join('\n') + '\n');
    }
  });

  it.each(COLOURS)('moves no screen under %s', (name) => {
    const moved: string[] = [];
    for (const { key, styled } of screens) {
      const lines = styled.flatMap((one) => linesOf(one, themes.get(name)!));
      found.set(`${key} ${name}`, hashOf(lines));
      if (!WRITE && pinned.get(`${key} ${name}`) !== hashOf(lines)) moved.push(`${key} ${name}`);
    }
    expect(moved).toEqual([]);
  });

  it('pins every screen on every colour, and none besides', () => {
    if (WRITE) return;
    expect(pinned.size).toBe(WALKS.flatMap((walk) => walk.screens).length * COLOURS.length);
  });
});
