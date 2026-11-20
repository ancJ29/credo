import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['map.ts'],
      // elsewhere: the site's build runs them
      exclude: ['*.test.ts', 'docusaurus.config.ts', 'sidebars.ts', 'links.ts'],
      reporter: [['text', { skipFull: true }]],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
