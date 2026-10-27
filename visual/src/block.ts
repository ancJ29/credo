/**
 * The block the human pastes into the chat: plain text, a line an answer. The page writes it and
 * `pnpm answers` reads it, so the one file holds both halves of the format.
 *
 * ```text
 * Credo walks answers
 * Build: branch a-piece, commit abc123def
 * admin-setup:3-settings:vi | yes | 0123456789ab
 * admin-setup:3-settings:en | no | 0123456789ab | the save button is hard to find
 * ```
 */
export const BLOCK_TITLE = 'Credo walks answers';

/** One answer: the key `<walk>:<screen>:<language>`, and the fingerprint of the words it was given on. */
export type BlockEntry = {
  key: string;
  answer: 'yes' | 'no';
  fingerprint: string;
  reason: string;
};

export type BlockBuild = { branch: string; commit: string; changed: boolean };

/** A reason on one line: the block holds a line an answer. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

export function blockText(build: BlockBuild, entries: readonly BlockEntry[]) {
  const lines = entries.map((entry) =>
    [
      entry.key,
      entry.answer,
      entry.fingerprint,
      ...(entry.answer === 'no' ? [oneLine(entry.reason)] : []),
    ].join(' | '),
  );
  const from = `Build: branch ${build.branch}, commit ${build.commit}${build.changed ? ' with changes' : ''}`;
  return [BLOCK_TITLE, from, ...lines].join('\n');
}

/** A line the command cannot take, by its number in the pasted text. */
type Refusal = { line: number; why: string };

const ANSWER = /^(\S+) \| (yes|no) \| ([0-9a-f]{12})(?: \| (.*))?$/;

/**
 * The answers in a pasted block, each with its line number, and the lines that are none. Blank
 * lines, the title, the build line and the chat's code fences are skipped. Text with no title is
 * not a block at all.
 */
export function parseBlock(text: string) {
  const lines = text.split(/\r?\n/);
  if (!lines.some((line) => line.trim() === BLOCK_TITLE)) {
    throw new Error(`not an answers block: no "${BLOCK_TITLE}" line`);
  }
  const entries: (BlockEntry & { line: number })[] = [];
  const refused: Refusal[] = [];
  lines.forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();
    if (
      text === '' ||
      text === BLOCK_TITLE ||
      text.startsWith('Build:') ||
      text.startsWith('```')
    ) {
      return;
    }
    const found = ANSWER.exec(text);
    if (!found) {
      refused.push({
        line,
        why: `“${text}” is not an answer line: <key> | yes or no | <fingerprint>`,
      });
      return;
    }
    const [, key, answer, fingerprint, reason = ''] = found;
    entries.push({ line, key, answer: answer as 'yes' | 'no', fingerprint, reason });
  });
  return { entries, refused };
}
