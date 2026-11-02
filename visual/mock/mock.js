// The walks page's next look, as a static mock: one screen drawn large, its one question, Yes or No,
// and only the screens changed since the last yes asked. Classic script, so it runs from file://.
(function () {
  'use strict';
  const W = window.MOCK_WALKS;
  const S = window.MOCK_SCREENS;
  const $ = (id) => document.getElementById(id);
  const LANGS = ['vi', 'en'];
  const LANG_NAME = { vi: 'Tiếng Việt', en: 'English' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (iso) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  };
  const person = (id) => W.people.find((p) => p.id === id);
  const walkOf = (id) => W.walks.find((w) => w.id === id);
  const screenOf = (walk, id) => walk.screens.find((s) => s.id === id);
  const keyOf = (item) => `${item.walk}:${item.screen}:${item.lang}`;

  // What is asked: every screen and language whose words changed since its last answer, in page order.
  const asked = [];
  for (const walk of W.walks)
    for (const screen of walk.screens)
      for (const lang of LANGS)
        if (screen.languages[lang].shown.kind !== 'yes' && screen.languages[lang].shown.kind !== 'no')
          asked.push({ walk: walk.id, screen: screen.id, lang });
  const totalScreens = W.walks.reduce((n, w) => n + w.screens.length, 0);

  const state = {
    at: asked[0] ? { ...asked[0] } : null,
    show: null, // a device id; null is the person's own
    answers: {}, // key -> { answer, reason }
    who: 'human',
    only: 'asked',
    open: {}, // walk id -> open in the drawer
    noOpen: false,
  };

  const answered = () => asked.filter((item) => state.answers[keyOf(item)]).length;
  const nextAsked = (from) => {
    const at = asked.findIndex((item) => keyOf(item) === keyOf(from));
    const after = asked.slice(at + 1).concat(asked.slice(0, Math.max(at, 0)));
    return after.find((item) => !state.answers[keyOf(item)]) || null;
  };
  const isAsked = (item) => asked.some((a) => keyOf(a) === keyOf(item));

  // The screen, in a frame of its own at the device's width, scaled to the room the stage has.
  let frame = null;
  let drawnKey = '';
  function deviceFor(walk) {
    const id = state.show || person(walk.person).device;
    return W.devices.find((d) => d.id === id);
  }
  function draw() {
    const wrap = $('frame-wrap');
    const blank = $('blank');
    if (!state.at) return;
    const walk = walkOf(state.at.walk);
    const device = deviceFor(walk);
    const key = `${state.at.walk}/${state.at.screen}/${state.at.lang}/${device.id}`;
    const html = S.screens[key];
    wrap.className = `frame-wrap ${device.id}`;
    if (!html) {
      wrap.hidden = true;
      blank.hidden = false;
      blank.textContent =
        'The mock draws only ten of the 96 screens. The real page draws this one here, as large as this.';
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
    frame.title = `Screen ${screenOf(walk, state.at.screen).number} in ${LANG_NAME[state.at.lang]}, ${device.label} ${device.width}`;
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
    if (!frame || !state.at) return;
    const device = deviceFor(walkOf(state.at.walk));
    const room = $('stage').clientWidth - parseFloat(getComputedStyle($('stage')).paddingLeft) * 2;
    const scale = room > 0 ? Math.min(1, room / device.width) : 1;
    frame.style.transform = `scale(${scale})`;
    const wrap = $('frame-wrap');
    wrap.style.width = `${device.width * scale}px`;
    wrap.style.height = `${parseFloat(frame.style.height) * scale}px`;
  }

  function segment(host, items, current, pick) {
    host.replaceChildren(
      ...items.map((item) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = item.label;
        b.setAttribute('aria-pressed', String(item.id === current));
        b.addEventListener('click', () => pick(item.id));
        return b;
      }),
    );
  }

  function render() {
    document.body.classList.toggle('partner', state.who === 'partner');
    for (const el of document.querySelectorAll('.partner-only')) el.hidden = state.who !== 'partner';
    for (const el of document.querySelectorAll('.human-only')) el.hidden = state.who === 'partner';

    const n = answered();
    $('left').innerHTML = asked.length
      ? `<b>${asked.length - n}</b> of ${asked.length} left<span class="wide"> to answer</span>`
      : 'Nothing to answer';
    $('meter').style.width = `${asked.length ? (100 * n) / asked.length : 100}%`;
    const given = Object.keys(state.answers).length;
    const count = given ? ` (${given})` : '';
    $('copy').textContent = `Copy my answers${count}`;
    $('share').textContent = `Share${count}`;

    const allDone = !state.at || (asked.length > 0 && n === asked.length && !state.looking);
    $('done').hidden = !allDone;
    $('view').hidden = allDone;
    $('ask').hidden = allDone;
    if (allDone) {
      $('frame-wrap').hidden = true;
      $('blank').hidden = true;
      $('crumb').innerHTML = '<b>All answered</b>';
      $('done-text').textContent =
        state.who === 'partner'
          ? `${given} answers are ready. Share copies them, under your label, to post where your invite says.`
          : `${given} answers are ready. Copy them, and paste the text into the chat.`;
      $('copy-2').textContent = `Copy my answers (${given})`;
      $('share-2').textContent = `Share (${given})`;
      return;
    }

    const walk = walkOf(state.at.walk);
    const screen = screenOf(walk, state.at.screen);
    const who = person(walk.person);
    const device = deviceFor(walk);
    $('crumb').innerHTML = '';
    const crumb = [
      ['span', who.name.en],
      ['b', walk.title.en, 'walk-t'],
      ['span', `Screen ${screen.number} of ${walk.screens.length}`],
    ];
    for (const [tag, text, cls] of crumb) {
      const el = document.createElement(tag);
      el.textContent = text;
      if (cls) el.className = cls;
      $('crumb').append(el);
    }

    segment(
      $('widths'),
      W.devices.map((d) => ({ id: d.id, label: `${d.label[0].toUpperCase()}${d.label.slice(1)} ${d.width}` })),
      device.id,
      (id) => {
        state.show = id === who.device ? null : id;
        render();
      },
    );
    segment(
      $('langs'),
      LANGS.map((l) => ({ id: l, label: LANG_NAME[l] })),
      state.at.lang,
      (lang) => go({ ...state.at, lang }, true),
    );
    const own = W.devices.find((d) => d.id === who.device);
    const works = { operator: 'the operator works', admin: 'the client’s admin works', office: 'office staff work', driver: 'the driver works' }[who.id];
    $('theirs').textContent =
      device.id === who.device
        ? `The width ${works} at.`
        : `Not their width: ${works} at ${own.label} ${own.width}.`;

    const shown = screen.languages[state.at.lang].shown;
    const mine = state.answers[keyOf(state.at)];
    const tag = $('tagline');
    tag.innerHTML = '';
    const lang = document.createElement('span');
    lang.className = 'lang-name';
    lang.textContent = LANG_NAME[state.at.lang];
    tag.append(lang);
    const note = document.createElement('span');
    if (mine) {
      note.textContent =
        mine.answer === 'yes' ? 'You said yes. It goes out when you copy.' : `You said no: ${mine.reason}`;
    } else if (shown.kind === 'changed') {
      note.className = 'hi';
      note.textContent = `Changed since your ${shown.answer} of ${day(shown.on)}`;
    } else {
      note.textContent = `Not asked: you said ${shown.kind} on ${day(shown.on)}. Answer again only if something is wrong.`;
    }
    tag.append(note);
    $('question').textContent = screen.question;
    $('sentence').textContent = screen.sentence[state.at.lang] || screen.sentence.en;
    $('reason').hidden = !state.noOpen;
    $('no').setAttribute('aria-expanded', String(state.noOpen));
    draw();
  }

  function go(item, keepLooking) {
    state.at = { ...item };
    state.noOpen = false;
    state.looking = keepLooking || !isAsked(item);
    $('reason-text').value = '';
    render();
    window.scrollTo({ top: 0 });
  }

  function stamp(kind) {
    const el = $('stamp');
    el.textContent = kind === 'yes' ? 'Yes' : 'No';
    el.classList.toggle('no', kind === 'no');
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  function answer(kind, reason) {
    if (!state.at) return;
    state.answers[keyOf(state.at)] = { answer: kind, reason: reason || '' };
    stamp(kind);
    const walk = walkOf(state.at.walk);
    $('said').textContent = `${kind === 'yes' ? 'Yes' : 'No'} for screen ${screenOf(walk, state.at.screen).number} in ${LANG_NAME[state.at.lang]}.`;
    const next = nextAsked(state.at);
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = still ? 0 : 420;
    setTimeout(() => {
      if (next) go(next);
      else {
        state.looking = false;
        state.noOpen = false;
        render();
      }
    }, wait);
  }

  function step(by) {
    const list = state.only === 'asked' && asked.length ? asked : allItems();
    const at = list.findIndex((item) => keyOf(item) === keyOf(state.at));
    const to = list[at + by];
    if (to) go(to);
  }
  function allItems() {
    const out = [];
    for (const walk of W.walks)
      for (const screen of walk.screens)
        for (const lang of LANGS) out.push({ walk: walk.id, screen: screen.id, lang });
    return out;
  }

  // The block the human pastes, or the partner's Share message: the lines are today's.
  function blockText() {
    const items = allItems().filter((item) => state.answers[keyOf(item)]);
    const label = state.who === 'partner' ? $('label').value.trim().toLowerCase() : '';
    const lines = items.map((item) => {
      const a = state.answers[keyOf(item)];
      return `${keyOf(item)} | ${a.answer} | ${a.reason.replace(/\s+/g, ' ').trim()}`;
    });
    const head = [`Credo walks answers`, `Build: ${W.build.branch}, commit ${W.build.commit}`];
    if (label) head.push(`By: ${label}`);
    return head.concat(lines).join('\n');
  }
  function openBlock() {
    const text = blockText();
    const partner = state.who === 'partner';
    $('block-h').textContent = partner ? 'Your answers, to share' : 'Your answers';
    $('block-p').textContent = partner
      ? 'Copied. Post it where your invite says.'
      : 'Copied. Paste it into the chat.';
    $('block-text').value = text;
    if (!Object.keys(state.answers).length)
      $('block-p').textContent = 'Nothing answered yet: the text holds the build only.';
    $('block').hidden = false;
    try {
      navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
    } catch (e) {
      /* the text is in the box to copy by hand */
    }
    $('block-done').focus();
  }

  // The drawer: every walk by who does it; asked screens marked, the rest to look at again.
  function renderList() {
    const host = $('walk-list');
    host.replaceChildren();
    for (const b of $('only').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b.dataset.only === state.only));
    for (const p of W.people) {
      const walks = W.walks.filter((w) => w.person === p.id);
      const shown = walks.filter(
        (w) => state.only === 'all' || asked.some((a) => a.walk === w.id),
      );
      if (!shown.length) continue;
      const h = document.createElement('h3');
      h.textContent = p.name.en;
      host.append(h);
      for (const walk of shown) {
        const box = document.createElement('div');
        box.className = 'walk';
        const head = document.createElement('button');
        head.type = 'button';
        const wAsked = asked.filter((a) => a.walk === walk.id);
        const left = wAsked.filter((a) => !state.answers[keyOf(a)]).length;
        const open = state.open[walk.id] ?? (state.only === 'asked' || (state.at && state.at.walk === walk.id));
        head.setAttribute('aria-expanded', String(open));
        head.innerHTML = '<span class="t"></span><span class="n"></span>';
        head.querySelector('.t').textContent = walk.title.en;
        const n = head.querySelector('.n');
        if (left) {
          n.className = 'n hi';
          n.textContent = `${left} to answer`;
        } else n.textContent = `${walk.screens.length} screens${wAsked.length ? ', answered' : ''}`;
        head.addEventListener('click', () => {
          state.open[walk.id] = !open;
          renderList();
        });
        box.append(head);
        if (open) {
          const ol = document.createElement('ol');
          for (const screen of walk.screens) {
            const changedIn = LANGS.filter((l) => screen.languages[l].shown.kind === 'changed');
            if (state.only === 'asked' && !changedIn.length) continue;
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            const lang = changedIn.find((l) => !state.answers[`${walk.id}:${screen.id}:${l}`]) || changedIn[0] || 'vi';
            const here = state.at && state.at.walk === walk.id && state.at.screen === screen.id;
            b.setAttribute('aria-current', String(Boolean(here)));
            b.innerHTML = '<span class="num"></span><span class="s"></span><span class="marks"></span>';
            b.querySelector('.num').textContent = screen.number;
            b.querySelector('.s').textContent = screen.sentence.en;
            const marks = b.querySelector('.marks');
            for (const l of LANGS) {
              const m = document.createElement('span');
              const mine = state.answers[`${walk.id}:${screen.id}:${l}`];
              const was = screen.languages[l].shown;
              m.textContent = ` ${l} ${mine ? mine.answer : was.kind === 'changed' ? 'asked' : was.kind}`;
              m.className = mine ? `mark-${mine.answer}` : was.kind === 'changed' ? 'hi' : '';
              marks.append(m);
            }
            b.addEventListener('click', () => {
              closeList();
              go({ walk: walk.id, screen: screen.id, lang }, !changedIn.length);
            });
            li.append(b);
            ol.append(li);
          }
          box.append(ol);
        }
        host.append(box);
      }
    }
    const foot = document.createElement('p');
    foot.style.color = 'var(--muted)';
    foot.textContent =
      state.only === 'asked'
        ? `${asked.length} answers asked, of ${totalScreens * 2} (${totalScreens} screens in two languages). The rest hold your yes.`
        : `${totalScreens} screens in ${W.walks.length} walks, each in two languages.`;
    host.append(foot);
  }
  function openList() {
    renderList();
    $('drawer').hidden = false;
    $('scrim').hidden = false;
    $('close-list').focus();
  }
  function closeList() {
    $('drawer').hidden = true;
    $('scrim').hidden = true;
  }

  $('yes').addEventListener('click', () => answer('yes'));
  $('no').addEventListener('click', () => {
    state.noOpen = !state.noOpen;
    render();
    if (state.noOpen) $('reason-text').focus();
  });
  $('save-no').addEventListener('click', () => {
    const reason = $('reason-text').value.trim();
    if (!reason) {
      $('said').textContent = 'A No needs its reason: say what is wrong, then save.';
      $('reason-text').focus();
      return;
    }
    answer('no', reason);
  });
  $('open-list').addEventListener('click', openList);
  $('open-list-2').addEventListener('click', openList);
  $('close-list').addEventListener('click', closeList);
  $('scrim').addEventListener('click', closeList);
  for (const b of $('only').querySelectorAll('button'))
    b.addEventListener('click', () => {
      state.only = b.dataset.only;
      state.open = {};
      renderList();
    });
  for (const id of ['copy', 'copy-2', 'share', 'share-2']) $(id).addEventListener('click', openBlock);
  $('block-done').addEventListener('click', () => ($('block').hidden = true));
  $('help').addEventListener('click', () => ($('helpbox').hidden = false));
  $('help-done').addEventListener('click', () => ($('helpbox').hidden = true));
  for (const b of $('who').querySelectorAll('button'))
    b.addEventListener('click', () => {
      state.who = b.dataset.who;
      for (const o of $('who').querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
      render();
    });
  for (const b of $('theme').querySelectorAll('button'))
    b.addEventListener('click', () => {
      if (b.dataset.theme) document.documentElement.dataset.theme = b.dataset.theme;
      else delete document.documentElement.dataset.theme;
      for (const o of $('theme').querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
    });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      closeList();
      $('block').hidden = true;
      $('helpbox').hidden = true;
      return;
    }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
    if (typing || !$('drawer').hidden || !$('block').hidden || !$('helpbox').hidden || $('ask').hidden) return;
    const k = event.key.toLowerCase();
    const walk = state.at && walkOf(state.at.walk);
    const acts = {
      y: () => answer('yes'),
      n: () => $('no').click(),
      arrowright: () => step(1),
      arrowleft: () => step(-1),
      l: () => go({ ...state.at, lang: state.at.lang === 'vi' ? 'en' : 'vi' }, true),
      w: () => {
        const ids = W.devices.map((d) => d.id);
        const next = ids[(ids.indexOf(deviceFor(walk).id) + 1) % ids.length];
        state.show = next === person(walk.person).device ? null : next;
        render();
      },
      '?': () => ($('helpbox').hidden = false),
    };
    if (acts[k] && state.at) {
      event.preventDefault();
      acts[k]();
    }
  });

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe($('stage'));
  else window.addEventListener('resize', fit);

  render();
})();
