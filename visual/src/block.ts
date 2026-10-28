/**
 * The block pasted into the chat: plain text, a line an answer. The page writes it and
 * `pnpm answers` reads it, so the one file holds both halves of the format. A partner's block, in
 * the Share message, has one line more, `By: <label>`; a block without it is the human's.
 *
 * ```text
 * Credo walks answers
 * Build: branch a-piece, commit abc123def
 * By: p1
 * admin-setup:3-settings:vi | yes | 0123456789ab
 * admin-setup:3-settings:en | no | 0123456789ab | the save button is hard to find
 * ```
 */
export const BLOCK_TITLE = 'Credo walks answers';

/** What names a partner: a label the human gives, never a name. */
export const LABEL = /^[a-z0-9-]{1,20}$/;

/** One answer: the key `<walk>:<screen>:<language>`, and the fingerprint of the words it was given on. */
export type BlockEntry = {
  key: string;
  answer: 'yes' | 'no';
  fingerprint: string;
  reason: string;
};

export type BlockBuild = { branch: string; commit: string; changed: boolean };

/**
 * A reason on one line: the block holds a line an answer. Its backticks become quotes, so no
 * block carries a code fence that would end it, in the chat or when read back.
 */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').replaceAll('`', "'").trim();

export function blockText(build: BlockBuild, entries: readonly BlockEntry[], by = '') {
  const lines = entries.map((entry) =>
    [
      entry.key,
      entry.answer,
      entry.fingerprint,
      ...(entry.answer === 'no' ? [oneLine(entry.reason)] : []),
    ].join(' | '),
  );
  const from = `Build: branch ${build.branch}, commit ${build.commit}${build.changed ? ' with changes' : ''}`;
  return [BLOCK_TITLE, from, ...(by === '' ? [] : [`By: ${by}`]), ...lines].join('\n');
}

/** A line the command cannot take, by its number in the pasted text. */
type Refusal = { line: number; why: string };

const ANSWER = /^(\S+) \| (yes|no) \| ([0-9a-f]{12})(?: \| (.*))?$/;
/** What a line that means to be an answer starts with: a key (`walk:screen:language`), then a bar. */
const ANSWER_LIKE = /^[^\s:]+(?::[^\s:]+){2} \|/;
/** A line that looks like a `By:` mark, however the chat dressed it: `by : p1`, `*By:*`, `> > BY:`. */
const BY_LIKE = /^\W*by\s*:/i;
/** The readable header of a partner's Share post, which may outlive its `By:` line. */
const SHARE_HEADER = /^\W*credo walks:\s*answers from\b/i;
/** A line that marks a partner's post: a `By:` mark or Share's header, never an answer line. */
const partnerMark = (text: string) =>
  (BY_LIKE.test(text) || SHARE_HEADER.test(text)) && !ANSWER_LIKE.test(text);

/**
 * A line as the chat may have mangled it: zero-width characters gone, every kind of space (no-break,
 * narrow, thin) a plain one, a quote mark, a code fence glued to either end, and the mark of an
 * edit, all taken off.
 */
const cleaned = (raw: string) =>
  raw
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/[^\S\r\n]/g, ' ')
    .trim()
    .replace(/^>\s?/, '')
    .replace(/\s*\(edited\)$/, '')
    .replace(/^`{3,}/, '')
    .replace(/`{3,}$/, '')
    .trim();

/** An answer taken: its line in the paste and the label of its block, empty for the human's. */
type Taken = BlockEntry & { line: number; by: string };

type Candidate = {
  line: number;
  key: string;
  answer: 'yes' | 'no';
  fingerprint: string;
  reason: string;
};

/** One block as it is read: from its title to the next, judged when it ends. */
type Open = {
  title: number;
  by: string;
  hasBy: boolean;
  /** The block cannot be taken: a By: line that is no label, a second one, or one after an answer. */
  spoiled: boolean;
  seen: number;
  candidates: Candidate[];
};

/**
 * The answers in a pasted text of one block or several, each with its line number and the label
 * of its block's `By:` line, and the lines that are refused. A block runs from its title line to
 * the next, or to a code fence's end. A line that starts like an answer is taken or refused; every
 * other line is skipped, so the chat's names, times and readable lines never stop a paste.
 *
 * Whose blocks they are is decided by the caller, never by the paste. Without `partners`, a paste
 * with any line that looks like a `By:` mark or Share's header, anywhere in it, is a partner's or a mix: nothing in
 * it is taken, and one refusal names `--partners`. With `partners`, only a block with one valid
 * `By:` line before its first answer line is taken; every other block is refused answer by
 * answer, as is a line that starts like an answer before any title, and a title with no answer
 * line under it. Text with no title and no such line is not a block at all.
 */
export function parseBlock(text: string, { partners = false } = {}) {
  const lines = text.split(/\r?\n/);
  if (!lines.some((line) => cleaned(line) === BLOCK_TITLE || ANSWER_LIKE.test(cleaned(line)))) {
    throw new Error(`not an answers block: no "${BLOCK_TITLE}" line`);
  }
  if (!partners) {
    const mark = lines.findIndex((line) => partnerMark(cleaned(line)));
    if (mark >= 0) {
      return {
        entries: [] as Taken[],
        refused: [
          {
            line: mark + 1,
            why: 'a By: line: this paste holds a partner’s block, so nothing in it is written; partners’ posts are taken by `pnpm answers --partners`, your own block in a paste of its own',
          },
        ],
      };
    }
  }
  const entries: Taken[] = [];
  const refused: Refusal[] = [];
  const refuse = (line: number, why: string) => refused.push({ line, why });
  let block: Open | undefined;

  const close = () => {
    if (!block) return;
    const { title, by, hasBy, spoiled, seen, candidates } = block;
    if (seen === 0) refuse(title, `no answer line under this "${BLOCK_TITLE}" line`);
    const why = spoiled
      ? 'its By: line is no label, is a second one, is written another way, or comes after an answer line'
      : partners && !hasBy
        ? 'no By: line: a partner’s block has one, before its first answer'
        : '';
    for (const one of candidates) {
      if (why) refuse(one.line, `“${one.key}” is in a block with ${why}`);
      else entries.push({ ...one, by });
    }
    block = undefined;
  };

  const read = (raw: string, index: number) => {
    const line = index + 1;
    const text = cleaned(raw);
    if (text === BLOCK_TITLE) {
      close();
      block = { title: line, by: '', hasBy: false, spoiled: false, seen: 0, candidates: [] };
      return;
    }
    if (block && BY_LIKE.test(text) && !ANSWER_LIKE.test(text)) {
      const label = text.slice(text.indexOf(':') + 1).trim();
      if (!text.startsWith('By:')) {
        refuse(line, `“${text}”: a By: line written another way than "By: <label>"`);
        block.spoiled = true;
      } else if (block.seen > 0) {
        refuse(line, `“${label}”: a By: line after an answer line`);
        block.spoiled = true;
      } else if (block.hasBy) {
        refuse(line, `“${label}”: a second By: line`);
        block.spoiled = true;
      } else if (!LABEL.test(label)) {
        refuse(line, `“${label}” is not a label: 1 to 20 lowercase letters, digits or hyphens`);
        block.spoiled = true;
      } else {
        block.hasBy = true;
        block.by = label;
      }
      return;
    }
    if (!ANSWER_LIKE.test(text)) return;
    const found = ANSWER.exec(text);
    if (block) block.seen += 1;
    if (!found) {
      refuse(line, `“${text}” is not an answer line: <key> | yes or no | <fingerprint>`);
    } else if (!block) {
      refuse(line, `“${found[1]}” comes before any "${BLOCK_TITLE}" line`);
    } else {
      const [, key, answer, fingerprint, reason = ''] = found;
      block.candidates.push({ line, key, answer: answer as 'yes' | 'no', fingerprint, reason });
    }
  };

  lines.forEach((raw, index) => {
    read(raw, index);
    // A code fence's end ends the block, so a post whose title was lost never joins the one above.
    if (raw.trim().endsWith('```')) close();
  });
  close();
  return { entries, refused: refused.sort((a, b) => a.line - b.line) };
}
