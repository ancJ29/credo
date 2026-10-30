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

const plain = await make();
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
  it('opens on the first screen waiting and draws that screen’s frame alone, at PC', async () => {
    render(<Page report={await make(yes(...both('1-sign-in')))} />);

    expect(number()).toBe('2');
    expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(screen.getByTitle('Screen 2 in Tiếng Việt, PC 1280')).toBeTruthy();
    pick('Show', 'All three');
    expect(document.querySelectorAll('iframe')).toHaveLength(3);
  });

  it('opens on the screen the address names, a reload or a pasted link', async () => {
    window.history.replaceState(null, '', '#admin-setup-5-language-menu');

    render(<Page report={await make()} />);

    expect(number()).toBe('5');
  });

  it('opens on a walk’s first screen waiting when the address names the walk, and on the first waiting when it names nothing', async () => {
    window.history.replaceState(null, '', '#admin-setup');
    const { unmount } = render(<Page report={await make(yes(...both('1-sign-in')))} />);
    expect(number()).toBe('2');
    unmount();

    window.history.replaceState(null, '', '#nowhere');
    render(<Page report={await make()} />);
    expect(number()).toBe('1');
  });

  it('names the screen in the address as it moves, and follows the address when Back or a pasted link changes it', async () => {
    render(<Page report={await make()} />);

    go('4-saved');
    expect(window.location.hash).toBe('#admin-setup-4-saved');
    go('4-saved');
    expect(number()).toBe('4');

    hashTo('#admin-setup-6-service-down');
    expect(number()).toBe('6');
  });

  it('opens a walk’s first screen waiting from its card on the map', async () => {
    render(<Page report={await make(yes(...both('1-sign-in')), WALKS.slice(0, 2))} />);

    fireEvent.click(
      within(screen.getByRole('region', { name: 'The map of the day' })).getAllByRole('link')[0],
    );

    expect(document.querySelector('.w-walk')!.id).toBe('operator-setup');
    expect(number()).toBe('1');
  });

  it('says in a line atop the screen the walk, the screen’s place, the language and the width', async () => {
    render(<Page report={await make()} />);

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
  it('Prev and Next move on among the screens and are off at the ends', async () => {
    render(<Page report={await make()} />);
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

  it('Next unanswered names where it goes: the other language here, else the screen, and says so when none waits', async () => {
    const { rerender } = render(<Page report={await make()} />);
    expect(button(/^Next: English$/)).toBeTruthy();
    rerender(<Page report={await make(yes('1-sign-in:en'))} />);
    expect(button('Next unanswered: screen 2')).toBeTruthy();
    fireEvent.click(button('Next unanswered: screen 2'));
    expect(number()).toBe('2');
  });

  it('Next unanswered goes to the other language of this screen first, then the next screen waiting, Tiếng Việt first', async () => {
    render(<Page report={await make()} />);

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

  it('wraps at the end, and says so, and says so when none waits', async () => {
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
    render(<Page report={await make(all)} />);
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

  it('wraps past the last screen to the first one waiting', async () => {
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
    render(<Page report={await make(all)} />);
    go('9-unknown-company');

    key('u');

    expect(number()).toBe('1');
    expect(document.querySelector('.w-moved')!.textContent).toContain('Back at the first screen');
  });

  it('J and K move, Y and N answer, L switches the language and U goes to the next unanswered', async () => {
    render(<Page report={await make()} />);

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

  it('J and K stop at the ends', async () => {
    render(<Page report={await make()} />);

    key('k');
    expect(number()).toBe('1');
    go('9-unknown-company');
    key('j');
    expect(number()).toBe('9');
  });

  it('N opens the reason box without moving the focus, and the keys still work after it', async () => {
    render(<Page report={await make()} />);

    key('n');
    const box = screen.getByLabelText('Reason for the No');
    expect(document.activeElement).not.toBe(box);

    fireEvent.change(box, { target: { value: 'too small' } });
    key('n');
    expect(screen.getByLabelText('Reason for the No')).toBe(box);
    expect(document.activeElement).not.toBe(box);
    key('y');
    expect(screen.queryByLabelText('Reason for the No')).toBeNull();
    fireEvent.click(screen.getByLabelText('No'));
    expect(document.activeElement).not.toBe(screen.getByLabelText('Reason for the No'));
  });

  it('a key does nothing in a text box, in the paste box, or with Ctrl, Cmd or Alt', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(screen.getByLabelText('No'));
    const box = screen.getByLabelText('Reason for the No');
    fireEvent.click(button('Paste last answers…'));
    const pasteBox = screen.getByLabelText('Paste an earlier block or Share message');

    key('j', {}, box);
    key('j', {}, pasteBox);
    key('j', { ctrlKey: true });
    key('j', { metaKey: true });
    key('j', { altKey: true });
    expect(number()).toBe('1');

    key('j', {}, screen.getByLabelText('Yes'));
    expect(number()).toBe('2');
  });

  it('Tab from the line atop reaches the drawn language’s Yes and No before any drawn screen, and the drawn screens take no pointer and are not inert', async () => {
    render(<Page report={await make()} />);
    const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');
    const stage = document.querySelector('.w-stage')!;
    const atop = document.querySelector('.w-where')!;
    const yesNo = screen.getByLabelText('Yes');

    expect(stage.hasAttribute('inert')).toBe(false);
    expect(yesNo.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stage.querySelector('iframe')).toBeTruthy();
    expect(atop.compareDocumentPosition(yesNo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(css).toMatch(/\.w-stage \{[^}]*pointer-events: none/);
    // The panel is first in the page's order, and the stage is drawn before it.
    expect(css).toMatch(/\.w-stage \{[^}]*order: 1/);
    expect(css).toMatch(/\.w-panel \{[^}]*order: 2/);
  });

  it('opens the list over the page from the line atop on a phone, and closes it on a screen', async () => {
    render(<Page report={await make()} />);
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

  it('keeps the screen in view marked in the list, one at a time', async () => {
    render(<Page report={await make()} />);

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

  it('keeps the list, Prev, Next, J and K to the screens with a language left, and says done on a walk with none', async () => {
    render(<Page report={await make(done)} />);
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

  it('keeps a screen answered while in view until the person moves, so a reason can be typed', async () => {
    render(<Page report={await make()} />);
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

  it('moves on to the next screen left when it is turned on over an answered screen', async () => {
    render(<Page report={await make(done)} />);
    go('3-settings');

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(number()).toBe('4');
  });

  it('opens an answered screen the address names with the toggle off, and says so', async () => {
    localStorage.setItem('credo-walks-only-unanswered', 'yes');
    window.history.replaceState(null, '', '#admin-setup-3-settings');

    render(<Page report={await make(done)} />);

    expect(number()).toBe('3');
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    expect(document.querySelector('.w-moved')!.textContent).toBe(
      'That screen is answered, so every screen is shown.',
    );
    hashTo('#admin-setup-4-saved');
    expect(document.querySelector('.w-moved')!.textContent).toBe('');
  });

  it('is kept in the browser, off when the page first opens', async () => {
    const { unmount } = render(<Page report={await make()} />);
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Only unanswered'));
    unmount();

    render(<Page report={await make()} />);

    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(true);
  });

  it('with none left, says so, with the last action and a way back to every screen', async () => {
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
    render(<Page report={await make(everything)} />);

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();
    expect(
      within(document.querySelector<HTMLElement>('.w-done')!).getByText('Copy my answers'),
    ).toBeTruthy();
    fireEvent.click(button('Show all screens'));
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(false);
    expect(document.querySelectorAll('.w-screen')).toHaveLength(1);
  });

  it('with none left, offers Share, off while nothing is chosen, on a partner’s page', async () => {
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
    render(<Page report={await make(everything)} partner />);

    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(screen.getAllByRole('button', { name: 'Share' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();
    expect(document.querySelector<HTMLButtonElement>('.w-done .w-next')!.disabled).toBe(true);
  });

  it('offers Copy, off while nothing is chosen, from the empty place on the human’s page', async () => {
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
    render(<Page report={await make(everything)} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));

    expect(document.querySelector<HTMLButtonElement>('.w-done .w-next')!.disabled).toBe(true);
  });
});

describe('a partner’s page', () => {
  const human = yes(...both('1-sign-in'));
  const mine = yes(...both('2-sign-in-refused', '@p1'));

  it('counts a screen answered when that partner answered it, and the human’s answers mark nothing there', async () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={await make({ ...human, ...mine })} partner />);

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

  it('follows the label kept in the browser as it is typed, and reads next unanswered by it', async () => {
    render(<Page report={await make({ ...human, ...mine })} partner />);
    const label = screen.getByLabelText('Label from the invite');

    fireEvent.change(label, { target: { value: 'p1' } });

    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    fireEvent.change(label, { target: { value: 'p2' } });
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
    expect(button('Next: English')).toBeTruthy();
  });

  it('reads the human’s page by the human’s answers alone', async () => {
    render(<Page report={await make({ ...human, ...mine })} />);

    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(number()).toBe('2');
    expect(document.querySelector('.w-partners')!.textContent).not.toContain('Recorded');
  });
});

describe('what the review found', () => {
  const allOf = async (walkId: string) => {
    const walk = (await make({}, WALKS.slice(0, 2))).walks.find((one) => one.id === walkId)!;
    return Object.fromEntries(
      walk.screens.flatMap((one) =>
        (['vi', 'en'] as const).map((language) => [
          `${walkId}:${one.id}:${language}`,
          {
            answer: 'yes' as const,
            on: '2026-10-29',
            reason: '',
            words: one.languages[language].words,
          },
        ]),
      ),
    );
  };
  const every = () =>
    yes(
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

  it('opens on the first screen waiting when the address has a stray percent sign, at the start and on a change', async () => {
    window.history.replaceState(null, '', '#100%');
    render(<Page report={await make()} />);
    expect(number()).toBe('1');

    hashTo('#50%');

    expect(number()).toBe('1');
  });

  it('opens the first screen waiting elsewhere, and says so, when a walk is opened with nothing left in it under only unanswered', async () => {
    localStorage.setItem('credo-walks-only-unanswered', 'yes');
    window.history.replaceState(null, '', '#operator-setup');

    render(<Page report={await make(await allOf('operator-setup'), WALKS.slice(0, 2))} />);

    expect(document.querySelector('.w-walk')!.id).toBe('admin-setup');
    expect(screen.getByLabelText<HTMLInputElement>('Only unanswered').checked).toBe(true);
    expect(document.querySelector('.w-moved')!.textContent).toBe(
      'Nothing is left to answer in that walk, so this is the first screen waiting.',
    );
  });

  it('does the same from the walk’s card on the map', async () => {
    localStorage.setItem('credo-walks-only-unanswered', 'yes');
    render(<Page report={await make(await allOf('operator-setup'), WALKS.slice(0, 2))} />);
    fireEvent.click(
      within(screen.getByRole('region', { name: 'The map of the day' })).getAllByRole('link')[0],
    );

    expect(document.querySelector('.w-walk')!.id).toBe('admin-setup');
    expect(document.querySelector('.w-moved')!.textContent).toContain('Nothing is left');
  });

  it('shows the place with nothing left, and no hidden screen, when every walk is answered', async () => {
    localStorage.setItem('credo-walks-only-unanswered', 'yes');
    window.history.replaceState(null, '', '#admin-setup');

    render(<Page report={await make(every())} />);

    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();
    expect(document.querySelector('.w-moved')).toBeNull();
  });

  it('leaves Y, N and L alone while no screen shows', async () => {
    render(<Page report={await make(every())} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));
    expect(screen.getByRole('heading', { name: 'Nothing left to answer' })).toBeTruthy();

    key('y');
    key('n');
    key('l');

    expect(document.querySelector('.w-tocopy')!.textContent).toBe('none chosen yet');
    fireEvent.click(button('Show all screens'));
    expect(place()).toContain('Tiếng Việt');
  });

  it('keeps a screen in view after Yes for both languages under only unanswered, until the person moves', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));

    fireEvent.click(button(/^Yes for both languages/));

    expect(items()).toContain('#admin-setup-1-sign-in');
  });

  it('drops a screen answered in view from the list once the address moves the person on', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(screen.getByLabelText('Only unanswered'));
    key('y');
    key('l');
    key('y');
    expect(items()).toContain('#admin-setup-1-sign-in');

    hashTo('#admin-setup-2-sign-in-refused');

    expect(number()).toBe('2');
    expect(items()).not.toContain('#admin-setup-1-sign-in');
  });

  it('answers only the walk in view from a walk’s Yes to the unanswered', async () => {
    render(<Page report={await make({}, WALKS.slice(0, 2))} />);
    expect(number()).toBe('1');
    expect(document.querySelector('.w-walk')!.id).toBe('admin-setup');

    const mine = WALKS[0].screens.length * 2;
    const other = WALKS[1].screens.length * 2;

    fireEvent.click(
      within(document.querySelector<HTMLElement>('.w-rail-walk[open]')!).getByRole('button', {
        name: `Yes to ${mine} unanswered in this walk`,
      }),
    );

    expect(document.querySelector('.w-note')!.textContent).toBe(`${mine} answered Yes · Undo`);
    expect(
      screen.getByRole('button', { name: `Yes to ${other} unanswered on the page` }),
    ).toBeTruthy();
  });
});
