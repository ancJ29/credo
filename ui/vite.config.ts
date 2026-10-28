import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The app as the local front serves it; `/api` is the front's, so the UI knows no host. The fake
 * build (`--mode fake`) is the same app with `?fake` compiled in, in a folder of its own. */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: mode === 'fake' ? 'dist/fake' : 'dist/app',
    // One bundle of React and Mantine, about 650 kB: no route is split off until a page is heavy.
    chunkSizeWarningLimit: 1000,
  },
}));
