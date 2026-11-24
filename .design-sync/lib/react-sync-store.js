// React 18+ ships useSyncExternalStore itself; the npm shim's CommonJS copy cannot be bundled
// for the design agent's page, where React is a global.
export { useSyncExternalStore } from 'react';
