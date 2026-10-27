import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The walks page as the mock is built (`ui/vite.mock.config.ts`): one script, one set of styles
 * and the font, to be inlined into the one HTML file, since a browser refuses module scripts and
 * fonts fetched from `file://`. `src/build.ts` calls this with `write: false`.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: { input: 'page.html', output: { codeSplitting: false } },
  },
});
