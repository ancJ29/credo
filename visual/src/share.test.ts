// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseBlock } from './block';
import { normalizeLabel, shareText } from './share';

const build = { branch: 'main', commit: '1a2b3c4d5', changed: false };
const FP = '0123456789ab';
const item = (over: object) => ({
  key: 'admin-setup:1-sign-in:vi',
  answer: 'yes' as const,
  fingerprint: FP,
  reason: '',
  number: 1,
  sentence: 'Sign in',
  language: 'Tiếng Việt',
  ...over,
});

describe('the Share message', () => {
  it('The message reads for Slack, then holds the machine’s lines in a code block at its end', () => {
    const text = shareText(build, 'p1', [
      item({}),
      item({
        key: 'admin-setup:2-sign-in-refused:en',
        answer: 'no',
        reason: 'The message does not say what to do',
        number: 2,
        sentence: 'Sign-in refused',
        language: 'English',
      }),
    ]);

    expect(text).toBe(
      [
        '*Credo walks: answers from p1*',
        'Build: main, commit 1a2b3c4d5',
        '*1. Sign in* (Tiếng Việt): Yes',
        '*2. Sign-in refused* (English): No. The message does not say what to do',
        '```',
        'Credo walks answers',
        'Build: branch main, commit 1a2b3c4d5',
        'By: p1',
        `admin-setup:1-sign-in:vi | yes | ${FP}`,
        `admin-setup:2-sign-in-refused:en | no | ${FP} | The message does not say what to do`,
        '```',
      ].join('\n'),
    );
  });

  it('says so when the tree differed from the commit', () => {
    const text = shareText({ ...build, changed: true }, 'p1', [item({})]);

    expect(text).toContain('Build: main, commit 1a2b3c4d5 with changes');
  });

  it('A reason’s backticks become a quote in both parts, so none closes the block; its other marks come back unchanged', () => {
    const reason = 'a `b` ``` & <c> *d* _e_ ~f~ :smile:';
    const text = shareText(build, 'p1', [item({ answer: 'no', reason })]);

    expect(text.match(/```/g)).toHaveLength(2);
    expect(text).toContain("No. a 'b' ''' & <c> *d* _e_ ~f~ :smile:");
    const { entries, refused } = parseBlock(text, { partners: true });
    expect(refused).toEqual([]);
    expect(entries[0].reason).toBe("a 'b' ''' & <c> *d* _e_ ~f~ :smile:");
    expect(entries[0].by).toBe('p1');
  });

  it('A label is lowercased and trimmed', () => {
    expect(normalizeLabel('  P1 ')).toBe('p1');
  });
});
