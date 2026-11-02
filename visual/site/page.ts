// The walks page: who is answering first, then the map of the day; a
// walk opens at its first screen left to answer, its screens listed beside the picture, its one
// question in a slim bar, or the picture alone in Look. Answers stay in this browser, one set a
// name. The build bundles it into one classic script, so it runs from file://.
import type { PageData, PageScreen, PageWalk } from './data';
import { WORDS } from './words';

type Lang = 'vi' | 'en';
type Kind = 'new' | 'changed' | 'yes' | 'no';
type Item = { walk: string; screen: string };
type At = Item & { lang: Lang };
/** An answer as kept: the screen's name, the picture's version, yes or no, the memo and the time. */
type Answer = {
  screen: string;
  lang: Lang;
  version: string;
  answer: 'yes' | 'no';
  memo: string;
  at: string;
};
type Status = { kind: 'new' } | { kind: 'changed' | 'yes' | 'no'; was: Answer };
type Vars = Record<string, string | number | boolean>;

{
  const W: PageData = window.WALKS_DATA;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const whoName = $<HTMLInputElement>('who-name');
  const memoText = $<HTMLTextAreaElement>('memo-text');
  const blockBox = $<HTMLTextAreaElement>('block-text');
  const LANGS: Lang[] = ['vi', 'en'];
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const person = (id: string) => W.people.find((p) => p.id === id)!;
  const walkOf = (id: string) => W.walks.find((w) => w.id === id)!;
  const screenOf = (walk: PageWalk, id: string) => walk.screens.find((s) => s.id === id)!;
  // One answer a screen, whichever language it was given on.
  const keyOf = (item: Item) => `${item.walk}/${item.screen}`;

  // Storage: every read and write may throw (a private window, a blocked site, an opaque origin),
  // and the page works without it, its answers then living until the page closes.
  const PREFIX = 'credo-walks:';
  const memory: Record<string, unknown> = {};
  const store = {
    get<T>(name: string, fallback: T): T {
      try {
        const raw = window.localStorage.getItem(PREFIX + name);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch {
        /* read from memory below */
      }
      return name in memory ? (memory[name] as T) : fallback;
    },
    set(name: string, value: unknown) {
      memory[name] = value;
      try {
        window.localStorage.setItem(PREFIX + name, JSON.stringify(value));
      } catch {
        /* kept in memory only */
      }
    },
  };

  // The page's own words, Tiếng Việt first. The screens open in the language their person reads.
  const savedLang = store.get<Lang>('page-lang', 'vi');
  let ui: Lang = LANGS.includes(savedLang) ? savedLang : 'vi';
  function t(key: string, vars?: Vars) {
    const text = WORDS[ui][key];
    return text.replace(/\{(\w+)\}/g, (_all, name: string) => String(vars![name]));
  }
  const answerWord = (kind: Kind) => t(`st_${kind}`);
  const inline = (kind: string) => t(`ans_${kind}`); // an answer inside a sentence
  const langName = (l: Lang) => t(`lang_${l}`);
  const deviceName = (d: { id: string; width: number }) => `${t(`dev_${d.id}`)} ${d.width}`;
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return ui === 'vi'
      ? `${d.getDate()}/${d.getMonth() + 1}`
      : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  function applyWords() {
    document.documentElement.lang = ui;
    for (const e of document.querySelectorAll<HTMLElement>('[data-t]'))
      e.textContent = t(e.dataset['t']!);
    for (const e of document.querySelectorAll<HTMLElement>('[data-t-title]'))
      e.title = t(e.dataset['tTitle']!);
    for (const e of document.querySelectorAll<HTMLElement>('[data-t-aria-label]'))
      e.setAttribute('aria-label', t(e.dataset['tAriaLabel']!));
  }

  // A screen's version: the build's own, twelve hex digits over what the screen draws.
  const versionOf = (item: Item) => screenOf(walkOf(item.walk), item.screen).version;

  const state = {
    view: 'who' as 'who' | 'map' | 'walk',
    name: '', // as typed
    at: null as At | null,
    show: null as string | null, // a device id; null is the person's own
    look: false,
    memo: null as 'no' | 'memo' | null,
    listOpen: store.get('list-open', !window.matchMedia('(max-width: 760px)').matches),
  };
  // Answers are kept under the name, trimmed and compared without case.
  const nameKey = () => state.name.trim().toLowerCase();
  const answers = () => store.get<Record<string, Answer>>(`answers:${nameKey()}`, {});

  function statusOf(item: Item): Status {
    const mine = answers()[keyOf(item)];
    if (!mine) return { kind: 'new' };
    if (mine.version !== versionOf(item)) return { kind: 'changed', was: mine };
    return { kind: mine.answer, was: mine };
  }
  const isLeft = (item: Item) => {
    const k = statusOf(item).kind;
    return k === 'new' || k === 'changed';
  };
  // The language each person reads: the demo company's people all read Vietnamese.
  const READS: Record<string, Lang> = { operator: 'vi', admin: 'vi', office: 'vi', driver: 'vi' };
  const readsOf = (walk: PageWalk) => READS[walk.person];
  const itemsOf = (walk: PageWalk): Item[] =>
    walk.screens.map((screen) => ({ walk: walk.id, screen: screen.id }));
  const allItems = () => W.walks.flatMap(itemsOf);

  // The build line, in full and in short, from the build's own record.
  const b = W.build;
  const buildFull = () =>
    `${t('blBranch')}${b.branch}${t('blCommit')}${b.commit}${b.changed ? t('blWithChanges') : ''}${t('blTimes', b)}`;
  const buildShort = `${b.branch} · ${b.commit}`;

  // The screen, in a frame of its own at the device's width, scaled to the room the picture has.
  let frame: HTMLIFrameElement | null = null;
  let drawnKey = '';
  function deviceFor(walk: PageWalk) {
    const id = state.show || person(walk.person).device;
    return W.devices.find((d) => d.id === id)!;
  }
  function draw() {
    const wrap = $('frame-wrap');
    const walk = walkOf(state.at!.walk);
    const screen = screenOf(walk, state.at!.screen);
    const device = deviceFor(walk);
    const key = `${state.at!.walk}/${state.at!.screen}/${state.at!.lang}/${device.id}`;
    const html = W.captures[`${state.at!.walk}/${state.at!.screen}/${state.at!.lang}`];
    wrap.className = `frame-wrap ${device.id}`;
    if (drawnKey === key) {
      frame!.title = t('frameTitle', {
        n: screen.number,
        lang: langName(state.at!.lang),
        device: t(`dev_${device.id}`),
        width: device.width,
      });
      return fit();
    }
    drawnKey = key;
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = t('frameTitle', {
      n: screen.number,
      lang: langName(state.at!.lang),
      device: t(`dev_${device.id}`),
      width: device.width,
    });
    frame.setAttribute('tabindex', '-1');
    frame.style.width = `${device.width}px`;
    frame.style.height = `${device.id === 'phone' ? 844 : device.id === 'tablet' ? 1024 : 800}px`;
    wrap.insertBefore(frame, $('stamp'));
    // The screen goes into the frame's own page, so its width is the viewport the app's CSS reads.
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      `<!doctype html><html lang="${state.at!.lang}" data-mantine-color-scheme="light"><head><meta charset="utf-8">` +
        `<style>${W.css}</style><style>body{margin:0}</style></head><body>${html.replace(/<!--style:(\d+)-->/g, (_tag, n: string) => `<style data-mantine-styles="true">${W.styles[Number(n)]}</style>`)}</body></html>`,
    );
    doc.close();
    const mine = frame;
    const grow = () => {
      if (frame !== mine) return;
      const h = mine.contentDocument!.documentElement.scrollHeight;
      if (h > parseFloat(mine.style.height) + 1) mine.style.height = `${h}px`;
      fit();
    };
    setTimeout(grow, 30);
    setTimeout(grow, 300);
    fit();
  }
  function fit() {
    if (!frame || !state.at || state.view !== 'walk') return;
    const device = deviceFor(walkOf(state.at.walk));
    const pic = $('pic');
    const pad = parseFloat(getComputedStyle(pic).paddingLeft) || 0;
    const room = pic.clientWidth - pad * 2;
    const scale = room > 0 ? Math.min(1, room / device.width) : 1;
    frame.style.transform = `scale(${scale})`;
    const wrap = $('frame-wrap');
    wrap.style.width = `${device.width * scale}px`;
    wrap.style.height = `${parseFloat(frame.style.height) * scale}px`;
  }

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function segment(
    host: HTMLElement,
    items: { id: string; label: string; title?: string }[],
    current: string | null,
    pick: (id: string) => void,
    cls?: string,
  ) {
    host.replaceChildren(
      ...items.map((item) => {
        const btn = el('button', cls === undefined ? 'btn' : cls, item.label);
        btn.type = 'button';
        if (item.title) btn.title = item.title;
        btn.setAttribute('aria-pressed', String(item.id === current));
        btn.addEventListener('click', () => pick(item.id));
        return btn;
      }),
    );
  }

  // The map of the day: people down, the day's stages across; one cell may hold several walks.
  function renderMap() {
    const map = $('map');
    map.style.setProperty('--parts', String(W.parts.length));
    map.replaceChildren(el('span', 'corner'));
    for (const part of W.parts) map.append(el('span', 'colhead', part.name[ui]));
    for (const p of W.people) {
      const who = el('div', 'person');
      who.append(el('b', '', p.name[ui]), el('span', '', t(`dev_${p.device}`)));
      map.append(who);
      for (const part of W.parts) {
        const walks = W.walks.filter((w) => w.person === p.id && w.part === part.id);
        const cell = el('div', walks.length ? 'cell' : 'cell empty');
        if (!walks.length) cell.title = t('emptyCell');
        for (const walk of walks) cell.append(card(walk, part));
        map.append(cell);
      }
    }
    const items = allItems();
    const left = items.filter(isLeft).length;
    const changed = items.filter((i) => statusOf(i).kind === 'changed').length;
    $('map-sum').textContent = left
      ? t('mapSumLeft', { left, all: items.length, fresh: left - changed, changed })
      : t('mapSumDone', { all: items.length });
    const line = el('span');
    line.append(t('blBranch'), el('code', '', b.branch), t('blCommit'), el('code', '', b.commit));
    line.append(`${b.changed ? t('blWithChanges') : ''}${t('blTimes', b)}`);
    $('build-line').replaceChildren(line);
  }
  function card(walk: PageWalk, part: { name: Record<Lang, string> }) {
    const items = itemsOf(walk);
    const left = items.filter(isLeft).length;
    const changed = items.filter((i) => statusOf(i).kind === 'changed').length;
    const btn = el('button', `card${left ? ' has-left' : ''}`);
    btn.type = 'button';
    btn.dataset.walk = walk.id;
    btn.append(
      el('span', 'part', part.name[ui]),
      el('b', '', walk.title[ui]),
      el('span', 'sub', t('screens', { n: walk.screens.length })),
    );
    const pills = el('span', 'pills');
    if (left) pills.append(el('span', 'pill left', t('pillLeft', { n: left })));
    if (changed) pills.append(el('span', 'pill changed', t('pillChanged', { n: changed })));
    if (!left) pills.append(el('span', 'pill done', t('pillDone')));
    btn.append(pills);
    btn.addEventListener('click', () => openWalk(walk.id));
    return btn;
  }

  // Who is answering: asked at every open, the last name used on this browser filled in.
  function showWho() {
    state.view = 'who';
    state.look = false;
    state.memo = null;
    closeMenu();
    whoName.value = state.name || store.get('last-name', '');
    render();
    whoName.focus();
  }
  function enterName() {
    const name = whoName.value.trim();
    if (!name) {
      $('who-note').textContent = t('whoNeed');
      whoName.focus();
      return;
    }
    state.name = name;
    store.set('last-name', name);
    whoName.blur();
    toMap();
  }

  function openWalk(id: string) {
    const walk = walkOf(id);
    const items = itemsOf(walk);
    // A walk opens in the language its person reads; L or View changes it for the rest of the walk.
    state.at = { ...(items.find(isLeft) || items[0]), lang: readsOf(walk) };
    state.view = 'walk';
    state.memo = null;
    state.look = false;
    say('');
    closeMenu();
    render();
  }
  function toMap() {
    state.view = 'map';
    state.look = false;
    state.memo = null;
    render();
    window.scrollTo({ top: 0 });
  }

  function render() {
    applyWords();
    const view = state.view;
    const inWalk = view === 'walk';
    document.body.classList.toggle('in-walk', inWalk);
    document.body.classList.toggle('look', inWalk && state.look);
    document.body.classList.toggle('memo-open', inWalk && Boolean(state.memo));
    document.body.classList.toggle('list-folded', !state.listOpen);
    $('who-view').hidden = view !== 'who';
    $('map-view').hidden = view !== 'map';
    $('stage').hidden = !inWalk;
    $('bar').hidden = !inWalk;
    $('to-map').hidden = !inWalk;
    $('list-btn').hidden = !inWalk;
    $('list-btn').setAttribute('aria-expanded', String(state.listOpen));
    $('brand').classList.toggle('on-walk', inWalk);
    $('look').hidden = !inWalk;
    $('badge').hidden = !(inWalk && state.look);
    $('build-short').hidden = !inWalk;
    $('build-short').textContent = buildShort;
    $('build-short').title = buildFull();
    for (const id of ['left', 'copy', 'who-btn', 'menu-btn']) $(id).hidden = view === 'who';
    $('who-btn').textContent = state.name;
    segment(
      $('ui-langs'),
      LANGS.map((l) => ({ id: l, label: t(l === 'vi' ? 'uiVi' : 'uiEn'), title: langName(l) })),
      ui,
      setPageLang,
      '',
    );

    if (view === 'who') {
      const last = store.get('last-name', '');
      $('who-note').textContent = last ? t('whoSeen', { name: last }) : '';
      $('where').replaceChildren();
      return;
    }

    const items = allItems();
    const left = items.filter(isLeft).length;
    $('left').textContent = t('leftTop', { n: left });
    $('left').title = t('leftTitle', { n: left, all: items.length });
    $('meter').style.width = `${(100 * (items.length - left)) / items.length}%`;
    renderMenu();

    if (view === 'map') {
      $('where').replaceChildren(el('span', '', t('mapWhere')));
      renderMap();
      return;
    }

    const walk = walkOf(state.at!.walk);
    const screen = screenOf(walk, state.at!.screen);
    const who = person(walk.person);
    $('where').replaceChildren(
      el('span', 'person-t', who.name[ui]),
      el('b', 'walk-t', walk.title[ui]),
      el('span', '', `${screen.number}/${walk.screens.length}`),
    );
    renderList(walk, screen);

    const st = statusOf(state.at!);
    const memoMark = memoOf(st) ? ' ✎' : '';
    const badge = $('badge');
    badge.className = `badge s-${st.kind}`;
    badge.textContent = `${answerWord(st.kind)}${memoMark}`;
    badge.title = `${statusTitle(st)}${memoOf(st) ? `: “${memoOf(st)}”` : ''}${t('badgeTail')}`;
    const mark = $('mark');
    if (st.kind === 'changed') {
      mark.className = 'mark hi';
      mark.textContent = t('markChanged', { answer: inline(st.was.answer), day: day(st.was.at) });
    } else if (st.kind === 'yes' || st.kind === 'no') {
      mark.className = `mark said ${st.kind}`;
      mark.textContent = st.was.memo
        ? t('markSaidMemo', { answer: inline(st.kind), memo: st.was.memo })
        : t('markSaid', { answer: inline(st.kind) });
    } else {
      mark.className = 'mark';
      mark.textContent = '';
    }
    $('question').textContent = screen.question[ui];
    const device = deviceFor(walk);
    const own =
      device.id === who.device ? '' : t('notTheirWidth', { device: t(`dev_${who.device}`) });
    $('sub').textContent =
      `${screen.sentence[ui]} · ${langName(state.at!.lang)} · ${deviceName(device)}${own}`;

    const targets = allYesTargets(walk).length;
    for (const id of ['all-yes', 'all-yes-bar']) {
      $<HTMLButtonElement>(id).disabled = !targets;
      $(id).title = targets ? t('allYesAsk', { n: targets }) : t('allYesNone');
    }
    $('memo').hidden = !state.memo;
    $('memo').classList.toggle('for-no', state.memo === 'no');
    $('memo-no').hidden = state.memo !== 'memo';
    $('memo-save-t').textContent = state.memo === 'no' ? t('memoNo') : t('memoYes');
    if (!memoText.classList.contains('need'))
      memoText.placeholder = state.memo === 'no' ? t('memoPhNo') : t('memoPhMemo');
    $('no').setAttribute('aria-expanded', String(state.memo === 'no'));
    draw();
  }
  const memoOf = (st: Status) => ('was' in st ? st.was.memo : '');
  function statusTitle(st: Status) {
    if (st.kind === 'new') return t('stTitle_new');
    if (st.kind === 'changed') return t('stTitle_changed', { answer: inline(st.was.answer) });
    return t('stTitle_said', { answer: inline(st.kind) });
  }

  // The walk's screens beside the picture: each one's name, its answer in the screen's language.
  function renderList(walk: PageWalk, current: PageScreen) {
    $('wl-items').replaceChildren(
      ...walk.screens.map((s) => {
        const item = { walk: walk.id, screen: s.id, lang: state.at!.lang };
        const st = statusOf(item); // the screen's one answer, whichever language is on view
        const li = el('li');
        const btn = el('button');
        btn.type = 'button';
        btn.dataset.screen = s.id;
        btn.setAttribute('aria-current', String(s.id === current.id));
        const mark = el(
          'span',
          `st s-${st.kind}`,
          `${answerWord(st.kind)}${memoOf(st) ? ' ✎' : ''}`,
        );
        mark.title = statusTitle(st);
        btn.append(el('span', 'num', String(s.number)), el('span', 'nm', s.sentence[ui]), mark);
        btn.addEventListener('click', () => go(item));
        li.append(btn);
        return li;
      }),
    );
  }

  function renderMenu() {
    const inWalk = state.view === 'walk';
    $('menu-walk').hidden = !inWalk;
    if (!inWalk) return;
    const walk = walkOf(state.at!.walk);
    const who = person(walk.person);
    segment(
      $('widths'),
      W.devices.map((d) => ({ id: d.id, label: deviceName(d) })),
      deviceFor(walk).id,
      (id) => {
        state.show = id === who.device ? null : id;
        render();
      },
    );
    $('theirs').textContent = t('theirsWalk', {
      who: who.name[ui],
      device: deviceName(W.devices.find((d) => d.id === who.device)!),
    });
    segment(
      $('langs'),
      LANGS.map((l) => ({ id: l, label: langName(l) })),
      state.at!.lang,
      (lang) => go({ ...state.at!, lang: lang as Lang }),
    );
  }

  function setPageLang(lang: string) {
    ui = lang as Lang;
    store.set('page-lang', lang);
    say('');
    render();
  }

  function go(item: At) {
    state.at = { ...item };
    state.memo = null;
    memoText.value = '';
    render();
  }

  function stamp(kind: Kind) {
    const s = $('stamp');
    s.textContent = answerWord(kind);
    s.classList.toggle('no', kind === 'no');
    s.classList.remove('go');
    void s.offsetWidth;
    s.classList.add('go');
  }
  function say(text: string) {
    $('said').textContent = text;
  }

  // An answer keeps the screen's name, the picture's version, yes or no, the memo and the time.
  function answer(kind: 'yes' | 'no', memo: string) {
    const here = state.at!;
    const all = answers();
    all[keyOf(here)] = {
      screen: `${here.walk}/${here.screen}`,
      lang: here.lang,
      version: versionOf(here),
      answer: kind,
      memo,
      at: new Date().toISOString(),
    };
    store.set(`answers:${nameKey()}`, all);
    stamp(kind);
    const walk = walkOf(here.walk);
    say(
      t('saved', {
        answer: answerWord(kind),
        n: screenOf(walk, here.screen).number,
        lang: langName(here.lang),
      }),
    );
    const items = itemsOf(walk);
    const at = items.findIndex((i) => keyOf(i) === keyOf(here));
    const next = items
      .slice(at + 1)
      .concat(items.slice(0, at))
      .find(isLeft);
    const lang = here.lang;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.memo = null;
    memoText.value = '';
    memoText.blur();
    render();
    setTimeout(
      () => {
        if (state.view !== 'walk') return;
        if (next) go({ ...next, lang });
        else toMap();
      },
      still ? 0 : 420,
    );
  }

  function openMemo(kind: 'no' | 'memo') {
    state.memo = kind;
    const mine = answers()[keyOf(state.at!)];
    memoText.value = mine && mine.memo ? mine.memo : '';
    memoText.classList.remove('need');
    render();
    memoText.focus();
  }
  function saveMemo(kind?: 'yes' | 'no') {
    const memo = memoText.value.trim();
    const as = kind || (state.memo === 'no' ? 'no' : 'yes');
    if (as === 'no' && !memo) {
      say(t('memoNeed'));
      memoText.placeholder = t('memoNeed');
      memoText.classList.add('need');
      memoText.focus();
      return;
    }
    memoText.classList.remove('need');
    answer(as, memo);
  }
  function cancelMemo() {
    state.memo = null;
    memoText.value = '';
    memoText.classList.remove('need');
    memoText.blur();
    render();
  }

  function step(by: number) {
    const walk = walkOf(state.at!.walk);
    const at = walk.screens.findIndex((s) => s.id === state.at!.screen);
    const to = walk.screens[at + by];
    if (to) go({ ...state.at!, screen: to.id });
  }

  // Yes to all: every screen of the walk still left, new or changed, unless its last answer was a No
  // or carried a memo. It asks once, then offers an Undo that puts each screen back as it was.
  function allYesTargets(walk: PageWalk) {
    return itemsOf(walk).filter((item) => {
      const st = statusOf(item);
      if (st.kind === 'new') return true;
      return st.kind === 'changed' && st.was.answer !== 'no' && !st.was.memo;
    });
  }
  function askAllYes() {
    const n = allYesTargets(walkOf(state.at!.walk)).length;
    if (!n) {
      say(t('allYesNone'));
      return;
    }
    $('all-h').textContent = t('allYesAsk', { n });
    $('all-box').hidden = false;
    $('all-go').focus();
  }
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  function allYes() {
    $('all-box').hidden = true;
    const walk = walkOf(state.at!.walk);
    const all = answers();
    const before: Record<string, Answer | null> = {};
    const at = new Date().toISOString();
    for (const item of allYesTargets(walk)) {
      const k = keyOf(item);
      before[k] = all[k] || null;
      all[k] = {
        screen: k,
        lang: state.at!.lang,
        version: versionOf(item),
        answer: 'yes',
        memo: '',
        at,
      };
    }
    store.set(`answers:${nameKey()}`, all);
    const n = Object.keys(before).length;
    say(t('allYesDone', { n }));
    $('undo-t').textContent = t('allYesDone', { n });
    $('undo').hidden = false;
    $('undo-btn').onclick = () => {
      const now = answers();
      for (const [k, was] of Object.entries(before)) {
        if (was) now[k] = was;
        else delete now[k];
      }
      store.set(`answers:${nameKey()}`, now);
      clearTimeout(undoTimer);
      $('undo').hidden = true;
      render();
    };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => ($('undo').hidden = true), 8000);
    render();
  }

  // The block pasted into the chat: the build, the name, then one line a screen answered, with its
  // version and the language it was answered on. Its form is fixed, since the machine reads it.
  function blockText() {
    const all = answers();
    const lines = allItems()
      .filter((item) => all[keyOf(item)])
      .map((item) => {
        const a = all[keyOf(item)];
        const memo = a.memo.replace(/\s+/g, ' ').trim();
        return `${a.screen} | ${a.lang} | version ${a.version} | ${a.answer} | ${memo} | ${a.at.slice(0, 16).replace('T', ' ')} UTC`;
      });
    const line = `Branch ${b.branch}, commit ${b.commit}${b.changed ? ' with changes' : ''}, committed ${b.committed}; built ${b.built}.`;
    return ['Credo walks answers', line, `By: ${state.name}`].concat(lines).join('\n');
  }
  function openBlock() {
    const text = blockText();
    $('block-p').textContent = Object.keys(answers()).length ? t('blockCopied') : t('blockEmpty');
    blockBox.value = text;
    $('block').hidden = false;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    } catch {
      /* the text is in the box to copy by hand */
    }
    $('block-done').focus();
  }

  function openMenu() {
    $('menu').hidden = false;
    $('menu-btn').setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    $('menu').hidden = true;
    $('menu-btn').setAttribute('aria-expanded', 'false');
  }
  function toggleLook() {
    state.look = !state.look;
    state.memo = null;
    render();
  }
  function toggleList() {
    if (state.look) return;
    state.listOpen = !state.listOpen;
    store.set('list-open', state.listOpen);
    render();
  }

  $('who-form').addEventListener('submit', (event) => {
    event.preventDefault();
    enterName();
  });
  $('who-btn').addEventListener('click', showWho);
  $('to-map').addEventListener('click', toMap);
  $('brand').addEventListener('click', () => (state.view === 'who' ? null : toMap()));
  $('list-btn').addEventListener('click', toggleList);
  $('list-fold').addEventListener('click', toggleList);
  $('yes').addEventListener('click', () => answer('yes', ''));
  $('no').addEventListener('click', () => (state.memo === 'no' ? cancelMemo() : openMemo('no')));
  $('memo-btn').addEventListener('click', () =>
    state.memo === 'memo' ? cancelMemo() : openMemo('memo'),
  );
  $('memo-save').addEventListener('click', () => saveMemo());
  $('memo-no').addEventListener('click', () => saveMemo('no'));
  $('memo-cancel').addEventListener('click', cancelMemo);
  memoText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveMemo();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelMemo();
    }
  });
  $('all-yes').addEventListener('click', askAllYes);
  $('all-yes-bar').addEventListener('click', askAllYes);
  $('all-go').addEventListener('click', allYes);
  $('all-cancel').addEventListener('click', () => ($('all-box').hidden = true));
  $('look').addEventListener('click', toggleLook);
  $('badge').addEventListener('click', toggleLook);
  $('menu-btn').addEventListener('click', () => ($('menu').hidden ? openMenu() : closeMenu()));
  $('copy').addEventListener('click', openBlock);
  $('block-done').addEventListener('click', () => ($('block').hidden = true));
  $('help').addEventListener('click', () => ($('helpbox').hidden = false));
  $('help-done').addEventListener('click', () => ($('helpbox').hidden = true));
  for (const btn of $('theme').querySelectorAll('button'))
    btn.addEventListener('click', () => {
      if (btn.dataset.theme) document.documentElement.dataset.theme = btn.dataset.theme;
      else delete document.documentElement.dataset.theme;
      for (const o of $('theme').querySelectorAll('button'))
        o.setAttribute('aria-pressed', String(o === btn));
    });
  document.addEventListener('click', (event) => {
    if (
      !$('menu').hidden &&
      !$('menu').contains(event.target as Node) &&
      !$('menu-btn').contains(event.target as Node)
    )
      closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const dialogs = !$('block').hidden || !$('helpbox').hidden || !$('all-box').hidden;
    if (event.key === 'Escape') {
      if (dialogs || !$('menu').hidden) {
        closeMenu();
        $('block').hidden = true;
        $('helpbox').hidden = true;
        $('all-box').hidden = true;
      } else if (state.memo) cancelMemo();
      else if (state.look) toggleLook();
      return;
    }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement!.tagName);
    if (typing || dialogs) return;
    const k = event.key.toLowerCase();
    if (k === '?') {
      $('helpbox').hidden = false;
      return;
    }
    if (state.view !== 'walk') return;
    const walk = walkOf(state.at!.walk);
    const acts: Record<string, () => void> = {
      f: toggleLook,
      s: toggleList,
      arrowright: () => step(1),
      arrowleft: () => step(-1),
      l: () => go({ ...state.at!, lang: state.at!.lang === 'vi' ? 'en' : 'vi' }),
      w: () => {
        const ids = W.devices.map((d) => d.id);
        const next = ids[(ids.indexOf(deviceFor(walk).id) + 1) % ids.length];
        state.show = next === person(walk.person).device ? null : next;
        render();
      },
      // Look answers too: Y at once, N and M by the memo floating over the picture's foot.
      y: () => answer('yes', ''),
      n: () => openMemo('no'),
      m: () => openMemo('memo'),
    };
    if (k === 'y' && event.shiftKey) {
      event.preventDefault();
      askAllYes();
    } else if (acts[k]) {
      event.preventDefault();
      acts[k]();
    }
  });

  if (window.ResizeObserver) new ResizeObserver(fit).observe($('pic'));
  else window.addEventListener('resize', fit);

  showWho();
}
