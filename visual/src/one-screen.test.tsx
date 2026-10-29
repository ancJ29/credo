import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { Page } from './page';
import { makeReport } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const make = (answers: Answers = {}, walks = WALKS.slice(0, 1)) =>
  makeReport({
    walks,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const plain = make();
const wordsOf = (key: string) => {
  const [walkId, screenId, language] = key.split(':');
  const found = plain.walks
    .find((walk) => walk.id === walkId)!
    .screens.find((one) => one.id === screenId)!;
  return found.languages[language as 'vi' | 'en'].words;
};
/** The human's yes on the words now, for each listed key; a `@label` key is a partner's. */
const yes = (...keys: string[]): Answers =>
  Object.fromEntries(
    keys.map((key) => [
      `admin-setup:${key}`,
      {
        answer: 'yes' as const,
        on: '2026-10-29',
        reason: '',
        words: wordsOf(`admin-setup:${key.split('@')[0]}`),
      },
    ]),
  );
const both = (id: string, label = '') => [`${id}:vi${label}`, `${id}:en${label}`];

afterEach(() => localStorage.clear());

const key = (name: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key: name, ...init });
const number = () => document.querySelector('.w-screen .w-number')!.textContent;
const place = () => document.querySelector('.w-place')!.textContent;
const go = (id: string) =>
  fireEvent.click(document.querySelector(`a.w-rail-item[href="#admin-setup-${id}"]`)!);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const pick = (legend: string, label: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: legend })).getByLabelText(label));
const items = () =>
  [...document.querySelectorAll('a.w-rail-item')].map((a) => a.getAttribute('href'));
