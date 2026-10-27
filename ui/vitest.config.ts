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
      // elsewhere: the entries mount a page in a browser. src/mock/MockPage.test.tsx renders the
      // mock's page, src/App.test.tsx the app's, and the walk spec runs `main.tsx` on the stack.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mock/main.tsx', 'src/main.tsx'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
