import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type RecordStore, recordTools } from './records';

describe('the one list read', () => {
  /** A store whose pages are `pages`, one a call, each answering `more` while one is left. */
  const paged = (pages: string[][]) => {
    const asked: (string | undefined)[] = [];
    const store: RecordStore = {
      getRecord: () => Promise.resolve(null),
      listRecords: (_prefix, after) => {
        asked.push(after);
        const page = pages[asked.length - 1] ?? [];
        return Promise.resolve({
          records: page.map((key) => ({ key, data: 1, tag: 't' })),
          more: asked.length < pages.length,
        });
      },
      putRecord: () => Promise.resolve('saved'),
      removeRecord: () => Promise.resolve('removed'),
    };
    return { asked, every: recordTools(store).every };
  };

  it('asks for each page after the last key read and answers every record in order', async () => {
    const { asked, every } = paged([['p.a', 'p.b'], ['p.c']]);
    expect((await every('p.', z.number(), 'thing')).map((one) => one.key)).toEqual([
      'p.a',
      'p.b',
      'p.c',
    ]);
    expect(asked).toEqual([undefined, 'p.b']);
  });

  it('is a fault, never a loop, when a page does not move past the last key read or is empty with more left', async () => {
    await expect(
      paged([['p.a', 'p.b'], ['p.b'], ['p.c']]).every('p.', z.number(), 'thing'),
    ).rejects.toThrow('the thing list is longer than c-storage returns');
    await expect(paged([['p.a'], [], ['p.c']]).every('p.', z.number(), 'thing')).rejects.toThrow(
      'the thing list is longer than c-storage returns',
    );
    await expect(paged([[], ['p.c']]).every('p.', z.number(), 'thing')).rejects.toThrow(
      'the thing list is longer than c-storage returns',
    );
  });
});
