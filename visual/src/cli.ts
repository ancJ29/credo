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
import { drawnWords } from './words';

/**
 * `pnpm report`: builds the walks page from the repository the command runs in, and says where it
 * landed and what waits. The screens are drawn on a DOM made for the run.
 */
export async function report(cwd: string, log: (line: string) => void) {
  const { build } = await import('./build');
  const restore = installDom();
  try {
    const { folder, report } = await build({
      cwd,
      answersFile: join(PACKAGE, 'answers.json'),
      readWords: (state, language, navigation) =>
        drawnWords(state.screen, state.colour, language, { navigation }),
    });
    const { tally } = report;
    log(`walks page: ${folder}`);
    log(`${tally.waiting} waiting, ${tally.changed} asked again, ${tally.no} no, ${tally.yes} yes`);
    return folder;
  } finally {
    restore();
  }
}

/**
 * `pnpm answers <file>`: reads a block the human pasted into the chat and writes the answers that
 * hold into `visual/answers.json`. Each is held against the words the screen draws now; a line
 * that is stale, or names an unknown screen or language, is refused by its number and says why.
 * Answers the file already holds, for other screens, stay.
 *
 * @returns how many lines were refused, for the command's exit status
 */
export async function answer(
  block: string,
  log: (line: string) => void,
  { file = join(PACKAGE, 'answers.json'), now = new Date() } = {},
) {
  const restore = installDom();
  try {
    const current = currentWords(WALKS, SCREENS, (state, language, navigation) =>
      drawnWords(state.screen, state.colour, language, { navigation }),
    );
    const existing = parseAnswers(await readFile(file, 'utf8'));
    const { answers, taken, refused } = takeAnswers(
      block,
      current,
      existing,
      vietnamTime(now).date,
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
