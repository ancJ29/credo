// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORDS } from './words';

const read = (name: string) => readFileSync(join(import.meta.dirname, name), 'utf8');

describe('the walks page’s words', () => {
  it('holds the same keys in Tiếng Việt and English, none empty', () => {
    expect(Object.keys(WORDS.en).sort()).toEqual(Object.keys(WORDS.vi).sort());
    for (const language of ['vi', 'en'] as const) {
      for (const [key, value] of Object.entries(WORDS[language])) {
        expect(value, `${language}: ${key}`).not.toBe('');
      }
    }
  });

  it('holds every key the page asks for, and the same {names} in both languages', () => {
    const asked = [
      ...read('page.ts').matchAll(/\bt\('(\w+)'/g),
      ...read('index.html').matchAll(/data-t(?:-title|-aria-label)?="(\w+)"/g),
    ].map((one) => one[1]);
    for (const key of new Set(asked)) expect(WORDS.vi[key], key).toBeDefined();

    // the keys built from a kind, a language or a device
    for (const kind of ['new', 'changed', 'yes', 'no'])
      expect(WORDS.vi[`st_${kind}`]).toBeDefined();
    for (const kind of ['yes', 'no']) expect(WORDS.vi[`ans_${kind}`]).toBeDefined();
    for (const one of ['vi', 'en']) expect(WORDS.vi[`lang_${one}`]).toBeDefined();
    for (const device of ['pc', 'tablet', 'phone']) expect(WORDS.vi[`dev_${device}`]).toBeDefined();
    for (const kind of ['new', 'changed', 'said'])
      expect(WORDS.vi[`stTitle_${kind}`]).toBeDefined();

    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((one) => one[1]).sort();
    for (const [key, value] of Object.entries(WORDS.vi)) {
      expect(names(WORDS.en[key]), key).toEqual(names(value));
    }
  });
});
