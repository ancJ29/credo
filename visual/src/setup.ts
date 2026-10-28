import { afterEach } from 'vitest';
import { prepareDom } from './dom';

// The tests that pick Node as their environment have no window to prepare, and must not load
// React's DOM renderer before they make one: it asks at its first load whether there is a window,
// and with none it never listens for a text field's `input` event, so a scene types into nothing.
if (typeof window !== 'undefined') {
  prepareDom(window);
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
