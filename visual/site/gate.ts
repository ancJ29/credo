// The password box in front of the walks page and the docs site: one home for both. Until the right
// password is typed the page's content is hidden and a plain box asks for it; the entry's SHA-256
// (a fixed prefix plus the entry) is compared with the hash the build put in `ops/site-password.sha256`.
// A right entry is remembered in this browser. It stops a curious outsider, not a determined one:
// the page's own files are public. Browser code only; `gate-file.ts` is the build's reading of the hash.

/** Put before the entry before it is hashed. `ops/site-password.sh` writes the same prefix. */
export const GATE_PREFIX = 'credo-site-gate:';
const REMEMBER = 'credo-site-gate';
const BOX = 'site-gate';

/** The one rule that hides the content until the box is answered (the page marks `html` open with an
 * attribute of its own, never `class`: the docs site's head library rewrites the whole `class` of `html`
 * at start-up and on each link followed). The box shows itself in spite of it. Both pages carry this
 * text in their head. */
export const GATE_STYLE = 'html:not([data-site-gate=open]) body{visibility:hidden}';

declare global {
  interface Window {
    SITE_GATE_HASH: string;
  }
}

export const WORDS = {
  title: 'Please enter the password',
  help: 'You were given a password with the link. Type it here to open the page.',
  label: 'Password',
  open: 'Open',
  wrong: 'That password is not right. Please try again.',
  broken:
    'This browser cannot check the password. Please open the page in Chrome, Safari or Firefox.',
};

/** The entry's SHA-256 as 64 lowercase hex digits. Throws where the browser has no WebCrypto. */
export async function digestOf(entry: string, win: Window = window) {
  const bytes = new TextEncoder().encode(GATE_PREFIX + entry);
  const digest = await win.crypto.subtle.digest('SHA-256', bytes);
  // Array.from, not a spread: the docs build's loose Babel turns `[...typedArray]` into `[].concat(typedArray)`
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Reads what this browser remembers; a blocked storage only means the box asks again. */
function remembered(win: Window) {
  try {
    return win.localStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
}

function remember(win: Window, hash: string) {
  try {
    win.localStorage.setItem(REMEMBER, hash);
  } catch {
    /* asked again next time */
  }
}

/** Opens the page at once for a browser that remembers the right password, else draws the box. */
export function startGate(hash: string, win: Window = window) {
  const doc = win.document;
  const open = () => {
    doc.documentElement.setAttribute('data-site-gate', 'open');
    doc.getElementById(BOX)?.remove();
  };
  if (remembered(win) === hash) {
    open();
    return;
  }
  const box = doc.createElement('div');
  box.id = BOX;
  box.style.cssText =
    'visibility:visible;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;' +
    'background:Canvas;color:CanvasText;font:16px/1.45 system-ui,sans-serif';
  const form = doc.createElement('form');
  form.style.cssText = 'display:grid;gap:12px;width:min(360px,calc(100vw - 32px))';
  const title = doc.createElement('h1');
  title.textContent = WORDS.title;
  title.style.cssText = 'margin:0;font-size:22px';
  const help = doc.createElement('p');
  help.textContent = WORDS.help;
  help.style.cssText = 'margin:0';
  const label = doc.createElement('label');
  label.textContent = WORDS.label;
  label.style.cssText = 'display:grid;gap:4px';
  const input = doc.createElement('input');
  input.type = 'password';
  input.autocomplete = 'current-password';
  input.required = true;
  input.style.cssText = 'font:inherit;padding:8px 10px';
  label.append(input);
  const button = doc.createElement('button');
  button.type = 'submit';
  button.textContent = WORDS.open;
  button.style.cssText = 'font:inherit;padding:8px 10px;cursor:pointer';
  const note = doc.createElement('p');
  note.setAttribute('role', 'alert');
  note.style.cssText = 'margin:0;min-height:1.45em';
  form.append(title, help, label, button, note);
  box.append(form);
  doc.body.append(box);
  input.focus();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    note.textContent = '';
    digestOf(input.value, win).then(
      (entered) => {
        if (entered === hash) {
          remember(win, hash);
          open();
        } else {
          note.textContent = WORDS.wrong;
          input.value = '';
          input.focus();
        }
      },
      () => {
        note.textContent = WORDS.broken;
      },
    );
  });
}
