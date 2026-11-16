import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { runWords } from './words';

process.exitCode = await runWords(process.argv.slice(2), process.env, {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  cwd: process.cwd(),
  root: fileURLToPath(new URL('../../', import.meta.url)),
  ask: async (question) => {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await terminal.question(`${question} `);
    terminal.close();
    return answer;
  },
});
