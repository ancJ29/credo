import { JSDOM } from 'jsdom';

/**
 * jsdom's `<dialog>` is a bare element: no `open`, no `showModal`, no `close`. This gives it the
 * parts the page uses, as a browser's modal dialog has them: `showModal` opens it, `close` shuts it
 * and says so with a `close` event. The page behind and Escape are the browser's, not stubbed.
 */
export function stubDialog(win: Window & typeof globalThis) {
  const dialog = win.HTMLDialogElement.prototype;
  Object.defineProperty(dialog, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open');
    },
  });
  dialog.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialog.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new win.Event('close'));
  };
}

/**
 * What the app's components read of a browser that jsdom leaves out: Mantine asks `matchMedia` for
 * the colour scheme and watches sizes, its controls scroll options into view, and React's `act`
 * wants to know it is allowed.
 */
export function prepareDom(win: Window & typeof globalThis) {
  win.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  win.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  win.Element.prototype.scrollIntoView = () => {};
  stubDialog(win);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

/**
 * A page for a Node process to draw screens on: jsdom's window and what it holds become the
 * globals React and Mantine reach for, where Node has none of its own. Returns the undo.
 */
export function installDom() {
  const { window } = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const win = window as unknown as Window & typeof globalThis;
  prepareDom(win);

  const global = globalThis as Record<string, unknown>;
  const before = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown) => {
    if (!before.has(key)) before.set(key, Object.getOwnPropertyDescriptor(global, key));
    Object.defineProperty(global, key, { value, configurable: true, writable: true });
  };
  for (const key of Object.getOwnPropertyNames(win)) {
    if (!(key in global)) set(key, (win as unknown as Record<string, unknown>)[key]);
  }
  // Node has a `FormData` of its own, which refuses a jsdom form: React reads one on a submit.
  set('FormData', win.FormData);
  set('window', win);
  set('document', win.document);
  set('navigator', win.navigator);

  return () => {
    for (const [key, descriptor] of before) {
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete global[key];
    }
    win.close();
  };
}
