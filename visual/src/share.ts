import { type BlockBuild, type BlockEntry, blockText } from './block';

/** One answered screen in a Share message: the machine's line, and what Slack's readers see. */
export type ShareItem = BlockEntry & {
  number: number;
  /** The screen's sentence, in English. */
  sentence: string;
  /** The language's name, as the page shows it. */
  language: string;
};

/** What a partner typed as a label: lowercased, without the spaces around it. */
export const normalizeLabel = (typed: string) => typed.trim().toLowerCase();

/** Slack ends a code block at its own fence: a reason's backticks become quotes in both parts. */
const quoted = (reason: string) => reason.replaceAll('`', "'");

/**
 * The message a partner posts in Slack: a readable part, then the machine's lines in a code block
 * at its end (Slack formats nothing inside code, so a key's colons and underscores survive). The
 * human copies the posts into the chat and `pnpm answers` reads the block.
 */
export function shareText(build: BlockBuild, label: string, items: readonly ShareItem[]) {
  const readable = items.map(
    (item) =>
      `*${item.number}. ${item.sentence}* (${item.language}): ${
        item.answer === 'yes' ? 'Yes' : `No. ${quoted(item.reason).replace(/\s+/g, ' ').trim()}`
      }`,
  );
  const entries = items.map((item) => ({ ...item, reason: quoted(item.reason) }));
  return [
    `*Credo walks: answers from ${label}*`,
    `Build: ${build.branch}, commit ${build.commit}${build.changed ? ' with changes' : ''}`,
    ...readable,
    '```',
    blockText(build, entries, label),
    '```',
  ].join('\n');
}
