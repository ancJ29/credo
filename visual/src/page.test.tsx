import { SCREENS } from '@credo/ui/mock';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answers } from './answers';
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

const reportWith = (answers: Answers = {}, changed = false): Report =>
  makeReport({
    walks: WALKS,
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

afterEach(() => vi.unstubAllGlobals());

describe('the walks page: the map', () => {
  it('The page opens on the map: the parts of the day across, the people down with their device; a built walk is a card with its title and its count of screens, and an empty cell is hatched', () => {
    render(<Page report={reportWith()} />);

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
    const card = within(map).getByRole('link');
    expect(card.getAttribute('href')).toBe('#admin-setup');
    expect(card.textContent).toContain('Set up the company: its name, colour and languages');
    expect(card.textContent).toContain('7 screens');
    expect(card.textContent).toContain('14 waiting');
    // One cell of fifteen is filled; fourteen are hatched.
    expect(within(map).getAllByTitle('Not built yet')).toHaveLength(14);
  });

  it('counts one screen in the singular', () => {
    const report = reportWith();
    report.walks[0].screens = report.walks[0].screens.slice(0, 1);

    render(<Page report={report} />);

    expect(screen.getByRole('link').textContent).toContain('1 screen');
    expect(screen.getByRole('link').textContent).not.toContain('1 screens');
  });
});

describe('the walks page: a walk', () => {
  it('Each walk shows its main path, then what can go wrong: each screen with its sentence in both languages and its one question', () => {
    render(<Page report={reportWith()} />);

    const walk = screen.getByRole('region', {
      name: 'Set up the company: its name, colour and languages',
    });
    const headings = within(walk).getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'The main path',
      'What can go wrong',
    ]);
    const numbers = [...walk.querySelectorAll('.w-number')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '3', '4', '5', '2', '6', '7']);
    const last = walk.querySelector('#admin-setup-7-save-failed')!;
    expect(last.textContent).toContain('A save that failed, what was typed kept');
    expect(last.textContent).toContain('Lưu không thành công, nội dung đã nhập vẫn còn');
    expect(last.textContent).toContain(
      'Would the admin know the save did not happen, and that nothing typed is lost?',
    );
  });

  it('leaves out a heading whose path holds no screen', () => {
    const report = reportWith();
    report.walks[0].screens = report.walks[0].screens.filter((s) => s.path === 'main');

    render(<Page report={report} />);

    expect(screen.queryByText('What can go wrong')).toBeNull();
    expect(screen.getByText('The main path')).toBeTruthy();
  });

  it('says the person and the width the walk is drawn at', () => {
    render(<Page report={reportWith()} />);

    expect(screen.getByText(/The client’s admin on a PC, drawn 1280 pixels wide/)).toBeTruthy();
  });
});

