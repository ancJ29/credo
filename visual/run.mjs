// `pnpm report` and `pnpm answers <file>`. The screens are the app's own components, with CSS
// modules and TSX, which Node cannot import alone: a Vite server loads them as the mock's build
// and the tests do.
import console from 'node:console';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const [command, file] = process.argv.slice(2);
const root = fileURLToPath(new URL('.', import.meta.url));

async function pasted() {
  if (file === undefined) {
    process.stdin.setEncoding('utf8');
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    return text;
  }
  // pnpm runs a script in the package's folder; a relative path is the caller's.
  return readFile(resolve(process.env.INIT_CWD ?? process.cwd(), file), 'utf8');
}

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
  if (command === 'answers') {
    if ((await cli.answer(await pasted(), console.log)) > 0) process.exitCode = 1;
  } else {
    await cli.report(process.cwd(), console.log);
  }
} finally {
  await server.close();
}
