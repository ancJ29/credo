import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^use-sync-external-store\/shim(\/.*)?$/, replacement: new URL('./react-sync-store.js', import.meta.url).pathname },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: { entry: 'entry.ts', formats: ['es'], fileName: () => 'index.es.js', cssFileName: 'style' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'] },
  },
});
