import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageData } from './data';
import { WORDS } from './words';

const TEMPLATE = readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');
const BODY = TEMPLATE.slice(TEMPLATE.indexOf('<body>') + 6, TEMPLATE.indexOf('<script>'));

const walk = (id: string, person: string, part: string, screens: string[]) => ({
  id,
  person,
  part,
  title: { vi: `${id} vi`, en: `${id} en` },
  screens: screens.map((screen, at) => ({
    id: screen,
    number: at + 1,
    path: 'main' as const,
    sentence: { vi: `${screen} câu`, en: `${screen} sentence` },
    question: { vi: `${screen} hỏi?`, en: `${screen} ask?` },
    version: `v-${id}-${screen}`,
  })),
});

/** A small build: one cell with two walks (office, daily), a phone walk, and an empty cell. */
const makeData = (): PageData => {
  const walks = [
    walk('office-a', 'office', 'daily', ['a1', 'a2', 'a3']),
    walk('office-b', 'office', 'daily', ['b1']),
    walk('driver-c', 'driver', 'daily', ['c1', 'c2']),
  ];
  const captures: Record<string, string> = {};
  for (const one of walks) {
    for (const screen of one.screens) {
      for (const language of ['vi', 'en']) {
        captures[`${one.id}/${screen.id}/${language}`] =
          `<p>${screen.id} ${language}</p><!--style:0-->`;
      }
    }
  }
  return {
    title: 'Credo Day Walks',
    build: {
      branch: 'walks-page',
      commit: 'abc123def',
      changed: false,
      committed: '2026-11-03 00:25 +07',
      built: '2026-11-03 00:30 +07',
    },
    devices: [
      { id: 'pc', label: 'PC', width: 1280 },
      { id: 'tablet', label: 'tablet', width: 768 },
      { id: 'phone', label: 'phone', width: 390 },
    ],
    people: [
      { id: 'office', name: { vi: 'Văn phòng', en: 'Office' }, device: 'pc', width: 1280 },
      { id: 'driver', name: { vi: 'Tài xế', en: 'Driver' }, device: 'phone', width: 390 },
    ],
    parts: [
      { id: 'setup', name: { vi: 'Thiết lập', en: 'Set up' } },
      { id: 'daily', name: { vi: 'Hằng ngày', en: 'Daily' } },
    ],
    walks,
    css: 'p{color:blue}',
    styles: [':root{--c:red}'],
    captures,
  };
};

// The page adds listeners to the document and window as it loads; a test that loads it again
// must not leave the last load's listeners on the shared document.
const added: [EventTarget, string, EventListenerOrEventListenerObject][] = [];
const originals = {
  document: document.addEventListener.bind(document),
  window: window.addEventListener.bind(window),
};
let observed: ((entries: unknown[]) => void)[] = [];

