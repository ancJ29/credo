import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

    expect(
      screen.getByText(
        /The client’s admin on a PC; every screen is drawn at PC 1280, tablet 768, phone 390 pixels/,
      ),
    ).toBeTruthy();
  });
});

describe('the walks page: the drawn screens', () => {
  it('Each walk screen is drawn at three widths, PC 1280, tablet 768 and phone 390, in Vietnamese and in English, from the app’s own components', () => {
    render(<Page report={reportWith()} />);

    expect(screen.getAllByTitle(/ · (vi|en) · \d+$/)).toHaveLength(42);
    for (const width of ['1280', '768', '390']) {
      const frames = screen.getAllByTitle(new RegExp(` · (vi|en) · ${width}$`));
      expect(frames).toHaveLength(14);
      expect(frames.every((frame) => frame.getAttribute('width') === width)).toBe(true);
    }

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

  it('The three widths of a language sit together, widest first, each in a column as wide as its device so they scale alike', () => {
    render(<Page report={reportWith()} />);

    const en = within(document.querySelector<HTMLElement>('#admin-setup-3-settings')!).getByRole(
      'region',
      { name: 'English' },
    );
    const group = en.querySelector<HTMLElement>('.w-frames')!;

    expect([...group.querySelectorAll('figcaption')].map((c) => c.textContent)).toEqual([
      'PC · 1280',
      'tablet · 768',
      'phone · 390',
    ]);
    expect(group.style.getPropertyValue('--cols')).toBe(
      'minmax(0, 1280fr) minmax(0, 768fr) minmax(0, 390fr)',
    );
    expect(en.querySelectorAll('iframe')).toHaveLength(3);
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

describe('the walks page: its width', () => {
  // jsdom lays nothing out, so the page's width is read from its rules; the look is the human's.
  const css = readFileSync(join(process.cwd(), 'src/page.css'), 'utf8');

  it('The page uses the whole width of the window and reads on a PC, a tablet and a phone: the widths side by side from 1000 pixels, stacked below, the map in one column on a phone', () => {
    const wrap = /\.w-wrap \{[^}]*\}/.exec(css)![0];

    expect(wrap).not.toContain('max-width');
    expect(wrap).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toMatch(
      /@media \(min-width: 1000px\) \{\s*\.w-frames \{[^}]*grid-template-columns: var\(--cols\)/,
    );
    expect(css).toMatch(/@media \(max-width: 480px\) \{\s*\.w-map \{[^}]*minmax\(0, 1fr\)/);
  });
});

describe('the walks page: answering', () => {
  const region = (id: string, name: string) =>
    within(document.querySelector<HTMLElement>(`#admin-setup-${id}`)!).getByRole('region', {
      name,
    });
  const choose = (id: string, name: string, answer: 'Yes' | 'No') =>
    fireEvent.click(within(region(id, name)).getByLabelText(answer));
  const reason = (id: string, name: string, text: string) =>
    fireEvent.change(within(region(id, name)).getByLabelText('Reason'), {
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
    localStorage.clear();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('The page says at its top how to answer and that the block goes to the chat', () => {
    render(<Page report={reportWith()} />);

    const line = document.querySelector('.w-howto')!.textContent;

    expect(line).toContain('Yes or No, and a reason for any No');
    expect(line).toContain('paste the block into the chat');
    expect(line).toContain('sends nothing');
  });

  it('Each screen, in each language, has Yes and No and a reason box', () => {
    render(<Page report={reportWith()} />);

    expect(screen.getAllByLabelText('Yes')).toHaveLength(14);
    expect(screen.getAllByLabelText('No')).toHaveLength(14);
    expect(screen.getAllByLabelText('Reason')).toHaveLength(14);
    for (const name of ['Tiếng Việt', 'English']) {
      const one = within(region('3-settings', name));
      expect(one.getByRole('group', { name: 'Your answer' })).toBeTruthy();
      expect(one.getByLabelText<HTMLInputElement>('Yes').checked).toBe(false);
    }
  });

  it('The reason is required for a No, marked until it is given, and a Yes needs none', () => {
    render(<Page report={reportWith()} />);
    const box = () => within(region('3-settings', 'English')).getByLabelText('Reason');

    expect(box().hasAttribute('required')).toBe(false);
    choose('3-settings', 'English', 'Yes');
    expect(box().hasAttribute('required')).toBe(false);
    choose('3-settings', 'English', 'No');
    expect(box().hasAttribute('required')).toBe(true);
    expect(box().getAttribute('aria-invalid')).toBe('true');
    reason('3-settings', 'English', 'too small');
    expect(box().getAttribute('aria-invalid')).toBe('false');
    expect((box() as HTMLTextAreaElement).value).toBe('too small');
  });

  it('answers one screen in one language at a time, and Clear takes the choice back', () => {
    render(<Page report={reportWith()} />);

    choose('3-settings', 'English', 'No');
    reason('3-settings', 'English', 'too small');

    const vi = within(region('3-settings', 'Tiếng Việt'));
    expect(vi.getByLabelText<HTMLInputElement>('No').checked).toBe(false);
    fireEvent.click(within(region('3-settings', 'English')).getByRole('button', { name: 'Clear' }));
    const en = within(region('3-settings', 'English'));
    expect(en.getByLabelText<HTMLInputElement>('No').checked).toBe(false);
    expect(en.getByLabelText<HTMLTextAreaElement>('Reason').value).toBe('');
  });

  it('Copy my answers builds one block naming the build, with each answered screen and language, its fingerprint and a no’s reason, and puts it on the clipboard', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    const report = reportWith();
    render(<Page report={report} />);
    choose('1-sign-in', 'Tiếng Việt', 'Yes');
    choose('3-settings', 'English', 'No');
    reason('3-settings', 'English', 'the save button\nis hard to find');

    await press();

    const prints = fingerprintsOf(report);
    const expected = [
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      `admin-setup:1-sign-in:vi | yes | ${prints.get('admin-setup:1-sign-in:vi')}`,
      `admin-setup:3-settings:en | no | ${prints.get('admin-setup:3-settings:en')} | the save button is hard to find`,
    ].join('\n');
    expect(write).toHaveBeenCalledWith(expected);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('The block to paste into the chat').value,
    ).toBe(expected);
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into the chat.');
    expect(screen.getByText('2 answers chosen')).toBeTruthy();
  });

  it('shows the block to select when the clipboard refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<Page report={reportWith()} />);
    choose('1-sign-in', 'English', 'Yes');

    await press();

    expect(screen.getByRole('status').textContent).toContain('Select the text below');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('The block to paste into the chat').value,
    ).toContain('admin-setup:1-sign-in:en | yes | ');
    const area = screen.getByLabelText<HTMLTextAreaElement>('The block to paste into the chat');
    fireEvent.focus(area);
    expect(area.selectionEnd - area.selectionStart).toBe(area.value.length);
  });

  it('gives no block, and says so, when nothing is answered', async () => {
    render(<Page report={reportWith()} />);

    await press();

    expect(screen.getByRole('status').textContent).toBe('Nothing answered yet.');
    expect(screen.queryByLabelText('The block to paste into the chat')).toBeNull();
    expect(screen.getByText('0 answers chosen')).toBeTruthy();
  });

  it('gives no block while a No lacks its reason, naming the screen', async () => {
    const write = vi.fn(() => Promise.resolve());
    clipboard(write);
    render(<Page report={reportWith()} />);
    choose('1-sign-in', 'English', 'Yes');
    choose('3-settings', 'English', 'No');

    await press();

    expect(screen.getByRole('status').textContent).toBe(
      'A No needs its reason: admin-setup:3-settings:en',
    );
    expect(screen.queryByLabelText('The block to paste into the chat')).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByText('2 answers chosen')).toBeTruthy();
  });

  it('keeps the unsent choices across a reload', () => {
    const { unmount } = render(<Page report={reportWith()} />);
    choose('3-settings', 'English', 'No');
    reason('3-settings', 'English', 'too small');
    unmount();

    render(<Page report={reportWith()} />);

    const en = within(region('3-settings', 'English'));
    expect(en.getByLabelText<HTMLInputElement>('No').checked).toBe(true);
    expect(en.getByLabelText<HTMLTextAreaElement>('Reason').value).toBe('too small');
  });

  it('works without the browser’s storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      clear: () => {},
    });
    render(<Page report={reportWith()} />);

    choose('3-settings', 'English', 'Yes');

    expect(
      within(region('3-settings', 'English')).getByLabelText<HTMLInputElement>('Yes').checked,
    ).toBe(true);
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
