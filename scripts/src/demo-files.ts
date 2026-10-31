import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listFile } from '@credo/ui/import-demo';
import { demoFilesOf } from './demo/lists';
import { CLIENTS } from './demo/mapping';

/**
 * `pnpm demo-files`: the Excel files the presenter chooses in the demo's step 2, one customers' file
 * and one products' file for each scenario's first client, in Vietnamese and in English, written
 * into `folder`. Each holds ten rows: eight new, one whose code the copy's list already has, and
 * one refused. The files are made from the same client and scenario as the seed's lists, so the
 * code "already there" is there in a fresh copy.
 *
 * @returns the names of the files written, in order
 */
export async function writeDemoFiles(folder: string, log: (line: string) => void) {
  await mkdir(folder, { recursive: true });
  const written: string[] = [];
  for (const [client, { scenario }] of Object.entries(CLIENTS)) {
    for (const language of ['vi', 'en'] as const) {
      const rows = demoFilesOf(client, scenario, language);
      for (const kind of ['customers', 'products'] as const) {
        const name = `${scenario}-${kind}-${language}.xlsx`;
        const file = await listFile(kind, language, rows[kind], name);
        await writeFile(join(folder, name), Buffer.from(await file.arrayBuffer()));
        log(`${join(folder, name)}`);
        written.push(name);
      }
    }
  }
  return written;
}
