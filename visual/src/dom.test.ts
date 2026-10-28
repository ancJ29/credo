// @vitest-environment node
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installDom, prepareDom } from './dom';

describe('a DOM for a Node process', () => {
  it('gives Node a window, a document and the classes React reaches for, then takes them away', () => {
    const had = 'document' in globalThis;

    const restore = installDom();
    const kept = {
      document: typeof document,
      element: typeof Element,
      matchMedia: typeof window.matchMedia,
      title: document.title,
      // Node's own globals are kept.
      structuredClone: typeof structuredClone,
    };
    restore();

    expect(had).toBe(false);
    expect(kept).toEqual({
      document: 'object',
      element: 'function',
      matchMedia: 'function',
      title: '',
      structuredClone: 'function',
    });
    expect('document' in globalThis).toBe(false);
    expect('Element' in globalThis).toBe(false);
  });

  it('puts back a global Node had, if it set one over', () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    const restore = installDom();
    expect(globalThis.navigator).not.toBe(undefined);
    restore();

    expect(Object.getOwnPropertyDescriptor(globalThis, 'navigator')).toEqual(before);
  });

  it('prepares a window: a media query that never matches, sizes watched by nothing, scrolling by none', () => {
    const win = new JSDOM('').window as unknown as Window & typeof globalThis;

    prepareDom(win);
    const query = win.matchMedia('(min-width: 1px)');
    const observer = new win.ResizeObserver(() => {});

    expect(query.matches).toBe(false);
    expect(query.media).toBe('(min-width: 1px)');
    expect(() => {
      query.addEventListener('change', () => {});
      query.removeEventListener('change', () => {});
      query.addListener(() => {});
      query.removeListener(() => {});
      query.dispatchEvent(new win.Event('change'));
      observer.observe(win.document.body);
      observer.unobserve(win.document.body);
      observer.disconnect();
      win.document.body.scrollIntoView();
    }).not.toThrow();
  });

  it('keeps a size watcher the window already has', () => {
    const win = new JSDOM('').window as unknown as Window & typeof globalThis;
    const own = class {} as unknown as typeof ResizeObserver;
    win.ResizeObserver = own;

    prepareDom(win);

    expect(win.ResizeObserver).toBe(own);
  });
});
