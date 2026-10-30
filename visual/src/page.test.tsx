import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREDO_COLOUR } from '@credo/shared';
import { SCREENS } from '@credo/ui/mock';
import { DICTIONARIES } from '@credo/ui/words';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answers } from './answers';
import { fingerprintsOf } from './choices';
import { Page } from './page';
import { makeReport, type Report } from './report';
import { PARTS, PEOPLE, WALKS } from './walks';

const source = {
  branch: 'a-piece',
  commit: 'abc123def',
  changed: false,
  committedAt: new Date('2026-10-27T18:59:00Z'),
  home: '/h',
};

/** The page as piece 1's walk draws it; the whole set of walks is held by its own test. */
const reportWith = (
  answers: Answers = {},
  changed = false,
  walks = WALKS.slice(0, 1),
): Promise<Report> =>
  makeReport({
    walks,
    people: PEOPLE,
    parts: PARTS,
    mock: SCREENS,
    answers,
    source: { ...source, changed },
    builtAt: new Date('2026-10-27T19:30:00Z'),
    readWords: (state, language) => [`text: ${state.id} ${language}`],
  });

const answer = (kind: 'yes' | 'no', language: 'vi' | 'en', number: string, words?: string[]) =>
  [
    `admin-setup:${number}:${language}`,
    {
      answer: kind,
      on: '2026-10-29',
      reason: kind === 'no' ? 'the message is too small' : '',
      words: words ?? [`text: ${number === '1-sign-in' ? 'empty' : 'x'} ${language}`],
    },
  ] as const;

/** The section of one walk screen, opened through the list when it is not the one in view. */
const card = (id: string) => {
  if (!document.querySelector(`#admin-setup-${id}`)) {
    fireEvent.click(document.querySelector(`a.w-rail-item[href="#admin-setup-${id}"]`)!);
  }
  return document.querySelector<HTMLElement>(`#admin-setup-${id}`)!;
};
/** Picks a language or the widths for the whole page. */
const pick = (legend: 'Language' | 'Show', label: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: legend })).getByLabelText(label));
/** A screen's answer, in the language the page shows. */
const panel = (id: string, language = 'Tiếng Việt') =>
  within(within(card(id)).getByRole('group', { name: `Your answer in ${language}` }));
const stateOf = (id: string) => card(id).querySelector('.w-state > span')!.textContent;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the walks page: the map', () => {
  it('The page opens on the map: the parts of the day across, the people down with their device; a built walk is a card with its title and its count of screens, and an empty cell is hatched', async () => {
    render(<Page report={await reportWith()} />);

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.slice(0, 3)).toEqual([
      'A business’s day in Credo',
      'The map of the day',
      'Set up the company: its name, colour and languages',
    ]);
    const map = screen.getByRole('region', { name: 'The map of the day' });
    for (const part of ['Set up', 'Staff', 'Stock', 'Orders', 'Delivery']) {
      expect(within(map).getByText(part)).toBeTruthy();
    }
    expect(within(map).getByText('The client’s admin').parentElement!.textContent).toContain('PC');
    expect(within(map).getByText('The driver').parentElement!.textContent).toContain('phone');
    const cell = within(map).getByRole('link');
    expect(cell.getAttribute('href')).toBe('#admin-setup');
    expect(cell.textContent).toContain('Set up the company: its name, colour and languages');
    expect(cell.textContent).toContain('9 screens');
    expect(cell.textContent).toContain('18 waiting');
    // One cell of twenty is filled; nineteen are hatched.
    expect(within(map).getAllByTitle('Not built yet')).toHaveLength(19);
  });

  it('puts the operator’s walk on its own row, above the client’s admin, with its nine screens and its questions', async () => {
    render(<Page report={await reportWith({}, false, WALKS.slice(0, 2))} />);

    const map = screen.getByRole('region', { name: 'The map of the day' });
    const [operator, admin] = within(map).getAllByRole('link');
    expect(operator.getAttribute('href')).toBe('#operator-setup');
    expect(operator.textContent).toContain('Make a client and send it its link');
    expect(operator.textContent).toContain('9 screens');
    expect(admin.getAttribute('href')).toBe('#admin-setup');
    expect(within(map).getByText('The operator').parentElement!.textContent).toContain('PC');
    expect(within(map).getAllByTitle('Not built yet')).toHaveLength(18);

    fireEvent.click(operator);
    const walk = document.querySelector('#operator-setup')!;
    const items = [
      ...document.querySelectorAll<HTMLAnchorElement>('a.w-rail-item[href^="#operator-setup-"]'),
    ];
    const seen = items.map((item) => {
      fireEvent.click(item);
      return [walk.querySelector('.w-number')!.textContent, walk.textContent] as const;
    });
    expect(seen.map(([number]) => number)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const text = seen.map(([, content]) => content).join(' ');
    expect(text).toContain('Would you know this is our own door, not a client’s?');
    expect(text).toContain('Does this say what to do?');
    fireEvent.click(admin);
    expect(document.querySelector('#admin-setup')!.textContent).toContain('Sign in');
    const question = [...document.querySelectorAll<HTMLElement>('#admin-setup .w-question')];
    expect(question).toHaveLength(1);
  });

  it('counts one screen in the singular', async () => {
    const report = await reportWith();
    report.walks[0].screens = report.walks[0].screens.slice(0, 1);

    render(<Page report={report} />);

    const cell = within(screen.getByRole('region', { name: 'The map of the day' })).getByRole(
      'link',
    );
    expect(cell.textContent).toContain('1 screen');
    expect(cell.textContent).not.toContain('1 screens');
  });
});

