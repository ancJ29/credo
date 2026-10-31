import { appendFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Box, comparePictures, decodePng } from './pixels';
import { classifyProcesses, parseProcessList } from './strays';

export type Io = { stdin: () => Promise<string>; out: (line: string) => void };

const USAGE =
  'usage: compare <label> <left> <right> [--bases [--allow-retired]] [--moved <screen>,…|all] [--raw <file>] | strays <root> <pid>';

/** A picture's screen: its name without the language and the width. */
const screenOf = (name: string) => name.replace(/-(en|vi)-\d+\.png$/, '');
const boxOf = ({ x0, y0, x1, y1 }: Box) => `${x0},${y0} to ${x1},${y1}`;
const pngs = async (dir: string) =>
  (await readdir(dir)).filter((name) => name.endsWith('.png')).sort();

type Options = { bases: boolean; retired: boolean; moved: Set<string> | 'all'; raw?: string };

function parseOptions(rest: string[], out: Io['out']): Options | undefined {
  const options: Options = { bases: false, retired: false, moved: new Set() };
  for (let i = 0; i < rest.length; i++) {
    const option = rest[i];
    if (option === '--bases') {
      options.bases = true;
    } else if (option === '--allow-retired') {
      options.retired = true;
    } else if (option === '--moved' || option === '--raw') {
      const value = rest[++i];
      if (value === undefined) {
        out(option === '--moved' ? '--moved needs a list or all' : '--raw needs a file');
        return undefined;
      }
      if (option === '--raw') options.raw = value;
      else options.moved = value === 'all' ? 'all' : new Set(value.split(','));
    } else {
      out(`unknown option ${option}`);
      return undefined;
    }
  }
  return options;
}

/** Compares the pictures of two folders by name, pixel by pixel. Outside `--bases` any difference is
 * red. Against the bases (the right side), a picture the bases lack is new and listed, a base no
 * picture matches is red, and a moved picture is red unless its screen is named by `--moved`. */
async function compare(
  label: string,
  left: string,
  right: string,
  options: Options,
  out: Io['out'],
) {
  const [leftNames, rightNames] = [await pngs(left), await pngs(right)];
  const lines: string[] = [];
  const reds: string[] = [];
  const raw: string[] = [];
  let movedCount = 0;
  const unmoved = new Set<string>();
  const allowed = (name: string) =>
    options.bases && (options.moved === 'all' || options.moved.has(screenOf(name)));
  const names = leftNames.filter((name) => rightNames.includes(name));
  for (const name of names) {
    try {
      const difference = comparePictures(
        decodePng(await readFile(join(left, name))),
        decodePng(await readFile(join(right, name))),
      );
      if (difference.kind === 'equal') {
        unmoved.add(screenOf(name));
        continue;
      }
      movedCount++;
      const text =
        difference.kind === 'size'
          ? `size ${difference.left} against ${difference.right}`
          : `${difference.pixels} px, shade ${difference.shade}, box ${boxOf(difference.box)}`;
      raw.push(`${label} ${name}: ${text}\n`);
      if (allowed(name)) {
        lines.push(`  moved ${name}: ${text} (named)`);
      } else {
        lines.push(`  moved ${name}: ${text}`);
        reds.push(`${name} moved`);
        if (options.bases) lines.push(`  red ${name} moved and its screen is not named in --moved`);
      }
    } catch (error) {
      lines.push(`  unreadable ${name}: ${(error as Error).message}`);
      reds.push(`${name} unreadable`);
    }
  }
  const newOnes = leftNames.filter((name) => !rightNames.includes(name));
  const lacking = rightNames.filter((name) => !leftNames.includes(name));
  for (const name of newOnes) {
    lines.push(options.bases ? `  new ${name}` : `  only in the left: ${name}`);
    if (!options.bases) reds.push(`${name} only in the left`);
  }
  for (const name of lacking) {
    if (options.bases && options.retired) {
      lines.push(`  retired ${name}`);
      continue;
    }
    lines.push(options.bases ? `  base with no picture: ${name}` : `  only in the right: ${name}`);
    reds.push(`${name} has no counterpart`);
  }
  if (options.moved !== 'all') {
    for (const screen of [...options.moved].sort()) {
      if (unmoved.has(screen)) lines.push(`  named, not moved: ${screen}`);
    }
  }
  if (leftNames.length === 0 && rightNames.length === 0) {
    lines.push('  no pictures to compare');
    reds.push('no pictures');
  }
  const unreadable = lines.filter((line) => line.startsWith('  unreadable')).length;
  out(
    `compare ${label}: ${names.length} pictures, ${movedCount} moved, ${newOnes.length} new, ${lacking.length} without a counterpart, ${unreadable} unreadable`,
  );
  lines.forEach((line) => out(line));
  out(
    reds.length === 0
      ? 'result: green'
      : `result: red: ${reds.length === movedCount && movedCount > 0 ? `${movedCount} moved` : reds.join('; ')}`,
  );
  if (options.raw && raw.length > 0) await appendFile(options.raw, raw.join(''));
  return reds.length === 0 ? 0 : 1;
}

/** The commands `walk/run.sh` calls: `compare`, the raw count of two folders, and `strays`, the
 * leftover processes in a `ps` listing on stdin. Exit 0 green, 1 red, 2 a call or a listing it
 * cannot read. */
export async function walksCommand(argv: string[], io: Io): Promise<number> {
  const [command, ...rest] = argv;
  if (command === 'compare' && rest.length >= 3) {
    const options = parseOptions(rest.slice(3), io.out);
    return options ? compare(rest[0], rest[1], rest[2], options, io.out) : 2;
  }
  if (command === 'strays' && rest.length === 2) {
    try {
      const { strays, busy } = classifyProcesses(parseProcessList(await io.stdin()), {
        root: rest[0],
        self: Number(rest[1]),
      });
      strays.forEach((p) => io.out(`stray ${p.pid} ${p.command}`));
      busy.forEach((p) => io.out(`busy ${p.pid} ${p.command}`));
      return 0;
    } catch (error) {
      io.out(`unreadable: ${(error as Error).message}`);
      return 2;
    }
  }
  io.out(USAGE);
  return 2;
}
