// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { makeRoot } from '../tests/repo';
import { build, PACKAGE } from './build';
import { stubDialog } from './dom';

it('The built page’s own script, run in jsdom: two answers chosen, “Copy my answers” giving the block with no By: line, shown in its dialog and equal to the clipboard’s', async () => {
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
    .replaceAll('<\\/script', '</script')
    // the import page's libraries load on demand, and Vite's loader reads `import.meta`, which
    // only a module may: a classic script is given the page's address in its place
    .replaceAll('import.meta', '({ url: "file:///index.html" })');
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
  // The scenes run the app on the fake, which clones its data set as a browser's window can.
  window.structuredClone = structuredClone;
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out and has no scrolling.
  window.Element.prototype.scrollIntoView = () => {};
  stubDialog(window);
  window.eval(script);
  const { document } = window;
  // React draws the page, and writes the clipboard, in tasks of their own.
  const until = async (done: () => boolean) => {
    for (let waited = 0; !done() && waited < 5000; waited += 10) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(done()).toBe(true);
  };
  await until(() => document.querySelector('.w-yesno') !== null);
  // The human's page has the one button, and no label box and no Share.
  expect(document.querySelector('input[aria-label="Label from the invite"]')).toBeNull();
  expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Share')).toBe(
    false,
  );
  // The guide opens by itself on a first visit, once; closing it hands the page its keys.
  const guide = [...document.querySelectorAll('dialog')].at(-1)!;
  await until(() => guide.open);
  [...guide.querySelectorAll('button')].find((b) => b.textContent === 'Close')!.click();
  await until(() => !guide.open);
  // One screen is open, and one frame drawn.
  expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
  const press = async (name: string, writes: number) => {
    [...document.querySelectorAll('button')].find((button) => button.textContent === name)!.click();
    await until(() => written.length === writes);
  };

  const yes = document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]');
  yes[0].click();
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent === 'Next ›')!
    .click();
  await until(() => document.querySelector('.w-number')!.textContent === '2');
  document.querySelectorAll<HTMLInputElement>('.w-yesno input[type="radio"]')[0].click();
  await press('Copy my answers', 1);
  const shown = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="The text to paste"]',
  )!.value;
  const [copied] = written;
  expect(shown).toBe(copied);
  expect(copied.match(/ \| (yes|no) \| /g)).toHaveLength(2);
  expect(copied).toContain('Credo walks answers');
  expect(copied).not.toContain('By:');
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Done')!.click();
  await until(() => document.querySelector('dialog[open]') === null);

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
  await press('Copy my answers', 2);
  const [, bulk] = written;
  expect(bulk.match(/ \| yes \| /g)).toHaveLength(2);
  expect(bulk).toContain('admin-setup:2-sign-in-refused:vi | yes | ');
  expect(bulk).toContain('admin-setup:2-sign-in-refused:en | yes | ');
  window.close();
});
