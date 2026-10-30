import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const plain = await make();
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

const shared = async () => {
  const written: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
  });
  await act(() => {
    fireEvent.click(document.querySelector('.w-send .w-share')!);
    return Promise.resolve();
  });
  Reflect.deleteProperty(navigator, 'clipboard');
  return written.join('\n');
};
const tocopy = () => document.querySelector('.w-tocopy')!.textContent;
const post = (label: string, ...entries: ReturnType<typeof entryOf>[]) =>
  shareText(
    build,
    label,
    entries.map((one) => ({ ...one, number: 1, sentence: 'x', language: 'Tiếng Việt' })),
  );
const labelBox = () => screen.getByLabelText('Label from the invite');
const BULK = /^Yes to \d+ unanswered on the page$/;

afterEach(() => localStorage.clear());

describe('the panel answers both languages', () => {
  it('draws the language shown with Yes and No, and the other with its mark and a button that draws it', async () => {
    render(<Page report={await make()} />);

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

  it('shows the other language’s mark as it is answered', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(button('Show in English'));
    yes();
    fireEvent.click(button('Show in Tiếng Việt'));

    expect(document.querySelector('.w-other .w-mark')!.getAttribute('data-mark')).toBe('yes');
  });
});

describe('one action stands out', () => {
  const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');

  it('is Yes and No while the language drawn waits', async () => {
    render(<Page report={await make()} />);

    expect(action()).toBe('answer');
    expect(css).toMatch(/\.w-walk\[data-action='answer'\] \.w-big \.w-face \{[^}]*var\(--blue\)/);
  });

  it('is the reason box after a No, until a reason is typed, and then Next unanswered', async () => {
    render(<Page report={await make()} />);

    fireEvent.click(screen.getByLabelText('No'));
    expect(action()).toBe('reason');
    expect(screen.getByLabelText('Reason for the No')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Reason for the No'), {
      target: { value: 'too small' },
    });

    expect(action()).toBe('next');
    expect(css).toMatch(/\.w-walk\[data-action='next'\] \.w-moves \.w-next:not\(:disabled\)/);
  });

  it('opens the reason box after a No, by a click or by N, and leaves the focus where it was', async () => {
    render(<Page report={await make()} />);
    const reason = () => screen.queryByLabelText('Reason for the No');
    expect(reason()).toBeNull();

    screen.getByLabelText('Yes').focus();
    fireEvent.click(screen.getByLabelText('No'));
    expect(reason()).toBeTruthy();
    expect(document.activeElement).not.toBe(reason());
    expect(screen.getByText('A reason for the No is needed: the box is below.')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Yes'));
    expect(reason()).toBeNull();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(reason()).toBeTruthy();
    expect(document.activeElement).not.toBe(reason());
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'y' });
    expect(reason()).toBeNull();
  });

  it('is Next unanswered, naming where it goes, once answered', async () => {
    render(<Page report={await make()} />);

    yes();

    expect(action()).toBe('next');
    expect(button('Next: English')).toBeTruthy();
    fireEvent.click(button('Show in English'));
    yes();
    expect(button('Next unanswered: screen 2')).toBeTruthy();
  });

  it('is Copy my answers on the human’s page when nothing waits, with the count', async () => {
    render(<Page report={await make(everything())} />);

    expect(action()).toBe('done');
    expect(document.querySelector('.w-all')!.textContent).toBe('All 18 answered');
    expect(
      within(document.querySelector<HTMLElement>('.w-where')!).getByText('Copy my answers'),
    ).toBeTruthy();
    expect(
      within(document.querySelector<HTMLElement>('.w-where')!).getByRole<HTMLButtonElement>(
        'button',
        { name: 'Copy my answers' },
      ).disabled,
    ).toBe(true);
    expect(css).toMatch(/\.w-send\[data-action='done'\]\[data-partner='false'\] \.w-copy/);
  });

  it('is Share on a partner’s page when that partner has answered every screen', async () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={await make(everything('@p1'))} partner />);

    expect(action()).toBe('done');
    expect(
      within(document.querySelector<HTMLElement>('.w-where')!).getByRole<HTMLButtonElement>(
        'button',
        { name: 'Share' },
      ).disabled,
    ).toBe(true);
    expect(css).toMatch(/\.w-send\[data-action='done'\]\[data-partner='true'\] \.w-share/);
  });

  it('is not done on a partner’s page while the human alone has answered', async () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={await make(everything())} partner />);

    expect(action()).toBe('answer');
  });
});

