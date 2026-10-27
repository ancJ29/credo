import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The app as the local front serves it; `/api` is the front's, so the UI knows no host. */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/app',
    // One bundle of React and Mantine, about 650 kB: no route is split off until a page is heavy.
    chunkSizeWarningLimit: 1000,
  },
});
