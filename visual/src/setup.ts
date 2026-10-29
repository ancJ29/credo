import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { prepareDom } from './dom';

/**
 * jsdom loads every iframe's blank page on its own, a moment after the frame is mounted, and
 * fires `load` between two steps of a test, outside `act`, where the mock's `Frame` would draw its
 * screen. A frame here stays blank until a test fires its `load` itself, as the walks page's tests
 * do for the screens they read: that event is not the browser's own (`isTrusted` is false), and
 * it comes inside `act`.
 */
function loadOnlyWhenFired(win: Window & typeof globalThis) {
  const add = Reflect.get(win.HTMLIFrameElement.prototype, 'addEventListener') as (
    this: HTMLIFrameElement,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  win.HTMLIFrameElement.prototype.addEventListener = function (
    this: HTMLIFrameElement,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type !== 'load') return add.call(this, type, listener, options);
    const fired = (event: Event) => {
      if (event.isTrusted) return;
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    };
    return add.call(this, type, fired, options);
  };
}

// The tests that pick Node as their environment have no window to prepare.
if (typeof window !== 'undefined') {
  prepareDom(window);
  loadOnlyWhenFired(window);
}

/**
 * An update outside `act` is a red in the test it lands in: React only prints it, and a test that
 * passes with it may have read the page before the update.
 */
const outsideAct: string[] = [];
const print = console.error;
console.error = (...args: unknown[]) => {
  if (String(args[0]).includes('not wrapped in act')) outsideAct.push(String(args[0]));
  print(...args);
};
afterEach(() => {
  cleanup();
  expect(outsideAct.splice(0)).toEqual([]);
});
