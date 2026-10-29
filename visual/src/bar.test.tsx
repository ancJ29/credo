import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answers } from './answers';
import { Page } from './page';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');

/** The text between the braces that follow `opening`, braces inside counted. */
function block(text: string, opening: string) {
  const start = text.indexOf(opening);
  if (start < 0) return '';
  let depth = 0;
  for (let at = start + opening.length - 1; at < text.length; at++) {
    if (text[at] === '{') depth++;
    if (text[at] === '}' && --depth === 0) return text.slice(start + opening.length, at);
  }
  return '';
}

/** The declarations of a rule in the stylesheet. */
const rule = (selector: string) => block(css, `\n${selector} {`);

const make = (walks = WALKS.slice(0, 1), answers: Answers = {}) =>
  makeReport({
    walks,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: {
      branch: 'a-piece',
      commit: 'abc123def',
      changed: false,
      committedAt: new Date('2026-10-27T18:59:00Z'),
      home: '/h',
    },
    builtAt: new Date('2026-10-27T19:30:00Z'),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const plain = make();
const wordsOf = (id: string, language: 'vi' | 'en') =>
  plain.walks[0].screens.find((one) => one.id === id)!.languages[language].words;
const IDS = plain.walks[0].screens.map((one) => one.id);
const yesOn = (id: string, language: 'vi' | 'en', label = '') =>
  [
    `admin-setup:${id}:${language}${label}`,
    { answer: 'yes' as const, on: '2026-10-29', reason: '', words: wordsOf(id, language) },
  ] as const;
const all = (label = ''): Answers =>
  Object.fromEntries(IDS.flatMap((id) => [yesOn(id, 'vi', label), yesOn(id, 'en', label)]));

const clipboard = (write: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: write },
  });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const bar = () => within(document.querySelector<HTMLElement>('.w-send')!);
const number = () => document.querySelector('.w-screen .w-number')!.textContent;
const yes = () => fireEvent.click(screen.getByLabelText('Yes'));
const press = async (name: string) =>
  act(() => {
    fireEvent.click(button(name));
    return Promise.resolve();
  });

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  localStorage.clear();
});

describe('the footer', () => {
  it('keeps the notice above its one row, not in it', () => {
    render(<Page report={make()} />);

    const footer = document.querySelector('.w-send')!;
    const note = footer.querySelector('[role="status"]')!;
    const row = footer.querySelector('.w-send-row')!;

    expect(row.contains(note)).toBe(false);
    expect(note.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rule('.w-note')).toContain('position: absolute');
    expect(rule('.w-note')).toContain('bottom: calc(100% + 8px)');
  });

  it('stays one row at every width, and the count and the buttons give way to nothing', () => {
    expect(rule('.w-send-row')).toContain('flex-wrap: nowrap');
    expect(rule('.w-ledger')).toContain('min-width: 40px');
    expect(rule('.w-walkbar')).toContain('min-width: 6px');
    expect(rule('.w-count')).toContain('white-space: nowrap');
    expect(rule('.w-count')).toContain('text-overflow: ellipsis');
    expect(rule('.w-copy,\n.w-share')).toContain('flex: none');
    expect(css).not.toMatch(/\.w-send-row \{[^}]*flex-wrap: wrap/);
  });

  it('draws one bar a walk, as wide as its share of the answers and filled to what is answered in it', () => {
    const answers = Object.fromEntries([yesOn('1-sign-in', 'vi'), yesOn('1-sign-in', 'en')]);
    render(<Page report={make(WALKS, answers)} />);

    const bars = [...document.querySelectorAll<HTMLElement>('.w-walkbar')];

    expect(bars).toHaveLength(2);
    expect(bars.map((one) => one.style.flex)).toEqual(['18 1 0px', '8 1 0px']);
    expect(bars.map((one) => one.querySelector<HTMLElement>('.w-walkfill')!.style.width)).toEqual([
      `${(2 / 18) * 100}%`,
      '0%',
    ]);
  });

  it('names a walk and what is left in it on hover and to a reader, and says done when nothing is', () => {
    render(<Page report={make(WALKS, all())} />);

    const [first, second] = [...document.querySelectorAll<HTMLElement>('.w-walkbar')];

    expect(first.getAttribute('title')).toBe(first.getAttribute('aria-label'));
    expect(first.getAttribute('title')).toBe(
      'Set up the company: its name, colour and languages: done',
    );
    expect(second.getAttribute('title')).toMatch(/: 4 left$/);
  });

  it('opens a walk’s first screen waiting when its bar is clicked, and is no Tab stop', () => {
    window.history.replaceState(null, '', '#admin-setup-1-sign-in');
    render(<Page report={make(WALKS, all())} />);
    const bars = [...document.querySelectorAll<HTMLAnchorElement>('.w-walkbar')];
    expect(document.querySelector('.w-walk')!.id).toBe('admin-setup');

    fireEvent.click(bars[1]);

    expect(document.querySelector('.w-walk')!.id).toBe('operator-setup');
    expect(number()).toBe('1');
    expect(bars.every((one) => one.tabIndex === -1)).toBe(true);
  });

  it('counts in plain words: of all, and none chosen yet, the ones ready to copy, and the ones copied', async () => {
    clipboard(() => Promise.resolve());
    render(<Page report={make()} />);
    const count = () => document.querySelector('.w-count')!.textContent;

    expect(count()).toBe('0 of 18 answered · none chosen yet');
    yes();
    expect(count()).toBe('1 of 18 answered · 1 ready to copy');
    await press('Copy my answers');
    expect(count()).toBe('1 of 18 answered · 1 copied');
    fireEvent.click(button('Done'));
    expect(count()).toBe('1 of 18 answered · 1 copied');
    fireEvent.click(screen.getByLabelText('No'));
    expect(count()).toBe('1 of 18 answered · 1 ready to copy');
  });

  it('says all answered when none waits, and “by you” on a partner’s page', () => {
    const { unmount } = render(<Page report={make(WALKS.slice(0, 1), all())} />);
    expect(document.querySelector('.w-progress')!.textContent).toBe('All 18 answered');
    unmount();
    localStorage.setItem('credo-walks-label', 'p1');

    render(<Page report={make(WALKS.slice(0, 1), all('@p1'))} partner />);

    expect(document.querySelector('.w-progress')!.textContent).toBe('All 18 answered by you');
  });
});

