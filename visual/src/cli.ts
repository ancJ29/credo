import { join } from 'node:path';
import { PACKAGE } from './build';
import { installDom } from './dom';
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