describe('the walks page: a walk', () => {
  it('Each walk shows its screens in number order, a screen that goes wrong tagged in place: each with its sentence in both languages and its one question', async () => {
    render(<Page report={await reportWith()} />);

    const walk = screen.getByRole('region', {
      name: 'Set up the company: its name, colour and languages',
    });
    const items = [...document.querySelectorAll<HTMLAnchorElement>('a.w-rail-item')];
    const seen = items.map((item) => {
      fireEvent.click(item);
      return [
        walk.querySelector('.w-number')!.textContent,
        walk.querySelector('.w-path')?.textContent ?? null,
      ];
    });
    expect(seen.map(([number]) => number)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(seen.map(([, tag]) => tag)).toEqual([
      null,
      'Goes wrong',
      null,
      null,
      null,
      'Goes wrong',
      'Goes wrong',
      'Goes wrong',
      'Goes wrong',
    ]);
    const last = walk.querySelector('#admin-setup-9-unknown-company')!;
    expect(last).toBeTruthy();
    const seventh = card('7-save-failed');
    expect(seventh.textContent).toContain('A save that failed, what was typed kept');
    expect(seventh.textContent).toContain('Lưu không thành công, nội dung đã nhập vẫn còn');
    expect(seventh.textContent).toContain(
      'Would the admin know the save did not happen, and that nothing typed is lost?',
    );
  });

  it('tags nothing when no screen of the walk goes wrong, in the walk and in the rail', async () => {
    const report = await reportWith();
    report.walks[0].screens = report.walks[0].screens.filter((s) => s.path === 'main');

    render(<Page report={report} />);

    for (const item of document.querySelectorAll<HTMLAnchorElement>('a.w-rail-item')) {
      fireEvent.click(item);
      expect(screen.queryByText('Goes wrong')).toBeNull();
    }
    expect(screen.queryByText('goes wrong')).toBeNull();
  });

  it('says the person and the width the walk is drawn at', async () => {
    render(<Page report={await reportWith()} />);

    expect(
      screen.getByText(
        /The client’s admin on a PC; every screen is drawn at PC 1280, tablet 768, phone 390 pixels/,
      ),
    ).toBeTruthy();
  });
});

describe('the walks page: the drawn screens', () => {
  it('Each piece-2 screen is drawn as a scene: the whole app on the fake at its address, inside its frame, with its steps done there', async () => {
    render(<Page report={await reportWith({}, false, WALKS.slice(3, 4))} />);

    // The page opens at the walk's first screen; the list moves to the second.
    fireEvent.click(document.querySelector('a.w-rail-item[href="#admin-staff-staff-2-add"]')!);
    const frame = screen.getByTitle<HTMLIFrameElement>('Screen 2 in Tiếng Việt, PC 1280');
    act(() => {
      fireEvent.load(frame);
    });
    const inner = frame.contentDocument!;

    // the app opens at `/staff/new`, signed in as the root, and its steps are done: the scene says
    // so when they end, which takes as long as the machine is loaded
    await waitFor(
      () => expect(inner.querySelector('[data-scene]')!.getAttribute('data-scene')).toBe('done'),
      { timeout: 20_000 },
    );
    expect(inner.body.textContent).toContain('Thêm nhân viên');
    expect(inner.documentElement.lang).toBe('vi');
    // its steps typed into the form inside the frame, as a person does
    expect(inner.querySelector<HTMLInputElement>('input[type=tel]')!.value).toBe('0909 123 456');
    expect(inner.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Mới vào làm.');
    // and nothing of it is drawn on the page itself
    expect(document.body.textContent).not.toContain('Thêm nhân viên');
  });

  const inFrame = (title: string) => {
    const frame = screen.getByTitle<HTMLIFrameElement>(title);
    act(() => {
      fireEvent.load(frame);
    });
    return frame.contentDocument!;
  };

  it('Each walk screen is drawn at PC 1280 alone to start, and at tablet 768 and phone 390 on request, in Vietnamese and in English, from the app’s own components', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.getAllByTitle(/^Screen \d in Tiếng Việt, /)).toHaveLength(1);
    expect(screen.getByTitle('Screen 1 in Tiếng Việt, PC 1280').getAttribute('width')).toBe('1280');
    pick('Show', 'All three');
    for (const [device, width] of [
      ['PC', '1280'],
      ['Tablet', '768'],
      ['Phone', '390'],
    ]) {
      const frames = screen.getAllByTitle(new RegExp(`, ${device} ${width}$`));
      expect(frames).toHaveLength(1);
      expect(frames[0].getAttribute('width')).toBe(width);
    }
    // Screen 7 is the mock's failed save: the settings with the error and what was typed.
    card('7-save-failed');
    const vi = inFrame('Screen 7 in Tiếng Việt, PC 1280');
    expect(vi.body.textContent).toContain('Chưa lưu được cài đặt.');
    expect(vi.documentElement.lang).toBe('vi');

    pick('Language', 'English');

    expect(screen.queryAllByTitle(/ in Tiếng Việt, /)).toHaveLength(0);
    expect(screen.getAllByTitle(/^Screen \d in English, /)).toHaveLength(3);
    const en = inFrame('Screen 7 in English, Tablet 768');
    expect(en.body.textContent).toContain('The settings were not saved.');
    expect((en.querySelector('input') as HTMLInputElement).value).toBe('Minh Phát Sài Gòn');
    expect(en.documentElement.lang).toBe('en');
    // Screen 8 is the mock's conflict: someone else saved first.
    card('8-save-conflict');
    expect(inFrame('Screen 8 in English, Phone 390').body.textContent).toContain(
      'Someone saved newer settings first.',
    );
    // Screen 1 is the sign-in in the company's name.
    card('1-sign-in');
    expect(inFrame('Screen 1 in English, Phone 390').body.textContent).toContain('Minh Phát');
  });

  /** The level-2 headings a scene's frame draws once its steps are done. */
  const sceneHeadings = async (title: string) => {
    const inner = inFrame(title);
    await waitFor(
      () => expect(inner.querySelector('[data-scene]')!.getAttribute('data-scene')).toBe('done'),
      { timeout: 20_000 },
    );
    return [...inner.querySelectorAll('h2')].map((heading) => heading.textContent);
  };
  const move = (name: '‹ Prev' | 'Next ›') => fireEvent.click(screen.getByRole('button', { name }));

  it('A move draws the new screen’s own picture, never the one shown before it: the operator’s screens 1, 2, 3, 2 and 1 by Next and Prev, at tablet in Tiếng Việt', async () => {
    render(<Page report={await reportWith({}, false, WALKS.slice(1, 2))} />);
    pick('Show', 'Tablet');
    const words = DICTIONARIES.vi.operator;
    const own = { 1: words.signIn, 2: words.newTitle, 3: words.madeTitle };

    expect(await sceneHeadings('Screen 1 in Tiếng Việt, Tablet 768')).toEqual([own[1]]);
    for (const [press, number] of [
      ['Next ›', 2],
      ['Next ›', 3],
      ['‹ Prev', 2],
      ['‹ Prev', 1],
    ] as const) {
      move(press);
      expect(await sceneHeadings(`Screen ${number} in Tiếng Việt, Tablet 768`)).toEqual([
        own[number],
      ]);
    }
  });

  it('A move draws the new screen’s own picture, never the one shown before it: the admin’s mock screens 4, 3, 2, 1 and 2 by Prev and Next, at PC in English', async () => {
    window.history.replaceState(null, '', '#admin-setup-4-saved');
    render(<Page report={await reportWith()} />);
    pick('Language', 'English');
    /** What the screen's first field holds: the settings' company name, or the sign-in's name. */
    const field = (number: number) =>
      inFrame(`Screen ${number} in English, PC 1280`).querySelector('input')!.value;

    expect(field(4)).toBe('Minh Phát Sài Gòn');
    for (const [press, number, held] of [
      ['‹ Prev', 3, 'Minh Phát'],
      ['‹ Prev', 2, 'root'],
      ['‹ Prev', 1, ''],
      ['Next ›', 2, 'root'],
    ] as const) {
      move(press);
      expect(field(number)).toBe(held);
    }
  });

  it('A move draws the new screen’s own picture across two walks: from the admin’s last screen to the operator’s first by Next, at phone in Tiếng Việt', async () => {
    window.history.replaceState(null, '', '#admin-setup-9-unknown-company');
    render(<Page report={await reportWith({}, false, WALKS.slice(0, 2))} />);
    pick('Show', 'Phone');
    // Loaded inside an async act: this screen's frame measures itself again just after its load.
    const unknown = screen.getByTitle<HTMLIFrameElement>('Screen 9 in Tiếng Việt, Phone 390');
    await act(() => {
      fireEvent.load(unknown);
      return Promise.resolve();
    });
    expect(unknown.contentDocument!.body.textContent).toContain(
      DICTIONARIES.vi.unknownClient.title,
    );

    move('Next ›');

    expect(await sceneHeadings('Screen 1 in Tiếng Việt, Phone 390')).toEqual([
      DICTIONARIES.vi.operator.signIn,
    ]);
  });

  it('A switch shows the screen in one language, Tiếng Việt first, at PC to start, at one width or all three, so each width in each language is one press away', async () => {
    render(<Page report={await reportWith()} />);
    const language = within(screen.getByRole('group', { name: 'Language' }));
    const show = within(screen.getByRole('group', { name: 'Show' }));
    const frames = () => [...document.querySelectorAll('iframe')];

    expect(language.getByLabelText<HTMLInputElement>('Tiếng Việt').checked).toBe(true);
    expect(show.getByLabelText<HTMLInputElement>('PC').checked).toBe(true);
    expect(show.getAllByRole('radio').map((radio) => radio.closest('label')!.textContent)).toEqual([
      'PC',
      'Tablet',
      'Phone',
      'All three',
    ]);
    for (const [device, width] of [
      ['PC', '1280'],
      ['Tablet', '768'],
      ['Phone', '390'],
    ]) {
      pick('Show', device);
      expect(frames()).toHaveLength(1);
      expect(frames().every((frame) => frame.getAttribute('width') === width)).toBe(true);
      expect(card('1-sign-in').querySelector('.w-frames')!.getAttribute('data-show')).toBe(
        device.toLowerCase(),
      );
    }

    pick('Language', 'English');

    expect(language.getByLabelText<HTMLInputElement>('English').checked).toBe(true);
    expect(screen.getAllByTitle(/^Screen \d in English, Phone 390$/)).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Your answer in English' })).toHaveLength(1);
    pick('Show', 'All three');
    expect(frames()).toHaveLength(3);
    expect(card('1-sign-in').querySelector('.w-frames')!.getAttribute('data-show')).toBe('all');
  });

  it('Shown together, a screen’s three widths sit widest first, each captioned with its device and width and no wider than it', async () => {
    render(<Page report={await reportWith()} />);
    pick('Show', 'All three');

    const figures = [...card('3-settings').querySelectorAll<HTMLElement>('figure')];

    expect(figures.map((figure) => figure.querySelector('figcaption')!.textContent)).toEqual([
      'PC 1280 px',
      'Tablet 768 px',
      'Phone 390 px',
    ]);
    expect(figures.map((figure) => figure.dataset['device'])).toEqual(['pc', 'tablet', 'phone']);
    expect(figures.map((figure) => figure.style.maxWidth)).toEqual(['1280px', '768px', '390px']);
  });

  it('A move brings the screen it opens to the top of the window, and a change of language or width does not move it', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<Page report={await reportWith()} />);

    const toTop = () =>
      scroll.mock.calls.filter(([where]) => typeof where === 'object' && where.block === 'start');
    pick('Show', 'All three');
    pick('Language', 'English');
    expect(toTop()).toHaveLength(0);

    card('5-language-menu');

    expect(toTop()).toHaveLength(1);
    expect(scroll.mock.contexts[scroll.mock.calls.indexOf(toTop()[0])]).toBe(
      document.querySelector('#admin-setup-5-language-menu'),
    );
  });

  it('scales a screen down to the room it has, and its box to the same', async () => {
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
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
    render(<Page report={await reportWith()} />);
    const box = () => document.querySelector<HTMLElement>('.w-scaled')!;

    expect(box().style.height).toBe('');
    width.mockReturnValue(640);
    height.mockReturnValue(500);
    act(() => watching.forEach((fit) => fit()));

    expect(box().style.height).toBe('250px');
    expect(box().firstElementChild!.getAttribute('style')).toContain('scale(0.5)');

    // Room to spare: the screen is never drawn larger than the device.
    width.mockReturnValue(3000);
    act(() => watching.forEach((fit) => fit()));

    expect(box().style.height).toBe('500px');
    expect(box().firstElementChild!.getAttribute('style')).toContain('scale(1)');
  });

  it('stops watching a size when it leaves', async () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Page report={await reportWith()} />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});

