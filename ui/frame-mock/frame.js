// The frame mock's drawing: the legacy app's frame (coloured header and side menu on a PC, the bar
// of four and More on a phone) around the new app's menus and words, all its state in the URL's
// hash so every view has an address. A static look, not product code.
(function () {
  'use strict';
  var D = window.FRAME_DATA;
  var $ = function (sel) { return document.querySelector(sel); };

  // The three widths the walks take, each with its screen's height. Below Mantine's sm (768) the
  // phone's frame; at 768 and above the PC's.
  var HEIGHTS = { 390: 844, 768: 1024, 1280: 800 };
  var SM = 768;
  var STATES = ['content', 'empty', 'loading', 'failed'];
  // icons: the hidden PC menu leaves a 60-pixel strip of icons; a client's option, off as the legacy's.
  var DEFAULTS = { w: '1280', palette: 'steel', header: 'colour', menu: 'colour', icons: 'off', scheme: 'light', lang: 'vi', state: 'content', nav: 'shown' };
  var HOME = { client: '/orders', console: '/operator/clients' };
  var MORE = { client: '/more', console: '/operator/more' };
  // The frame's few words the app's dictionaries do not hold yet.
  var OWN = { vi: { more: 'Thêm' }, en: { more: 'More' } };
  var LANGS = { vi: 'Tiếng Việt', en: 'English' };
  var USER = 'u1';
  // A stand-in company: its name and its logo (Tabler's Adobe mark), the same in both apps and languages.
  var BRAND = 'Acme';
  // The old app's greys (the new app's NEUTRAL): the white variants' ground, text and edges.
  var N = ['#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827'];

  // Any colour's ten shades, mixed as the new app's theme does today: 0 to 6 toward white, 8 and 9
  // toward black, 7 the colour itself.
  var TOWARD_WHITE = [0.92, 0.82, 0.68, 0.5, 0.32, 0.16, 0.06];
  var TOWARD_BLACK = [0.2, 0.38];
  var rgbOf = function (hex) { return [1, 3, 5].map(function (at) { return parseInt(hex.slice(at, at + 2), 16); }); };
  var hexOf = function (rgb) { return '#' + rgb.map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); };
  var mix = function (from, to, share) { return from.map(function (v, i) { return Math.round(v + (to[i] - v) * share); }); };
  function mixed(colour) {
    var base = rgbOf(colour);
    return TOWARD_WHITE.map(function (s) { return hexOf(mix(base, [255, 255, 255], s)); })
      .concat([hexOf(base)], TOWARD_BLACK.map(function (s) { return hexOf(mix(base, [0, 0, 0], s)); }));
  }

  // A stock name, or a colour that is a stock shade 7, draws that palette's own ten shades (the
  // legacy's lookup); any other colour is mixed.
  function paletteOf(value) {
    var v = String(value || '').toLowerCase();
    var stock = D.palettes.filter(function (p) { return p.name === v || p.shades[7] === v; })[0];
    if (stock) return { name: stock.name, shades: stock.shades, stock: true };
    if (/^#[0-9a-f]{6}$/.test(v)) return { name: v, shades: mixed(v), stock: false };
    return paletteOf(DEFAULTS.palette);
  }

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var appOf = function (path) { return path.indexOf('/operator') === 0 ? 'console' : 'client'; };
  var pagesOf = function (app) { return app === 'console' ? D.console : D.client; };
  var isPhone = function (s) { return Number(s.w) < SM; };
  var labelOf = function (L, page) { return L.nav[page.label.split('.')[1]]; };
  var activeOn = function (path, pagePath) { return path === pagePath || path.indexOf(pagePath + '/') === 0; };

  function icon(name, size, stroke) {
    var nodes = D.icons[name] || [];
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (stroke || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      nodes.map(function (n) {
        return '<' + n[0] + Object.keys(n[1]).map(function (k) { return ' ' + k + '="' + esc(n[1][k]) + '"'; }).join('') + '/>';
      }).join('') + '</svg>';
  }

  var logo = function () { return icon('IconBrandAdobe', 36).replace('<svg ', '<svg class="logo" '); };

  // The state, read from and written to the hash: #/orders?w=1280&palette=steel&...
  function read() {
    var h = decodeURI(location.hash.replace(/^#/, ''));
    var q = h.indexOf('?');
    var params = new URLSearchParams(q < 0 ? '' : h.slice(q + 1));
    var s = { path: (q < 0 ? h : h.slice(0, q)) || HOME.client };
    Object.keys(DEFAULTS).forEach(function (k) { s[k] = params.get(k) || DEFAULTS[k]; });
    return normalise(s);
  }
  function normalise(s) {
    if (!HEIGHTS[s.w]) s.w = DEFAULTS.w;
    s.header = s.header === 'white' ? 'white' : 'colour';
    s.menu = s.menu === 'white' ? 'white' : 'colour';
    s.scheme = s.scheme === 'dark' ? 'dark' : 'light';
    s.lang = s.lang === 'en' ? 'en' : 'vi';
    s.state = STATES.indexOf(s.state) < 0 ? 'content' : s.state;
    s.nav = s.nav === 'hidden' ? 'hidden' : 'shown';
    s.icons = s.icons === 'on' ? 'on' : 'off';
    s.palette = paletteOf(s.palette).name;
    var app = appOf(s.path);
    var known = pagesOf(app).some(function (p) { return p.path === s.path; }) || (isPhone(s) && s.path === MORE[app]);
    if (!known) s.path = HOME[app];
    return s;
  }
  function hashOf(s) {
    var params = new URLSearchParams();
    Object.keys(DEFAULTS).forEach(function (k) { params.set(k, s[k]); });
    return '#' + s.path + '?' + params.toString();
  }

  var ui = { user: false, lang: false };
  function go(changes) {
    var s = normalise(Object.assign(read(), changes));
    ui.user = ui.lang = false;
    var next = hashOf(s);
    if (location.hash !== next) location.hash = next;
    render();
  }

  // WCAG's contrast; a token the mock adds takes the first candidate that reads on its ground.
  var lum = function (hex) {
    var c = rgbOf(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  var ratio = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  var readable = function (candidates, ground, min) {
    return candidates.filter(function (c) { return ratio(c, ground) >= min; })[0] || candidates[candidates.length - 1];
  };

  // The palette and the scheme's colours, as literal values in one style element. In light, the
  // white variants keep the legacy's own values (neutral 0, 8, 7 and 2; the active item on shade 0,
  // its text 9, its mark 7); the badge, the accent text and every dark value are the mock's, each
  // picked to read: text 4.5:1, marks 3:1.
  function paint(b, dark) {
    var body = dark ? '#242424' : '#ffffff';
    var badgeBg = dark ? b[9] : b[1];
    var v = {
      '--body': dark ? '#242424' : '#ffffff',
      '--surface': dark ? '#2e2e2e' : '#ffffff',
      '--text': dark ? '#c9c9c9' : N[7],
      '--strong': dark ? '#e9ecef' : N[8],
      '--dim': dark ? '#9a9a9a' : N[5],
      '--border': dark ? '#424242' : N[2],
      '--hover': dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
      // The white variants: neutral 0 to paint, 8 for text, 7 for icons, 2 for the edge; in dark,
      // the dark surface in their place.
      '--n0': dark ? '#2e2e2e' : N[0],
      '--n2': dark ? '#424242' : N[2],
      '--n3': dark ? '#5c5c5c' : N[3],
      '--n7': dark ? '#b8b8b8' : N[7],
      '--n8': dark ? '#e9ecef' : N[8],
      '--accent': dark ? readable([b[4], b[3], b[2]], body, 4.5) : readable([b[7], b[8], b[9]], body, 4.5),
      '--badge-bg': badgeBg,
      '--badge-text': dark ? readable([b[0], '#ffffff'], badgeBg, 4.5) : readable([b[9], N[9]], badgeBg, 4.5),
      '--nav-active-bg': dark ? b[9] : b[0],
      '--nav-active-text': dark ? readable([b[0], '#ffffff'], b[9], 4.5) : b[9],
      '--nav-accent': dark ? readable([b[3], b[2], b[1]], '#2e2e2e', 3) : b[7],
      '--bar-icon': dark ? '#9a9a9a' : N[6],
      '--bar-active-bg': dark ? b[9] : b[1],
      '--bar-active-icon': dark ? readable([b[1], b[0], '#ffffff'], b[9], 3) : b[7],
      '--bar-shadow': 'rgba(' + rgbOf(b[7]).join(', ') + ', 0.25)',
      '--err-bg': dark ? '#3a1d1d' : '#fef2f2',
      '--err-text': dark ? '#fca5a5' : '#991b1b',
      '--err-border': dark ? '#7f1d1d' : '#fecaca',
    };
    b.forEach(function (c, i) { v['--b' + i] = c; });
    $('#paint').textContent =
      '.app{' + Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(';') + '}\n' +
      '.app-header.colour,.primary{background:linear-gradient(135deg,' + b[7] + ' 0%,' + b[9] + ' 100%)}\n' +
      '.app-menu.colour{background:linear-gradient(180deg,' + b[9] + ' 0%,' + b[8] + ' 100%)}\n' +
      '.app-header.white .logo{color:' + b[7] + '}\n';
    return v;
  }

  function header(s, L, app, phone) {
    var white = s.header === 'white';
    var h = '<header class="app-header ' + (white ? 'white' : 'colour') + '">';
    h += '<div class="brand"><a href="' + esc(hashOf(Object.assign({}, s, { path: HOME[app] }))) + '" data-go="' + HOME[app] + '" aria-label="' + BRAND + '">' + logo() + '</a>';
    h += '<span class="brand-name">' + BRAND + '</span>';
    if (app === 'console') h += '<span class="badge">' + esc(L.badge) + '</span>';
    // The legacy's toggle sits after the brand: X while the menu shows, the menu's icon once hidden.
    if (!phone) {
      h += '<button type="button" class="hbtn" data-act="toggle-menu" aria-label="' + esc(L.nav.menu) + '" aria-expanded="' + (s.nav === 'shown') + '">' +
        icon(s.nav === 'shown' ? 'IconX' : 'IconMenu2', 18) + '</button>';
    }
    h += '</div><div class="hright">';
    h += '<button type="button" class="hbtn lang" data-act="lang-menu" aria-label="' + esc(L.user.language) + '" aria-haspopup="menu" aria-expanded="' + ui.lang + '">' +
      icon('IconLanguage', 18) + '<span>' + s.lang.toUpperCase() + '</span></button>';
    if (phone) {
      h += '<button type="button" class="hbtn" data-act="user-menu" aria-label="' + USER + '" aria-haspopup="menu" aria-expanded="' + ui.user + '">' + icon('IconUser', 20) + '</button>';
    } else {
      h += '<button type="button" class="user" data-act="user-menu" aria-label="' + USER + '" aria-haspopup="menu" aria-expanded="' + ui.user + '">' +
        '<span class="avatar" aria-hidden="true">' + USER.toUpperCase() + '</span><span class="name">' + USER + '</span>' + icon('IconChevronDown', 14) + '</button>';
    }
    if (ui.lang) {
      h += '<div class="dropdown" role="menu"><div class="label">' + esc(L.user.language) + '</div>' +
        ['vi', 'en'].map(function (l) {
          return '<button type="button" role="menuitem" lang="' + l + '" data-set="lang=' + l + '" aria-current="' + (l === s.lang) + '">' + LANGS[l] + '</button>';
        }).join('') + '</div>';
    }
    if (ui.user) {
      h += '<div class="dropdown" role="menu"><button type="button" role="menuitem">' + icon('IconKey', 16) + esc(L.user.password) + '</button><hr>' +
        '<button type="button" role="menuitem" class="danger">' + icon('IconLogout', 16) + esc(L.user.signOut) + '</button></div>';
    }
    return h + '</div></header>';
  }

  // The side menu; hidden with the icons option on, a strip of icons, each named for a screen
  // reader and its page's name shown on hover, as the legacy's tooltip.
  function menu(s, L, pages) {
    var strip = s.nav === 'hidden' && s.icons === 'on';
    var h = '<nav class="app-menu ' + (s.menu === 'white' ? 'white' : 'colour') + '" aria-label="' + esc(L.nav.menu) + '">';
    pages.forEach(function (p) {
      var name = esc(labelOf(L, p));
      h += '<a href="' + esc(hashOf(Object.assign({}, s, { path: p.path }))) + '" data-go="' + p.path + '"' + (activeOn(s.path, p.path) ? ' aria-current="page"' : '') +
        (strip ? ' aria-label="' + name + '" data-tip="' + name + '"' : '') + '>' + icon(p.icon, strip ? 22 : 20, 1.6) + '<span>' + name + '</span></a>';
    });
    return h + '<div class="build" title="main">' + esc(D.source.commit) + '</div></nav>';
  }

  // The phone's bar: the menu's first four, then More, a page of the rest; icons only, as the
  // legacy draws them, each named for a screen reader.
  function bar(s, L, app, pages) {
    var four = pages.slice(0, 4);
    var onMore = !four.some(function (p) { return activeOn(s.path, p.path); });
    var item = function (path, name, iconName, active) {
      return '<a href="' + esc(hashOf(Object.assign({}, s, { path: path }))) + '" data-go="' + path + '" aria-label="' + esc(name) + '" title="' + esc(name) + '"' +
        (active ? ' aria-current="page"' : '') + '><span>' + icon(iconName, 22, 1.8) + '</span></a>';
    };
    return '<nav class="app-bar" aria-label="' + esc(L.nav.menu) + '">' +
      four.map(function (p) { return item(p.path, labelOf(L, p), p.icon, activeOn(s.path, p.path)); }).join('') +
      item(MORE[app], OWN[s.lang].more, 'IconDots', onMore) + '</nav>';
  }

  var ROWS = [['#1041', '08:15', '3'], ['#1042', '09:40', '1'], ['#1043', '10:05', '12'], ['#1044', '13:30', '2']];

  function page(s, L, app, pages) {
    var isMore = s.path === MORE[app];
    var current = pages.filter(function (p) { return p.path === s.path; })[0];
    var soon = app === 'console' && current && (current.id === 'usage' || current.id === 'activity');
    var title = isMore ? OWN[s.lang].more : labelOf(L, current);
    var h = '<div class="page-head"><h2>' + esc(title) + '</h2>' +
      (!isMore && !soon && s.state === 'content' ? '<button type="button" class="primary" aria-label="' + esc(title) + '">' + icon('IconPlus', 20) + '</button>' : '') + '</div>';
    if (s.state === 'loading') return h + '<div class="loading" role="status"><div class="spin"></div><span>' + esc(L.loading) + '</span></div>';
    if (s.state === 'failed') {
      return h + '<div class="failed" role="alert">' + icon('IconAlertTriangle', 20) + '<span>' + esc(L.loadFailed) + '</span>' +
        '<button type="button" data-set="state=content">' + esc(L.retry) + '</button></div>';
    }
    if (isMore) {
      var link = function (p) {
        return '<a class="more-row" href="' + esc(hashOf(Object.assign({}, s, { path: p.path }))) + '" data-go="' + p.path + '">' + icon(p.icon, 20) +
          '<span>' + esc(labelOf(L, p)) + '</span><span class="go">' + icon('IconChevronRight', 16) + '</span></a>';
      };
      return h + '<div class="card" data-more>' + pages.slice(4).map(link).join('') + '</div>' +
        '<div class="card" style="margin-top:12px"><button type="button" class="more-row">' + icon('IconKey', 20) + '<span>' + esc(L.user.password) + '</span></button>' +
        '<button type="button" class="more-row danger">' + icon('IconLogout', 20) + '<span>' + esc(L.user.signOut) + '</span></button></div>';
    }
    if (s.state === 'empty' || soon) {
      return h + '<div class="card empty">' + icon('IconInbox', 40, 1.5) + '<div>' + esc(soon ? L.soon : L.none) + '</div></div>';
    }
    return h + '<div class="card">' + ROWS.map(function (r) {
      return '<div class="row"><span class="code">' + r[0] + '</span><span class="when">' + r[1] + '</span><span class="tag">×' + r[2] + '</span></div>';
    }).join('') + '</div>';
  }

  function seg(pairs, s, disabled) {
    return '<span class="seg">' + pairs.map(function (p) {
      return '<button type="button" data-set="' + p[0] + '"' + (disabled ? ' disabled' : '') + '>' + esc(p[1]) + '</button>';
    }).join('') + '</span>';
  }
  function controls(s, pal) {
    var app = appOf(s.path);
    var phone = isPhone(s);
    var L = D.words[s.lang];
    var h = '<p>The old app\'s frame around the new app\'s menus and words. A yes starts the frame in the app; a no: tell the session what reads unlike the old app.</p>';
    h += '<h2>App</h2>' + seg([['path=' + HOME.client, 'Client app'], ['path=' + HOME.console, 'Console']]);
    h += '<h2>Width</h2>' + seg([['w=390', '390 phone'], ['w=768', '768'], ['w=1280', '1280']]);
    h += '<h2>Palette</h2><div class="swatches">' + D.palettes.map(function (p) {
      return '<button type="button" class="swatch" data-set="palette=' + p.name + '"><i style="background:' + p.shades[7] + '"></i>' + p.name + '</button>';
    }).join('') + '</div>';
    h += '<div class="mix"><span>Any colour</span><input type="color" id="mix-colour" value="' + pal.shades[7] + '" aria-label="Any colour">' +
      '<input type="text" id="mix-text" value="' + pal.shades[7] + '" spellcheck="false" aria-label="Any colour, as #rrggbb"></div>';
    h += '<div class="shades" id="shades">' + pal.shades.map(function (c, i) {
      return '<span class="' + (i === 7 ? 'brand' : '') + '" style="background:' + c + ';color:' + (lum(c) > 0.35 ? '#111827' : '#ffffff') + '" title="shade ' + i + ': ' + c + '" data-shade="' + c + '">' + i + '</span>';
    }).join('') + '</div>';
    h += '<p>' + (pal.stock
      ? 'The old app\'s ' + pal.name + ': its own ten shades, 7 the brand (' + pal.shades[7] + ').'
      : pal.shades[7] + ' is no stock shade 7: its ten shades mixed toward white and black, as the new app does today.') + '</p>';
    h += '<h2>Header</h2>' + seg([['header=colour', 'Coloured'], ['header=white', 'White']]);
    h += '<h2>Side menu</h2>' + seg([['menu=colour', 'Coloured'], ['menu=white', 'White']], s, phone) + ' ' + seg([['nav=shown', 'Shown'], ['nav=hidden', 'Hidden']], s, phone);
    h += '<h2>Icons when the menu is hidden</h2>' + seg([['icons=off', 'Off'], ['icons=on', 'On']], s, phone);
    if (!phone) h += '<p>A client\'s option, off as the old app\'s: on, the hidden menu leaves a strip 60 wide, a page\'s name on hover.</p>';
    if (phone) h += '<p>A phone has no side menu: its bar holds the first four pages and More, a page of the rest.</p>';
    h += '<h2>State</h2>' + seg([['state=content', 'Content'], ['state=empty', 'Empty'], ['state=loading', 'Loading'], ['state=failed', 'Failed']]);
    var map = pagesOf(app).slice();
    if (phone) map.push({ path: MORE[app], more: true });
    h += '<h2>Page map</h2><ul class="map" lang="' + s.lang + '">' + map.map(function (p) {
      return '<li><a href="' + esc(hashOf(Object.assign({}, s, { path: p.path }))) + '" data-go="' + p.path + '"' + (s.path === p.path ? ' aria-current="page"' : '') + '>' +
        '<span>' + esc(p.more ? OWN[s.lang].more : labelOf(L, p)) + '</span><code>' + p.path + '</code></a></li>';
    }).join('') + '</ul>';
    h += '<h2>Source</h2><p>main at ' + esc(D.source.commit) + ', committed ' + esc(D.source.committed.slice(0, 16).replace('T', ' ')) + '; data written ' + esc(D.source.built.replace('T', ' ')) +
      '. Menus from ui/src/nav.ts and ui/src/operatorNav.ts, words from ui/src/i18n, icons the app\'s own; the nine palettes are the old app\'s.</p>';
    $('#controls').innerHTML = h;
  }

  function frame(s, v) {
    var L = D.words[s.lang];
    var app = appOf(s.path);
    var pages = pagesOf(app);
    var phone = isPhone(s);
    var cls = ['app', phone ? 'phone' : 'pc'];
    if (!phone && s.nav === 'hidden') cls.push(s.icons === 'on' ? 'menu-icons' : 'menu-hidden');
    var h = '<div class="' + cls.join(' ') + '" lang="' + s.lang + '" data-app="' + app + '" data-scheme="' + s.scheme + '">' + header(s, L, app, phone);
    if (!phone) h += menu(s, L, pages);
    h += '<main class="app-main"' + (s.state === 'loading' ? ' aria-busy="true"' : '') + '>' + page(s, L, app, pages) + '</main>';
    if (phone) h += bar(s, L, app, pages);
    var device = $('#device');
    device.innerHTML = h + '</div>';
    device.style.width = s.w + 'px';
    device.style.height = HEIGHTS[s.w] + 'px';
    device.style.borderColor = v['--border'];
  }

  function fit() {
    var box = $('#device-box');
    var device = $('#device');
    var s = read();
    var w = Number(s.w);
    var h = HEIGHTS[s.w];
    var scale = box.clientWidth && box.clientHeight ? Math.min(1, (box.clientWidth - 4) / w, (box.clientHeight - 4) / h) : 1;
    device.style.transform = scale < 1 ? 'scale(' + scale.toFixed(3) + ')' : '';
    $('#addr').textContent = s.path + '   ·   ' + w + ' × ' + h + ', ' + (isPhone(s) ? 'the phone\'s frame (below 768)' : 'the PC\'s frame') +
      (scale < 1 ? ', drawn at ' + Math.round(scale * 100) + '%' : '');
  }

  function render() {
    var s = read();
    var pal = paletteOf(s.palette);
    document.documentElement.setAttribute('data-scheme', s.scheme);
    var v = paint(pal.shades, s.scheme === 'dark');
    controls(s, pal);
    frame(s, v);
    // Every control that sets a value shows whether it holds now.
    document.querySelectorAll('.top [data-set], .controls [data-set]').forEach(function (b) {
      var kv = b.getAttribute('data-set').split('=');
      var on = kv[0] === 'path' ? appOf(kv[1]) === appOf(s.path) : s[kv[0]] === kv[1];
      b.setAttribute('aria-pressed', String(on));
    });
    window.FRAME_MOCK = { state: s, palette: pal, tokens: v };
    fit();
  }

  // The one question's answer, kept in the browser where it can be.
  var KEY = 'credo-frame-mock-round-2';
  function answer(value) {
    try { if (value) localStorage.setItem(KEY, value); else value = localStorage.getItem(KEY); } catch (_e) { /* no storage on this page */ }
    document.querySelectorAll('[data-answer]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-answer') === value)); });
    $('#answer').textContent = value === 'yes' ? 'Noted: tell the session "yes".' : value === 'no' ? 'Noted: tell the session what reads unlike the old app.' : '';
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go], [data-set], [data-act], [data-answer]');
    if (!t) {
      if ((ui.user || ui.lang) && !e.target.closest('.dropdown')) { ui.user = ui.lang = false; render(); }
      return;
    }
    if (t.disabled) return;
    if (t.hasAttribute('data-go')) { e.preventDefault(); go({ path: t.getAttribute('data-go') }); return; }
    if (t.hasAttribute('data-set')) {
      e.preventDefault();
      var kv = t.getAttribute('data-set').split('=');
      var change = {};
      change[kv[0]] = kv.slice(1).join('=');
      go(change);
      return;
    }
    if (t.hasAttribute('data-answer')) { answer(t.getAttribute('data-answer')); return; }
    var act = t.getAttribute('data-act');
    if (act === 'toggle-menu') go({ nav: read().nav === 'shown' ? 'hidden' : 'shown' });
    if (act === 'user-menu') { ui.user = !ui.user; ui.lang = false; render(); }
    if (act === 'lang-menu') { ui.lang = !ui.lang; ui.user = false; render(); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'mix-colour' && e.target.id !== 'mix-text') return;
    var value = e.target.value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(value)) go({ palette: value });
    else e.target.setAttribute('aria-invalid', 'true');
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', fit);

  if (!location.hash) { try { history.replaceState(null, '', hashOf(read())); } catch (_e) { /* the hash stays empty */ } }
  render();
  answer();
})();
