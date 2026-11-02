// The walks page's next look, as a static mock: the map of the day first; a walk opens at its first
// screen left to answer, drawn large, with its one question in a slim bar, or alone in Look.
// Answers stay in this browser. Classic script, so it runs from file://.
(function () {
  'use strict';
  const W = window.MOCK_WALKS;
  const S = window.MOCK_SCREENS;
  const $ = (id) => document.getElementById(id);
  const LANGS = ['vi', 'en'];
  const LANG_NAME = { vi: 'Tiếng Việt', en: 'English' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DEVICE = { pc: 'PC', tablet: 'tablet', phone: 'phone' };
  const day = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  const person = (id) => W.people.find((p) => p.id === id);
  const walkOf = (id) => W.walks.find((w) => w.id === id);
  const screenOf = (walk, id) => walk.screens.find((s) => s.id === id);
  const keyOf = (item) => `${item.walk}/${item.screen}/${item.lang}`;
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

  // A picture's version: an opaque id, one per screen and language. The mock makes its own; what
  // the real page computes it from is not settled here.
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

  const answers = () => store.get('answers', {});
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
  const itemsOf = (walk) => {
    const out = [];
    for (const screen of walk.screens) for (const lang of LANGS) out.push({ walk: walk.id, screen: screen.id, lang });
    return out;
  };
  const allItems = () => W.walks.flatMap(itemsOf);

  const state = {
    view: 'map',
    at: null,
    show: null, // a device id; null is the person's own
    look: false,
    memo: null, // null, 'no' or 'memo'
    who: 'human',
  };

  // The build line, in full and in short, from the build's own record.
  const b = W.build;
  const buildFull = `Branch ${b.branch}, commit ${b.commit}${b.changed ? ' with changes' : ''}, committed ${b.committed}; built ${b.built}.`;
  const buildShort = `${b.branch} · ${b.commit}`;

  // The screen, in a frame of its own at the device's width, scaled to the room the stage has.
  let frame = null;
  let drawnKey = '';
  function deviceFor(walk) {
    const id = state.show || person(walk.person).device;
    return W.devices.find((d) => d.id === id);
  }
  const deviceName = (d) => `${d.label === 'PC' ? 'PC' : d.label[0].toUpperCase() + d.label.slice(1)} ${d.width}`;
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
      blank.replaceChildren(
        el('b', '', screen.sentence[state.at.lang] || screen.sentence.en),
        el('span', '', `Screen ${screen.number}: not captured in the mock. The real page draws it here, this large.`),
      );
      drawnKey = '';
      if (frame) frame.remove();
      frame = null;
      return;
    }
    wrap.hidden = false;
    blank.hidden = true;
    if (drawnKey === key) return fit();
    drawnKey = key;
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = `Screen ${screen.number} in ${LANG_NAME[state.at.lang]}, ${device.label} ${device.width}`;
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
    const stage = $('stage');
    const pad = parseFloat(getComputedStyle(stage).paddingLeft) || 0;
    const room = stage.clientWidth - pad * 2;
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
  function segment(host, items, current, pick) {
    host.replaceChildren(
      ...items.map((item) => {
        const btn = el('button', 'btn', item.label);
        btn.type = 'button';
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
    for (const part of W.parts) map.append(el('span', 'colhead', part.name.en));
    for (const p of W.people) {
      const who = el('div', 'person');
      who.append(el('b', '', p.name.en), el('span', '', DEVICE[p.device]));
      map.append(who);
      for (const part of W.parts) {
        const walks = W.walks.filter((w) => w.person === p.id && w.part === part.id);
        const cell = el('div', walks.length ? 'cell' : 'cell empty');
        if (!walks.length) cell.title = 'Not built yet';
        for (const walk of walks) cell.append(card(walk, part));
        map.append(cell);
      }
    }
    const items = allItems();
    const left = items.filter(isLeft).length;
    const changed = items.filter((i) => statusOf(i).kind === 'changed').length;
    $('map-sum').textContent = left
      ? `${left} of ${items.length} answers left (each screen in two languages): ${left - changed} new to you, ${changed} changed since your answer. A walk opens at its first one.`
      : `All ${items.length} answers given. Copy them, and paste the text into the chat.`;
    $('build-line').replaceChildren(buildLineNode());
  }
  function card(walk, part) {
    const items = itemsOf(walk);
    const left = items.filter(isLeft).length;
    const changed = items.filter((i) => statusOf(i).kind === 'changed').length;
    const inMock = captured(walk);
    const btn = el('button', `card${left ? ' has-left' : ''}${inMock ? '' : ' nomock'}`);
    btn.type = 'button';
    btn.dataset.walk = walk.id;
    btn.append(el('span', 'part', part.name.en), el('b', '', walk.title.en), el('span', 'sub', `${walk.screens.length} screens`));
    const pills = el('span', 'pills');
    if (left) pills.append(el('span', 'pill left', `${left} left`));
    if (changed) pills.append(el('span', 'pill changed', `${changed} changed`));
    if (!left) pills.append(el('span', 'pill done', 'All answered'));
    if (!inMock) pills.append(el('span', 'pill nomock', 'Not in the mock'));
    btn.append(pills);
    btn.addEventListener('click', () => openWalk(walk.id));
    return btn;
  }
  function buildLineNode() {
    const span = el('span');
    span.append('Branch ', el('code', '', b.branch), ', commit ', el('code', '', b.commit));
    span.append(`${b.changed ? ' with changes' : ''}, committed ${b.committed}; built ${b.built}.`);
    if (newerScreens()) span.append(el('br'), el('span', 'mock-tag', 'Mock: a newer build pretended'));
    return span;
  }

  function openWalk(id) {
    const walk = walkOf(id);
    const items = itemsOf(walk);
    state.at = { ...(items.find(isLeft) || items[0]) };
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
    const inWalk = state.view === 'walk';
    document.body.classList.toggle('in-walk', inWalk);
    document.body.classList.toggle('look', inWalk && state.look);
    for (const e of document.querySelectorAll('.partner-only')) e.hidden = state.who !== 'partner';
    for (const e of document.querySelectorAll('.human-only')) e.hidden = state.who === 'partner';
    $('map-view').hidden = inWalk;
    $('stage').hidden = !inWalk;
    $('bar').hidden = !inWalk;
    $('to-map').hidden = !inWalk;
    $('brand').classList.toggle('on-walk', inWalk);
    $('look').hidden = !inWalk;
    document.body.classList.toggle('memo-open', inWalk && Boolean(state.memo));
    $('badge').hidden = !(inWalk && state.look);
    $('build-short').hidden = !inWalk;
    $('build-short').textContent = buildShort;
    $('build-short').title = buildFull;

    const items = allItems();
    const left = items.filter(isLeft).length;
    $('left').innerHTML = `<b>${left}</b> left`;
    $('left').title = `${left} of ${items.length} answers left to give`;
    $('meter').style.width = `${(100 * (items.length - left)) / items.length}%`;
    const given = Object.keys(answers()).length;
    $('share').textContent = `Share${given ? ` (${given})` : ''}`;
    renderMenu();

    if (!inWalk) {
      $('where').replaceChildren(el('span', '', 'The map of the day'));
      $('dots').replaceChildren();
      renderMap();
      return;
    }

    const walk = walkOf(state.at.walk);
    const screen = screenOf(walk, state.at.screen);
    const who = person(walk.person);
    $('where').replaceChildren(
      el('span', 'person-t', who.name.en),
      el('b', 'walk-t', walk.title.en),
      el('span', '', `${screen.number}/${walk.screens.length}`),
    );
    $('dots').replaceChildren(
      ...walk.screens.map((s) => {
        const item = { walk: walk.id, screen: s.id, lang: state.at.lang };
        const kind = statusOf(item).kind;
        const dot = el('button', `s-${kind}`);
        dot.type = 'button';
        dot.title = `Screen ${s.number}: ${kind === 'new' ? 'new to you' : kind === 'changed' ? 'changed since your answer' : `your ${kind}`}`;
        dot.setAttribute('aria-current', String(s.id === screen.id));
        dot.addEventListener('click', () => go(item));
        return dot;
      }),
    );

    const st = statusOf(state.at);
    const memoMark = st.was && st.was.memo ? ' ✎' : '';
    const badge = $('badge');
    badge.className = `badge s-${st.kind}`;
    badge.textContent = `${{ new: 'New', changed: 'Changed', yes: 'Yes', no: 'No' }[st.kind]}${memoMark}`;
    badge.title = `${st.kind === 'new' ? 'New to you' : st.kind === 'changed' ? `Changed since your ${st.was.answer}` : `Your ${st.kind}`}${st.was && st.was.memo ? `: “${st.was.memo}”` : ''}. F or a click brings the bars back.`;
    const mark = $('mark');
    if (st.kind === 'changed') {
      mark.className = 'mark hi';
      mark.textContent = `Changed since your ${st.was.answer} of ${day(st.was.at)}`;
    } else if (st.kind === 'yes' || st.kind === 'no') {
      mark.className = `mark said ${st.kind}`;
      mark.textContent = st.was.memo ? `Your ${st.kind}: “${st.was.memo}”` : `Your ${st.kind}`;
    } else {
      mark.className = 'mark';
      mark.textContent = '';
    }
    $('question').textContent = screen.question;
    const device = deviceFor(walk);
    const own = device.id === who.device ? '' : ` (not their width: they work at ${DEVICE[who.device]})`;
    $('sub').textContent = `${screen.sentence[state.at.lang] || screen.sentence.en} · ${LANG_NAME[state.at.lang]} · ${deviceName(device)}${own}`;

    $('memo').hidden = !state.memo;
    $('memo').classList.toggle('for-no', state.memo === 'no');
    $('memo-no').hidden = state.memo !== 'memo';
    $('memo-save').firstChild.textContent = state.memo === 'no' ? 'Save the No ' : 'Save with Yes ';
    $('memo-text').placeholder =
      state.memo === 'no' ? 'What is wrong on this screen, in a few words' : 'A note for this screen';
    $('memo-text').classList.remove('need');
    $('no').setAttribute('aria-expanded', String(state.memo === 'no'));
    draw();
  }

  function renderMenu() {
    const walk = state.at && state.view === 'walk' ? walkOf(state.at.walk) : null;
    const who = walk && person(walk.person);
    segment($('widths'), W.devices.map((d) => ({ id: d.id, label: deviceName(d) })), walk ? deviceFor(walk).id : null, (id) => {
      state.show = who && id === who.device ? null : id;
      render();
    });
    $('theirs').textContent = who
      ? `${who.name.en} works at ${deviceName(W.devices.find((d) => d.id === who.device))}.`
      : 'Each walk opens at the width its person works at.';
    segment($('langs'), LANGS.map((l) => ({ id: l, label: LANG_NAME[l] })), walk ? state.at.lang : null, (lang) => {
      if (walk) go({ ...state.at, lang });
    });
    const newer = newerScreens();
    $('newer').setAttribute('aria-pressed', String(Boolean(newer)));
    $('mock-note').textContent = newer
      ? `A newer build changed ${newer.length} screens: ${newer.join(', ')}.`
      : 'Answers are kept in this browser, under the credo-walks-mock: keys.';
  }

  function go(item) {
    state.at = { ...item };
    state.memo = null;
    $('memo-text').value = '';
    render();
  }

  function stamp(kind) {
    const s = $('stamp');
    s.textContent = kind === 'yes' ? 'Yes' : 'No';
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
    store.set('answers', all);
    stamp(kind);
    const walk = walkOf(state.at.walk);
    say(`${kind === 'yes' ? 'Yes' : 'No'} saved for screen ${screenOf(walk, state.at.screen).number} in ${LANG_NAME[state.at.lang]}.`);
    const items = itemsOf(walk);
    const at = items.findIndex((i) => keyOf(i) === keyOf(state.at));
    const next = items.slice(at + 1).concat(items.slice(0, at)).find(isLeft);
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.memo = null;
    $('memo-text').value = '';
    $('memo-text').blur();
    render();
    setTimeout(() => {
      if (state.view !== 'walk') return;
      if (next) go(next);
      else toMap();
    }, still ? 0 : 420);
  }

  function openMemo(kind) {
    state.memo = kind;
    const mine = answers()[keyOf(state.at)];
    $('memo-text').value = mine && mine.memo ? mine.memo : '';
    render();
    $('memo-text').focus();
  }
  function saveMemo(kind) {
    const memo = $('memo-text').value.trim();
    const as = kind || (state.memo === 'no' ? 'no' : 'yes');
    if (as === 'no' && !memo) {
      say('A No needs its memo: say what is wrong, then save.');
      $('memo-text').placeholder = 'A No needs its memo: what is wrong, then Enter';
      $('memo-text').classList.add('need');
      $('memo-text').focus();
      return;
    }
    answer(as, memo);
  }
  function cancelMemo() {
    state.memo = null;
    $('memo-text').value = '';
    $('memo-text').blur();
    render();
  }

  function step(by) {
    const walk = walkOf(state.at.walk);
    const at = walk.screens.findIndex((s) => s.id === state.at.screen);
    const to = walk.screens[at + by];
    if (to) go({ ...state.at, screen: to.id });
  }

  // The block the human pastes, or the partner's Share message: one line an answer, with its version.
  function blockText() {
    const all = answers();
    const label = state.who === 'partner' ? $('label').value.trim().toLowerCase() : '';
    const lines = allItems()
      .filter((item) => all[keyOf(item)])
      .map((item) => {
        const a = all[keyOf(item)];
        const memo = a.memo.replace(/\s+/g, ' ').trim();
        return `${a.screen} | ${a.lang} | version ${a.version} | ${a.answer} | ${memo} | ${a.at.slice(0, 16).replace('T', ' ')} UTC`;
      });
    const head = ['Credo walks answers', buildFull];
    if (label) head.push(`By: ${label}`);
    return head.concat(lines).join('\n');
  }
  function openBlock() {
    const text = blockText();
    const partner = state.who === 'partner';
    $('block-h').textContent = partner ? 'Your answers, to share' : 'Your answers';
    $('block-p').textContent = Object.keys(answers()).length
      ? partner
        ? 'Copied. Post it where your invite says.'
        : 'Copied. Paste it into the chat.'
      : 'Nothing answered yet: the text holds the build only.';
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
    store.drop('answers');
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

  $('to-map').addEventListener('click', toMap);
  $('brand').addEventListener('click', toMap);
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
  $('share').addEventListener('click', openBlock);
  $('block-done').addEventListener('click', () => ($('block').hidden = true));
  $('help').addEventListener('click', () => ($('helpbox').hidden = false));
  $('help-done').addEventListener('click', () => ($('helpbox').hidden = true));
  $('label').value = store.get('label', 'p1');
  $('label').addEventListener('change', () => store.set('label', $('label').value.trim()));
  for (const btn of $('who').querySelectorAll('button'))
    btn.addEventListener('click', () => {
      state.who = btn.dataset.who;
      for (const o of $('who').querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === btn));
      render();
    });
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
      arrowright: () => step(1),
      arrowleft: () => step(-1),
      l: () => go({ ...state.at, lang: state.at.lang === 'vi' ? 'en' : 'vi' }),
      w: () => {
        const ids = W.devices.map((d) => d.id);
        const next = ids[(ids.indexOf(deviceFor(walk).id) + 1) % ids.length];
        state.show = next === person(walk.person).device ? null : next;
        render();
      },
    };
    // Look answers too: Y at once, N and M by the memo floating over the picture's foot.
    acts.y = () => answer('yes', '');
    acts.n = () => openMemo('no');
    acts.m = () => openMemo('memo');
    if (acts[k]) {
      event.preventDefault();
      acts[k]();
    }
  });

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe($('stage'));
  else window.addEventListener('resize', fit);

  render();
})();