describe('the walks page: the drawn screens', () => {
  it('The page draws each walk screen live from the app’s own components, in its state, in Vietnamese and in English, at its person’s device width', () => {
    render(<Page report={reportWith()} />);

    const frames = screen.getAllByTitle(/ · (vi|en) · 1280$/);
    expect(frames).toHaveLength(14);
    expect(frames.every((frame) => frame.getAttribute('width') === '1280')).toBe(true);

    const inFrame = (title: string) => {
      const frame = screen.getByTitle<HTMLIFrameElement>(title);
      act(() => {
        fireEvent.load(frame);
      });
      return frame.contentDocument!;
    };
    // Screen 7 is the mock's failed save: the settings with the error and what was typed.
    const en = inFrame('7 7-save-failed · en · 1280');
    const vi = inFrame('7 7-save-failed · vi · 1280');
    expect(en.body.textContent).toContain('The settings were not saved.');
    expect((en.querySelector('input') as HTMLInputElement).value).toBe('Minh Phát Sài Gòn');
    expect(vi.body.textContent).toContain('Chưa lưu được cài đặt.');
    expect(en.documentElement.lang).toBe('en');
    expect(vi.documentElement.lang).toBe('vi');
    // Screen 1 is the sign-in in the company's name.
    expect(inFrame('1 1-sign-in · en · 1280').body.textContent).toContain('Minh Phát');
  });

  it('scales a screen down to the room it has, and its box to the same', () => {
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
    render(<Page report={reportWith()} />);
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
    width.mockRestore();
    height.mockRestore();
  });

  it('stops watching a size when it leaves', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<Page report={reportWith()} />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});

describe('the walks page: the answers', () => {
  const card = (id: string) => document.querySelector<HTMLElement>(`#admin-setup-${id}`)!;

  it('Each drawn screen shows its language’s answer: not yet asked, a dated yes, or a "no" with its reason', () => {
    const words = (language: string) => [`text: empty ${language}`];
    render(
      <Page
        report={reportWith(
          Object.fromEntries([
            answer('yes', 'vi', '1-sign-in', words('vi')),
            answer('no', 'en', '1-sign-in', words('en')),
          ]),
        )}
      />,
    );

    const vi = within(card('1-sign-in')).getByRole('region', { name: 'Tiếng Việt' });
    const en = within(card('1-sign-in')).getByRole('region', { name: 'English' });
    expect(vi.textContent).toContain('Yes · 2026-10-29');
    expect(en.textContent).toContain('No · 2026-10-29');
    expect(en.textContent).toContain('the message is too small');
    expect(card('3-settings').textContent).toContain('Not yet asked');
  });

  it('A changed word asks again, showing the words before and now', () => {
    render(
      <Page
        report={reportWith(Object.fromEntries([answer('yes', 'en', '1-sign-in', ['text: old'])]))}
      />,
    );

    const en = within(card('1-sign-in')).getByRole('region', { name: 'English' });

    expect(en.textContent).toContain('Asked again');
    expect(en.textContent).toContain('Its words changed since the yes of 2026-10-29.');
    expect(within(en).getByText('Words before').nextElementSibling!.textContent).toBe('text: old');
    expect(within(en).getByText('Words now').nextElementSibling!.textContent).toBe(
      'text: empty en',
    );
  });

  it('shows the words each screen was read as, folded', () => {
    render(<Page report={reportWith()} />);

    const en = within(card('7-save-failed')).getByRole('region', { name: 'English' });

    expect(within(en).getByText('The words')).toBeTruthy();
    expect(en.querySelector('details pre')!.textContent).toBe('text: save-failed en');
  });

  it('Approved screens fold away', () => {
    render(
      <Page
        report={reportWith(
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

  it('lists an answer whose screen left the walks, and counts its no', () => {
    const gone: Answers = {
      'admin-setup:9-gone:vi': { answer: 'no', on: '2026-10-29', reason: 'too small', words: [] },
      'admin-setup:8-gone:en': { answer: 'yes', on: '2026-10-29', reason: '', words: [] },
    };
    render(<Page report={reportWith(gone)} />);

    const section = screen.getByRole('region', { name: 'Answers whose screen left the walks' });

    expect(section.textContent).toContain('admin-setup:9-gone:vi: no on 2026-10-29, too small');
    expect(section.textContent).toContain('admin-setup:8-gone:en: yes on 2026-10-29');
    expect(section.textContent).not.toContain('yes on 2026-10-29,');
    expect(screen.getByRole('banner').textContent).toContain('1 no');
  });

  it('has no list of the gone when none is gone', () => {
    render(<Page report={reportWith()} />);

    expect(screen.queryByText('Answers whose screen left the walks')).toBeNull();
  });
});

describe('the walks page: what it was built from', () => {
  it('The page says what it was built from: the branch, the commit and its time', () => {
    render(<Page report={reportWith()} />);

    const line = document.querySelector('.w-build')!.textContent;

    expect(line).toBe(
      'Branch a-piece, commit abc123def, committed 2026-10-28 01:59 +07; built 2026-10-28 02:30 +07.',
    );
  });

  it('says so when the tree differed from the commit', () => {
    render(<Page report={reportWith({}, true)} />);

    expect(document.querySelector('.w-build')!.textContent).toContain(
      'commit abc123def with changes,',
    );
  });

  it('opens with what waits, in all', () => {
    render(<Page report={reportWith()} />);

    expect(screen.getByRole('banner').textContent).toContain('14 waiting');
  });
});
