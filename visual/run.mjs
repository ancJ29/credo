// `pnpm report`. The screens are the app's own components, with CSS modules and TSX, which Node
// cannot import alone: a Vite server loads them as the mock's build and the tests do.
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const server = await createServer({
  root,
  configFile: `${root}vite.config.ts`,
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true },
});
try {
  const cli = await server.ssrLoadModule('/src/cli.ts');
  await cli.report(process.cwd(), console.log);
} finally {
  await server.close();
}