describe('the last action, from the place nothing waits', () => {
  it('copies on the human’s page when the answers are chosen here', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    render(<Page report={await make()} />);
    fireEvent.click(rail().getByRole('button', { name: 'Yes to 18 unanswered on the page' }));
    expect(action()).toBe('done');

    await act(() => {
      fireEvent.click(
        within(document.querySelector<HTMLElement>('.w-where')!).getByRole('button', {
          name: 'Copy my answers',
        }),
      );
      return Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Copied: 18 answers' })).toBeTruthy();
    Reflect.deleteProperty(navigator, 'clipboard');
  });
});

describe('many at once', () => {
  it('answers Yes for both languages of this screen, showing its count, off at none', async () => {
    render(<Page report={await make()} />);
    const both = () => button(/^Yes for both languages/) as HTMLButtonElement;

    expect(both().textContent).toBe('Yes for both languages (2)');
    fireEvent.click(both());

    expect(note()).toBe('2 answered Yes · Undo');
    expect(both().textContent).toBe('Yes for both languages (0)');
    expect(both().disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
  });

  it('counts only what it may answer: a choice made stays', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(screen.getByLabelText('No'));

    expect((button(/^Yes for both languages/) as HTMLButtonElement).textContent).toBe(
      'Yes for both languages (1)',
    );
    fireEvent.click(button(/^Yes for both languages/));
    expect(screen.getByLabelText<HTMLInputElement>('No').checked).toBe(true);
  });

  it('answers the unanswered of a walk and of all walks, and clears the choices made, each with its count', async () => {
    render(<Page report={await make()} />);

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

  it('puts back exactly the choices before the last bulk action, and ends at the next change', async () => {
    render(<Page report={await make()} />);
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

  it('is on a partner’s page too, reading that partner’s answers', async () => {
    localStorage.setItem('credo-walks-label', 'p1');
    render(
      <Page
        report={await make({
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
  it('turns Clear off with no choice to take back, and tells the bar whose page it is', async () => {
    const { unmount } = render(<Page report={await make()} />);

    expect(
      rail().getByRole<HTMLButtonElement>('button', { name: 'Clear 0 choices on the page' })
        .disabled,
    ).toBe(true);
    expect(document.querySelector('.w-send')!.getAttribute('data-partner')).toBe('false');
    unmount();
    render(<Page report={await make()} partner />);
    expect(document.querySelector('.w-send')!.getAttribute('data-partner')).toBe('true');
  });
});

describe('paste last answers', () => {
  const lines = (...ids: string[]) =>
    blockText(
      build,
      ids.map((id) => entryOf(id, 'vi')),
    );

  it('says what it will fill and what it leaves, then fills, and Undo takes it back', async () => {
    render(<Page report={await make()} />);
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

  it('refuses a partner’s post whole on the human’s page, with nothing to fill', async () => {
    render(<Page report={await make()} />);
    const post = shareText(build, 'p1', [
      { ...entryOf('1-sign-in', 'vi'), number: 1, sentence: 'x', language: 'Tiếng Việt' },
    ]);

    paste(post);

    expect(document.querySelector('.w-fill-says')!.textContent).toContain('partner’s post');
    expect((button('Fill') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('Cancel'));
    expect(screen.queryByLabelText('Paste an earlier block or Share message')).toBeNull();
  });

  it('fills nothing from an empty box, and says nothing', async () => {
    render(<Page report={await make()} />);
    fireEvent.click(button('Paste last answers…'));

    expect(document.querySelector('.w-fill-says')!.textContent).toBe('');
    expect((button('Fill') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('Paste last answers…'));
    expect(screen.queryByLabelText('Paste an earlier block or Share message')).toBeNull();
  });

  it('on a partner’s page, keeps the paste’s label when none was kept', async () => {
    render(<Page report={await make()} partner />);
    const post = shareText(build, 'p7', [
      { ...entryOf('1-sign-in', 'vi'), number: 1, sentence: 'x', language: 'Tiếng Việt' },
    ]);

    paste(post);
    fireEvent.click(button('Fill'));

    expect(screen.getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('p7');
    expect(localStorage.getItem('credo-walks-label')).toBe('p7');
    expect(screen.getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
  });
});

describe('what the review found', () => {
  const noOnRecord = () => make(Object.fromEntries([yesOnNo('1-sign-in', 'vi', '@p1')]));
  function yesOnNo(id: string, language: 'vi' | 'en', label: string) {
    return [
      `admin-setup:${id}:${language}${label}`,
      {
        answer: 'no' as const,
        on: '2026-10-29',
        reason: 'too small',
        words: screenOf(id).languages[language].words,
      },
    ] as const;
  }

  it('keeps Yes to the unanswered off on a partner’s page until a label is kept, so no yes goes over their No on record', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    render(<Page report={await noOnRecord()} partner />);
    const names = [
      /^Yes to \d+ unanswered on the page$/,
      /^Yes to \d+ unanswered in this walk$/,
      /^Yes for both languages/,
    ];

    for (const name of names) expect((button(name) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button(names[0]));
    fireEvent.change(screen.getByLabelText('Label from the invite'), { target: { value: 'p1' } });
    expect((button(names[0]) as HTMLButtonElement).disabled).toBe(false);
    expect(button('Share')).toHaveProperty('disabled', true);
    expect(written).toHaveLength(0);
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('puts the label back as it was when a paste that kept it is undone', async () => {
    render(<Page report={await make()} partner />);
    paste(
      shareText(build, 'p7', [
        { ...entryOf('1-sign-in', 'vi'), number: 1, sentence: 'x', language: 'Tiếng Việt' },
      ]),
    );
    fireEvent.click(button('Fill'));
    expect(screen.getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('p7');

    fireEvent.click(button('Undo'));

    expect(screen.getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('');
    expect(localStorage.getItem('credo-walks-label')).toBe('');
  });

  it('asks for the reason of a No before it offers the copy, even on the last language waiting', async () => {
    const all = Object.fromEntries(
      IDS.flatMap((id) => [
        yesOn(id, 'vi'),
        ...(id === '9-unknown-company' ? [] : [yesOn(id, 'en')]),
      ]),
    );
    render(<Page report={await make(all)} />);
    fireEvent.click(button('Show in English'));

    fireEvent.click(screen.getByLabelText('No'));

    expect(action()).toBe('reason');
  });

  it('keeps asking when a screen is asked again after a yes', async () => {
    const moved = await make({
      'admin-setup:1-sign-in:vi': { answer: 'yes', on: '2026-10-29', reason: '', words: ['moved'] },
    });
    render(<Page report={moved} />);

    expect(action()).toBe('answer');
  });

  it('runs Share, not Copy, from the place nothing waits on a partner’s page', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    localStorage.setItem('credo-walks-label', 'p1');
    render(<Page report={await make()} partner />);
    fireEvent.click(rail().getByRole('button', { name: 'Yes to 18 unanswered on the page' }));
    expect(action()).toBe('done');

    await act(() => {
      fireEvent.click(within(document.querySelector<HTMLElement>('.w-where')!).getByText('Share'));
      return Promise.resolve();
    });

    expect(written.at(-1)).toContain('By: p1');
    Reflect.deleteProperty(navigator, 'clipboard');
  });
});

describe('the label judged again', () => {
  it('takes back what a bulk action answered when the label typed turns out to have answered it already', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    const label = screen.getByLabelText('Label from the invite');

    fireEvent.change(label, { target: { value: 'p' } });
    fireEvent.click(rail().getByRole('button', { name: /^Yes to \d+ unanswered on the page$/ }));
    fireEvent.change(label, { target: { value: 'p1' } });
    fireEvent.blur(label);

    expect(note()).toBe('1 answer taken back: p1 had answered them already');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await act(() => {
      fireEvent.click(document.querySelector('.w-send .w-share')!);
      return Promise.resolve();
    });
    expect(written.join('\n')).not.toContain('admin-setup:1-sign-in:vi | yes');
    expect(written.join('\n')).toContain('admin-setup:2-sign-in-refused:vi | yes');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('leaves what was answered by hand, and what the new label has not answered', async () => {
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    const label = screen.getByLabelText('Label from the invite');
    fireEvent.change(label, { target: { value: 'p' } });
    yes();
    fireEvent.click(button(/^Yes for both languages/));
    fireEvent.change(label, { target: { value: 'p2' } });
    fireEvent.blur(label);

    expect(note()).toBe('1 answered Yes · Undo');
  });

  it('judges the label once it is left, never while it is typed through another partner’s', async () => {
    localStorage.setItem('credo-walks-label', 'p2');
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.click(rail().getByRole('button', { name: BULK }));
    expect(tocopy()).toBe('18 ready to copy');
    fireEvent.click(button('change'));
    for (const typed of ['', 'p', 'p1', 'p12'])
      fireEvent.change(labelBox(), { target: { value: typed } });
    fireEvent.blur(labelBox());

    expect(tocopy()).toBe('18 ready to copy');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('judges the label when Share is pressed with the box still open', async () => {
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.change(labelBox(), { target: { value: 'p' } });
    fireEvent.click(rail().getByRole('button', { name: BULK }));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });

    const text = await shared();

    expect(text).not.toContain('admin-setup:1-sign-in:vi | yes');
    expect(text).toContain('admin-setup:2-sign-in-refused:vi | yes');
    expect(note()).toBe('1 answer taken back: p1 had answered them already');
  });

  it('judges nothing by a label that is not one yet', async () => {
    render(<Page report={await make()} partner />);
    paste(post('p1', entryOf('1-sign-in', 'vi')));
    fireEvent.click(button('Fill'));
    fireEvent.change(labelBox(), { target: { value: '' } });
    fireEvent.blur(labelBox());

    expect(tocopy()).toBe('1 ready to copy');
  });

  it('does not share a paste’s answers under another label than the one they were filled under', async () => {
    render(<Page report={await make()} partner />);
    paste(post('p1', entryOf('1-sign-in', 'vi')));
    fireEvent.click(button('Fill'));
    fireEvent.change(labelBox(), { target: { value: 'p2' } });

    expect(await shared()).not.toContain('admin-setup:1-sign-in:vi | yes');
    expect(note()).toBe('1 answer taken back: p2 had answered them already');
  });

  it('keeps a paste’s answers when the label is left as the paste had it', async () => {
    render(<Page report={await make()} partner />);
    paste(post('p1', entryOf('1-sign-in', 'vi')));
    fireEvent.click(button('Fill'));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(tocopy()).toBe('1 ready to copy');
  });

  it('judges a bulk answer made before a reload when the label changes after it', async () => {
    localStorage.setItem('credo-walks-label', 'p');
    const report = await make(Object.fromEntries([yesOnNoRecord()]));
    const { unmount } = render(<Page report={report} partner />);
    fireEvent.click(rail().getByRole('button', { name: BULK }));
    unmount();

    render(<Page report={report} partner />);
    fireEvent.click(button('change'));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });

    expect(await shared()).not.toContain('admin-setup:1-sign-in:vi | yes');
  });

  it('forgets the kept keys of choices that are gone', async () => {
    localStorage.setItem('credo-walks-label', 'p');
    localStorage.setItem('credo-walks-made', JSON.stringify({ 'admin-setup:1-sign-in:vi': null }));
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.click(button('change'));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(note()).toBe('');
  });

  it('reads only a label or none from what the browser kept, and works when it holds nonsense', async () => {
    localStorage.setItem('credo-walks-label', 'p');
    const report = await make(Object.fromEntries([yesOnNoRecord()]));
    const { unmount } = render(<Page report={report} partner />);
    fireEvent.click(rail().getByRole('button', { name: BULK }));
    unmount();
    const kept = JSON.parse(localStorage.getItem('credo-walks-made')!) as Record<string, unknown>;
    localStorage.setItem(
      'credo-walks-made',
      JSON.stringify({ ...kept, 'admin-setup:2-sign-in-refused:vi': 7 }),
    );
    render(<Page report={report} partner />);
    fireEvent.click(button('change'));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(note()).toBe('1 answer taken back: p1 had answered them already');
    cleanup();
    localStorage.setItem('credo-walks-made', '{not json');
    render(<Page report={report} partner />);
    expect(tocopy()).toMatch(/ready to copy$/);
  });

  it('leaves a screen answered by hand when a bulk action passed over it and the new label has answered it', async () => {
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.change(labelBox(), { target: { value: 'p' } });
    yes();
    fireEvent.click(button(/^Yes for both languages/));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(tocopy()).toBe('2 ready to copy');
  });
});

describe('what the keys do in the label box', () => {
  it('answers nothing and moves nothing for a key typed there', async () => {
    render(<Page report={await make()} partner />);
    for (const typed of ['n', 'y', 'j', 'l']) fireEvent.keyDown(labelBox(), { key: typed });

    expect(tocopy()).toBe('none chosen yet');
    expect(document.querySelector('.w-screen .w-number')?.textContent).toBe('1');
  });
});

describe('Undo of a bulk action and the label', () => {
  it('after Undo, a new label takes nothing back and says nothing', async () => {
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.change(labelBox(), { target: { value: 'p' } });
    fireEvent.click(rail().getByRole('button', { name: BULK }));
    fireEvent.click(button('Undo'));
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(note()).toBe('');
  });

  it('after a bulk Yes is changed by hand, a new label that had answered that screen leaves the hand’s No', async () => {
    render(<Page report={await make(Object.fromEntries([yesOnNoRecord()]))} partner />);
    fireEvent.change(labelBox(), { target: { value: 'p' } });
    fireEvent.click(button(/^Yes for both languages/));
    fireEvent.click(screen.getByLabelText('No'));
    fireEvent.change(screen.getByLabelText('Reason for the No'), {
      target: { value: 'too small' },
    });
    fireEvent.change(labelBox(), { target: { value: 'p1' } });
    fireEvent.blur(labelBox());

    expect(tocopy()).toBe('2 ready to copy');
  });
});

function yesOnNoRecord() {
  return [
    'admin-setup:1-sign-in:vi@p1',
    {
      answer: 'no' as const,
      on: '2026-10-29',
      reason: 'too small',
      words: screenOf('1-sign-in').languages.vi.words,
    },
  ] as const;
}
