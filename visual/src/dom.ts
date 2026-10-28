import { JSDOM } from 'jsdom';

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