describe('the one button', () => {
  it('is Copy my answers on the human’s page, with no label box and no Share', () => {
    render(<Page report={make()} />);

    expect(button('Copy my answers')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByLabelText('Label from the invite')).toBeNull();
    expect(screen.queryByLabelText('Your label')).toBeNull();
  });

  it('is Share on a partner’s page, with no Copy my answers, and asks once for the label from the invite', () => {
    render(<Page report={make()} partner />);

    expect(bar().getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(bar().queryByRole('button', { name: 'Copy my answers' })).toBeNull();
    const input = bar().getByLabelText<HTMLInputElement>('Label from the invite');
    expect(input.placeholder).toBe('Label from the invite');
    fireEvent.change(input, { target: { value: 'P1' } });
    expect(input.value).toBe('p1');
    fireEvent.blur(input);

    expect(bar().queryByLabelText('Label from the invite')).toBeNull();
    expect(document.querySelector('.w-label-kept')!.textContent).toBe('as p1, change');
    fireEvent.click(button('change'));
    expect(bar().getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('p1');
  });

  it('shows the kept label at once on a later visit, and keeps asking while the box holds no label', () => {
    localStorage.setItem('credo-walks-label', 'p1');
    const { unmount } = render(<Page report={make()} partner />);
    expect(document.querySelector('.w-label-kept')!.textContent).toBe('as p1, change');
    unmount();
    localStorage.clear();

    render(<Page report={make()} partner />);
    const input = screen.getByLabelText('Label from the invite');
    fireEvent.change(input, { target: { value: '!' } });
    fireEvent.blur(input);

    expect(screen.getByLabelText('Label from the invite')).toBeTruthy();
  });

  it('is off while nothing is chosen, quiet while screens wait, and teal when none waits', () => {
    const { unmount } = render(<Page report={make()} />);
    const copy = () => button('Copy my answers') as HTMLButtonElement;

    expect(copy().disabled).toBe(true);
    yes();
    expect(copy().disabled).toBe(false);
    expect(document.querySelector('.w-send')!.getAttribute('data-action')).toBe('next');
    unmount();

    render(<Page report={make(WALKS.slice(0, 1), all())} />);
    expect(document.querySelector('.w-send')!.getAttribute('data-action')).toBe('done');
    expect(css).toMatch(/\.w-send\[data-action='done'\]\[data-partner='false'\] \.w-copy/);
    expect(rule('.w-copy,\n.w-share')).not.toContain('var(--teal)');
  });
});

describe('the text a copy made', () => {
  it('opens in a dialog that says where to paste it, with Copy again and Done, and the footer keeps its place', async () => {
    const written: string[] = [];
    clipboard((text) => (written.push(text), Promise.resolve()));
    render(<Page report={make()} />);
    yes();
    const footer = document.querySelector('.w-send')!.innerHTML;

    await press('Copy my answers');

    const dialog = document.querySelector<HTMLDialogElement>('dialog.w-dialog[open]')!;
    expect(within(dialog).getByRole('heading', { name: 'Copied: 1 answer' })).toBeTruthy();
    expect(within(dialog).getByText('Paste it into the chat.')).toBeTruthy();
    const text = within(dialog).getByLabelText<HTMLTextAreaElement>('The text to paste');
    expect(text.value).toBe(written[0]);
    expect(document.activeElement).toBe(text);
    await press('Copy again');
    expect(written).toEqual([written[0], written[0]]);
    fireEvent.click(button('Done'));
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.querySelector('.w-send-row')!.children).toHaveLength(3);
    expect(footer).toContain('w-send-row');
  });

  it('says where the clipboard refused, and Copy again may be refused too', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={make()} />);
    yes();

    await press('Copy my answers');
    await press('Copy again');

    expect(screen.getByRole('heading', { name: 'Copy this text' })).toBeTruthy();
    expect(screen.getByText(/Select the text and copy it\. Paste it into the chat\./)).toBeTruthy();
  });

  it('says Post it in Slack from a partner’s page', async () => {
    clipboard(() => Promise.resolve());
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={make()} partner />);
    yes();

    await press('Share');

    expect(screen.getByText('Post it in Slack.')).toBeTruthy();
  });
});

