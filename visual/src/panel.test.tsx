import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Answers } from './answers';
import { blockText } from './block';
import { Page } from './page';
import { makeReport } from './report';
import { shareText } from './share';
import { PARTS, PEOPLE, WALKS } from './walks';

const make = (answers: Answers = {}) =>
  makeReport({
    walks: WALKS.slice(0, 1),
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: { branch: 'b', commit: 'c', changed: false, committedAt: new Date(0), home: '/h' },
    builtAt: new Date(0),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const plain = make();
const IDS = [
  '1-sign-in',
  '2-sign-in-refused',
  '3-settings',
  '4-saved',
  '5-language-menu',
  '6-service-down',
  '7-save-failed',
  '8-save-conflict',
  '9-unknown-company',
];
const screenOf = (id: string) => plain.walks[0].screens.find((one) => one.id === id)!;
const yesOn = (id: string, language: 'vi' | 'en', label = '') =>
  [
    `admin-setup:${id}:${language}${label}`,
    {
      answer: 'yes' as const,
      on: '2026-10-29',
      reason: '',
      words: screenOf(id).languages[language].words,
    },
  ] as const;
const everything = (label = ''): Answers =>
  Object.fromEntries(IDS.flatMap((id) => [yesOn(id, 'vi', label), yesOn(id, 'en', label)]));
const entryOf = (id: string, language: 'vi' | 'en', answer: 'yes' | 'no' = 'yes', reason = '') => ({
  key: `admin-setup:${id}:${language}`,
  answer,
  fingerprint: screenOf(id).languages[language].fingerprint,
  reason,
});
const build = { branch: 'an-earlier-piece', commit: 'abc123def', changed: false };

const action = () => document.querySelector('.w-walk')!.getAttribute('data-action');
const note = () => document.querySelector('.w-note')!.textContent;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const yes = () => fireEvent.click(screen.getByLabelText('Yes'));
const rail = () => within(document.querySelector<HTMLElement>('.w-rail')!);
const drawn = () => screen.getByRole('group', { name: /^Your answer in / });
const paste = (text: string) => {
  fireEvent.click(button('Paste last answers…'));
  fireEvent.change(screen.getByLabelText('Paste an earlier block or Share message'), {
    target: { value: text },
  });
};

afterEach(() => localStorage.clear());

describe('the panel answers both languages', () => {
  it('draws the language shown with Yes and No, and the other with its mark and a button that draws it', () => {
    render(<Page report={make()} />);

    expect(drawn().getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getAllByLabelText('Yes')).toHaveLength(1);
    const other = document.querySelector('.w-other')!;
    expect(other.querySelector('.w-mark')!.getAttribute('data-mark')).toBe('open');
    expect(other.textContent).toContain('English: not answered');

    fireEvent.click(button('Show in English'));

    expect(drawn().textContent).toContain('Your answer in English');
    expect(document.querySelector('.w-place')!.textContent).toContain('English');
    expect(screen.getByTitle('Screen 1 in English, PC 1280')).toBeTruthy();
    expect(document.querySelector('.w-other')!.textContent).toContain('Tiếng Việt: not answered');
    fireEvent.click(button('Show in Tiếng Việt'));
    expect(drawn().textContent).toContain('Your answer in Tiếng Việt');
  });

  it('shows the other language’s mark as it is answered', () => {
    render(<Page report={make()} />);
    fireEvent.click(button('Show in English'));
    yes();
    fireEvent.click(button('Show in Tiếng Việt'));

    expect(document.querySelector('.w-other .w-mark')!.getAttribute('data-mark')).toBe('yes');
  });
});

describe('one action stands out', () => {
  const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');

  it('is Yes and No while the language drawn waits', () => {
    render(<Page report={make()} />);

    expect(action()).toBe('answer');
    expect(css).toMatch(/\.w-walk\[data-action='answer'\] \.w-big \.w-face \{[^}]*var\(--teal\)/);
  });

  it('is the reason box after a No, until a reason is typed, and then Next unanswered', () => {
    render(<Page report={make()} />);

    fireEvent.click(screen.getByLabelText('No'));
    expect(action()).toBe('reason');
    expect(document.activeElement).toBe(screen.getByLabelText('Reason for the No'));
    fireEvent.change(screen.getByLabelText('Reason for the No'), {
      target: { value: 'too small' },
    });

    expect(action()).toBe('next');
    expect(css).toMatch(/\.w-walk\[data-action='next'\] \.w-moves \.w-next:not\(:disabled\)/);
  });

  it('is Next unanswered, naming where it goes, once answered', () => {
    render(<Page report={make()} />);

    yes();

    expect(action()).toBe('next');
    expect(button('Next: English')).toBeTruthy();
    fireEvent.click(button('Show in English'));
    yes();
    expect(button('Next unanswered: screen 2')).toBeTruthy();
  });

  it('is Copy my answers on the human’s page when nothing waits, with the count', () => {
    render(<Page report={make(everything())} />);

    expect(action()).toBe('done');
    expect(document.querySelector('.w-all')!.textContent).toBe('All 18 answered');
    expect(
      within(document.querySelector<HTMLElement>('.w-where')!).getByText('Copy my answers'),
    ).toBeTruthy();
    fireEvent.click(
      within(document.querySelector<HTMLElement>('.w-where')!).getByText('Copy my answers'),
    );
    expect(note()).toContain('Nothing chosen yet');
    expect(css).toMatch(/\.w-send\[data-action='done'\]\[data-partner='false'\] \.w-copy/);
  });

  it('is Share on a partner’s page when that partner has answered every screen', () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={make(everything('@p1'))} partner />);

    expect(action()).toBe('done');
    fireEvent.click(within(document.querySelector<HTMLElement>('.w-where')!).getByText('Share'));

    expect(note()).toBe('Nothing chosen yet: answer a screen first.');
    expect(css).toMatch(/\.w-send\[data-action='done'\]\[data-partner='true'\] \.w-share/);
  });

  it('is not done on a partner’s page while the human alone has answered', () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={make(everything())} partner />);

    expect(action()).toBe('answer');
  });
});

