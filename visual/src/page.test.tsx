import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
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

/** The section of one walk screen. */
const card = (id: string) => document.querySelector<HTMLElement>(`#admin-setup-${id}`)!;
/** Picks a language or the widths for the whole page. */
const pick = (legend: 'Language' | 'Show', label: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: legend })).getByLabelText(label));
/** A screen's answer, in the language the page shows. */
const panel = (id: string, language = 'Tiếng Việt') =>
  within(within(card(id)).getByRole('group', { name: `Your answer in ${language}` }));
const stateOf = (id: string) => card(id).querySelector('.w-state > span')!.textContent;

/** The browser's report of the sections in a band near the top of the window. */
function watchBand() {
  const band = {
    callback: undefined as IntersectionObserverCallback | undefined,
    watched: [] as Element[],
    disconnect: vi.fn(),
    report: (entries: [string, boolean][]) =>
      act(() =>
        band.callback!(
          entries.map(([id, isIntersecting]) => ({
            target: card(id),
            isIntersecting,
          })) as unknown as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        ),
      ),
  };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        band.callback = callback;
      }
      observe(element: Element) {
        band.watched.push(element);
      }
      disconnect() {
        band.disconnect();
      }
    },
  );
  return band;
}

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

  it('puts the operator’s walk on its own row, above the client’s admin, with its four screens and its questions', async () => {
    render(<Page report={await reportWith({}, false, WALKS.slice(0, 2))} />);

    const map = screen.getByRole('region', { name: 'The map of the day' });
    const [operator, admin] = within(map).getAllByRole('link');
    expect(operator.getAttribute('href')).toBe('#operator-setup');
    expect(operator.textContent).toContain('Make a client and send it its link');
    expect(operator.textContent).toContain('4 screens');
    expect(admin.getAttribute('href')).toBe('#admin-setup');
    expect(within(map).getByText('The operator').parentElement!.textContent).toContain('PC');
    expect(within(map).getAllByTitle('Not built yet')).toHaveLength(18);

    const walk = document.querySelector('#operator-setup')!;
    expect([...walk.querySelectorAll('.w-number')].map((n) => n.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(walk.textContent).toContain('Would you know this is our own door, not a client’s?');
    expect(walk.textContent).toContain('Does this say what to do?');
    expect(document.querySelector('#admin-setup')!.textContent).toContain(
      'Would the person know to ask whoever sent the link?',
    );
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
  it('Each walk shows its main path, then what can go wrong: each screen with its sentence in both languages and its one question', async () => {
    render(<Page report={await reportWith()} />);

    const walk = screen.getByRole('region', {
      name: 'Set up the company: its name, colour and languages',
    });
    const headings = within(walk).getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'The main path',
      'What can go wrong',
    ]);
    const numbers = [...walk.querySelectorAll('.w-number')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '3', '4', '5', '2', '6', '7', '8', '9']);
    const last = walk.querySelector('#admin-setup-7-save-failed')!;
    expect(last.textContent).toContain('A save that failed, what was typed kept');
    expect(last.textContent).toContain('Lưu không thành công, nội dung đã nhập vẫn còn');
    expect(last.textContent).toContain(
      'Would the admin know the save did not happen, and that nothing typed is lost?',
    );
  });

  it('leaves out a heading whose path holds no screen, in the walk and in the rail', async () => {
    const report = await reportWith();
    report.walks[0].screens = report.walks[0].screens.filter((s) => s.path === 'main');

    render(<Page report={report} />);

    expect(screen.queryByText('What can go wrong')).toBeNull();
    expect(screen.getAllByText('The main path')).toHaveLength(2);
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

  it('Each walk screen is drawn at three widths, PC 1280, tablet 768 and phone 390, in Vietnamese and in English, from the app’s own components', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.getAllByTitle(/^Screen \d in Tiếng Việt, /)).toHaveLength(27);
    for (const [device, width] of [
      ['PC', '1280'],
      ['Tablet', '768'],
      ['Phone', '390'],
    ]) {
      const frames = screen.getAllByTitle(new RegExp(`, ${device} ${width}$`));
      expect(frames).toHaveLength(9);
      expect(frames.every((frame) => frame.getAttribute('width') === width)).toBe(true);
    }
    // Screen 7 is the mock's failed save: the settings with the error and what was typed.
    const vi = inFrame('Screen 7 in Tiếng Việt, PC 1280');
    expect(vi.body.textContent).toContain('Chưa lưu được cài đặt.');
    expect(vi.documentElement.lang).toBe('vi');

    pick('Language', 'English');

    expect(screen.queryAllByTitle(/ in Tiếng Việt, /)).toHaveLength(0);
    expect(screen.getAllByTitle(/^Screen \d in English, /)).toHaveLength(27);
    const en = inFrame('Screen 7 in English, Tablet 768');
    expect(en.body.textContent).toContain('The settings were not saved.');
    expect((en.querySelector('input') as HTMLInputElement).value).toBe('Minh Phát Sài Gòn');
    expect(en.documentElement.lang).toBe('en');
    // Screen 8 is the mock's conflict: someone else saved first.
    expect(inFrame('Screen 8 in English, Phone 390').body.textContent).toContain(
      'Someone saved newer settings first.',
    );
    // Screen 1 is the sign-in in the company's name.
    expect(inFrame('Screen 1 in English, Phone 390').body.textContent).toContain('Minh Phát');
  });

  it('A switch shows every screen in one language, Tiếng Việt first, at one width or all three, so each width in each language is one press away', async () => {
    render(<Page report={await reportWith()} />);
    const language = within(screen.getByRole('group', { name: 'Language' }));
    const show = within(screen.getByRole('group', { name: 'Show' }));
    const frames = () => [...document.querySelectorAll('iframe')];

    expect(language.getByLabelText<HTMLInputElement>('Tiếng Việt').checked).toBe(true);
    expect(show.getByLabelText<HTMLInputElement>('All three').checked).toBe(true);
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
      expect(frames()).toHaveLength(9);
      expect(frames().every((frame) => frame.getAttribute('width') === width)).toBe(true);
      expect(card('3-settings').querySelector('.w-frames')!.getAttribute('data-show')).toBe(
        device.toLowerCase(),
      );
    }

    pick('Language', 'English');

    expect(language.getByLabelText<HTMLInputElement>('English').checked).toBe(true);
    expect(screen.getAllByTitle(/^Screen \d in English, Phone 390$/)).toHaveLength(9);
    expect(screen.getAllByRole('group', { name: 'Your answer in English' })).toHaveLength(9);
    pick('Show', 'All three');
    expect(frames()).toHaveLength(27);
    expect(card('3-settings').querySelector('.w-frames')!.getAttribute('data-show')).toBe('all');
  });

  it('Shown together, a screen’s three widths sit widest first, each captioned with its device and width and no wider than it', async () => {
    render(<Page report={await reportWith()} />);

    const figures = [...card('3-settings').querySelectorAll<HTMLElement>('figure')];

    expect(figures.map((figure) => figure.querySelector('figcaption')!.textContent)).toEqual([
      'PC 1280 px',
      'Tablet 768 px',
      'Phone 390 px',
    ]);
    expect(figures.map((figure) => figure.dataset['device'])).toEqual(['pc', 'tablet', 'phone']);
    expect(figures.map((figure) => figure.style.maxWidth)).toEqual(['1280px', '768px', '390px']);
  });

  it('A change of language or width brings back the screen that was in view', async () => {
    const band = watchBand();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<Page report={await reportWith()} />);

    // Nothing reported in view yet: a change scrolls nowhere.
    pick('Show', 'PC');
    expect(scroll).not.toHaveBeenCalled();

    band.report([['5-language-menu', true]]);
    pick('Language', 'English');

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(card('5-language-menu'));
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    pick('Show', 'All three');
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.contexts[1]).toBe(card('5-language-menu'));
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

  it('stops watching a size, and the band, when it leaves', async () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const band = watchBand();
    const { unmount } = render(<Page report={await reportWith()} />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
    expect(band.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('the walks page: the rail', () => {
  it('A rail lists each walk’s screens, the main path first, each with a mark for each language, and marks the screen in view', async () => {
    const band = watchBand();
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
      '#admin-setup-3-settings',
      '#admin-setup-4-saved',
      '#admin-setup-5-language-menu',
      '#admin-setup-2-sign-in-refused',
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
    expect(marks(4)).toEqual([
      ['open', 'Tiếng Việt: not answered'],
      ['no', 'English: no'],
    ]);
    expect(marks(5)[1]).toEqual(['again', 'English: asked again']);
    // A choice made on the page marks its screen at once, in the rail and on the screen.
    fireEvent.click(panel('3-settings').getByLabelText('No'));
    expect(marks(1)[0]).toEqual(['no', 'Tiếng Việt: no']);
    expect(card('3-settings').querySelector('summary .w-mark')!.getAttribute('data-mark')).toBe(
      'no',
    );

    // The screen in view, as the browser reports it.
    expect(band.watched).toHaveLength(9);
    expect(nav.querySelector('[aria-current]')).toBeNull();
    band.report([['4-saved', true]]);
    expect(items[2].getAttribute('aria-current')).toBe('location');
    // Two in the band: the first in the page's order.
    band.report([
      ['4-saved', false],
      ['2-sign-in-refused', true],
      ['5-language-menu', true],
    ]);
    expect(items[3].getAttribute('aria-current')).toBe('location');
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
    // None in the band, between two sections: the last stays.
    band.report([
      ['5-language-menu', false],
      ['2-sign-in-refused', false],
    ]);
    expect(items[3].getAttribute('aria-current')).toBe('location');
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

  it('Approved screens fold away', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([
            answer('yes', 'vi', '1-sign-in', ['text: empty vi']),
            answer('yes', 'en', '1-sign-in', ['text: empty en']),
            answer('yes', 'vi', '3-settings', ['text: filled vi']),
          ]),
        )}
      />,
    );

    expect((card('1-sign-in') as HTMLDetailsElement).open).toBe(false);
    expect((card('3-settings') as HTMLDetailsElement).open).toBe(true);
    expect((card('2-sign-in-refused') as HTMLDetailsElement).open).toBe(true);
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
    expect(card('1-sign-in').hasAttribute('open')).toBe(true);
  });

  it('A screen every partner answered yes, in both languages, still waits for the human: its card stays open and unmarked', async () => {
    const yes = (language: string): Answers => ({
      [`admin-setup:1-sign-in:${language}@p1`]: {
        answer: 'yes',
        on: '2026-10-30',
        reason: '',
        words: [`text: empty ${language}`],
      },
    });
    render(<Page report={await reportWith({ ...yes('vi'), ...yes('en') })} />);

    expect(card('1-sign-in').hasAttribute('open')).toBe(true);
    expect(
      [...card('1-sign-in').querySelectorAll('.w-mark')].map((mark) =>
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
    expect(rule('.w-rail')).toContain('position: sticky');
    expect(css).toMatch(
      /@media \(min-width: 1000px\) \{\s*\.w-desk \{[^}]*grid-template-columns: 252px minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 480px\) \{\s*\.w-map \{\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it('Beside its widths in a wide body, under them in a narrow one, each screen asks its question with Yes and No in the page’s language; the narrow one rides at the foot of the window', async () => {
    render(<Page report={await reportWith()} />);
    const grid = card('3-settings').querySelector('.w-screen-grid')!;
    const ask = within(grid.querySelector<HTMLElement>('.w-panel')!);

    expect([...grid.children].map((child) => child.className)).toEqual([
      'w-stage',
      'w-panel',
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

  it('The page says at its top how to answer: a partner shares under their label, “Copy my answers” is not for partners', async () => {
    render(<Page report={await reportWith()} />);

    const line = document.querySelector('.w-howto')!.textContent;

    expect(line).toContain('Yes or No, in Tiếng Việt and in English, with a reason for any No');
    expect(line).toContain('A partner types their label and presses “Share”');
    expect(line).toContain('“Copy my answers” is not for partners');
    expect(line).toContain('sends nothing');
  });

  it('Each screen, in each language, has Yes and No, and a reason box that a No brings', async () => {
    render(<Page report={await reportWith()} />);

    expect(screen.getAllByRole('group', { name: 'Your answer in Tiếng Việt' })).toHaveLength(9);
    expect(screen.getAllByLabelText('Yes')).toHaveLength(9);
    expect(screen.getAllByLabelText('No')).toHaveLength(9);
    expect(screen.queryAllByLabelText('Reason for the No')).toHaveLength(0);
    pick('Language', 'English');
    expect(screen.getAllByRole('group', { name: 'Your answer in English' })).toHaveLength(9);
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
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into the chat.');
    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(screen.getByText('2 answers to copy')).toBeTruthy();
  });

  it('shows the block to select when the clipboard refuses, until it is hidden', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={await reportWith()} />);
    choose('1-sign-in', 'Yes');

    await press();

    expect(screen.getByRole('status').textContent).toContain('Select the text below');
    const area = screen.getByLabelText<HTMLTextAreaElement>('The text to paste');
    expect(area.value).toContain('admin-setup:1-sign-in:vi | yes | ');
    fireEvent.focus(area);
    expect(area.selectionEnd - area.selectionStart).toBe(area.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Hide the text' }));
    expect(screen.queryByLabelText('The text to paste')).toBeNull();
  });

  it('gives no block, and says so, when nothing is answered', async () => {
    render(<Page report={await reportWith()} />);

    await press();

    expect(screen.getByRole('status').textContent).toBe(
      'Nothing chosen yet: answer a screen first.',
    );
    expect(screen.queryByLabelText('The text to paste')).toBeNull();
    expect(screen.getByText('0 of 18 answered')).toBeTruthy();
    expect(screen.getByText('0 answers to copy')).toBeTruthy();
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
    expect(screen.getByText('3 answers to copy')).toBeTruthy();
  });

  const shareButton = async () => {
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
      return Promise.resolve();
    });
  };
  const label = (text: string) =>
    fireEvent.change(screen.getByLabelText('Your label'), { target: { value: text } });

  it('Beside "Copy my answers", Share copies the answers chosen as one Slack message: each screen’s number, sentence and language, Yes or No, a No’s reason, and the machine’s lines in a code block at its end', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const report = await reportWith();
    render(<Page report={report} />);
    label('P1');
    expect(screen.getByLabelText<HTMLInputElement>('Your label').value).toBe('p1');
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
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into Slack.');
  });

  it('Share asks once for the partner’s label, keeps it in the browser, and gives no message without one, saying so', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const { unmount } = render(<Page report={await reportWith()} />);
    choose('1-sign-in', 'Yes');

    await shareButton();

    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Type your label first');
    label('Not A Label!');
    await shareButton();
    expect(write).not.toHaveBeenCalled();
    label('p-1');
    expect(screen.getByLabelText<HTMLInputElement>('Your label').value).toBe('p-1');
    unmount();

    render(<Page report={await reportWith()} />);
    expect(screen.getByLabelText<HTMLInputElement>('Your label').value).toBe('p-1');
    choose('1-sign-in', 'Yes');
    await shareButton();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('Share says so when nothing is chosen, and when a No lacks its reason, and shows the message to select when the clipboard refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={await reportWith()} />);
    label('p1');

    await shareButton();
    expect(screen.getByRole('status').textContent).toContain('Nothing chosen yet');

    choose('3-settings', 'No');
    await shareButton();
    expect(screen.getByRole('status').textContent).toContain('A No needs its reason');

    reason('3-settings', 'too small');
    await shareButton();
    expect(screen.getByRole('status').textContent).toContain('paste it into Slack');
    expect(screen.getByLabelText<HTMLTextAreaElement>('The text to paste').value).toContain(
      'By: p1',
    );
  });

  it('The bar counts the answers on record with those chosen here, of all there are, and the ones to copy', async () => {
    render(
      <Page
        report={await reportWith(
          Object.fromEntries([answer('yes', 'vi', '1-sign-in', ['text: empty vi'])]),
        )}
      />,
    );
    const ticks = () =>
      [...document.querySelectorAll('.w-ledger .w-tick')].map((tick) =>
        tick.getAttribute('data-mark'),
      );

    expect(screen.getByText('1 of 18 answered')).toBeTruthy();
    expect(screen.getByText('0 answers to copy')).toBeTruthy();
    choose('3-settings', 'Yes');
    expect(screen.getByText('2 of 18 answered')).toBeTruthy();
    expect(screen.getByText('1 answer to copy')).toBeTruthy();
    expect(ticks()).toHaveLength(18);
    expect(ticks().slice(0, 4)).toEqual(['yes', 'open', 'yes', 'open']);
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
