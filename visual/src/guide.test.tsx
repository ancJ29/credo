import { SCREENS } from '@credo/ui/mock';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Page } from './page';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const report = () =>
  makeReport({
    walks: WALKS.slice(0, 1),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers: {},
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const SEEN = 'credo-walks-guide-seen';
const guide = () => [...document.querySelectorAll('dialog')].at(-1)!;
const key = (name: string, target: Element = document.body) =>
  fireEvent.keyDown(target, { key: name });
const number = () => document.querySelector('.w-screen .w-number')!.textContent;

afterEach(() => localStorage.clear());

describe('the guide opens', () => {
  it('by itself on a first visit, once, kept in the browser', () => {
    localStorage.removeItem(SEEN);
    const { unmount } = render(<Page report={report()} />);

    expect(guide().open).toBe(true);
    expect(within(guide()).getByRole('heading', { name: 'How this page works' })).toBeTruthy();
    expect(localStorage.getItem(SEEN)).toBe('yes');
    unmount();

    render(<Page report={report()} />);

    expect(guide().open).toBe(false);
  });

  it('at each load when the browser keeps nothing, and the page works', () => {
    localStorage.removeItem(SEEN);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      clear: () => {},
    });

    const { unmount } = render(<Page report={report()} />);
    expect(guide().open).toBe(true);
    unmount();
    render(<Page report={report()} />);

    expect(guide().open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(guide().open).toBe(false);
    vi.unstubAllGlobals();
  });

  it('from the “?” atop the screen and from the ? key', () => {
    render(<Page report={report()} />);
    expect(guide().open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'How this page works' }));
    expect(guide().open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(guide().open).toBe(false);

    key('?');
    expect(guide().open).toBe(true);
  });

  it('holds the keys, the teal button, many at once, and where this page’s answers go', () => {
    render(<Page report={report()} />);
    key('?');
    const text = guide().textContent;

    for (const words of [
      'J · K',
      'Y · N',
      'L',
      'U',
      'Esc',
      'The teal button is the next thing to do',
      'Undo',
      'Paste last answers',
      'Only unanswered',
    ]) {
      expect(text).toContain(words);
    }
    expect(text).toContain('Press “Copy my answers”, then paste the text into the chat');
    expect(text).not.toContain('Slack');
  });

  it('says on a partner’s page to type the label from the invite and Share', () => {
    render(<Page report={report()} partner />);
    key('?');

    expect(guide().textContent).toContain('Type the label from your invite');
    expect(guide().textContent).toContain('post the message in Slack');
    expect(guide().textContent).not.toContain('Press “Copy my answers”');
  });
});

describe('the guide says whose page it is', () => {
  it('a partner’s page, on a partner’s', () => {
    render(<Page report={report()} partner />);
    key('?');

    expect(guide().textContent).toContain('This is a partner’s page.');
    expect(guide().textContent).not.toContain('your own page');
  });

  it('your own page, opened from disk, on the human’s', () => {
    render(<Page report={report()} />);
    key('?');

    expect(guide().textContent).toContain('This is your own page, opened from disk.');
    expect(guide().textContent).not.toContain('partner’s page');
  });
});

describe('the guide is a modal dialog', () => {
  it('opens at its top: the title takes the focus, not Close at its foot', () => {
    render(<Page report={report()} />);
    key('?');

    expect(document.activeElement).toBe(
      within(guide() as HTMLElement).getByRole('heading', { name: 'How this page works' }),
    );
  });

  it('moves the focus in, shuts on Escape, and gives the focus back where it was', () => {
    render(<Page report={report()} />);
    const opener = screen.getByRole('button', { name: 'How this page works' });
    opener.focus();

    fireEvent.click(opener);
    expect(guide().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(guide(), { key: 'Escape' });

    expect(guide().open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('keeps any other key inside it open', () => {
    render(<Page report={report()} />);
    key('?');

    fireEvent.keyDown(guide(), { key: 'a' });

    expect(guide().open).toBe(true);
  });

  it('shuts when the browser closes it, and the page keeps working', () => {
    render(<Page report={report()} />);
    key('?');

    fireEvent(guide(), new Event('close'));

    expect(screen.queryByRole('heading', { name: 'How this page works' })).toBeNull();
  });

  it('takes the keys of the page behind while it is open', () => {
    render(<Page report={report()} />);
    key('?');

    for (const name of ['j', 'k', 'y', 'n', 'l', 'u']) key(name);

    expect(number()).toBe('1');
    expect(document.querySelector('.w-place')!.textContent).toContain('Tiếng Việt');
    expect(screen.queryByLabelText<HTMLInputElement>('Yes')).toBeTruthy();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('none chosen yet');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    key('j');
    expect(number()).toBe('2');
  });
});