describe('the dialog of a copy is modal', () => {
  it('shuts on Escape and gives the focus back to the button, and the page takes no key while it is open', async () => {
    clipboard(() => Promise.resolve());
    render(<Page report={make()} />);
    yes();
    const copy = button('Copy my answers');
    copy.focus();

    await press('Copy my answers');
    expect(document.querySelector('dialog[open]')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(number()).toBe('1');
    fireEvent.keyDown(document.querySelector('dialog[open]')!, { key: 'Escape' });

    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.activeElement).toBe(copy);
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(number()).toBe('2');
  });

  it('takes the focus into its text, the one thing it asks for', async () => {
    clipboard(() => Promise.resolve());
    render(<Page report={make()} />);
    yes();

    await press('Copy my answers');

    expect(document.activeElement).toBe(document.querySelector('dialog[open] textarea'));
  });
});

describe('the notice above the footer', () => {
  it('rides above the footer with its Undo, and a cross shuts it', () => {
    render(<Page report={make()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Yes for both languages/ }));

    const note = document.querySelector('.w-note')!;
    expect(note.textContent).toBe('2 answered Yes · Undo');
    expect(document.querySelector('.w-send-row')!.contains(note)).toBe(false);
    fireEvent.click(within(note as HTMLElement).getByRole('button', { name: 'Dismiss' }));
    expect(note.textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(rule('.w-dismiss::before')).toContain("content: '×'");
  });

  it('names the screen whose No lacks its reason, and opens it when pressed', () => {
    clipboard(() => Promise.resolve());
    render(<Page report={make()} />);
    fireEvent.click(screen.getByLabelText('No'));
    fireEvent.click(button('Next ›'));
    yes();

    fireEvent.click(button('Copy my answers'));
    expect(document.querySelector('.w-note')!.textContent).toBe(
      'A No needs its reason: screen 1 in Tiếng Việt.',
    );
    expect(number()).toBe('2');
    fireEvent.click(button('A No needs its reason: screen 1 in Tiếng Việt.'));

    expect(number()).toBe('1');
  });

  it('asks for the label from the invite first when Share is pressed without one', () => {
    render(<Page report={make()} partner />);
    yes();

    fireEvent.click(button('Share'));

    expect(document.querySelector('.w-note')!.textContent).toContain(
      'Type the label from your invite first',
    );
  });
});

describe('the footer keeps its height', () => {
  it('on the page, so an answer at the foot of the window rests above it', () => {
    const watching: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          watching.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60);
    render(<Page report={make()} />);

    act(() => watching.forEach((fit) => fit()));

    expect(document.documentElement.style.getPropertyValue('--bar')).toBe('60px');
    document.documentElement.style.removeProperty('--bar');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
