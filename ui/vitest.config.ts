import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // elsewhere: the mock's entry mounts the page in a browser; src/mock/MockPage.test.tsx
      // renders the page it mounts.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mock/main.tsx'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
