// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BLOCK_TITLE, blockText, LABEL, parseBlock } from './block';

const build = { branch: 'a-piece', commit: 'abc123def', changed: false };
const FP = '0123456789ab';
const yes = { key: 'w:1-a:vi', answer: 'yes' as const, fingerprint: FP, reason: '' };
const no = { key: 'w:1-a:en', answer: 'no' as const, fingerprint: FP, reason: 'too small' };

describe('the block for the chat', () => {
  it('The block names the build, and a line an answer: screen, language, yes or no, the reason of a no, and the fingerprint', () => {
    expect(blockText(build, [yes, no])).toBe(
      [
        'Credo walks answers',
        'Build: branch a-piece, commit abc123def',
        `w:1-a:vi | yes | ${FP}`,
        `w:1-a:en | no | ${FP} | too small`,
      ].join('\n'),
    );
  });

  it('says so when the tree differed from the commit, and keeps a reason to one line', () => {
    const text = blockText({ ...build, changed: true }, [{ ...no, reason: ' two\n lines  here ' }]);

    expect(text).toContain('Build: branch a-piece, commit abc123def with changes');
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toContain(`| no | ${FP} | two lines here`);
  });

  it('reads back what it wrote, a reason with a bar in it whole', () => {
    const barred = { ...no, reason: 'a | b' };

    const { entries, refused } = parseBlock(blockText(build, [yes, barred]));

    expect(refused).toEqual([]);
    expect(entries).toEqual([
      { line: 3, by: '', ...yes },
      { line: 4, by: '', ...barred },
    ]);
  });

  it('skips blank lines, the title, the build line and the chat’s code fences', () => {
    const text = ['```', BLOCK_TITLE, '', 'Build: x', `  w:1-a:vi | yes | ${FP}  `, '```'].join(
      '\r\n',
    );

    expect(parseBlock(text).entries.map((entry) => entry.line)).toEqual([5]);
    expect(parseBlock(text).refused).toEqual([]);
  });

  it('A line that starts like an answer is taken or refused by its number', () => {
    const text = [BLOCK_TITLE, `w:1-a:vi | maybe | ${FP}`, 'w:1-a:vi | yes | short'].join('\n');

    const { entries, refused } = parseBlock(text);

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([2, 3]);
    expect(refused[1].why).toContain('is not an answer line');
  });

  it('skips every other line, so Slack’s names, times and readable lines never stop a paste', () => {
    const text = [
      'Sam  10:42',
      '*Credo walks: answers from p1*',
      'Build: main, commit abc123def',
      '*1. Sign in* (Tiếng Việt): Yes',
      '```',
      BLOCK_TITLE,
      'Build: branch main, commit abc123def',
      'By: p1',
      `w:1-a:vi | yes | ${FP}`,
      '```',
      'hello',
    ].join('\r\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(refused).toEqual([]);
    expect(entries).toEqual([{ line: 9, by: 'p1', ...yes }]);
  });

  it('A line that starts like an answer before any title is refused, never dropped', () => {
    const text = [`w:1-a:vi | yes | ${FP}`, BLOCK_TITLE, `w:1-a:en | yes | ${FP}`].join('\n');

    const { entries, refused } = parseBlock(text);

    expect(entries.map((one) => one.line)).toEqual([3]);
    expect(refused).toHaveLength(1);
    expect(refused[0].line).toBe(1);
    expect(refused[0].why).toContain('before any');
    expect(() => parseBlock(`w:1-a:vi | yes | ${FP}`)).not.toThrow();
  });

  it('is no block without its title and without a line that starts like an answer', () => {
    expect(() => parseBlock('hello')).toThrow('not an answers block');
  });

  it('One paste holds several blocks, each answer under the By: line of its own block', () => {
    const text = [
      BLOCK_TITLE,
      'By: p1',
      `w:1-a:vi | yes | ${FP}`,
      'Alice  10:43',
      BLOCK_TITLE,
      'By: p2',
      `w:1-a:vi | no | ${FP} | too small`,
      BLOCK_TITLE,
      `w:1-a:en | yes | ${FP}`,
    ].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(entries.map((one) => [one.line, one.by])).toEqual([
      [3, 'p1'],
      [7, 'p2'],
    ]);
    expect(refused.map((one) => one.line)).toEqual([9]);
  });

  it('A label is 1 to 20 lowercase letters, digits or hyphens; any other is refused by line, and so are its answers', () => {
    for (const good of ['p1', 'a', 'x-9', 'a'.repeat(20)]) expect(LABEL.test(good)).toBe(true);
    for (const bad of ['', 'P1', 'p_1', 'a'.repeat(21), 'p 1', 'é', 'p@1', 'p:1']) {
      expect(LABEL.test(bad)).toBe(false);
    }
    const text = [BLOCK_TITLE, 'By: Sam', `w:1-a:vi | yes | ${FP}`].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([2, 3]);
    expect(refused[0].why).toContain('is not a label');
  });

  it('Writes the By: line after the build, for a partner’s block, and none for the human’s', () => {
    const text = blockText(build, [yes], 'p1');

    expect(text.split('\n').slice(0, 3)).toEqual([
      'Credo walks answers',
      'Build: branch a-piece, commit abc123def',
      'By: p1',
    ]);
    expect(blockText(build, [yes])).not.toContain('By:');
    expect(parseBlock(text, { partners: true }).entries).toEqual([{ line: 4, by: 'p1', ...yes }]);
  });

  it('In the human’s own paste, a block with a By: line refuses the whole paste: one refusal, no answer taken, even the block with no By: line', () => {
    const text = [
      BLOCK_TITLE,
      'By: p1',
      `w:1-a:vi | no | ${FP} | partner`,
      BLOCK_TITLE,
      `w:1-a:en | yes | ${FP}`,
    ].join('\n');

    const { entries, refused } = parseBlock(text);

    expect(entries).toEqual([]);
    expect(refused).toHaveLength(1);
    expect(refused[0].line).toBe(2);
    expect(refused[0].why).toContain('--partners');
  });

  it('Any line that looks like a By: mark, however the chat dressed it and wherever it stands, makes the paste a partner’s', () => {
    const marks = [
      'by: p1',
      'BY: p1',
      'By : p1',
      '*By:* p1',
      '> > By: p1',
      '\u200bBy: p1',
      '\ufeff> By: p1',
      '\u2009By: p1',
    ];
    for (const mark of marks) {
      const after = parseBlock([BLOCK_TITLE, mark, `w:1-a:vi | yes | ${FP}`].join('\n'));
      const before = parseBlock([mark, BLOCK_TITLE, `w:1-a:vi | yes | ${FP}`].join('\n'));

      expect([mark, after.entries, after.refused.map((one) => one.line)]).toEqual([mark, [], [2]]);
      expect([mark, before.entries, before.refused.map((one) => one.line)]).toEqual([
        mark,
        [],
        [1],
      ]);
    }
  });

  it('Nothing the human’s own block prints looks like a partner’s mark: a branch named by-hand, a key that starts with by, a reason that says by:', () => {
    const own = blockText({ ...build, branch: 'by-hand' }, [
      { ...yes, key: 'by:1-a:vi' },
      { ...no, reason: 'by: hand' },
    ]);

    const { entries, refused } = parseBlock(own);

    expect(refused).toEqual([]);
    expect(entries.map((one) => one.key)).toEqual(['by:1-a:vi', 'w:1-a:en']);
  });

  it('A partner’s Share post that kept its readable header and lost its By: line makes the plain paste a partner’s', () => {
    const text = [
      '*Credo walks: answers from p1*',
      'Build: main, commit abc123def',
      '*1. Sign in* (Tiếng Việt): Yes',
      '```',
      BLOCK_TITLE,
      `w:1-a:vi | yes | ${FP}`,
      '```',
    ].join('\n');

    const { entries, refused } = parseBlock(text);

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([1]);
    expect(refused[0].why).toContain('--partners');
  });

  it('A reason with a code fence in it is written with quotes, so the human’s own block reads back whole', () => {
    const fenced = { ...no, reason: 'use ```code```' };
    const text = blockText(build, [fenced, { ...yes, key: 'w:2-b:vi' }]);

    expect(text).not.toContain('`');
    const { entries, refused } = parseBlock(text);

    expect(refused).toEqual([]);
    expect(entries.map((one) => [one.key, one.reason])).toEqual([
      ['w:1-a:en', "use '''code'''"],
      ['w:2-b:vi', ''],
    ]);
  });

  it('A second By: line written another way, by: p2 after By: p1, spoils the block as well', () => {
    for (const second of ['by: p2', 'BY: p2', '*By:* p2', 'By : p2']) {
      const text = [BLOCK_TITLE, 'By: p1', second, `w:1-a:vi | yes | ${FP}`].join('\n');

      const { entries, refused } = parseBlock(text, { partners: true });

      expect([second, entries]).toEqual([second, []]);
      expect(refused.map((one) => one.line)).toEqual([3, 4]);
    }
  });

  it('A first By: line written another way, by: p1 or By : p1, is refused with the answers of its block, and the reason says so', () => {
    for (const first of ['by: p1', 'By : p1']) {
      const text = [BLOCK_TITLE, first, `w:1-a:vi | yes | ${FP}`].join('\n');

      const { entries, refused } = parseBlock(text, { partners: true });

      expect([first, entries]).toEqual([first, []]);
      expect(refused.map((one) => one.line)).toEqual([2, 3]);
      expect(refused[0].why).toContain('another way');
      expect(refused[1].why).toContain('is written another way');
    }
  });

  it('With --partners, a block with no By: line is refused, every answer of it, so a human’s block pasted among partners’ never reads as theirs', () => {
    const text = [
      BLOCK_TITLE,
      'By: p1',
      `w:1-a:vi | no | ${FP} | partner`,
      'Sam  10:44',
      BLOCK_TITLE,
      'Build: branch main, commit abc123def',
      `w:1-a:vi | yes | ${FP}`,
      `w:1-a:en | yes | ${FP}`,
    ].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(entries.map((one) => [one.line, one.by])).toEqual([[3, 'p1']]);
    expect(refused.map((one) => one.line)).toEqual([7, 8]);
    expect(refused[0].why).toContain('no By: line');
  });

  it('A By: line that follows an answer line of its block is refused, and so is every answer of the block, before it or after', () => {
    const text = [BLOCK_TITLE, `w:1-a:vi | yes | ${FP}`, 'By: p1', `w:1-a:en | yes | ${FP}`].join(
      '\n',
    );

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([2, 3, 4]);
    expect(refused[1].why).toContain('after an answer line');
  });

  it('A By: line before any title is no block’s: with --partners the answer under the next title has no By: and is refused; without it the paste is refused whole', () => {
    const text = ['By: p1', BLOCK_TITLE, `w:1-a:vi | yes | ${FP}`].join('\n');

    expect(parseBlock(text, { partners: true }).refused.map((one) => one.line)).toEqual([3]);
    expect(parseBlock(text).entries).toEqual([]);
    expect(parseBlock(text).refused.map((one) => one.line)).toEqual([1]);
  });

  it('A second By: line spoils the block, whether it names the same label, another, or the first was no label; every answer of the block is refused', () => {
    for (const [first, second, lines] of [
      ['By: p1', 'By: p2', [3, 4]],
      ['By: p1', 'By: p1', [3, 4]],
      ['By: P1', 'By: p1', [2, 4]],
    ] as const) {
      const text = [BLOCK_TITLE, first, second, `w:1-a:vi | yes | ${FP}`].join('\n');

      const { entries, refused } = parseBlock(text, { partners: true });

      expect([first, second, entries]).toEqual([first, second, []]);
      expect(refused.map((one) => one.line)).toEqual(lines);
    }
  });

  it('A By: line after an answer spoils a block that had its label before, so its answers are refused whichever side of the late line they stand', () => {
    const text = [
      BLOCK_TITLE,
      'By: p1',
      `w:1-a:vi | yes | ${FP}`,
      'By: p2',
      `w:1-a:en | yes | ${FP}`,
    ].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([3, 4, 5]);
  });

  it('A By: line after an answer in the human’s own paste is a partner’s mark too: nothing is taken', () => {
    const text = [BLOCK_TITLE, `w:1-a:vi | yes | ${FP}`, 'By: p1', `w:1-a:en | yes | ${FP}`].join(
      '\n',
    );

    const { entries, refused } = parseBlock(text);

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([3]);
  });

  it('A code fence’s end ends the block, so a post whose title and By: line were lost never joins the one above', () => {
    const post = [BLOCK_TITLE, 'By: p1', `w:1-a:vi | yes | ${FP}`];
    const bare = [...post, '```', 'Sam  10:50', '```', `w:1-a:en | yes | ${FP}`].join('\n');
    const glued = [...post.slice(0, 2), `${post[2]}\`\`\``, `w:1-a:en | yes | ${FP}`].join('\n');

    for (const text of [bare, glued]) {
      const { entries, refused } = parseBlock(text, { partners: true });

      expect(entries.map((one) => [one.key, one.by])).toEqual([['w:1-a:vi', 'p1']]);
      expect(refused).toHaveLength(1);
      expect(refused[0].why).toContain('before any');
    }
  });

  it('Reads a line as the chat may mangle it: a no-break space, a quote mark, a fence glued to the line, an edit mark', () => {
    const text = [
      '```' + BLOCK_TITLE,
      '> By: p1',
      `w:1-a:vi\u00a0| yes | ${FP}`,
      `w:2-b:en | yes | ${FP} (edited)`,
      `> w:1-a:en | no | ${FP} | too small\`\`\``,
    ].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(refused).toEqual([]);
    expect(entries.map((one) => [one.key, one.answer, one.reason, one.by])).toEqual([
      ['w:1-a:vi', 'yes', '', 'p1'],
      ['w:2-b:en', 'yes', '', 'p1'],
      ['w:1-a:en', 'no', 'too small', 'p1'],
    ]);
  });

  it('Reads an answer line whose only signals are mangled: a narrow or thin space, a zero-width character, before or around the bar', () => {
    const text = [
      `${BLOCK_TITLE}\u200b`,
      '\ufeffBy: p1',
      `w:1-a:vi\u202f| yes\u2009| ${FP}`,
      `\u2007w:1-a:en | no | ${FP} | too\u2009small`,
      `w:2-b:en\u200b | yes | ${FP}`,
    ].join('\n');

    const { entries, refused } = parseBlock(text, { partners: true });

    expect(refused).toEqual([]);
    expect(entries.map((one) => [one.key, one.answer, one.reason])).toEqual([
      ['w:1-a:vi', 'yes', ''],
      ['w:1-a:en', 'no', 'too small'],
      ['w:2-b:en', 'yes', ''],
    ]);
    expect(() => parseBlock(`w:1-a:vi\u202f| yes | ${FP}`)).not.toThrow();
    expect(() => parseBlock(`\u200b${BLOCK_TITLE}\u2009`)).not.toThrow();
  });

  it('A key has three parts: a line with one colon before its bar is a chat line, not an answer', () => {
    const text = [BLOCK_TITLE, 'Re:plan | Acme', `w:1-a:vi | yes | ${FP}`].join('\n');

    expect(parseBlock(text).refused).toEqual([]);
  });

  it('A title with no answer line under it is refused, so a mangled block never vanishes; its By: line does not make it a block', () => {
    const { entries, refused } = parseBlock(
      [BLOCK_TITLE, 'By: p1', BLOCK_TITLE, `w:1-a:vi | yes | ${FP}`].join('\n'),
      {
        partners: true,
      },
    );

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([1, 4]);
    expect(refused[0].why).toContain('no answer line');
  });

  it('A chat name with a bar in it, such as Jane | Acme, is skipped, not refused', () => {
    const text = [BLOCK_TITLE, 'Jane | Acme  10:42', `w:1-a:vi | yes | ${FP}`].join('\n');

    expect(parseBlock(text).refused).toEqual([]);
  });
});
