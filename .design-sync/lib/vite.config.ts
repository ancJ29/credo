import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Every `react` import but react-compat.js's own goes through react-compat.js, so the library also
// runs on React 18 (a Claude Design canvas); react-compat.js alone imports the real, external React.
const reactCompat = fileURLToPath(new URL('./react-compat.js', import.meta.url));
const alwaysExternal = ['react-dom', 'react/jsx-runtime', 'react-dom/client'];

const reactThroughCompat: Plugin = {
  name: 'credo-react-compat',
  enforce: 'pre',
  resolveId(source, importer) {
    return source === 'react' && importer !== reactCompat ? reactCompat : null;
  },
};

export default defineConfig({
  plugins: [reactThroughCompat, react()],
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
    rollupOptions: {
      external: (source, importer) =>
        source === 'react' ? importer === reactCompat : alwaysExternal.includes(source),
    },
  },
});
