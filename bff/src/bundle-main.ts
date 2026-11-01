import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bundleBff } from './bundle';

const outfile = fileURLToPath(new URL('../dist/index.js', import.meta.url));
await bundleBff(outfile, process.env['CREDO_BUILD']);
console.log(`${outfile}: ${(await stat(outfile)).size} bytes`);
