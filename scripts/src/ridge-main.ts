import { writeSync } from 'node:fs';
import { runRidge } from './ridge';

/** fd 3 is the human's terminal, handed on by ops/operator.sh past its log; it is open or the
 * password is not shown. */
process.exitCode = await runRidge(process.argv.slice(2), process.env, {
  out: (line) => console.log(line),
  show: (line) => writeSync(3, `${line}\n`),
  err: (line) => console.error(line),
});
