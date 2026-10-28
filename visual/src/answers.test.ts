// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAnswers, readAnswers } from './answers';

const row = { answer: 'yes', on: '2026-10-29', reason: '', words: ['heading: Hello'] };
const text = (value: unknown) => JSON.stringify(value);

describe('the answers file', () => {
  it('reads the rows a screen is answered by', () => {
    const no = { ...row, answer: 'no', reason: 'too small' };

    expect(parseAnswers(text({ 'w:1-a:vi': row, 'w:1-a:en': no }))).toEqual({
      'w:1-a:vi': row,
      'w:1-a:en': no,
    });
    expect(parseAnswers('{}')).toEqual({});
  });

  it('An answers file that does not parse stops the build; it never reads as nothing answered', () => {
    expect(() => parseAnswers('{ "w:1-a:vi": ')).toThrow(/answers.json does not parse/);
    expect(() => parseAnswers('[]')).toThrow('must hold one object');
    expect(() => parseAnswers('null')).toThrow('must hold one object');
  });

  it('A row of no known form stops the build, naming it', () => {
    const bad = (answers: unknown, message: string) =>
      expect(() => parseAnswers(text(answers))).toThrow(message);

    bad({ 'w:1-a:fr': row }, '"w:1-a:fr" is not <walk>:<screen>:<vi|en>');
    bad({ 'w:1-a:vi': 'yes' }, '"w:1-a:vi" is not an object');
    bad({ 'w:1-a:vi': null }, '"w:1-a:vi" is not an object');
    bad({ 'w:1-a:vi': { ...row, extra: 1 } }, 'must hold exactly answer, on, reason, words');
    bad({ 'w:1-a:vi': { answer: 'yes' } }, 'must hold exactly');
    bad({ 'w:1-a:vi': { ...row, answer: 'maybe' } }, 'answer must be yes or no');
    bad({ 'w:1-a:vi': { ...row, on: '29/10/2026' } }, 'on must be a day, YYYY-MM-DD');
    bad({ 'w:1-a:vi': { ...row, on: '2026-13-45' } }, 'on must be a day, YYYY-MM-DD');
    bad({ 'w:1-a:vi': { ...row, on: 20261029 } }, 'on must be a day, YYYY-MM-DD');
    bad({ 'w:1-a:vi': { ...row, reason: 3 } }, 'reason must be text');
    bad({ 'w:1-a:vi': { ...row, answer: 'no' } }, 'a no needs its reason, and a yes has none');
    bad({ 'w:1-a:vi': { ...row, reason: 'why' } }, 'a no needs its reason, and a yes has none');
    bad({ 'w:1-a:vi': { ...row, words: 'x' } }, 'words must be a list of lines');
    bad({ 'w:1-a:vi': { ...row, words: [1] } }, 'words must be a list of lines');
  });

  it('reads the file at a path, and a missing one stops the build too', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'answers-'));
    writeFileSync(join(dir, 'answers.json'), text({ 'w:1-a:vi': row }));

    expect(Object.keys(await readAnswers(join(dir, 'answers.json')))).toEqual(['w:1-a:vi']);
    await expect(readAnswers(join(dir, 'missing.json'))).rejects.toThrow('ENOENT');
  });
});