describe('the walks page: the rail', () => {
  it('A rail lists each walk’s screens in number order, one that goes wrong tagged, each with a mark for each language, and marks the screen in view', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([
            answer('yes', 'vi', '1-sign-in', ['text: empty vi']),
            answer('no', 'en', '2-sign-in-refused', ['text: failed en']),
            answer('yes', 'en', '6-service-down', ['text: old']),
          ]),
        )}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'The walks’ screens' });
    const items = [...nav.querySelectorAll<HTMLAnchorElement>('a.w-rail-item')];
    const marks = (index: number) =>
      [...items[index].querySelectorAll('.w-mark')].map((mark) => [
        mark.getAttribute('data-mark'),
        mark.querySelector('.w-sr')!.textContent,
      ]);

    expect(
      within(nav).getByText('Set up the company: its name, colour and languages'),
    ).toBeTruthy();
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      '#admin-setup-1-sign-in',
      '#admin-setup-2-sign-in-refused',
      '#admin-setup-3-settings',
      '#admin-setup-4-saved',
      '#admin-setup-5-language-menu',
      '#admin-setup-6-service-down',
      '#admin-setup-7-save-failed',
      '#admin-setup-8-save-conflict',
      '#admin-setup-9-unknown-company',
    ]);
    expect(items[0].textContent).toContain('Sign in, in the company’s name and colours');
    expect(marks(0)).toEqual([
      ['yes', 'Tiếng Việt: yes'],
      ['open', 'English: not answered'],
    ]);
    expect(marks(1)).toEqual([
      ['open', 'Tiếng Việt: not answered'],
      ['no', 'English: no'],
    ]);
    expect(items.map((item) => !!item.querySelector('.w-rail-wrong'))).toEqual([
      false,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(marks(5)[1]).toEqual(['again', 'English: asked again']);
    // A choice made on the page marks its screen at once, in the rail and on the screen.
    fireEvent.click(panel('3-settings').getByLabelText('No'));
    expect(marks(2)[0]).toEqual(['no', 'Tiếng Việt: no']);
    expect(
      card('3-settings').querySelector('.w-screen-head .w-mark')!.getAttribute('data-mark'),
    ).toBe('no');

    // The screen in view is marked, one at a time; a line opens its screen and takes the mark.
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(items[2].getAttribute('aria-current')).toBe('location');
    fireEvent.click(items[4]);
    expect(items[4].getAttribute('aria-current')).toBe('location');
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
  });
});