/** Loads the page on a fresh body, as the browser would run its script once. */
async function load(
  options: { data?: PageData; name?: string; seed?: Record<string, unknown> } = {},
) {
  vi.resetModules();
  document.body.innerHTML = BODY;
  document.body.className = '';
  document.documentElement.removeAttribute('data-theme');
  window.WALKS_DATA = options.data ?? makeData();
  for (const [key, value] of Object.entries(options.seed ?? {})) {
    localStorage.setItem(`credo-walks:${key}`, JSON.stringify(value));
  }
  await import('./page');
  if (options.name !== undefined) enter(options.name);
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const click = (target: string | Element) =>
  (typeof target === 'string' ? $(target) : target).dispatchEvent(
    new MouseEvent('click', { bubbles: true }),
  );
const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
};
function enter(name: string) {
  $<HTMLInputElement>('who-name').value = name;
  $('who-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
const text = (id: string) => $(id).textContent;
const stored = (key: string) => {
  const raw = localStorage.getItem(`credo-walks:${key}`);
  return raw === null ? undefined : (JSON.parse(raw) as Record<string, unknown>);
};
const card = (id: string) => document.querySelector<HTMLElement>(`.card[data-walk="${id}"]`)!;
const frameText = () =>
  $<HTMLIFrameElement>('frame-wrap').querySelector('iframe')!.contentDocument!.body.textContent;
const rows = () => [...document.querySelectorAll('#wl-items li')].map((li) => li.textContent);
/** The answer bar's yes, and the 420 ms the page waits before going to the next screen. */
const yes = () => {
  click('yes');
  vi.advanceTimersByTime(500);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T01:00:00.000Z'));
  localStorage.clear();
  observed = [];
  document.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
    added.push([document, type, listener]);
    originals.document(type, listener);
  };
  window.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
    added.push([window, type, listener]);
    originals.window(type, listener);
  };
  window.scrollTo = () => {};
  window.ResizeObserver = class {
    constructor(callback: (entries: unknown[]) => void) {
      observed.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  for (const [target, type, listener] of added.splice(0))
    target.removeEventListener(type, listener);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const words = (key: string, vars: Record<string, string | number> = {}, lang: 'vi' | 'en' = 'vi') =>
  WORDS[lang][key].replace(/\{(\w+)\}/g, (all, name: string) =>
    name in vars ? String(vars[name]) : all,
  );

describe('the walks page', () => {
  it('asks who is answering at every open, the last name filled in; answers are kept under it, trimmed, any case', async () => {
    await load();

    expect($('who-view').hidden).toBe(false);
    expect($('map-view').hidden).toBe(true);
    expect($<HTMLInputElement>('who-name').value).toBe('');
    expect(text('who-note')).toBe('');

    enter('   ');
    expect(text('who-note')).toBe(words('whoNeed'));
    expect($('who-view').hidden).toBe(false);

    enter('  P1 ');
    expect($('map-view').hidden).toBe(false);
    expect($('who-btn').textContent).toBe('P1');
    click(card('office-a'));
    yes();
    expect(stored('answers:p1')?.['office-a/a1']).toMatchObject({ answer: 'yes' });
    expect(Object.keys(stored('answers:p1') ?? {})).toEqual(['office-a/a1']);
    expect(stored('last-name')).toBe('P1');

    // a fresh page on the same storage fills the last name in and says so
    await load();
    expect($<HTMLInputElement>('who-name').value).toBe('P1');
    expect(text('who-note')).toBe(words('whoSeen', { name: 'P1' }));
    enter('p1');
    expect(text('left')).toBe(words('leftTop', { n: 5 }));
    // the name chip brings the question back, with the name typed; another name sees none
    click('who-btn');
    expect($<HTMLInputElement>('who-name').value).toBe('p1');
    enter('p2');
    expect(text('left')).toBe(words('leftTop', { n: 6 }));
  });

  it('opens a walk at its first new or changed screen, in its person’s language; L shows the other', async () => {
    await load({
      name: 'p1',
      seed: {
        'answers:p1': {
          'office-a/a1': {
            screen: 'office-a/a1',
            lang: 'vi',
            version: 'v-office-a-a1',
            answer: 'yes',
            memo: '',
            at: '2026-11-02T12:00:00.000Z',
          },
          'office-a/a2': {
            screen: 'office-a/a2',
            lang: 'vi',
            version: 'old',
            answer: 'yes',
            memo: '',
            at: '2026-11-02T12:00:00.000Z',
          },
        },
      },
    });

    click(card('office-a'));
    expect($('stage').hidden).toBe(false);
    expect($('where').textContent).toContain('2/3');
    expect($('where').textContent).toContain('Văn phòng');
    expect(frameText()).toContain('a2 vi');
    expect($('frame-wrap').className).toBe('frame-wrap pc');
    expect($('frame-wrap').querySelector('iframe')!.title).toBe(
      words('frameTitle', { n: 2, lang: words('lang_vi'), device: words('dev_pc'), width: 1280 }),
    );

    press('l');
    expect(frameText()).toContain('a2 en');
    expect($('sub').textContent).toContain(words('lang_en'));
    press('L');
    expect(frameText()).toContain('a2 vi');
    press('l');
    press('y');
    vi.advanceTimersByTime(500);
    expect(stored('answers:p1')!['office-a/a2']).toMatchObject({ lang: 'en', answer: 'yes' });
    expect(frameText()).toContain('a3 en');
  });

  it('keeps one answer a screen, Yes or No, a No needing a memo, keeping version, language, memo and time', async () => {
    await load({ name: 'p1' });
    click(card('office-a'));

    yes();
    expect(stored('answers:p1')).toEqual({
      'office-a/a1': {
        screen: 'office-a/a1',
        lang: 'vi',
        version: 'v-office-a-a1',
        answer: 'yes',
        memo: '',
        at: '2026-11-03T01:00:00.000Z',
      },
    });
    expect(text('said')).toBe(
      words('saved', { answer: words('st_yes'), n: 1, lang: words('lang_vi') }),
    );
    expect($('stamp').className).toContain('go');
    expect(frameText()).toContain('a2 vi');

    // No opens the memo; with none, it is not saved
    click('no');
    expect($('memo').hidden).toBe(false);
    click('memo-save');
    expect(text('said')).toBe(words('memoNeed'));
    expect($<HTMLTextAreaElement>('memo-text').classList.contains('need')).toBe(true);
    expect($<HTMLTextAreaElement>('memo-text').placeholder).toBe(words('memoNeed'));
    expect(Object.keys(stored('answers:p1')!)).toEqual(['office-a/a1']);

    // a memo saves it as a No, on Enter; the keys are the field's while it has the focus
    press('l');
    $<HTMLTextAreaElement>('memo-text').value = '  the total  is wrong ';
    $('memo-text').focus();
    const enterKey = press('Enter');
    expect(enterKey.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(500);
    expect(stored('answers:p1')!['office-a/a2']).toMatchObject({
      lang: 'vi',
      answer: 'no',
      memo: 'the total  is wrong',
    });
    expect(frameText()).toContain('a3 vi');
    expect($('mark').textContent).toBe('');

    // the same screen again: one answer, the last
    click('to-map');
    click(card('office-a'));
    click(document.querySelector('#wl-items button[data-screen="a2"]')!);
    expect($('mark').textContent).toBe(
      words('markSaidMemo', { answer: words('ans_no'), memo: 'the total  is wrong' }),
    );
    click('no');
    expect($<HTMLTextAreaElement>('memo-text').value).toBe('the total  is wrong');
    click('no');
    expect($('memo').hidden).toBe(true);
    press('Y');
    vi.advanceTimersByTime(500);
    expect(stored('answers:p1')!['office-a/a2']).toMatchObject({ answer: 'yes', memo: '' });
    expect(Object.keys(stored('answers:p1')!)).toHaveLength(2);
  });

  it('reads a kept version that is not the build’s as changed, and its card counts it', async () => {
    await load({
      name: 'p1',
      seed: {
        'answers:p1': {
          'office-a/a1': {
            screen: 'office-a/a1',
            lang: 'vi',
            version: 'old',
            answer: 'no',
            memo: 'was wrong',
            at: '2026-11-02T12:00:00.000Z',
          },
          'office-a/a2': {
            screen: 'office-a/a2',
            lang: 'en',
            version: 'v-office-a-a2',
            answer: 'yes',
            memo: '',
            at: 'not a time',
          },
          'office-a/a3': {
            screen: 'office-a/a3',
            lang: 'vi',
            version: 'older',
            answer: 'yes',
            memo: '',
            at: '2026-11-02T12:00:00.000Z',
          },
          'office-b/b1': {
            screen: 'office-b/b1',
            lang: 'vi',
            version: 'older',
            answer: 'yes',
            memo: '',
            at: 'not a time',
          },
        },
      },
    });

    expect(card('office-a').textContent).toContain(words('pillLeft', { n: 2 }));
    expect(card('office-a').textContent).toContain(words('pillChanged', { n: 2 }));
    expect(card('office-b').textContent).toContain(words('pillLeft', { n: 1 }));
    expect(card('office-b').textContent).toContain(words('pillChanged', { n: 1 }));
    expect(text('map-sum')).toBe(words('mapSumLeft', { left: 5, all: 6, fresh: 2, changed: 3 }));

    click(card('office-a'));
    expect($('mark').textContent).toBe(
      words('markChanged', { answer: words('ans_no'), day: '2/11' }),
    );
    expect($('mark').className).toBe('mark hi');
    expect($('badge').textContent).toBe(`${words('st_changed')} ✎`);
    expect(rows()[0]).toContain(words('st_changed'));
    expect(rows()[1]).toContain(words('st_yes'));
    click(document.querySelector('#wl-items button[data-screen="a2"]')!);
    expect($('mark').textContent).toBe(words('markSaid', { answer: words('ans_yes') }));
    // a time that does not read leaves the day out
    click('to-map');
    click(card('office-b'));
    expect($('mark').textContent).toBe(words('markChanged', { answer: words('ans_yes'), day: '' }));
    // the English day
    click('to-map');
    click(card('office-a'));
    click(document.querySelectorAll('#ui-langs button')[1]);
    click(document.querySelector('#wl-items button[data-screen="a3"]')!);
    expect($('mark').textContent).toBe(
      words('markChanged', { answer: words('ans_yes', {}, 'en'), day: '2 Nov' }, 'en'),
    );
  });

  it('asks Yes to all once, skips a No or a memo, and Undo puts each back', async () => {
    const now = '2026-11-02T12:00:00.000Z';
    await load({
      name: 'p1',
      seed: {
        'answers:p1': {
          'office-a/a1': {
            screen: 'office-a/a1',
            lang: 'vi',
            version: 'old',
            answer: 'yes',
            memo: '',
            at: now,
          },
          'office-a/a2': {
            screen: 'office-a/a2',
            lang: 'vi',
            version: 'old',
            answer: 'no',
            memo: 'wrong',
            at: now,
          },
          'office-a/a3': {
            screen: 'office-a/a3',
            lang: 'vi',
            version: 'old',
            answer: 'yes',
            memo: 'with a note',
            at: now,
          },
        },
      },
    });
    click(card('office-a'));
    // a1 changed on a yes: it is a target; a2 a No and a3 a memo are not
    expect($<HTMLButtonElement>('all-yes').disabled).toBe(false);
    expect($('all-yes').title).toBe(words('allYesAsk', { n: 1 }));
    click('all-yes');
    expect($('all-box').hidden).toBe(false);
    expect($('all-h').textContent).toBe(words('allYesAsk', { n: 1 }));
    expect(document.activeElement).toBe($('all-go'));
    click('all-cancel');
    expect($('all-box').hidden).toBe(true);
    expect(stored('answers:p1')!['office-a/a1']).toMatchObject({ version: 'old' });

    click('all-yes-bar');
    click('all-go');
    expect($('all-box').hidden).toBe(true);
    expect(stored('answers:p1')!['office-a/a1']).toMatchObject({
      version: 'v-office-a-a1',
      answer: 'yes',
      at: '2026-11-03T01:00:00.000Z',
    });
    expect(stored('answers:p1')!['office-a/a2']).toMatchObject({ answer: 'no', memo: 'wrong' });
    expect(stored('answers:p1')!['office-a/a3']).toMatchObject({ version: 'old' });
    expect($('undo').hidden).toBe(false);
    expect(text('undo-t')).toBe(words('allYesDone', { n: 1 }));
    expect($<HTMLButtonElement>('all-yes').disabled).toBe(true);
    expect($('all-yes').title).toBe(words('allYesNone'));
    click('all-yes');
    expect(text('said')).toBe(words('allYesNone'));
    expect($('all-box').hidden).toBe(true);

    click('undo-btn');
    expect($('undo').hidden).toBe(true);
    expect(stored('answers:p1')!['office-a/a1']).toMatchObject({ version: 'old' });

    // a screen answered new goes back to new; the undo hides by itself after eight seconds
    click(card('office-b'));
    press('Y', { shiftKey: true });
    expect($('all-box').hidden).toBe(false);
    press('Enter');
    click('all-go');
    expect(stored('answers:p1')!['office-b/b1']).toMatchObject({ answer: 'yes' });
    click('undo-btn');
    expect(stored('answers:p1')!['office-b/b1']).toBeUndefined();
    click('all-yes');
    click('all-go');
    vi.advanceTimersByTime(8100);
    expect($('undo').hidden).toBe(true);
    expect(stored('answers:p1')!['office-b/b1']).toMatchObject({ answer: 'yes' });
  });

  it('places the map as one cell per person and stage, whatever a cell holds', async () => {
    await load({ name: 'p1' });

    const cells = [...document.querySelectorAll('#map > .cell')];
    expect(cells).toHaveLength(4);
    expect(document.querySelectorAll('#map > .person')).toHaveLength(2);
    expect(document.querySelectorAll('#map > .colhead')).toHaveLength(2);
    expect(cells.map((cell) => cell.className)).toEqual([
      'cell empty',
      'cell',
      'cell empty',
      'cell',
    ]);
    expect(cells[0].getAttribute('title')).toBe(words('emptyCell'));
    expect(cells[1].querySelectorAll('.card')).toHaveLength(2);
    expect(cells[3].querySelectorAll('.card')).toHaveLength(1);
    expect($('map').style.getPropertyValue('--parts')).toBe('2');
    expect(text('map-sum')).toBe(words('mapSumLeft', { left: 6, all: 6, fresh: 6, changed: 0 }));
    expect(text('build-line')).toBe(
      `${words('blBranch')}walks-page${words('blCommit')}abc123def${words('blTimes', { committed: '2026-11-03 00:25 +07', built: '2026-11-03 00:30 +07' })}`,
    );
    expect(card('office-a').textContent).toBe(
      `Hằng ngàyoffice-a vi${words('screens', { n: 3 })}${words('pillLeft', { n: 3 })}`,
    );

    // everything answered: the map says so, and a walk opens at its first screen
    click(card('office-b'));
    yes();
    click(card('office-a'));
    yes();
    yes();
    yes();
    click(card('driver-c'));
    yes();
    yes();
    expect(text('map-sum')).toBe(words('mapSumDone', { all: 6 }));
    expect(card('office-a').textContent).toContain(words('pillDone'));
    expect(card('office-a').className).toBe('card');
    expect($('meter').style.width).toBe('100%');
    click('to-map');
    click(card('office-a'));
    expect($('where').textContent).toContain('1/3');
  });

  it('says on the map, in the walk’s top line and in the block when the tree had changes', async () => {
    const data = makeData();
    data.build.changed = true;
    await load({ data, name: 'p1' });

    expect(text('build-line')).toContain(words('blWithChanges'));
    click(card('office-a'));
    expect($('build-short').textContent).toBe('walks-page · abc123def');
    expect($('build-short').title).toBe(
      `${words('blBranch')}walks-page${words('blCommit')}abc123def${words('blWithChanges')}${words('blTimes', { committed: data.build.committed, built: data.build.built })}`,
    );
    click('to-map');
    click('copy');
    expect($<HTMLTextAreaElement>('block-text').value).toContain(
      'abc123def with changes, committed',
    );
  });

  it('puts the build line in the Copy block with the name and a line a screen answered', async () => {
    await load({ name: ' P1 ' });
    click('copy');
    expect($('block').hidden).toBe(false);
    expect($('block-p').textContent).toBe(words('blockEmpty'));
    expect($<HTMLTextAreaElement>('block-text').value).toBe(
      'Credo walks answers\nBranch walks-page, commit abc123def, committed 2026-11-03 00:25 +07; built 2026-11-03 00:30 +07.\nBy: P1',
    );
    click('block-done');
    expect($('block').hidden).toBe(true);

    click(card('office-a'));
    yes();
    press('n');
    $<HTMLTextAreaElement>('memo-text').value = 'the cash\n gap   reads as a debt';
    press('Enter');
    vi.advanceTimersByTime(500);
    click('to-map');
    const clipboard = vi.fn(() => Promise.reject(new Error('refused')));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboard },
    });
    click('copy');
    expect(clipboard).toHaveBeenCalledOnce();
    expect($('block-p').textContent).toBe(words('blockCopied'));
    expect($<HTMLTextAreaElement>('block-text').value.split('\n').slice(2)).toEqual([
      'By: P1',
      'office-a/a1 | vi | version v-office-a-a1 | yes |  | 2026-11-03 01:00 UTC',
      'office-a/a2 | vi | version v-office-a-a2 | no | the cash gap reads as a debt | 2026-11-03 01:00 UTC',
    ]);
    // a clipboard that throws leaves the text in the box to copy by hand
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    click('block-done');
    click('copy');
    expect($('block').hidden).toBe(false);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    click('block-done');
    click('copy');
    expect($('block').hidden).toBe(false);
  });

  it('works without storage until the page closes', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    await load();
    expect($<HTMLInputElement>('who-name').value).toBe('');
    enter('p1');
    click(card('office-a'));
    yes();

    expect(text('left')).toBe(words('leftTop', { n: 5 }));
    expect(rows()[0]).toContain(words('st_yes'));
    click('who-btn');
    expect($<HTMLInputElement>('who-name').value).toBe('p1');
    enter('p1');
    expect(text('left')).toBe(words('leftTop', { n: 5 }));
  });

  it('switches the page’s own words to English and back, and keeps the choice', async () => {
    await load({ seed: { 'page-lang': 'xx' } });
    expect(document.documentElement.lang).toBe('vi');
    expect(text('who-go')).toContain(WORDS.vi['whoGo']);
    const buttons = () => [...document.querySelectorAll<HTMLElement>('#ui-langs button')];
    expect(buttons().map((one) => one.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    click(buttons()[1]);
    expect(document.documentElement.lang).toBe('en');
    expect(stored('page-lang')).toBe('en');
    expect(text('who-go')).toContain(WORDS.en['whoGo']);
    expect($('help').getAttribute('aria-label')).toBe(WORDS.en['helpLabel']);
    enter('p1');
    click(card('office-a'));
    // the same screen again, its frame kept and re-titled
    const picture = $('frame-wrap').querySelector('iframe');
    click(buttons()[0]);
    expect($('frame-wrap').querySelector('iframe')).toBe(picture);
    expect(picture!.title).toBe(
      words('frameTitle', { n: 1, lang: words('lang_vi'), device: words('dev_pc'), width: 1280 }),
    );
    expect($('where').textContent).toContain('Văn phòng');

    await load({ seed: { 'page-lang': 'en' } });
    expect(document.documentElement.lang).toBe('en');
  });

  it('shows the picture alone in Look, where F hides the bars, Y answers and Esc leaves', async () => {
    await load({ name: 'p1' });
    click(card('office-a'));
    expect(document.body.classList.contains('look')).toBe(false);
    expect($('badge').hidden).toBe(true);

    click('look');
    expect(document.body.classList.contains('look')).toBe(true);
    expect($('badge').hidden).toBe(false);
    expect($('badge').textContent).toBe(words('st_new'));
    // S does nothing in Look
    press('s');
    expect(stored('list-open')).toBeUndefined();
    press('Escape');
    expect(document.body.classList.contains('look')).toBe(false);
    press('f');
    expect(document.body.classList.contains('look')).toBe(true);
    click('badge');
    expect(document.body.classList.contains('look')).toBe(false);
    press('f');
    press('n');
    expect($('memo').hidden).toBe(false);
    expect(document.body.classList.contains('memo-open')).toBe(true);
    // F while a memo is open: the field takes the key
    press('f');
    expect(document.body.classList.contains('look')).toBe(true);
    // Esc closes the memo first, then Look; from the field it is the field's, from the page the page's
    press('Escape');
    expect($('memo').hidden).toBe(true);
    press('n');
    $('memo-text').blur();
    press('Escape');
    expect($('memo').hidden).toBe(true);
    expect(document.body.classList.contains('look')).toBe(true);
    press('Escape');
    expect(document.body.classList.contains('look')).toBe(false);
    press('Escape');
    expect($('stage').hidden).toBe(false);
    click('look');
    press('y');
    expect($('badge').textContent).toBe(words('st_yes'));
  });

  it('goes by the arrows, folds the list with S, cycles the width with W and opens the help with ?', async () => {
    await load({ name: 'p1' });
    click(card('office-a'));
    press('ArrowLeft');
    expect($('where').textContent).toContain('1/3');
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    expect($('where').textContent).toContain('3/3');
    press('ArrowLeft');
    expect($('where').textContent).toContain('2/3');

    expect(document.body.classList.contains('list-folded')).toBe(false);
    press('s');
    expect(document.body.classList.contains('list-folded')).toBe(true);
    expect(stored('list-open')).toBe(false);
    expect($('list-btn').getAttribute('aria-expanded')).toBe('false');
    click('list-btn');
    expect(document.body.classList.contains('list-folded')).toBe(false);
    click('list-fold');
    expect(stored('list-open')).toBe(false);
    click('list-btn');

    const width = () => $('frame-wrap').className;
    expect(width()).toBe('frame-wrap pc');
    press('w');
    expect(width()).toBe('frame-wrap tablet');
    expect($('sub').textContent).toContain(words('notTheirWidth', { device: words('dev_pc') }));
    press('w');
    expect(width()).toBe('frame-wrap phone');
    expect($('frame-wrap').querySelector('iframe')!.style.height).toBe('844px');
    press('w');
    expect(width()).toBe('frame-wrap pc');
    press('w');
    expect($('frame-wrap').querySelector('iframe')!.style.height).toBe('1024px');

    // the width chosen stays for the next walk; a phone walk's own is the phone's, with no note
    click('to-map');
    click(card('driver-c'));
    expect(width()).toBe('frame-wrap tablet');
    press('w');
    expect(width()).toBe('frame-wrap phone');
    expect($('sub').textContent).not.toContain(
      words('notTheirWidth', { device: words('dev_phone') }),
    );
    press('w');
    expect(width()).toBe('frame-wrap pc');

    // the help takes the keys while it is open, and Esc or Close shuts it
    expect(press('?').defaultPrevented).toBe(false);
    expect($('helpbox').hidden).toBe(false);
    press('ArrowRight');
    expect($('where').textContent).toContain('1/2');
    press('Escape');
    expect($('helpbox').hidden).toBe(true);
    click('help');
    click('help-done');
    expect($('helpbox').hidden).toBe(true);
    // a key with a modifier is the browser's
    press('ArrowRight', { ctrlKey: true });
    press('l', { metaKey: true });
    press('l', { altKey: true });
    expect($('where').textContent).toContain('1/2');
    // a key the page does not know is left alone
    expect(press('q').defaultPrevented).toBe(false);
  });

  it('keeps the memo’s own keys: Shift+Enter is a new line, Esc cancels, M opens it with the old memo', async () => {
    await load({ name: 'p1' });
    click(card('office-a'));
    yes();
    click('to-map');
    click(card('office-a'));
    click(document.querySelector('#wl-items button[data-screen="a1"]')!);

    press('m');
    expect($('memo').hidden).toBe(false);
    expect($('memo-no').hidden).toBe(false);
    expect($('memo-save-t').textContent).toBe(words('memoYes'));
    expect($<HTMLTextAreaElement>('memo-text').placeholder).toBe(words('memoPhMemo'));
    $<HTMLTextAreaElement>('memo-text').value = 'a note';
    expect(press('Enter', { shiftKey: true }).defaultPrevented).toBe(false);
    expect($('memo').hidden).toBe(false);
    press('Escape');
    expect($('memo').hidden).toBe(true);
    expect($<HTMLTextAreaElement>('memo-text').value).toBe('');

    // M again closes it; the button's Save as No saves a memo as a No
    click('memo-btn');
    click('memo-btn');
    expect($('memo').hidden).toBe(true);
    click('memo-btn');
    $<HTMLTextAreaElement>('memo-text').value = 'cash is short';
    click('memo-no');
    vi.advanceTimersByTime(500);
    expect(stored('answers:p1')!['office-a/a1']).toMatchObject({
      answer: 'no',
      memo: 'cash is short',
    });

    // a memo on a Yes is kept with it
    click('to-map');
    click(card('office-b'));
    click('memo-btn');
    $<HTMLTextAreaElement>('memo-text').value = 'fine, but late';
    click('memo-save');
    vi.advanceTimersByTime(500);
    expect(stored('answers:p1')!['office-b/b1']).toMatchObject({
      answer: 'yes',
      memo: 'fine, but late',
    });
    click(document.querySelector('#wl-items button[data-screen="b1"]')!);
    expect($('mark').textContent).toBe(
      words('markSaidMemo', { answer: words('ans_yes'), memo: 'fine, but late' }),
    );
    click('memo-btn');
    expect($<HTMLTextAreaElement>('memo-text').value).toBe('fine, but late');
    click('memo-cancel');
    expect($('memo').hidden).toBe(true);
    expect($('badge').textContent).toBe(`${words('st_yes')} ✎`);
  });

  it('opens the View menu, closes it by a click elsewhere, and sets the width, the screens’ language and the colour', async () => {
    await load({ name: 'p1' });
    const menu = $('menu');
    // on the map the menu holds the colour alone
    click('menu-btn');
    expect(menu.hidden).toBe(false);
    expect($('menu-walk').hidden).toBe(true);
    expect($('menu-btn').getAttribute('aria-expanded')).toBe('true');
    click('menu-btn');
    expect(menu.hidden).toBe(true);
    click('menu-btn');
    click(menu);
    expect(menu.hidden).toBe(false);
    click(document.body);
    expect(menu.hidden).toBe(true);
    click(document.body);

    click(card('driver-c'));
    click('menu-btn');
    const widths = [...document.querySelectorAll<HTMLElement>('#widths button')];
    expect(widths.map((one) => one.textContent)).toEqual(
      ['PC 1280', 'tablet 768', 'phone 390'].map(
        (_, at) => `${words(['dev_pc', 'dev_tablet', 'dev_phone'][at])} ${[1280, 768, 390][at]}`,
      ),
    );
    expect(widths.map((one) => one.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
    expect($('theirs').textContent).toBe(
      words('theirsWalk', { who: 'Tài xế', device: `${words('dev_phone')} 390` }),
    );
    click(widths[0]);
    expect($('frame-wrap').className).toBe('frame-wrap pc');
    click(document.querySelectorAll('#widths button')[2]);
    expect($('frame-wrap').className).toBe('frame-wrap phone');
    click(document.querySelectorAll('#langs button')[1]);
    expect(frameText()).toContain('c1 en');
    expect($('sub').textContent).toContain(words('lang_en'));

    const themes = [...document.querySelectorAll<HTMLElement>('#theme button')];
    click(themes[2]);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(themes.map((one) => one.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
    click(themes[1]);
    expect(document.documentElement.dataset['theme']).toBe('light');
    click(themes[0]);
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    // Esc shuts the menu
    press('Escape');
    expect(menu.hidden).toBe(true);
  });

  it('closes the menu and every dialog on Esc, and leaves the keys to a dialog or a field', async () => {
    await load({ name: 'p1' });
    click(card('office-a'));
    click('menu-btn');
    click('copy');
    expect($('block').hidden).toBe(false);
    press('Escape');
    expect(menu(true)).toBe(true);
    expect($('block').hidden).toBe(true);
    click('all-yes');
    expect($('all-box').hidden).toBe(false);
    // a key does nothing while the dialog is open
    press('y');
    expect(stored('answers:p1')).toBeUndefined();
    press('Escape');
    expect($('all-box').hidden).toBe(true);
    // nor does a key typed into the name field
    click('who-btn');
    const field = $<HTMLInputElement>('who-name');
    field.focus();
    press('?');
    expect($('helpbox').hidden).toBe(true);
    // the map has no walk keys
    field.blur();
    enter('p1');
    press('y');
    press('f');
    expect(stored('answers:p1')).toBeUndefined();
    expect($('stage').hidden).toBe(true);
  });

  it('goes back to the map from the brand and the arrow, and leaves the brand alone on the first page', async () => {
    await load();
    click('brand');
    expect($('who-view').hidden).toBe(false);
    enter('p1');
    click(card('office-a'));
    click('brand');
    expect($('map-view').hidden).toBe(false);
    click(card('office-a'));
    click('to-map');
    expect($('map-view').hidden).toBe(false);
  });

  it('goes to the map after the last screen, and not when the walk was left in the meantime', async () => {
    await load({ name: 'p1' });
    click(card('office-b'));
    yes();
    expect($('map-view').hidden).toBe(false);

    click(card('office-a'));
    click('yes');
    click('to-map');
    vi.advanceTimersByTime(500);
    expect($('map-view').hidden).toBe(false);
    expect($('stage').hidden).toBe(true);
  });

  it('does not wait for the next screen when the person asks for less motion', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    await load({ name: 'p1' });
    click(card('office-a'));
    click('yes');
    vi.advanceTimersByTime(0);
    expect(frameText()).toContain('a2 vi');
  });

  it('folds the list on a narrow window, and keeps what the person chose', async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    await load({ name: 'p1' });
    click(card('office-a'));
    expect(document.body.classList.contains('list-folded')).toBe(true);
    await load({ name: 'p1', seed: { 'list-open': true } });
    click(card('office-a'));
    expect(document.body.classList.contains('list-folded')).toBe(false);
  });

  it('fits the frame to the room the picture has, and grows it to what the screen draws', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    await load({ name: 'p1' });
    $('pic').style.paddingLeft = '20px';
    click(card('office-a'));
    let picture = $('frame-wrap').querySelector('iframe')!;
    // the room is 640 less two paddings, the PC's 1280 scaled to it
    expect(picture.style.transform).toBe('scale(0.46875)');
    expect($('frame-wrap').style.width).toBe('600px');
    expect($('frame-wrap').style.height).toBe(`${800 * 0.46875}px`);

    // the frame's own page is taller: it grows
    Object.defineProperty(picture.contentDocument!.documentElement, 'scrollHeight', {
      value: 1500,
    });
    vi.advanceTimersByTime(40);
    expect(picture.style.height).toBe('1500px');
    expect($('frame-wrap').style.height).toBe(`${1500 * 0.46875}px`);
    vi.advanceTimersByTime(300);
    expect(picture.style.height).toBe('1500px');

    // a screen left before its timers run is not touched by them
    press('ArrowRight');
    picture = $('frame-wrap').querySelector('iframe')!;
    expect(picture.style.height).toBe('800px');
    press('ArrowRight');
    vi.advanceTimersByTime(400);

    // the room changes: the observer refits; with none to fit, nothing is touched
    observed[0]([]);
    click('to-map');
    observed[0]([]);
  });

  it('refits on the window’s resize where the browser has no observer', async () => {
    (window as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0);
    await load({ name: 'p1' });
    click(card('office-a'));
    window.dispatchEvent(new Event('resize'));
    expect($('frame-wrap').querySelector('iframe')!.style.transform).toBe('scale(1)');
  });
});

const menu = (hidden: boolean) => $('menu').hidden === hidden;
