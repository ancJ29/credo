import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { TestModule } from 'vitest/node';

/** One test file's time in a local run, under the hash of the file's content: an edited file has a new hash and no entry. */
export type TimeTable = Record<string, { file: string; ms: number }>;

const SRC = import.meta.dirname;
export const TABLE_PATH = join(SRC, 'shard-times.json');

/** The first 16 hex digits of the content's SHA-256: the key a file's time is kept under. */
export function hashOf(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}

/** The table at `path`; an absent or unreadable one is an empty table, so every file falls back to its size. */
export function readTable(path: string): TimeTable {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TimeTable;
  } catch {
    return {};
  }
}

/** Every test file under `dir`, as vitest's own `include` of `src/**\/*.test.ts` finds them. */
export function testFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFilesUnder(path);
    return entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/**
 * What each file weighs in the split: its time from the table when the table holds its hash, else its size in bytes
 * times the table's milliseconds per byte over the files it does hold (1 when it holds none, so the weights are then
 * plain sizes and the split is the by-size one). A file that changed or is new thus lands by its size until a local
 * run (`pnpm --filter @credo/scripts times`) writes its time.
 */
export function weigh(
  paths: readonly string[],
  table: TimeTable,
): { path: string; size: number }[] {
  const files = paths.map((path) => ({
    path,
    size: statSync(path).size,
    hit: table[hashOf(path)],
  }));
  const known = files.reduce(
    (sum, file) => (file.hit ? { ms: sum.ms + file.hit.ms, bytes: sum.bytes + file.size } : sum),
    { ms: 0, bytes: 0 },
  );
  const perByte = known.bytes > 0 ? known.ms / known.bytes : 1;
  return files.map((file) => ({
    path: file.path,
    size: file.hit ? file.hit.ms : file.size * perByte,
  }));
}

/**
 * The table after a run: the old entries whose hash is still some test file's, with the run's own times over them.
 * `ran` holds the files the run reached, so a run of one file keeps the rest and drops what no file has any more.
 */
export function mergeTimes(
  old: TimeTable,
  current: readonly string[],
  ran: readonly { path: string; ms: number }[],
  base = SRC,
): TimeTable {
  const live = new Set(current.map(hashOf));
  const kept = Object.fromEntries(Object.entries(old).filter(([hash]) => live.has(hash)));
  const fresh = Object.fromEntries(
    ran.map(({ path, ms }) => [hashOf(path), { file: relative(base, path), ms: Math.round(ms) }]),
  );
  const merged = { ...kept, ...fresh };
  return Object.fromEntries(
    Object.entries(merged).sort(([, a], [, b]) => (a.file < b.file ? -1 : 1)),
  );
}

/** Writes the table after a green run (`SCRIPTS_WRITE_TIMES` in vitest.config.ts, `pnpm times`); a red run's times say nothing. */
export class TimesReporter {
  constructor(
    private readonly tablePath = TABLE_PATH,
    private readonly dir = SRC,
  ) {}

  onTestRunEnd(modules: readonly TestModule[], _errors: unknown, reason: string): void {
    if (reason !== 'passed') return;
    const ran = modules.map((module) => ({
      path: module.moduleId,
      ms: module.diagnostic().duration,
    }));
    const table = mergeTimes(readTable(this.tablePath), testFilesUnder(this.dir), ran, this.dir);
    writeFileSync(this.tablePath, `${JSON.stringify(table, null, 2)}\n`);
  }
}