describe('the walks page: the answers', () => {
  it('Each drawn screen shows its language’s answer: not yet asked, a dated yes, or a "no" with its reason', async () => {
    const words = (language: string) => [`text: empty ${language}`];
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([
            answer('yes', 'vi', '1-sign-in', words('vi')),
            answer('no', 'en', '1-sign-in', words('en')),
          ]),
        )}
      />,
    );

    expect(stateOf('1-sign-in')).toBe('Answered yes on 2026-10-29.');
    expect(stateOf('3-settings')).toBe('Not answered yet.');
    pick('Language', 'English');
    expect(stateOf('1-sign-in')).toBe('Answered no on 2026-10-29: the message is too small');
  });

  it('A changed word asks again, showing the words before and now', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([answer('yes', 'en', '1-sign-in', ['text: old'])]),
        )}
      />,
    );
    pick('Language', 'English');

    const words = card('1-sign-in').querySelector<HTMLDetailsElement>('details.w-words')!;

    expect(stateOf('1-sign-in')).toBe(
      'Asked again: its words changed since the yes of 2026-10-29.',
    );
    expect(words.open).toBe(true);
    expect(within(words).getByText('Words before').nextElementSibling!.textContent).toBe(
      'text: old',
    );
    expect(within(words).getByText('Words now').nextElementSibling!.textContent).toBe(
      'text: empty en',
    );
  });

  it('The words each screen was read as are folded, in the page’s language', async () => {
    render(<Page report={await reportWith()} />);
    const words = () => card('7-save-failed').querySelector<HTMLDetailsElement>('details.w-words')!;

    expect(words().open).toBe(false);
    expect(words().querySelector('summary')!.textContent).toBe(
      'The screen’s words, as the build read them',
    );
    expect(words().querySelector('pre')!.textContent).toBe('text: save-failed vi');
    pick('Language', 'English');
    expect(words().querySelector('pre')!.textContent).toBe('text: save-failed en');
  });

  it('The list says on each walk what is left in it, and done when nothing is', async () => {
    const both = (id: string, now: string) => [
      answer('yes', 'vi', id, [`text: ${now} vi`]),
      answer('yes', 'en', id, [`text: ${now} en`]),
    ];
    render(<Page report={await reportWith(Object.fromEntries(both('1-sign-in', 'empty')))} />);

    expect(
      [...document.querySelectorAll('.w-rail-title > span')]
        .slice(0, 2)
        .map((one) => one.textContent),
    ).toEqual(['Set up the company: its name, colour and languages', '8 left']);
    expect(document.querySelector('#admin-setup-2-sign-in-refused')).toBeTruthy();
  });

  it('lists an answer whose screen left the walks, and counts its no', async () => {
    const gone: Answers = {
      'admin-setup:9-gone:vi': { answer: 'no', on: '2026-10-29', reason: 'too small', words: [] },
      'admin-setup:8-gone:en': { answer: 'yes', on: '2026-10-29', reason: '', words: [] },
    };
    render(<Page report={await reportWith(gone)} />);

    const section = screen.getByRole('region', { name: 'Answers whose screen left the walks' });

    expect(section.textContent).toContain('admin-setup:9-gone:vi: no on 2026-10-29, too small');
    expect(section.textContent).toContain('admin-setup:8-gone:en: yes on 2026-10-29');
    expect(section.textContent).not.toContain('yes on 2026-10-29,');
    expect(screen.getByRole('banner').textContent).toContain('1 no');
  });

  it('Each screen shows the partners’ answers by label; the human’s alone marks the screen and counts in the bar', async () => {
    const partner = (kind: 'yes' | 'no', words: string[] = ['text: empty vi']) => ({
      answer: kind,
      on: '2026-10-30',
      reason: kind === 'no' ? 'too small' : '',
      words,
    });
    render(
      <Page
        report={await reportWith({
          'admin-setup:1-sign-in:vi@p2': partner('no'),
          'admin-setup:1-sign-in:vi@p1': partner('yes'),
          'admin-setup:1-sign-in:vi@p3': partner('yes', ['text: old']),
        })}
      />,
    );

    const list = within(card('1-sign-in')).getByRole('list', { name: 'Partners’ answers' });

    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'p1: yes on 2026-10-30.',
      'p2: no on 2026-10-30: too small',
      'p3: asked again, its words changed since the yes of 2026-10-30.',
    ]);
    expect(stateOf('1-sign-in')).toBe('Not answered yet.');
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain('18 waiting');
    expect(screen.getByRole('banner').textContent).not.toMatch(/\d+ (no|yes)\b/);
  });

  it('A screen every partner answered yes, in both languages, still waits for the human: its marks stay open', async () => {
    const yes = (language: string): Answers => ({
      [`admin-setup:1-sign-in:${language}@p1`]: {
        answer: 'yes',
        on: '2026-10-30',
        reason: '',
        words: [`text: empty ${language}`],
      },
    });
    render(<Page report={await reportWith({ ...yes('vi'), ...yes('en') })} />);

    expect(
      [...card('1-sign-in').querySelectorAll('.w-screen-head .w-mark')].map((mark) =>
        mark.getAttribute('data-mark'),
      ),
    ).toEqual(['open', 'open']);
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
  });

  it('lists a partner’s answer whose screen left the walks, and counts it nowhere', async () => {
    const gone: Answers = {
      'admin-setup:9-gone:vi@p1': {
        answer: 'no',
        on: '2026-10-29',
        reason: 'too small',
        words: [],
      },
    };
    render(<Page report={await reportWith(gone)} />);

    expect(
      screen.getByRole('region', { name: 'Answers whose screen left the walks' }).textContent,
    ).toContain('admin-setup:9-gone:vi@p1: no on 2026-10-29, too small');
    expect(screen.getByRole('banner').textContent).not.toContain('1 no');
  });

  it('has no list of the gone when none is gone', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.queryByText('Answers whose screen left the walks')).toBeNull();
  });
});

