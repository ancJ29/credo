// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { build, PACKAGE } from './build';

it('The built page’s own script, run in jsdom: a label typed, two answers chosen, Share’s message equal to the clipboard’s and the text shown, and “Copy my answers” giving the block with no By: line', async () => {
  const { worktree } = makeRoot();
  const { folder } = await build({
    cwd: worktree,
    answersFile: join(PACKAGE, 'answers.json'),
    builtAt: new Date('2026-10-27T19:30:00Z'),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });
  const full = readFileSync(join(folder, 'index.html'), 'utf8');
  // jsdom runs no module script, and a module waits for the document: so the script is run as a
  // classic one once the page is parsed, which is what a browser does with the module.
  const open = full.indexOf('<script type="module">');
  const close = full.indexOf('</script>', open);
  const script = full
    .slice(open + '<script type="module">'.length, close)
    .replaceAll('<\\/script', '</script');
  const dom = new JSDOM(full.slice(0, open) + full.slice(close + '</script>'.length), {
    // The page is opened from disk, as the human opens it.
    url: 'file:///walks/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  // jsdom's typings are the two lines types.d.ts declares; the window is the browser's.
  const window = dom.window as unknown as Window &
    typeof globalThis & { eval(code: string): unknown };
  const written: string[] = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
  });
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out and has no scrolling.
  window.Element.prototype.scrollIntoView = () => {};
  window.eval(script);
  const { document } = window;
  // React draws the page, and writes the clipboard, in tasks of their own.
  const until = async (done: () => boolean) => {
    for (let waited = 0; !done() && waited < 5000; waited += 10) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(done()).toBe(true);
  };
  await until(() => document.querySelector('input[aria-label="Your label"]') !== null);
  // One screen is open, and one frame drawn.
  expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
  const press = async (name: string, writes: number) => {
    [...document.querySelectorAll('button')].find((button) => button.textContent === name)!.click();
    await until(() => written.length === writes);
  };

  const input = document.querySelector<HTMLInputElement>('input[aria-label="Your label"]')!;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, 'p1');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const yes = document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]');
  yes[0].click();
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === 'Next ›')!
    .click();
  await until(() => document.querySelector('.w-number')!.textContent === '2');
  document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]')[0].click();
  await press('Share', 1);
  const shown = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="The text to paste"]',
  )!.value;
  await press('Copy my answers', 2);

  const [shared, copied] = written;
  expect(shown).toBe(shared);
  expect(shared).toContain('By: p1');
  expect(shared.match(/ \| (yes|no) \| /g)).toHaveLength(2);
  expect(copied).toContain('Credo walks answers');
  expect(copied).not.toContain('By:');

  // "Yes for both languages" answers the two languages of the screen in view, and the block that
  // gives is the one by hand gives.
  document
    .querySelector<HTMLButtonElement>('button[aria-label="Clear 2 choices on the page"]')!
    .click();
  await until(
    () => document.querySelector('button[aria-label="Clear 0 choices on the page"]') !== null,
  );
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === 'Yes for both languages (2)')!
    .click();
  await until(() => document.querySelector('.w-note')!.textContent.startsWith('2 answered Yes'));
  await press('Copy my answers', 3);
  const [, , bulk] = written;
  expect(bulk.match(/ \| yes \| /g)).toHaveLength(2);
  expect(bulk).toContain('admin-setup:2-sign-in-refused:vi | yes | ');
  expect(bulk).toContain('admin-setup:2-sign-in-refused:en | yes | ');
  window.close();
});
