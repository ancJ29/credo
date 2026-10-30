import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeWorkbook } from './importFile';

const written = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('write-excel-file/browser', () => ({
  default: (...args: unknown[]) => {
    written.calls.push(args);
    return { toBlob: () => Promise.resolve(new Blob(['x'])) };
  },
}));

beforeEach(() => {
  written.calls.length = 0;
});

describe('the template’s file', () => {
  it('writes every cell as Text, which write-excel-file’s own documentation names as the way to stop Excel reading a text as a number or a date, the first row bold and each column 28 wide', async () => {
    await writeWorkbook([
      {
        name: 'Staff',
        rows: [
          ['Phone', 'Started'],
          ['0909123456', '2026-10-01'],
        ],
      },
    ]);

    expect(written.calls).toEqual([
      [
        [
          {
            sheet: 'Staff',
            data: [
              [
                { value: 'Phone', type: String, format: '@', fontWeight: 'bold' },
                { value: 'Started', type: String, format: '@', fontWeight: 'bold' },
              ],
              [
                { value: '0909123456', type: String, format: '@' },
                { value: '2026-10-01', type: String, format: '@' },
              ],
            ],
            columns: [{ width: 28 }, { width: 28 }],
          },
        ],
      ],
    ]);
  });
});