describe('the walks page: its layout', () => {
  // jsdom lays nothing out, so the layout is read from its rules; the look is the human's.
  const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');
  /** A rule at the top level of the sheet, outside any media or container query. */
  const rule = (selector: string) =>
    new RegExp(`(?:^|\\n)${selector.replace(/[.[\]()+]/g, '\\$&')} \\{[^}]*\\}`).exec(css)![0];

  it('The page uses the whole width of the window and reads on a PC, a tablet and a phone: the rail at the side from 1000 pixels and a strip across the top below, the map in one column on a phone', () => {
    for (const selector of ['.w-main', '.w-desk', '.w-walks']) {
      expect(rule(selector), selector).not.toContain('max-width');
    }
    expect(rule('.w-main')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule('.w-desk')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule('.w-rail')).toContain('display: none');
    expect(css).toMatch(
      /@media \(min-width: 1000px\) \{\s*\.w-desk \{[^}]*grid-template-columns: 320px minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(/@media \(min-width: 1000px\) \{\s*\.w-rail,[^}]*position: sticky/);
    expect(rule(".w-rail[data-open='true']")).toContain('position: fixed');
    expect(css).toMatch(
      /@media \(max-width: 480px\) \{\s*\.w-map \{\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it('Beside its widths in a wide body, under them in a narrow one, each screen asks its question with Yes and No in the page’s language; the narrow one rides at the foot of the window', async () => {
    render(<Page report={await reportWith()} />);
    const grid = card('3-settings').querySelector('.w-screen-grid')!;
    const ask = within(grid.querySelector<HTMLElement>('.w-panel')!);

    expect([...grid.children].map((child) => child.className)).toEqual([
      'w-panel',
      'w-stage',
      'w-words',
    ]);
    expect(ask.getByText('Is this what an admin sets up first?')).toBeTruthy();
    expect(
      ask.getByRole('group', {
        name: 'Your answer in Tiếng Việt',
        description: 'Is this what an admin sets up first?',
      }),
    ).toBeTruthy();
    expect(css).toMatch(
      /@container screen \(min-width: 900px\) \{\s*\.w-screen-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\) 300px/,
    );
    expect(css).toMatch(
      /@container screen \(min-width: 900px\) \{[^@]*\.w-panel \{[^}]*grid-column: 2;[^}]*top: 16px/,
    );
    expect(rule('.w-panel')).toContain('position: sticky');
    expect(rule('.w-panel')).toContain('bottom: calc(var(--bar) + 8px)');
  });

  it('Shown together, a screen’s three widths share one scale: the PC’s across the top, the tablet’s and the phone’s under it, each column as wide as its device', () => {
    expect(css).toMatch(
      /@container stage \(min-width: 560px\) \{\s*\.w-frames\[data-show='all'\] \{\s*grid-template-columns: minmax\(0, 768fr\) minmax\(0, 390fr\) minmax\(0, 122fr\);/,
    );
    expect(css).toMatch(
      /\.w-frames\[data-show='all'\] \.w-frame\[data-device='pc'\] \{\s*grid-column: 1 \/ -1;/,
    );
  });

  it('Every control shows a focus ring, a radio’s on the face it lies under', () => {
    expect(rule('html.walks :focus-visible')).toContain('outline: 2px solid var(--focus)');
    expect(rule('.w-hide:focus-visible + .w-face')).toContain('outline: 2px solid var(--focus)');
  });

  it('The page’s one colour is the app’s own blue, with text on it, and on its tint, readable at AA in light and dark', () => {
    const value = (block: string, token: string) =>
      new RegExp(`${token}: (#[0-9a-f]{6})`).exec(block)![1];
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((at) => {
        const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (one: string, other: string) => {
      const [high, low] = [luminance(one), luminance(other)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    };
    expect(value(rule(':root'), '--blue')).toBe(CREDO_COLOUR);
    const dark = rule(":root[data-theme='dark']");
    for (const block of [rule(':root'), dark]) {
      expect(ratio(value(block, '--on-blue'), value(block, '--blue'))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(value(block, '--blue'), value(block, '--blue-soft'))).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(ratio(value(block, '--blue'), value(block, '--sheet'))).toBeGreaterThanOrEqual(4.5);
    }
    expect(rule('.w-seg input:checked + .w-face')).toContain('background: var(--blue)');
    expect(rule('.w-seg input:checked + .w-face')).toContain('color: var(--on-blue)');
    expect(css).not.toMatch(/#2f7d6d|--teal/);
  });

  it('Every colour has a dark value, whether the system or the page asks for dark', () => {
    const tokens = (block: string) =>
      [...block.matchAll(/(--[a-z-]+):/g)].map(([, name]) => name).sort();
    const light = tokens(rule(':root')).filter((name) => !['--mono', '--bar'].includes(name));
    const system = /:root:not\(\[data-theme='light'\]\) \{[^}]*\}/.exec(css)![0];

    expect(light.length).toBeGreaterThan(10);
    expect(tokens(system)).toEqual(light);
    expect(tokens(rule(":root[data-theme='dark']"))).toEqual(light);
  });
});

describe('the walks page: answering', () => {
  const choose = (id: string, value: 'Yes' | 'No', language?: string) =>
    fireEvent.click(panel(id, language).getByLabelText(value));
  const reason = (id: string, text: string, language?: string) =>
    fireEvent.change(panel(id, language).getByLabelText('Reason for the No'), {
      target: { value: text },
    });
  const clipboard = (write: (text: string) => Promise<void>) =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: write },
    });
  const press = async () => {
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy my answers' }));
      return Promise.resolve();
    });
  };
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('The page says at its top, in one line, how to answer and where to read more', async () => {
    render(<Page report={await reportWith()} />);

    expect(document.querySelector('.w-howto')!.textContent).toBe(
      'Answer Yes or No for each screen; How this page works.',
    );
  });

  it('Each screen, in each language, has Yes and No, and a reason box that a No brings', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.getAllByRole('group', { name: 'Your answer in Tiếng Việt' })).toHaveLength(1);
    expect(screen.getAllByLabelText('Yes')).toHaveLength(1);
    expect(screen.getAllByLabelText('No')).toHaveLength(1);
    expect(screen.queryAllByLabelText('Reason for the No')).toHaveLength(0);
    pick('Language', 'English');
    expect(screen.getAllByRole('group', { name: 'Your answer in English' })).toHaveLength(1);
    const yes = panel('3-settings', 'English').getByLabelText<HTMLInputElement>('Yes');
    expect(yes.type).toBe('radio');
    expect(yes.name).toBe('admin-setup:3-settings:en');
    expect(yes.checked).toBe(false);
  });

  it('The reason is required for a No, marked until it is given, and a Yes needs none', async () => {
    render(<Page report={await reportWith()} />);
    const box = () =>
      panel('3-settings').queryByLabelText<HTMLTextAreaElement>('Reason for the No');

    choose('3-settings', 'Yes');
    expect(box()).toBeNull();
    choose('3-settings', 'No');
    expect(box()!.hasAttribute('required')).toBe(true);
    expect(box()!.getAttribute('aria-invalid')).toBe('true');
    reason('3-settings', 'too small');
    expect(box()!.getAttribute('aria-invalid')).toBe('false');
    expect(box()!.value).toBe('too small');
    // A Yes puts the box away; a No again brings it back with what was typed.
    choose('3-settings', 'Yes');
    expect(box()).toBeNull();
    choose('3-settings', 'No');
    expect(box()!.value).toBe('too small');
  });

  it('answers one screen in one language at a time, and Clear takes the choice back', async () => {
    render(<Page report={await reportWith()} />);
    pick('Language', 'English');
    choose('3-settings', 'No', 'English');
    reason('3-settings', 'too small', 'English');

    pick('Language', 'Tiếng Việt');
    expect(panel('3-settings').getByLabelText<HTMLInputElement>('No').checked).toBe(false);
    expect(panel('3-settings').queryByRole('button', { name: 'Clear' })).toBeNull();
    pick('Language', 'English');
    const en = () => panel('3-settings', 'English');
    expect(en().getByLabelText<HTMLInputElement>('No').checked).toBe(true);
    expect(en().getByLabelText<HTMLTextAreaElement>('Reason for the No').value).toBe('too small');

    fireEvent.click(within(card('3-settings')).getByRole('button', { name: 'Clear' }));

    expect(en().getByLabelText<HTMLInputElement>('No').checked).toBe(false);
    expect(en().queryByLabelText('Reason for the No')).toBeNull();
    expect(within(card('3-settings')).queryByRole('button', { name: 'Clear' })).toBeNull();
    expect(stateOf('3-settings')).toBe('Not answered yet.');
  });

  it('says what a choice will do to the answer on record', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([
            answer('yes', 'vi', '1-sign-in', ['text: empty vi']),
            answer('no', 'vi', '2-sign-in-refused', ['text: old']),
          ]),
        )}
      />,
    );

    choose('1-sign-in', 'No');
    choose('3-settings', 'Yes');
    choose('2-sign-in-refused', 'Yes');

    expect(stateOf('1-sign-in')).toBe(
      'Your No goes into the block when you copy. It replaces the yes of 2026-10-29.',
    );
    expect(stateOf('3-settings')).toBe('Your Yes goes into the block when you copy.');
    expect(stateOf('2-sign-in-refused')).toBe(
      'Your Yes goes into the block when you copy. It replaces the no of 2026-10-29.',
    );
  });

  it('Copy my answers builds one block naming the build, with each answered screen and language, its fingerprint and a no’s reason, and puts it on the clipboard', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const report = await reportWith();
    render(<Page report={report} />);
    choose('1-sign-in', 'Yes');
    pick('Language', 'English');
    choose('3-settings', 'No', 'English');
    reason('3-settings', 'the save button\nis hard to find', 'English');

    await press();

    const prints = fingerprintsOf(report);
    const expected = [
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      `admin-setup:1-sign-in:vi | yes | ${prints.get('admin-setup:1-sign-in:vi')}`,
      `admin-setup:3-settings:en | no | ${prints.get('admin-setup:3-settings:en')} | the save button is hard to find`,
    ].join('\n');
    expect(write).toHaveBeenCalledWith(expected);
    expect(screen.getByLabelText<HTMLTextAreaElement>('The text to paste').value).toBe(expected);
    expect(screen.getByRole('heading', { name: 'Copied: 2 answers' })).toBeTruthy();
    expect(screen.getByText('Paste it into the chat.')).toBeTruthy();
    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('2 copied');
  });

  it('shows the block to select when the clipboard refuses, until it is done', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={await reportWith()} />);
    choose('1-sign-in', 'Yes');

    await press();

    expect(screen.getByText(/Select the text and copy it\./)).toBeTruthy();
    const area = screen.getByLabelText<HTMLTextAreaElement>('The text to paste');
    expect(area.value).toContain('admin-setup:1-sign-in:vi | yes | ');
    fireEvent.focus(area);
    expect(area.selectionEnd - area.selectionStart).toBe(area.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('The text to paste')).toBeNull();
  });

  it('gives no block, and the button is off, when nothing is answered', async () => {
    render(<Page report={await reportWith()} />);

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Copy my answers' }).disabled,
    ).toBe(true);
    await press();

    expect(screen.queryByLabelText('The text to paste')).toBeNull();
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('none chosen yet');
  });

  it('gives no block while a No lacks its reason, naming the screens', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    render(<Page report={await reportWith()} />);
    choose('7-save-failed', 'No');
    pick('Language', 'English');
    choose('1-sign-in', 'Yes', 'English');
    choose('3-settings', 'No', 'English');

    await press();

    expect(screen.getByRole('status').textContent).toBe(
      'A No needs its reason: screen 3 in English, screen 7 in Tiếng Việt.',
    );
    expect(screen.queryByLabelText('The text to paste')).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('3 ready to copy');
  });

  const shareButton = async () => {
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
      return Promise.resolve();
    });
  };
  const label = (text: string) =>
    fireEvent.change(screen.getByLabelText('Label from the invite'), { target: { value: text } });

  it('On a partner’s page, Share copies the answers chosen as one Slack message: each screen’s number, sentence and language, Yes or No, a No’s reason, and the machine’s lines in a code block at its end', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const report = await reportWith();
    render(<Page report={report} partner />);
    label('P1');
    expect(screen.getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('p1');
    choose('1-sign-in', 'Yes');
    pick('Language', 'English');
    choose('3-settings', 'No', 'English');
    reason('3-settings', 'the `save` button\nis hard to find', 'English');

    await shareButton();

    const prints = fingerprintsOf(report);
    const sentence = (index: number) => report.walks[0].screens[index].sentence.en;
    const expected = [
      '*Credo walks: answers from p1*',
      'Build: a-piece, commit abc123def',
      `*1. ${sentence(0)}* (Tiếng Việt): Yes`,
      `*3. ${sentence(2)}* (English): No. the 'save' button is hard to find`,
      '```',
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      'By: p1',
      `admin-setup:1-sign-in:vi | yes | ${prints.get('admin-setup:1-sign-in:vi')}`,
      `admin-setup:3-settings:en | no | ${prints.get('admin-setup:3-settings:en')} | the 'save' button is hard to find`,
      '```',
    ].join('\n');
    expect(write).toHaveBeenCalledWith(expected);
    expect(screen.getByLabelText<HTMLTextAreaElement>('The text to paste').value).toBe(expected);
    expect(screen.getByText('Post it in Slack.')).toBeTruthy();
  });

  it('Share asks once for the partner’s label, keeps it in the browser, and gives no message without one, saying so', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const { unmount } = render(<Page report={await reportWith()} partner />);
    choose('1-sign-in', 'Yes');

    await shareButton();

    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain(
      'Type the label from your invite first',
    );
    label('Not A Label!');
    await shareButton();
    expect(write).not.toHaveBeenCalled();
    label('p-1');
    expect(screen.getByLabelText<HTMLInputElement>('Label from the invite').value).toBe('p-1');
    unmount();

    render(<Page report={await reportWith()} partner />);
    expect(document.querySelector('.w-label-kept')!.textContent).toBe('as p-1, change');
    choose('1-sign-in', 'Yes');
    await shareButton();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('Share is off when nothing is chosen, says so when a No lacks its reason, and shows the message to select when the clipboard refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={await reportWith()} partner />);
    label('p1');

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Share' }).disabled).toBe(true);

    choose('3-settings', 'No');
    await shareButton();
    expect(screen.getByRole('status').textContent).toContain('A No needs its reason');

    reason('3-settings', 'too small');
    await shareButton();
    expect(screen.getByText(/Select the text and copy it\./)).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('The text to paste').value).toContain(
      'By: p1',
    );
  });

  it('The footer counts the answers on record with those chosen here, of all there are, and the ones ready to copy, with a bar a walk', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([answer('yes', 'vi', '1-sign-in', ['text: empty vi'])]),
        )}
      />,
    );
    const fill = () => document.querySelector<HTMLElement>('.w-walkfill')!.style.width;

    expect(screen.getByText('1 of 18 answered')).toBeTruthy();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('none chosen yet');
    choose('3-settings', 'Yes');
    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(document.querySelector('.w-tocopy')!.textContent).toBe('1 ready to copy');
    expect(document.querySelectorAll('.w-walkbar')).toHaveLength(1);
    expect(fill()).toBe(`${(2 / 18) * 100}%`);
  });

  it('The bar keeps its height on the page, so an answer at the foot of the window rests above it', async () => {
    const watching: (() => void)[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          watching.push(callback);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(72);
    const { unmount } = render(<Page report={await reportWith()} />);

    act(() => watching.forEach((fit) => fit()));

    expect(document.documentElement.style.getPropertyValue('--bar')).toBe('72px');
    unmount();
    document.documentElement.style.removeProperty('--bar');
  });

  it('keeps the unsent choices across a reload', async () => {
    const { unmount } = render(<Page report={await reportWith()} />);
    pick('Language', 'English');
    choose('3-settings', 'No', 'English');
    reason('3-settings', 'too small', 'English');
    unmount();

    render(<Page report={await reportWith()} />);
    pick('Language', 'English');

    const en = panel('3-settings', 'English');
    expect(en.getByLabelText<HTMLInputElement>('No').checked).toBe(true);
    expect(en.getByLabelText<HTMLTextAreaElement>('Reason for the No').value).toBe('too small');
  });

  it('works without the browser’s storage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      clear: () => {},
    });
    render(<Page report={await reportWith()} />);

    choose('3-settings', 'Yes');

    expect(panel('3-settings').getByLabelText<HTMLInputElement>('Yes').checked).toBe(true);
  });
});

describe('the walks page: what it was built from', () => {
  it('The page says what it was built from: the branch, the commit and its time', async () => {
    render(<Page report={await reportWith()} />);

    const line = document.querySelector('.w-build')!.textContent;

    expect(line).toBe(
      'Branch a-piece, commit abc123def, committed 2026-10-28 01:59 +07; built 2026-10-28 02:30 +07.',
    );
  });

  it('says so when the tree differed from the commit', async () => {
    render(<Page report={await reportWith({}, true)} />);

    expect(document.querySelector('.w-build')!.textContent).toContain(
      'commit abc123def with changes,',
    );
  });

  it('opens with what waits, in all', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.getByRole('banner').textContent).toContain('18 waiting');
  });
});
