/* The sign-in mock: every door the app has, drawn in the app's own frame and the app's own words.
 * A static look for the human to judge, not product code. It opens from disk and fetches nothing:
 * the words and the colours are in data.js, written from ui/src/i18n and ui/src/palettes.ts.
 *
 * The frame decision this mock draws: a sign-in takes the app's own coloured header (the brand's
 * gradient, its logo, its name and the language switch) and no menu, with the card on the app's
 * own ground beneath. A door has nowhere to walk to, so the menu would be empty furniture; the
 * coloured header is what makes the app recognisable, and it already carries the language switch
 * every door needs.
 */
(function () {
  const D = window.SIGNIN_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  const state = { screen: 'operator', lang: 'vi', scheme: 'light', width: 'pc', palette: 'credo' };
  const w = () => D.words[state.lang];
  const fill = (text, values) =>
    String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? `{{${k}}}`);
  const shades = () => (D.palettes.find((p) => p.name === state.palette) || D.palettes[0]).shades;

  /* The icons the screens draw, as the app's Tabler icons read: a fingerprint, a person, a lock. */
  const svg = (paths, size) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICON = {
    finger: (s) =>
      svg(
        '<path d="M18.9 7a8 8 0 0 0-13.8 0"/><path d="M7 11a5 5 0 0 1 10 0v2"/><path d="M9.5 20a16 16 0 0 0 1.5-7 1 1 0 0 1 2 0c0 2.5-.3 4.8-1 7"/><path d="M5 15a19 19 0 0 0 .5-4"/><path d="M17.5 19a21 21 0 0 0 .5-4"/>',
        s,
      ),
    user: (s) => svg('<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>', s),
    lock: (s) =>
      svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>', s),
    list: (s) => svg('<path d="M4 6h16M4 12h16M4 18h16"/>', s),
  };

  /* The page the human reads: every screen, each a distinct state of a door the app has today. */
  const SCREENS = [
    { id: 'operator', who: 'credo', name: "The operator's sign-in" },
    { id: 'operator-not-given', who: 'credo', name: 'The passkey not given' },
    { id: 'operator-refused', who: 'credo', name: 'A passkey that opens nothing here' },
    { id: 'join', who: 'credo', name: 'A join link opened' },
    { id: 'join-dead', who: 'credo', name: 'A link used, too old or replaced' },
    { id: 'join-unavailable', who: 'credo', name: 'A join link while the service is away' },
    { id: 'signin', who: 'client', name: "A person's sign-in" },
    { id: 'signin-refused', who: 'client', name: 'A sign-in refused' },
    { id: 'qr', who: 'client', name: 'A QR code signing a phone in' },
    { id: 'qr-refused', who: 'client', name: 'A QR code that cannot sign in' },
    { id: 'ended', who: 'credo', name: 'The sign-in ended mid-task' },
    { id: 'passkeys', who: 'credo', name: "One's own passkeys" },
    { id: 'ways', who: 'client', name: 'Ways to sign in: an email and a QR code' },
  ];
  const screenOf = (id) => SCREENS.find((s) => s.id === id);
  const ADDR = {
    operator: '/operator',
    'operator-not-given': '/operator',
    'operator-refused': '/operator',
    join: '/operator/join#…',
    'join-dead': '/operator/join#…',
    'join-unavailable': '/operator/join#…',
    signin: '/',
    'signin-refused': '/',
    qr: '/qr#…',
    'qr-refused': '/qr#…',
    ended: '/orders/4821',
    passkeys: '/operator/passkeys',
    ways: '/staff/1042',
  };

  /* The scheme's fixed values: the app's own greys in light, and this mock's dark beside them. */
  const SCHEME = {
    light: {
      ground: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
      surface: '#ffffff',
      border: '#e5e5e5',
      text: '#1f2937',
      dim: '#6b7280',
      strong: '#111827',
      'input-bg': '#ffffff',
      'err-bg': '#fef2f2',
      'err-border': '#fecaca',
      'err-text': '#991b1b',
      body: '#f5f5f5',
    },
    dark: {
      ground: '#141517',
      surface: '#1f2023',
      border: '#3f3f46',
      text: '#e5e7eb',
      dim: '#a1a1aa',
      strong: '#f4f4f5',
      'input-bg': '#27282c',
      'err-bg': '#2b1618',
      'err-border': '#7f1d1d',
      'err-text': '#fca5a5',
      body: '#141517',
    },
  };

  function paint() {
    const s = shades();
    const v = SCHEME[state.scheme];
    const brand = state.scheme === 'dark' ? [s[8], s[9]] : [s[7], s[9]];
    const lines = Object.entries(v).map(([k, value]) => `--${k}:${value}`);
    lines.push(`--accent:${state.scheme === 'dark' ? s[3] : s[7]}`);
    lines.push(`--brand-gradient:linear-gradient(135deg, ${brand[0]} 0%, ${brand[1]} 100%)`);
    lines.push(`--menu-gradient:linear-gradient(180deg, ${s[9]} 0%, ${s[8]} 100%)`);
    $('#paint').textContent = `.app{${lines.join(';')}}`;
  }

  /* The app's header, as every signed-in screen wears it: the brand, and the language switch. */
  function header(brand, user) {
    const logo = brand.logo
      ? `<img class="logo" src="${esc(brand.logo)}" alt="">`
      : `<span class="logo" style="background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">C</span>`;
    const langs = ['vi', 'en']
      .map(
        (l) =>
          `<span lang="${l}" aria-current="${l === state.lang}">${l === 'vi' ? 'VI' : 'EN'}</span>`,
      )
      .join('');
    return `<header class="app-header"><div class="brand">${logo}<span class="brand-name" data-demo>${esc(brand.name)}</span></div><div class="hright"><span class="lang-seg" aria-label="Language">${langs}</span>${
      user
        ? `<span class="user"><span class="avatar" data-demo>${esc(user.slice(0, 2).toUpperCase())}</span><span class="name" data-demo>${esc(user)}</span></span>`
        : ''
    }</div></header>`;
  }

  const brandOf = (who) =>
    who === 'client'
      ? { name: D.demo.client.name, logo: D.demo.client.logo }
      : { name: w().app.name, logo: null };

  const door = (who, inner) =>
    `${header(brandOf(who), null)}<div class="ground"><div class="card">${inner}</div></div>`;
  const alert = (text) => `<div class="alert" role="alert">${esc(text)}</div>`;
  const button = (text, icon) =>
    `<button type="button" class="btn">${icon ? ICON.finger(20) : ''}${esc(text)}</button>`;
  const field = (label, placeholder, icon) =>
    `<div class="field"><label>${esc(label)}</label><div class="input">${icon}<span>${esc(placeholder)}</span></div></div>`;

  /* A QR code's look: a fixed pattern, since a mock shows no real link. */
  const qrSquare = (label) => {
    let cells = '';
    for (let i = 0; i < 121; i++) {
      const x = i % 11;
      const y = (i / 11) | 0;
      const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
      const on = corner ? x % 2 === 0 || y % 2 === 0 : (x * 7 + y * 13 + x * y) % 3 === 0;
      cells += `<i class="${on ? 'on' : ''}"></i>`;
    }
    return `<div class="qr" role="img" aria-label="${esc(label)}">${cells}</div>`;
  };

  const BODY = {
    operator: () => operatorDoor(null),
    'operator-not-given': () => operatorDoor('notGiven'),
    'operator-refused': () => operatorDoor('refused'),
    join: () => joinDoor('ready'),
    'join-dead': () => joinDoor('dead'),
    'join-unavailable': () => joinDoor('unavailable'),
    signin: () => signInDoor(false),
    'signin-refused': () => signInDoor(true),
    qr: () => qrDoor(false),
    'qr-refused': () => qrDoor(true),
    ended: () => endedScreen(),
    passkeys: () => passkeysPage(),
    ways: () => waysPage(),
  };

  function operatorDoor(problem) {
    const t = w();
    return door(
      'credo',
      `<h2>${esc(t.operator.signIn)}</h2><div class="stack">${
        problem ? alert(t.passkey[problem]) : ''
      }<p class="hint">${esc(t.passkey.signInHint)}</p>${button(t.passkey.signInButton, true)}</div>`,
    );
  }

  function joinDoor(phase) {
    const t = w();
    let inner = '';
    if (phase === 'dead') inner = alert(t.passkey.dead);
    else if (phase === 'unavailable')
      inner = `<div class="stack tight">${alert(t.common.unavailable)}<button type="button" class="btn plain">${esc(t.common.retry)}</button></div>`;
    else
      inner =
        `<div class="stack"><div><p class="lead" data-demo>${esc(fill(t.passkey.joinFor, { name: D.demo.invited }))}</p>` +
        `<p class="sub" data-demo>${esc(fill(t.passkey.joinMadeBy, { name: D.demo.madeBy }))}</p></div>` +
        `<p class="hint" style="text-align:left">${esc(t.passkey.joinHint)}</p>${button(t.passkey.makeButton, true)}</div>`;
    return door('credo', `<h2>${esc(t.passkey.joinTitle)}</h2>${inner}`);
  }

  function signInDoor(refused) {
    const t = w();
    return door(
      'client',
      `<h2>${esc(t.auth.title)}</h2><div class="stack">${refused ? alert(t.auth.refused) : ''}` +
        field(t.auth.username, t.auth.usernamePlaceholder, ICON.user(18)) +
        field(t.auth.password, t.auth.passwordPlaceholder, ICON.lock(18)) +
        `${button(t.auth.submit, false)}</div>`,
    );
  }

  function qrDoor(refused) {
    const t = w();
    const inner = refused
      ? `<h2>${esc(t.qrSignIn.refusedTitle)}</h2><div class="stack tight"><p class="hint">${esc(t.qrSignIn.refusedText)}</p>${button(t.qrSignIn.password, false)}</div>`
      : `<h2>${esc(t.qrSignIn.busyTitle)}</h2><div class="stack tight"><div class="spin"></div><p class="hint">${esc(t.qrSignIn.busyText)}</p></div>`;
    return door('client', inner);
  }

  /* The screens that live inside the app, where the person is already in: the menu beside them. */
  function inApp(current, main) {
    const t = w();
    const items = [
      ['clients', t.nav.clients],
      ['operators', t.nav.operators],
      ['settings', t.nav.settings],
    ];
    const menu = `<nav class="app-menu">${items
      .map(
        ([id, label]) =>
          `<div class="item"${id === current ? ' aria-current="page"' : ''}>${ICON.list(22)}<span>${esc(label)}</span></div>`,
      )
      .join('')}</nav>`;
    return `${header(brandOf(screenOf(state.screen).who), D.demo.person.name)}${menu}<main class="app-main">${main}</main>`;
  }

  function passkeysPage() {
    const t = w();
    const rows = D.demo.passkeys
      .map(
        (k) =>
          `<tr><td data-demo>${esc(k.added)}</td><td${k.lastUsed ? ' data-demo' : ''}>${esc(k.lastUsed || t.passkey.never)}</td>` +
          `<td style="text-align:right"><button type="button" class="btn plain auto">${esc(t.passkey.remove)}</button></td></tr>`,
      )
      .join('');
    const main =
      `<div class="page-head"><h2>${esc(t.passkey.title)}</h2><button type="button" class="btn auto">${ICON.finger(18)}${esc(t.passkey.add)}</button></div>` +
      `<p class="dim" style="margin:0 0 12px">${esc(t.passkey.intro)}</p>` +
      `<div class="panel" style="padding:0;margin-top:0"><table><thead><tr><th>${esc(t.passkey.colAdded)}</th><th>${esc(t.passkey.colLastUsed)}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    return inApp('operators', main);
  }

  function waysPage() {
    const t = w();
    const main =
      `<div class="page-head"><h2>${esc(t.setup.signInsTitle)}</h2></div>` +
      `<p class="dim" style="margin:0">${esc(t.setup.signInsIntro)}</p>` +
      `<section class="panel"><h3>${esc(t.person.emailTitle)}</h3><p class="dim" style="margin:0 0 6px">${esc(t.person.emailText)}</p>` +
      `<p style="margin:0 0 12px" data-demo>${esc(D.demo.person.email)}</p>` +
      field(t.person.emailNew, '', '') +
      `<div style="display:flex;gap:10px;margin-top:12px"><button type="button" class="btn plain auto">${esc(t.person.emailSet)}</button><button type="button" class="btn plain auto">${esc(t.person.emailRemove)}</button></div></section>` +
      `<section class="panel"><h3>${esc(t.person.qrTitle)}</h3><p class="dim" style="margin:0 0 12px">${esc(t.person.qrText)}</p>` +
      qrSquare(t.person.qrImage) +
      `<p class="dim" style="margin:8px 0 12px;font-size:14px">${esc(t.person.qrOnce)}</p>` +
      `<button type="button" class="btn plain auto">${esc(t.person.qrNew)}</button></section>`;
    return inApp('settings', main);
  }

  function endedScreen() {
    const t = w();
    const beneath =
      `<div class="page-head"><h2>${esc(t.passkey.menu)}</h2></div><div class="panel">&nbsp;</div><div class="panel">&nbsp;</div>`;
    const modal =
      `<div class="veil"><div class="modal" role="dialog" aria-modal="true"><h3>${esc(t.passkey.endedTitle)}</h3>` +
      `<p style="margin:0">${esc(t.passkey.endedText)}</p>` +
      `<div class="row"><button type="button" class="btn plain auto">${esc(t.user.signOut)}</button><button type="button" class="btn auto">${esc(t.passkey.endedButton)}</button></div></div></div>`;
    return inApp('operators', beneath) + modal;
  }

  const SIZE = { pc: [1280, 800], phone: [390, 780] };

  function drawDevice() {
    const [width, height] = SIZE[state.width];
    const device = $('#device');
    device.style.width = `${width}px`;
    device.style.height = `${height}px`;
    device.innerHTML = `<div class="app${state.width === 'phone' ? ' phone' : ''}" lang="${state.lang}">${BODY[state.screen]()}</div>`;
    const box = $('#device-box');
    const room = box.clientWidth || width;
    const tall = box.clientHeight || height;
    const scale = Math.min(1, room / width, tall / height);
    device.style.transform = `scale(${scale})`;
    $('#addr').textContent = `${state.width === 'phone' ? 'phone 390' : 'PC 1280'} · ${ADDR[state.screen]}`;
  }

  function drawControls() {
    const chosen = D.palettes.map(
      (p) =>
        `<button type="button" class="swatch" data-palette="${esc(p.name)}" aria-pressed="${p.name === state.palette}"><i style="background:${p.shades[7]}"></i>${esc(p.name)}</button>`,
    );
    const map = SCREENS.map(
      (s, i) =>
        `<li><button type="button" data-screen="${s.id}" aria-current="${s.id === state.screen}"><b>${i + 1}</b><span>${esc(s.name)}</span></button></li>`,
    ).join('');
    $('#controls').innerHTML =
      `<h2>The screens</h2><ol class="map">${map}</ol>` +
      `<h2>The company's colour</h2><div class="swatches">${chosen.join('')}</div>` +
      `<div class="shades">${shades().map((c) => `<span style="background:${c}"></span>`).join('')}</div>` +
      `<h2>Where this came from</h2><p>Branch wip-signin-mock, commit ${esc(D.source.commit)}, committed ${esc(D.source.committed.slice(0, 16).replace('T', ' '))}, drawn ${esc(D.source.built)}.</p>` +
      `<p>Every word is the app's own, from its two dictionaries; the company, its colour and the people are the data set's.</p>`;
  }

  function draw() {
    document.documentElement.setAttribute('data-scheme', state.scheme);
    for (const b of document.querySelectorAll('[data-set]')) {
      const [key, value] = b.dataset.set.split('=');
      b.setAttribute('aria-pressed', String(state[key] === value));
    }
    paint();
    drawControls();
    drawDevice();
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-set],[data-screen],[data-palette],[data-answer]');
    if (!el) return;
    if (el.dataset.set) {
      const [key, value] = el.dataset.set.split('=');
      state[key] = value;
    } else if (el.dataset.screen) {
      state.screen = el.dataset.screen;
      state.palette = screenOf(state.screen).who === 'client' ? D.palettes[1].name : 'credo';
    } else if (el.dataset.palette) {
      state.palette = el.dataset.palette;
    } else {
      for (const b of document.querySelectorAll('[data-answer]'))
        b.setAttribute('aria-pressed', String(b === el));
      $('#answer').textContent =
        el.dataset.answer === 'yes' ? 'Yes, they read as the same app.' : 'No: say what is off.';
      return;
    }
    draw();
  });
  window.addEventListener('resize', drawDevice);

  window.SIGNIN_MOCK = { state, screens: SCREENS, draw, shades };
  draw();
})();
