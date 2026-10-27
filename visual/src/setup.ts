import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { prepareDom } from './dom';

// The tests that pick Node as their environment have no window to prepare.
if (typeof window !== 'undefined') prepareDom(window);
afterEach(cleanup);