const hashTo = (hash: string) =>
  act(() => {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

describe('one screen at a time', () => {
  it('opens on the first screen waiting and draws that screen’s frame alone, at PC', () => {
    render(<Page report={make(yes(...both('1-sign-in')))} />);

    expect(number()).toBe('2');
    expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(screen.getByTitle('Screen 2 in Tiếng Việt, PC 1280')).toBeTruthy();
    pick('Show', 'All three');
    expect(document.querySelectorAll('iframe')).toHaveLength(3);
  });

  it('opens on the screen the address names, a reload or a pasted link', () => {
    window.history.replaceState(null, '', '#admin-setup-5-language-menu');

    render(<Page report={make()} />);

    expect(number()).toBe('5');
  });

  it('opens on a walk’s first screen waiting when the address names the walk, and on the first waiting when it names nothing', () => {
    window.history.replaceState(null, '', '#admin-setup');
    const { unmount } = render(<Page report={make(yes(...both('1-sign-in')))} />);
    expect(number()).toBe('2');
    unmount();

    window.history.replaceState(null, '', '#nowhere');
    render(<Page report={make()} />);
    expect(number()).toBe('1');
  });

  it('names the screen in the address as it moves, and follows the address when Back or a pasted link changes it', () => {
    render(<Page report={make()} />);

    go('4-saved');
    expect(window.location.hash).toBe('#admin-setup-4-saved');
    go('4-saved');
    expect(number()).toBe('4');

    hashTo('#admin-setup-6-service-down');
    expect(number()).toBe('6');
  });

  it('opens a walk’s first screen waiting from its card on the map', () => {
    render(<Page report={make(yes(...both('1-sign-in')), WALKS)} />);

    fireEvent.click(
      within(screen.getByRole('region', { name: 'The map of the day' })).getAllByRole('link')[0],
    );

    expect(document.querySelector('.w-walk')!.id).toBe('operator-setup');
    expect(number()).toBe('1');
  });

  it('says in a line atop the screen the walk, the screen’s place, the language and the width', () => {
    render(<Page report={make()} />);

    expect(place()).toContain(
      'Set up the company: its name, colour and languages · screen 1 of 9 · Tiếng Việt · PC 1280',
    );
    go('3-settings');
    pick('Language', 'English');
    pick('Show', 'All three');
    expect(place()).toContain('screen 3 of 9 · English · all three widths');
  });
});

describe('moving', () => {
  it('Prev and Next move on among the screens and are off at the ends', () => {
    render(<Page report={make()} />);
    const prev = () => button('‹ Prev') as HTMLButtonElement;
    const next = () => button('Next ›') as HTMLButtonElement;

    expect(prev().disabled).toBe(true);
    fireEvent.click(next());
    expect(number()).toBe('2');
    fireEvent.click(prev());
    expect(number()).toBe('1');
    go('9-unknown-company');
    expect(next().disabled).toBe(true);
  });

  it('Next unanswered names where it goes: the other language here, else the screen, and says so when none waits', () => {
    const { rerender } = render(<Page report={make()} />);
    expect(button(/^Next: English$/)).toBeTruthy();
    rerender(<Page report={make(yes('1-sign-in:en'))} />);
    expect(button('Next unanswered: screen 2')).toBeTruthy();
    fireEvent.click(button('Next unanswered: screen 2'));
    expect(number()).toBe('2');
  });

  it('Next unanswered goes to the other language of this screen first, then the next screen waiting, Tiếng Việt first', () => {
    render(<Page report={make()} />);

    key('u');
    expect(number()).toBe('1');
    expect(place()).toContain('English');
    fireEvent.click(screen.getByLabelText('Yes'));
    key('u');
    expect(number()).toBe('1');
    expect(place()).toContain('Tiếng Việt');
    fireEvent.click(screen.getByLabelText('Yes'));
    key('u');
    expect(number()).toBe('2');
    expect(place()).toContain('Tiếng Việt');
  });

  it('wraps at the end, and says so, and says so when none waits', () => {
    const all = yes(
      ...[
        '1-sign-in',
        '2-sign-in-refused',
        '3-settings',
        '4-saved',
        '5-language-menu',
        '6-service-down',
        '7-save-failed',
        '8-save-conflict',
      ].flatMap((id) => both(id)),
    );
    render(<Page report={make(all)} />);
    expect(number()).toBe('9');

    key('u');
    expect(place()).toContain('English');
    fireEvent.click(screen.getByLabelText('Yes'));
    key('l');
    fireEvent.click(screen.getByLabelText('Yes'));
    key('u');

    expect(document.querySelector('.w-all')!.textContent).toBe('All 18 answered');
    key('u');
    expect(document.querySelector('.w-moved')!.textContent).toBe('Nothing left to answer.');
  });

  it('wraps past the last screen to the first one waiting', () => {
    const all = yes(
      ...[
        '2-sign-in-refused',
        '3-settings',
        '4-saved',
        '5-language-menu',
        '6-service-down',
        '7-save-failed',
        '8-save-conflict',
        '9-unknown-company',
      ].flatMap((id) => both(id)),
    );
    render(<Page report={make(all)} />);
    go('9-unknown-company');

    key('u');

    expect(number()).toBe('1');
    expect(document.querySelector('.w-moved')!.textContent).toContain('Back at the first screen');
  });

  it('J and K move, Y and N answer, L switches the language and U goes to the next unanswered', () => {
    render(<Page report={make()} />);

    key('j');
    expect(number()).toBe('2');
    key('k');
    expect(number()).toBe('1');
    key('y');
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
    key('n');
    expect(screen.getByLabelText<HTMLInputElement>('No').checked).toBe(true);
    key('l');
    expect(place()).toContain('English');
    key('l');
    expect(place()).toContain('Tiếng Việt');
    key('J');
    expect(number()).toBe('2');
    key('x');
    expect(number()).toBe('2');
  });

  it('J and K stop at the ends', () => {
    render(<Page report={make()} />);

    key('k');
    expect(number()).toBe('1');
    go('9-unknown-company');
    key('j');
    expect(number()).toBe('9');
  });

  it('N opens the reason box with the cursor in it, and again when a No is already given', () => {
    render(<Page report={make()} />);

    key('n');
    const box = screen.getByLabelText('Reason for the No');
    expect(document.activeElement).toBe(box);

    fireEvent.change(box, { target: { value: 'too small' } });
    (document.activeElement as HTMLElement).blur();
    key('n');
    expect(document.activeElement).toBe(box);
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByLabelText('Yes'));
    fireEvent.click(screen.getByLabelText('No'));
    expect(document.activeElement).toBe(screen.getByLabelText('Reason for the No'));
  });

  it('a key does nothing in a text box, in the label, or with Ctrl, Cmd or Alt', () => {
    render(<Page report={make()} />);
    fireEvent.click(screen.getByLabelText('No'));
    const box = screen.getByLabelText('Reason for the No');
    const label = screen.getByLabelText('Your label');

    key('j', {}, box);
    key('j', {}, label);
    key('j', { ctrlKey: true });
    key('j', { metaKey: true });
    key('j', { altKey: true });
    expect(number()).toBe('1');

    key('j', {}, screen.getByLabelText('Yes'));
    expect(number()).toBe('2');
  });

  it('Tab from the line atop reaches the drawn language’s Yes and No before any drawn screen, and the drawn screens take no pointer', () => {
    render(<Page report={make()} />);
    const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');
    const stage = document.querySelector('.w-stage')!;
    const atop = document.querySelector('.w-where')!;
    const yesNo = screen.getByLabelText('Yes');

    expect(stage.hasAttribute('inert')).toBe(true);
    expect(stage.querySelector('iframe')).toBeTruthy();
    expect(atop.compareDocumentPosition(yesNo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(css).toMatch(/\.w-stage \{[^}]*pointer-events: none/);
  });

  it('opens the list over the page from the line atop on a phone, and closes it on a screen', () => {
    render(<Page report={make()} />);
    const list = document.querySelector('.w-rail')!;

    expect(list.getAttribute('data-open')).toBe('false');
    fireEvent.click(button('Screens'));
    expect(list.getAttribute('data-open')).toBe('true');
    fireEvent.click(button('Close the list'));
    expect(list.getAttribute('data-open')).toBe('false');
    fireEvent.click(button('Screens'));
    go('4-saved');
    expect(list.getAttribute('data-open')).toBe('false');
  });

  it('opens each segment of the bar to its screen in its language, as a click and no Tab stop', () => {
    render(<Page report={make()} />);
    const ticks = [...document.querySelectorAll<HTMLAnchorElement>('.w-ledger a.w-tick')];

    expect(ticks).toHaveLength(18);
    expect(ticks.every((tick) => tick.tabIndex === -1)).toBe(true);
    fireEvent.click(ticks[5]);

    expect(number()).toBe('3');
    expect(place()).toContain('English');
  });

  it('keeps the screen in view marked in the list, one at a time', () => {
    render(<Page report={make()} />);

    go('4-saved');

    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(document.querySelector('[aria-current]')!.getAttribute('href')).toBe(
      '#admin-setup-4-saved',
    );
    expect(items()).toHaveLength(9);
  });
});

describe('only unanswered', () => {
  const done = yes(...both('1-sign-in'), ...both('3-settings'));

  it('keeps the list, Prev, Next, J and K to the screens with a language left, and says done on a walk with none', () => {
    render(<Page report={make(done)} />);
    expect(items()).toHaveLength(9);

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(items()).toHaveLength(7);
    expect(items()).not.toContain('#admin-setup-3-settings');
    go('2-sign-in-refused');
    key('j');
    expect(number()).toBe('4');
    key('k');
    expect(number()).toBe('2');
    expect((button('‹ Prev') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the bar’s segments, but those answered are no links', () => {
    render(<Page report={make(done)} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));

    const ticks = [...document.querySelectorAll('.w-ledger .w-tick')];

    expect(ticks).toHaveLength(18);
    expect(ticks.filter((tick) => tick.localName === 'a')).toHaveLength(14);
  });

  it('keeps a screen answered while in view until the person moves, so a reason can be typed', () => {
    render(<Page report={make()} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));

    key('y');
    key('l');
    key('y');

    expect(number()).toBe('1');
    expect(items()).toContain('#admin-setup-1-sign-in');
    key('j');
    expect(number()).toBe('2');
    expect(items()).not.toContain('#admin-setup-1-sign-in');
  });

  it('moves on to the next screen left when it is turned on over an answered screen', () => {
    render(<Page report={make(done)} />);
    go('3-settings');

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(number()).toBe('4');
  });

  it('opens an answered screen the address names with the toggle off, and says so', () => {
    localStorage.setItem('credo-walks-only-unanswered', 'yes');
    window.history.replaceState(null, '', '#admin-setup-3-settings');

    render(<Page report={make(done)} />);

    expect(number()).toBe('3');
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    expect(document.querySelector('.w-moved')!.textContent).toBe(
      'That screen is answered, so every screen is shown.',
    );
    hashTo('#admin-setup-4-saved');
    expect(document.querySelector('.w-moved')!.textContent).toBe('');
  });

  it('is kept in the browser, off when the page first opens', () => {
    const { unmount } = render(<Page report={make()} />);
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Only unanswered'));
    unmount();

    render(<Page report={make()} />);

    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(true);
  });

  it('with none left, says so, with the last action and a way back to every screen', () => {
    const everything = yes(
      ...[
        '1-sign-in',
        '2-sign-in-refused',
        '3-settings',
        '4-saved',
        '5-language-menu',
        '6-service-down',
        '7-save-failed',
        '8-save-conflict',
        '9-unknown-company',
      ].flatMap((id) => both(id)),
    );
    render(<Page report={make(everything)} />);

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();
    expect(
      within(document.querySelector<HTMLElement>('.w-done')!).getByText('Copy my answers'),
    ).toBeTruthy();
    fireEvent.click(button('Show all screens'));
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
  });

  it('with none left, offers Share on a partner’s page', () => {
    const everything = yes(
      ...[
        '1-sign-in',
        '2-sign-in-refused',
        '3-settings',
        '4-saved',
        '5-language-menu',
        '6-service-down',
        '7-save-failed',
        '8-save-conflict',
        '9-unknown-company',
      ].flatMap((id) => both(id, '@p1')),
    );
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={make(everything)} partner />);

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(screen.getAllByRole('button', { name: 'Share' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();
    fireEvent.click(document.querySelector('.w-done .w-next')!);
    expect(document.querySelector('.w-note')!.textContent).not.toBe('');
  });

  it('copies from the empty place on the human’s page', () => {
    const everything = yes(
      ...[
        '1-sign-in',
        '2-sign-in-refused',
        '3-settings',
        '4-saved',
        '5-language-menu',
        '6-service-down',
        '7-save-failed',
        '8-save-conflict',
        '9-unknown-company',
      ].flatMap((id) => both(id)),
    );
    render(<Page report={make(everything)} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));

    fireEvent.click(document.querySelector('.w-done .w-next')!);

    expect(document.querySelector('.w-note')!.textContent).toContain('Nothing chosen yet');
  });
});

describe('a partner’s page', () => {
  const human = yes(...both('1-sign-in'));
  const mine = yes(...both('2-sign-in-refused', '@p1'));

  it('counts a screen answered when that partner answered it, and the human’s answers mark nothing there', () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={make({ ...human, ...mine })} partner />);

    expect(number()).toBe('1');
    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(document.querySelector('.w-partners')!.textContent).toContain(
      'Recorded: yes on 2026-10-29.',
    );
    expect(
      [...document.querySelectorAll('.w-screen-head .w-mark')].map((mark) =>
        mark.getAttribute('data-mark'),
      ),
    ).toEqual(['open', 'open']);
    expect(document.querySelector('.w-state')!.textContent).toBe('Not answered yet.');
  });

  it('follows the label kept in the browser as it is typed, and reads next unanswered by it', () => {
    render(<Page report={make({ ...human, ...mine })} partner />);
    const label = screen.getByLabelText('Your label');

    fireEvent.change(label, { target: { value: 'p1' } });

    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    fireEvent.change(label, { target: { value: 'p2' } });
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
    expect(button('Next: English')).toBeTruthy();
  });

  it('reads the human’s page by the human’s answers alone', () => {
    render(<Page report={make({ ...human, ...mine })} />);

    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(number()).toBe('2');
    expect(document.querySelector('.w-partners')!.textContent).not.toContain('Recorded');
  });
});