describe('many at once', () => {
  it('answers Yes for both languages of this screen, showing its count, off at none', () => {
    render(<Page report={make()} />);
    const both = () => button(/^Yes for both languages/) as HTMLButtonElement;

    expect(both().textContent).toBe('Yes for both languages (2)');
    fireEvent.click(both());

    expect(note()).toBe('2 answered Yes · Undo');
    expect(both().textContent).toBe('Yes for both languages (0)');
    expect(both().disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
  });

  it('counts only what it may answer: a choice made stays', () => {
    render(<Page report={make()} />);
    fireEvent.click(screen.getByLabelText('No'));

    expect((button(/^Yes for both languages/) as HTMLButtonElement).textContent).toBe(
      'Yes for both languages (1)',
    );
    fireEvent.click(button(/^Yes for both languages/));
    expect(screen.getByLabelText<HTMLInputElement>('No').checked).toBe(true);
  });

  it('answers the unanswered of a walk and of all walks, and clears the choices made, each with its count', () => {
    render(<Page report={make()} />);

    expect(
      rail().getByRole('button', { name: 'Yes to 18 unanswered on the page' }).textContent,
    ).toBe('Yes to 18');
    expect(
      rail().getByRole('button', { name: 'Yes to 18 unanswered in this walk' }).textContent,
    ).toBe('Yes to 18');
    yes();
    expect(rail().getByRole('button', { name: 'Yes to 17 unanswered on the page' })).toBeTruthy();
    expect(
      rail().getByRole<HTMLButtonElement>('button', { name: 'Clear 1 choices on the page' })
        .disabled,
    ).toBe(false);
    fireEvent.click(rail().getByRole('button', { name: 'Yes to 17 unanswered in this walk' }));

    expect(note()).toBe('17 answered Yes · Undo');
    expect(document.querySelector('.w-all')!.textContent).toBe('All 18 answered');
    expect(rail().getByRole('button', { name: 'Clear 18 choices on the page' })).toBeTruthy();

    fireEvent.click(rail().getByRole('button', { name: 'Clear 18 choices in this walk' }));

    expect(note()).toBe('18 choices cleared · Undo');
    expect(rail().getByRole('button', { name: 'Yes to 18 unanswered on the page' })).toBeTruthy();
  });

  it('puts back exactly the choices before the last bulk action, and ends at the next change', () => {
    render(<Page report={make()} />);
    yes();
    fireEvent.click(button(/^Yes for both languages/));
    expect(note()).toBe('1 answered Yes · Undo');

    fireEvent.click(button('Undo'));

    expect(note()).toBe('');
    expect(rail().getByRole('button', { name: 'Yes to 17 unanswered on the page' })).toBeTruthy();
    fireEvent.click(button(/^Yes for both languages/));
    expect(note()).toBe('1 answered Yes · Undo');
    fireEvent.click(screen.getByLabelText('No'));
    expect(note()).toBe('');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('is on a partner’s page too, reading that partner’s answers', () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(
      <Page
        report={make({
          ...everything(),
          ...Object.fromEntries([yesOn('2-sign-in-refused', 'vi', '@p1')]),
        })}
        partner
      />,
    );

    expect(rail().getByRole('button', { name: 'Yes to 17 unanswered on the page' })).toBeTruthy();
    fireEvent.click(rail().getByRole('button', { name: 'Yes to 17 unanswered on the page' }));
    expect(note()).toBe('17 answered Yes · Undo');
  });
});

describe('counts that are off at none', () => {
  it('turns Clear off with no choice to take back, and tells the bar whose page it is', () => {
    const { unmount } = render(<Page report={make()} />);

    expect(
      rail().getByRole<HTMLButtonElement>('button', { name: 'Clear 0 choices on the page' })
        .disabled,
    ).toBe(true);
    expect(document.querySelector('.w-send')!.getAttribute('data-partner')).toBe('false');
    unmount();
    render(<Page report={make()} partner />);
    expect(document.querySelector('.w-send')!.getAttribute('data-partner')).toBe('true');
  });
});

describe('paste last answers', () => {
  const lines = (...ids: string[]) =>
    blockText(
      build,
      ids.map((id) => entryOf(id, 'vi')),
    );

  it('says what it will fill and what it leaves, then fills, and Undo takes it back', () => {
    render(<Page report={make()} />);
    const stale = `${lines('1-sign-in', '3-settings')}\nadmin-setup:9-gone:vi | yes | 0123456789ab\nnot a line | at all`;

    paste(stale);

    expect(document.querySelector('.w-fill-says')!.textContent).toBe(
      'Fills 2 of 3; 1 not on this page',
    );
    fireEvent.click(button('Fill'));

    expect(note()).toBe('2 filled · Undo');
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
    expect(screen.queryByLabelText('Paste an earlier block or Share message')).toBeNull();
    fireEvent.click(button('Undo'));
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(false);
  });

  it('refuses a partner’s post whole on the human’s page, with nothing to fill', () => {
    render(<Page report={make()} />);
    const post = shareText(build, 'p1', [
      { ...entryOf('1-sign-in', 'vi'), number: 1, sentence: 'x', language: 'Tiếng Việt' },
    ]);

    paste(post);

    expect(document.querySelector('.w-fill-says')!.textContent).toContain('partner’s post');
    expect((button('Fill') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('Cancel'));
    expect(screen.queryByLabelText('Paste an earlier block or Share message')).toBeNull();
  });

  it('fills nothing from an empty box, and says nothing', () => {
    render(<Page report={make()} />);
    fireEvent.click(button('Paste last answers…'));

    expect(document.querySelector('.w-fill-says')!.textContent).toBe('');
    expect((button('Fill') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('Paste last answers…'));
    expect(screen.queryByLabelText('Paste an earlier block or Share message')).toBeNull();
  });

  it('on a partner’s page, keeps the paste’s label when none was kept', () => {
    render(<Page report={make()} partner />);
    const post = shareText(build, 'p7', [
      { ...entryOf('1-sign-in', 'vi'), number: 1, sentence: 'x', language: 'Tiếng Việt' },
    ]);

    paste(post);
    fireEvent.click(button('Fill'));

    expect(screen.getByLabelText<HTMLInputElement>('Your label').value).toBe('p7');
    expect(localStorage.getItem('credo-walks-label')).toBe('p7');
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
  });
});
