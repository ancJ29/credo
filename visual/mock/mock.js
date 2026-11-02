// The walks page's next look, as a static mock: who is answering first, then the map of the day; a
// walk opens at its first screen left to answer, its screens listed beside the picture, its one
// question in a slim bar, or the picture alone in Look. Answers stay in this browser, one set a
// name. Classic script, so it runs from file://.
(function () {
  'use strict';
  const W = window.MOCK_WALKS;
  const S = window.MOCK_SCREENS;
  const WORDS = window.MOCK_WORDS;
  const $ = (id) => document.getElementById(id);
  const LANGS = ['vi', 'en'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const person = (id) => W.people.find((p) => p.id === id);
  const walkOf = (id) => W.walks.find((w) => w.id === id);
  const screenOf = (walk, id) => walk.screens.find((s) => s.id === id);
  // One answer a screen, whichever language it was given on.
  const keyOf = (item) => `${item.walk}/${item.screen}`;
  const captured = (walk) =>
    walk.screens.some((s) => Object.keys(S.screens).some((k) => k.startsWith(`${walk.id}/${s.id}/`)));

  // Storage: every read and write may throw (a private window, a blocked site, an opaque origin),
  // and the page works without it, its answers then living until the page closes.
  const PREFIX = 'credo-walks-mock:';
  const memory = {};
  const store = {
    get(name, fallback) {
      try {
        const raw = window.localStorage.getItem(PREFIX + name);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) {
        /* read from memory below */
      }
      return name in memory ? memory[name] : fallback;
    },
    set(name, value) {
      memory[name] = value;
      try {
        window.localStorage.setItem(PREFIX + name, JSON.stringify(value));
      } catch (e) {
        /* kept in memory only */
      }
    },
    drop(name) {
      delete memory[name];
      try {
        window.localStorage.removeItem(PREFIX + name);
      } catch (e) {
        /* nothing was kept */
      }
    },
  };

  // The page's own words, Tiếng Việt first. The screens open in the language their person reads.
  let ui = LANGS.includes(store.get('page-lang', 'vi')) ? store.get('page-lang', 'vi') : 'vi';
  function t(key, vars) {
    const text = WORDS[ui][key];
    return text.replace(/\{(\w+)\}/g, (all, name) => (vars && name in vars ? String(vars[name]) : all));
  }
  const answerWord = (kind) => t(`st_${kind}`);
  const inline = (kind) => t(`ans_${kind}`); // an answer inside a sentence
  const langName = (l) => t(`lang_${l}`);
  const deviceName = (d) => `${t(`dev_${d.id}`)} ${d.width}`;
  const day = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return ui === 'vi' ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  function applyWords() {
    document.documentElement.lang = ui;
    for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
    for (const e of document.querySelectorAll('[data-t-title]')) e.title = t(e.dataset.tTitle);
    for (const e of document.querySelectorAll('[data-t-aria-label]')) e.setAttribute('aria-label', t(e.dataset.tAriaLabel));
  }

  // A screen's version: an opaque id, one per screen. The mock makes its own; what the real page
  // computes it from is not settled here.
  function opaque(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
  const FIXED_NEWER = ['office-orders/orders-4-confirmed', 'driver-deliveries/driver-2-request', 'office-reconcile/reconcile-3-cash'];
  const newerScreens = () => store.get('newer-build', null);
  function versionOf(item) {
    const newer = newerScreens();
    const moved = newer && newer.includes(`${item.walk}/${item.screen}`);
    return opaque(`${W.build.commit}/${keyOf(item)}${moved ? '/newer' : ''}`);
  }

  const state = {
    view: 'who',
    name: '', // as typed
    at: null,
    show: null, // a device id; null is the person's own
    look: false,
    memo: null, // null, 'no' or 'memo'
    listOpen: store.get('list-open', !(window.matchMedia && window.matchMedia('(max-width: 760px)').matches)),
  };
  // Answers are kept under the name, trimmed and compared without case.
  const nameKey = () => state.name.trim().toLowerCase();
  const answers = () => store.get(`answers:${nameKey()}`, {});

  function statusOf(item) {
    const mine = answers()[keyOf(item)];
    if (!mine) return { kind: 'new' };
    if (mine.version !== versionOf(item)) return { kind: 'changed', was: mine };
    return { kind: mine.answer, was: mine };
  }
  const isLeft = (item) => {
    const k = statusOf(item).kind;
    return k === 'new' || k === 'changed';
  };
  // The language each person reads: the demo company's people all read Vietnamese.
  const READS = { operator: 'vi', admin: 'vi', office: 'vi', driver: 'vi' };
  const readsOf = (walk) => READS[walk.person] || 'vi';
  const itemsOf = (walk) => walk.screens.map((screen) => ({ walk: walk.id, screen: screen.id }));
  const allItems = () => W.walks.flatMap(itemsOf);

  // The build line, in full and in short, from the build's own record.
  const b = W.build;
  const buildFull = () =>
    `${t('blBranch')}${b.branch}${t('blCommit')}${b.commit}${b.changed ? t('blWithChanges') : ''}${t('blTimes', b)}`;
  const buildShort = `${b.branch} · ${b.commit}`;

  // The screen, in a frame of its own at the device's width, scaled to the room the picture has.
  let frame = null;
  let drawnKey = '';
  function deviceFor(walk) {
    const id = state.show || person(walk.person).device;
    return W.devices.find((d) => d.id === id);
  }
  function draw() {
    const wrap = $('frame-wrap');
    const blank = $('blank');
    const walk = walkOf(state.at.walk);
    const screen = screenOf(walk, state.at.screen);
    const device = deviceFor(walk);
    const key = `${state.at.walk}/${state.at.screen}/${state.at.lang}/${device.id}`;
    const html = S.screens[key];
    wrap.className = `frame-wrap ${device.id}`;
    if (!html) {
      wrap.hidden = true;
      blank.hidden = false;
      blank.style.maxWidth = `${device.width}px`;
      // The sentence stands in for the picture, so it is in the screen's language.
      const words = el('b', '', screen.sentence[state.at.lang] || screen.sentence.en);
      words.lang = state.at.lang;
      blank.replaceChildren(words, el('span', '', t('blankNote', { n: screen.number })));
      drawnKey = '';
      if (frame) frame.remove();
      frame = null;
      return;
    }
    wrap.hidden = false;
    blank.hidden = true;
    if (drawnKey === key) {
      frame.title = t('frameTitle', { n: screen.number, lang: langName(state.at.lang), device: t(`dev_${device.id}`), width: device.width });
      return fit();
    }
    drawnKey = key;
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = t('frameTitle', { n: screen.number, lang: langName(state.at.lang), device: t(`dev_${device.id}`), width: device.width });
    frame.setAttribute('tabindex', '-1');
    frame.style.width = `${device.width}px`;
    frame.style.height = `${device.id === 'phone' ? 844 : device.id === 'tablet' ? 1024 : 800}px`;
    wrap.insertBefore(frame, $('stamp'));
    // The screen goes into the frame's own page, so its width is the viewport the app's CSS reads.
    const doc = frame.contentDocument;
    doc.open();
    doc.write(
      `<!doctype html><html lang="${state.at.lang}" data-mantine-color-scheme="light"><head><meta charset="utf-8">` +
        `<style>${S.css}</style><style>body{margin:0}</style></head><body>${html}</body></html>`,
    );
    doc.close();
    const mine = frame;
    const grow = () => {
      if (frame !== mine || !mine.contentDocument) return;
      const h = mine.contentDocument.documentElement.scrollHeight;
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

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function segment(host, items, current, pick, cls) {
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
    map.style.setProperty('--parts', W.parts.length);
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
    if (newerScreens()) line.append(el('br'), el('span', 'mock-tag', t('mockNewerTag')));
    $('build-line').replaceChildren(line);
  }
  function card(walk, part) {
    const items = itemsOf(walk);
    const left = items.filter(isLeft).length;
    const changed = items.filter((i) => statusOf(i).kind === 'changed').length;
    const inMock = captured(walk);
    const btn = el('button', `card${left ? ' has-left' : ''}${inMock ? '' : ' nomock'}`);
    btn.type = 'button';
    btn.dataset.walk = walk.id;
    btn.append(el('span', 'part', part.name[ui]), el('b', '', walk.title[ui]), el('span', 'sub', t('screens', { n: walk.screens.length })));
    const pills = el('span', 'pills');
    if (left) pills.append(el('span', 'pill left', t('pillLeft', { n: left })));
    if (changed) pills.append(el('span', 'pill changed', t('pillChanged', { n: changed })));
    if (!left) pills.append(el('span', 'pill done', t('pillDone')));
    if (!inMock) pills.append(el('span', 'pill nomock', t('pillNoMock')));
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
    $('who-name').value = state.name || store.get('last-name', '');
    render();
    $('who-name').focus();
  }
  function enterName() {
    const name = $('who-name').value.trim();
    if (!name) {
      $('who-note').textContent = t('whoNeed');
      $('who-name').focus();
      return;
    }
    state.name = name;
    store.set('last-name', name);
    $('who-name').blur();
    toMap();
  }

  function openWalk(id) {
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

    const walk = walkOf(state.at.walk);
    const screen = screenOf(walk, state.at.screen);
    const who = person(walk.person);
    $('where').replaceChildren(
      el('span', 'person-t', who.name[ui]),
      el('b', 'walk-t', walk.title[ui]),
      el('span', '', `${screen.number}/${walk.screens.length}`),
    );
    renderList(walk, screen);

    const st = statusOf(state.at);
    const memoMark = st.was && st.was.memo ? ' ✎' : '';
    const badge = $('badge');
    badge.className = `badge s-${st.kind}`;
    badge.textContent = `${answerWord(st.kind)}${memoMark}`;
    badge.title = `${statusTitle(st)}${st.was && st.was.memo ? `: “${st.was.memo}”` : ''}${t('badgeTail')}`;
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
    const own = device.id === who.device ? '' : t('notTheirWidth', { device: t(`dev_${who.device}`) });
    $('sub').textContent = `${screen.sentence[ui] || screen.sentence.en} · ${langName(state.at.lang)} · ${deviceName(device)}${own}`;

    $('memo').hidden = !state.memo;
    $('memo').classList.toggle('for-no', state.memo === 'no');
    $('memo-no').hidden = state.memo !== 'memo';
    $('memo-save-t').textContent = state.memo === 'no' ? t('memoNo') : t('memoYes');
    if (!$('memo-text').classList.contains('need'))
      $('memo-text').placeholder = state.memo === 'no' ? t('memoPhNo') : t('memoPhMemo');
    $('no').setAttribute('aria-expanded', String(state.memo === 'no'));
    draw();
  }
  function statusTitle(st) {
    if (st.kind === 'new') return t('stTitle_new');
    if (st.kind === 'changed') return t('stTitle_changed', { answer: inline(st.was.answer) });
    return t('stTitle_said', { answer: inline(st.kind) });
  }

  // The walk's screens beside the picture: each one's name, its answer in the screen's language.
  function renderList(walk, current) {
    $('wl-items').replaceChildren(
      ...walk.screens.map((s) => {
        const item = { walk: walk.id, screen: s.id, lang: state.at.lang };
        const st = statusOf(item); // the screen's one answer, whichever language is on view
        const li = el('li');
        const btn = el('button');
        btn.type = 'button';
        btn.dataset.screen = s.id;
        btn.setAttribute('aria-current', String(s.id === current.id));
        const mark = el('span', `st s-${st.kind}`, `${answerWord(st.kind)}${st.was && st.was.memo ? ' ✎' : ''}`);
        mark.title = statusTitle(st);
        btn.append(el('span', 'num', String(s.number)), el('span', 'nm', s.sentence[ui] || s.sentence.en), mark);
        btn.addEventListener('click', () => go(item));
        li.append(btn);
        return li;
      }),
    );
  }

  function renderMenu() {
    const walk = state.at && state.view === 'walk' ? walkOf(state.at.walk) : null;
    const who = walk && person(walk.person);
    segment($('widths'), W.devices.map((d) => ({ id: d.id, label: deviceName(d) })), walk ? deviceFor(walk).id : null, (id) => {
      state.show = who && id === who.device ? null : id;
      render();
    });
    $('theirs').textContent = who
      ? t('theirsWalk', { who: who.name[ui], device: deviceName(W.devices.find((d) => d.id === who.device)) })
      : '';
    $('menu-walk').hidden = !walk;
    segment($('langs'), LANGS.map((l) => ({ id: l, label: langName(l) })), walk ? state.at.lang : null, (lang) => {
      if (walk) go({ ...state.at, lang });
    });
    const newer = newerScreens();
    $('newer').setAttribute('aria-pressed', String(Boolean(newer)));
    $('mock-note').textContent = newer ? t('newerNote', { n: newer.length, list: newer.join(', ') }) : t('storeNote');
  }

  function setPageLang(lang) {
    ui = lang;
    store.set('page-lang', lang);
    say('');
    render();
  }

  function go(item) {
    state.at = { ...item, lang: item.lang || state.at.lang };
    state.memo = null;
    $('memo-text').value = '';
    render();
  }

  function stamp(kind) {
    const s = $('stamp');
    s.textContent = answerWord(kind);
    s.classList.toggle('no', kind === 'no');
    s.classList.remove('go');
    void s.offsetWidth;
    s.classList.add('go');
  }
  function say(text) {
    $('said').textContent = text;
  }

  // An answer keeps the screen's name, the picture's version, yes or no, the memo and the time.
  function answer(kind, memo) {
    if (!state.at || state.view !== 'walk') return;
    const all = answers();
    all[keyOf(state.at)] = {
      screen: `${state.at.walk}/${state.at.screen}`,
      lang: state.at.lang,
      version: versionOf(state.at),
      answer: kind,
      memo: memo || '',
      at: new Date().toISOString(),
    };
    store.set(`answers:${nameKey()}`, all);
    stamp(kind);
    const walk = walkOf(state.at.walk);
    say(t('saved', { answer: answerWord(kind), n: screenOf(walk, state.at.screen).number, lang: langName(state.at.lang) }));
    const items = itemsOf(walk);
    const at = items.findIndex((i) => keyOf(i) === keyOf(state.at));
    const next = items.slice(at + 1).concat(items.slice(0, at)).find(isLeft);
    const lang = state.at.lang;
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.memo = null;
    $('memo-text').value = '';
    $('memo-text').blur();
    render();
    setTimeout(() => {
      if (state.view !== 'walk') return;
      if (next) go({ ...next, lang });
      else toMap();
    }, still ? 0 : 420);
  }

  function openMemo(kind) {
    state.memo = kind;
    const mine = answers()[keyOf(state.at)];
    $('memo-text').value = mine && mine.memo ? mine.memo : '';
    $('memo-text').classList.remove('need');
    render();
    $('memo-text').focus();
  }
  function saveMemo(kind) {
    const memo = $('memo-text').value.trim();
    const as = kind || (state.memo === 'no' ? 'no' : 'yes');
    if (as === 'no' && !memo) {
      say(t('memoNeed'));
      $('memo-text').placeholder = t('memoNeed');
      $('memo-text').classList.add('need');
      $('memo-text').focus();
      return;
    }
    $('memo-text').classList.remove('need');
    answer(as, memo);
  }
  function cancelMemo() {
    state.memo = null;
    $('memo-text').value = '';
    $('memo-text').classList.remove('need');
    $('memo-text').blur();
    render();
  }

  function step(by) {
    const walk = walkOf(state.at.walk);
    const at = walk.screens.findIndex((s) => s.id === state.at.screen);
    const to = walk.screens[at + by];
    if (to) go({ ...state.at, screen: to.id });
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
    $('block-text').value = text;
    $('block').hidden = false;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    } catch (e) {
      /* the text is in the box to copy by hand */
    }
    $('block-done').focus();
  }

  // Mock only: pretend a newer build changed three screens, so the changed mark shows. It takes the
  // screens answered last, topped up with fixed ones, so an answered screen moves whenever there is one.
  function toggleNewer() {
    if (newerScreens()) store.drop('newer-build');
    else {
      const recent = Object.values(answers())
        .sort((x, y) => (x.at < y.at ? 1 : -1))
        .map((a) => a.screen)
        .filter((s, i, list) => list.indexOf(s) === i);
      const pick = recent.slice(0, 3);
      for (const s of FIXED_NEWER) if (pick.length < 3 && !pick.includes(s)) pick.push(s);
      store.set('newer-build', pick);
    }
    render();
  }
  function forget() {
    store.drop(`answers:${nameKey()}`);
    render();
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
    if (state.view !== 'walk') return;
    state.look = !state.look;
    state.memo = null;
    render();
  }
  function toggleList() {
    if (state.view !== 'walk' || state.look) return;
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
  $('memo-btn').addEventListener('click', () => (state.memo === 'memo' ? cancelMemo() : openMemo('memo')));
  $('memo-save').addEventListener('click', () => saveMemo());
  $('memo-no').addEventListener('click', () => saveMemo('no'));
  $('memo-cancel').addEventListener('click', cancelMemo);
  $('memo-text').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveMemo();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelMemo();
    }
  });
  $('look').addEventListener('click', toggleLook);
  $('badge').addEventListener('click', toggleLook);
  $('menu-btn').addEventListener('click', () => ($('menu').hidden ? openMenu() : closeMenu()));
  $('newer').addEventListener('click', toggleNewer);
  $('forget').addEventListener('click', forget);
  $('copy').addEventListener('click', openBlock);
  $('block-done').addEventListener('click', () => ($('block').hidden = true));
  $('help').addEventListener('click', () => ($('helpbox').hidden = false));
  $('help-done').addEventListener('click', () => ($('helpbox').hidden = true));
  for (const btn of $('theme').querySelectorAll('button'))
    btn.addEventListener('click', () => {
      if (btn.dataset.theme) document.documentElement.dataset.theme = btn.dataset.theme;
      else delete document.documentElement.dataset.theme;
      for (const o of $('theme').querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === btn));
    });
  document.addEventListener('click', (event) => {
    if (!$('menu').hidden && !$('menu').contains(event.target) && !$('menu-btn').contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const dialogs = !$('block').hidden || !$('helpbox').hidden;
    if (event.key === 'Escape') {
      if (dialogs || !$('menu').hidden) {
        closeMenu();
        $('block').hidden = true;
        $('helpbox').hidden = true;
      } else if (state.memo) cancelMemo();
      else if (state.look) toggleLook();
      return;
    }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
    if (typing || dialogs) return;
    const k = event.key.toLowerCase();
    if (k === '?') {
      $('helpbox').hidden = false;
      return;
    }
    if (state.view !== 'walk') return;
    const walk = walkOf(state.at.walk);
    const acts = {
      f: toggleLook,
      s: toggleList,
      arrowright: () => step(1),
      arrowleft: () => step(-1),
      l: () => go({ ...state.at, lang: state.at.lang === 'vi' ? 'en' : 'vi' }),
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
    if (acts[k]) {
      event.preventDefault();
      acts[k]();
    }
  });

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe($('pic'));
  else window.addEventListener('resize', fit);

  showWho();
})();
