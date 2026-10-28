import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SCREENS } from '@credo/ui/mock';
import { parseAnswers } from './answers';
import { PACKAGE } from './build';
import { installDom } from './dom';
import { vietnamTime } from './home';
import { currentWords } from './report';
import { takeAnswers } from './take';
import { WALKS } from './walks';

/**
 * What the command line says: the command, the file (none: stdin), and whether `--partners` is
 * there, first or last. The flag decides whose answers are written.
 */
export function parseArgs(args: readonly string[]) {
  const [command, file] = args.filter((arg) => arg !== '--partners');
  return { command, file, partners: args.includes('--partners') };
}

/**
 * The words reader, loaded once the DOM stands: React's DOM renderer asks at its first load
 * whether there is a window, and with none it never listens for a text field's `input` event, so a
 * scene could type into nothing. Called after `installDom`, never from the top of the file.
 */
const loadWords = () => import('./words');

/**
 * `pnpm report`: builds the walks page from the repository the command runs in, and says where it
 * landed and what waits. The screens are drawn on a DOM made for the run.
 */
export async function report(cwd: string, log: (line: string) => void) {
  const { build } = await import('./build');
  const restore = installDom();
  try {
    const { readWords } = await loadWords();
    const { folder, report } = await build({
      cwd,
      answersFile: join(PACKAGE, 'answers.json'),
      readWords,
    });
    const { tally } = report;
    log(`walks page: ${folder}`);
    const { waiting, changed, no, yes } = tally;
    log(`${waiting} waiting, ${changed} asked again, ${no} no, ${yes} yes`);
    return folder;
  } finally {
    restore();
  }
}

/**
 * `pnpm answers [--partners] <file>`: reads the blocks the human pasted into the chat and writes
 * the answers that hold into `visual/answers.json`: the human's own block, or with `--partners` the
 * partners' Share messages, never both in one run. Each is held against the words the screen draws
 * now; a line that is stale, or names an unknown screen or language, is refused by its number and
 * says why. Answers the file already holds, for other screens, stay.
 *
 * @returns how many lines were refused, for the command's exit status
 */
export async function answer(
  block: string,
  log: (line: string) => void,
  { file = join(PACKAGE, 'answers.json'), now = new Date(), partners = false } = {},
) {
  const restore = installDom();
  try {
    const { readWords } = await loadWords();
    const current = await currentWords(WALKS, SCREENS, readWords);
    const existing = parseAnswers(await readFile(file, 'utf8'));
    const { answers, taken, refused } = takeAnswers(
      block,
      current,
      existing,
      vietnamTime(now).date,
      { partners },
    );
    if (taken.length > 0) await writeFile(file, `${JSON.stringify(answers, null, 2)}\n`);
    for (const key of taken) log(`taken: ${key}`);
    for (const { line, why } of refused) log(`refused, line ${line}: ${why}`);
    log(`${taken.length} written to answers.json, ${refused.length} refused`);
    return refused.length;
  } finally {
    restore();
  }
}
