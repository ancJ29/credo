// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BLOCK_TITLE, blockText, parseBlock } from './block';

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
      { line: 3, ...yes },
      { line: 4, ...barred },
    ]);
  });

  it('skips blank lines, the title, the build line and the chat’s code fences', () => {
    const text = ['```', BLOCK_TITLE, '', 'Build: x', `  w:1-a:vi | yes | ${FP}  `, '```'].join(
      '\r\n',
    );

    expect(parseBlock(text).entries.map((entry) => entry.line)).toEqual([5]);
    expect(parseBlock(text).refused).toEqual([]);
  });

  it('refuses a line that is no answer, by its number', () => {
    const text = [BLOCK_TITLE, `w:1-a:vi | maybe | ${FP}`, 'w:1-a:vi | yes | short', 'hello'].join(
      '\n',
    );

    const { entries, refused } = parseBlock(text);

    expect(entries).toEqual([]);
    expect(refused.map((one) => one.line)).toEqual([2, 3, 4]);
    expect(refused[2].why).toContain('“hello” is not an answer line');
  });

  it('is no block without its title', () => {
    expect(() => parseBlock(`w:1-a:vi | yes | ${FP}`)).toThrow('not an answers block');
  });
});
