// React as the design sync's library sees it. The library is built against React 19 (Mantine 9
// uses useEffectEvent, use, Activity and a context rendered as its own provider), but a Claude
// Design canvas mounts it on React 18. On React 19 every name here is React's own; on React 18
// the four are filled in. vite.config.ts sends every `import … from 'react'` here but this file's.
import * as React from 'react';

export * from 'react';
export default React.default ?? React;

const before19 = Number.parseInt(React.version, 10) < 19;

export const useEffectEvent =
  React.useEffectEvent ??
  function useEffectEvent(fn) {
    const ref = React.useRef(fn);
    (React.useInsertionEffect ?? React.useLayoutEffect)(() => {
      ref.current = fn;
    });
    return React.useCallback((...args) => ref.current(...args), []);
  };

// Only use(context) is met in the library; use(promise) needs React 19's Suspense.
export const use =
  React.use ??
  function use(usable) {
    if (usable && typeof usable.then === 'function') throw new Error('use(promise) needs React 19');
    return React.useContext(usable);
  };

export const Activity =
  React.Activity ??
  function Activity({ mode, children }) {
    return mode === 'hidden' ? null : React.createElement(React.Fragment, null, children);
  };

// React 19 renders <Context value={…}> as the provider; React 18 reads a context element as its
// consumer. Marked as a provider of itself, the context works both ways (Context.Provider still does).
export const createContext = before19
  ? function createContext(defaultValue) {
      const context = React.createContext(defaultValue);
      context.$$typeof = Symbol.for('react.provider');
      context._context = context;
      return context;
    }
  : React.createContext;
