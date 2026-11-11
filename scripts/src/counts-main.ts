import { fileURLToPath } from 'node:url';
import { repoIo, runCounts } from './counts';

const root = fileURLToPath(new URL('../../', import.meta.url));

process.exitCode = runCounts(process.argv.slice(2), repoIo(root, console.log, console.error));
