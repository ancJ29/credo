import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readListFile } from '@credo/ui/import-demo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeDemoFiles } from './demo-files';
import { customersOf, productsOf } from './demo/lists';

let folder: string;
beforeAll(async () => {
  folder = join(await mkdtemp(join(tmpdir(), 'credo-demo-files-')), 'demo-files');
});
afterAll(() => rm(join(folder, '..'), { recursive: true, force: true }));

describe('pnpm demo-files', () => {
  it('row 11: writes a customers’ and a products’ file for each scenario in each language, and the import page reads each as 8 rows that hold, 1 whose code a fresh copy has, 1 refused', async () => {
    const lines: string[] = [];

    const written = await writeDemoFiles(folder, (line) => lines.push(line));

    expect(written.sort()).toEqual([
      'S1-customers-en.xlsx',
      'S1-customers-vi.xlsx',
      'S1-products-en.xlsx',
      'S1-products-vi.xlsx',
      'S2-customers-en.xlsx',
      'S2-customers-vi.xlsx',
      'S2-products-en.xlsx',
      'S2-products-vi.xlsx',
    ]);
    expect((await readdir(folder)).sort()).toEqual(written);
    expect(lines).toHaveLength(8);
    for (const name of written) {
      const [scenario, kind] = name.split('-') as ['S1' | 'S2', 'customers' | 'products'];
      const client = scenario === 'S1' ? 'A' : 'B';
      const taken = new Set(
        (kind === 'customers' ? customersOf(client, scenario) : productsOf(client, scenario)).map(
          (one) => one.code,
        ),
      );
      const bytes = await readFile(join(folder, name));

      expect(await readListFile(kind, new Blob([bytes]), taken), name).toEqual({
        holds: 8,
        taken: 1,
        refused: 1,
      });
    }
  });
});
