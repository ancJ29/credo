import { writeSync } from 'node:fs';
import { runRidge } from './ridge';

/** Everything on the standard input: `root-password`'s new password arrives on a pipe. */
async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  return text;
}

/** fd 3 is the human's terminal, handed on by ops/operator.sh past its log; it is open or the
 * link is not shown. */
process.exitCode = await runRidge(process.argv.slice(2), process.env, {
  out: (line) => console.log(line),
  show: (line) => writeSync(3, `${line}\n`),
  err: (line) => console.error(line),
  stdin: readStdin,
});
