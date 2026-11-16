import { runWords } from './words';

process.exitCode = await runWords(process.argv.slice(2), process.env, {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  cwd: process.cwd(),
});
