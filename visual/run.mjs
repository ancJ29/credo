// `pnpm report`. The screens are the app's own components, with CSS modules and TSX, which Node
// cannot import alone: a Vite server loads `src/capture.ts`, as the tests' own runner loads it.
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

const server = await createServer({
  root,
  configFile: false,
  plugins: [(await import('@vitejs/plugin-react')).default()],
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true },
});
try {
  const { report } = await server.ssrLoadModule('/src/capture.ts');
  await report(process.cwd(), console.log);
} finally {
  await server.close();
}
