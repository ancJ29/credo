export type Listed = { pid: number; ppid: number; command: string };

/** What `ps -axo pid=,ppid=,command=` prints. An empty listing, or a line that is not a process, is
 * refused with the line itself: a list that could not be read is no "nothing is running". */
export function parseProcessList(text: string): Listed[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error('the process list holds no processes');
  return lines.map((line) => {
    const found = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!found) throw new Error(`the process list is not readable: ${line.trim()}`);
    return { pid: Number(found[1]), ppid: Number(found[2]), command: found[3] };
  });
}

/** What a walk's run starts: a test runner, the browser's driver, the UI's build server, the BFF's
 * entries, the stack's c-storage. Of the files under the root, only these are credo's runs: an editor
 * holding a file there is not. */
const RUNS = /\b(playwright|vitest|vite|tsx|c-storage|fake-main|demo-main)\b|\/main\.ts\b/;
/** The BFF a stack starts runs a path relative to its folder, so its command line names no root. */
const RELATIVE_ENTRY = /--import tsx src\/(main|fake-main|demo-main)\.ts\b/;

/** `cwdOf` reads a process's working folder (undefined when it cannot): the relative entry is credo's
 * only when it runs under the root, or another repo's server of the same shape would be stopped. */
const isCredos = (p: Listed, root: string, cwdOf: (pid: number) => string | undefined) =>
  // a node process: an editor or a tmux holding a credo file in its arguments is not a run
  (/^(\S*\/)?node\s/.test(p.command) && p.command.includes(`${root}/`) && RUNS.test(p.command)) ||
  (RELATIVE_ENTRY.test(p.command) && (cwdOf(p.pid) ?? '').startsWith(`${root}/`)) ||
  // c-storage, built by the stack into a temp folder of its own.
  /^\S*\/credo-[^/\s]*\/c-storage\b/.test(p.command);

/** A process of credo's whose parent is 1 was left by a run that was killed: a stray. One with a
 * live parent is someone's run, busy. The script itself, what started it and what it started are
 * neither. */
export function classifyProcesses(
  list: Listed[],
  {
    root,
    self,
    cwdOf = () => undefined,
  }: { root: string; self: number; cwdOf?: (pid: number) => string | undefined },
): { strays: Listed[]; busy: Listed[] } {
  const byPid = new Map(list.map((p) => [p.pid, p]));
  const inChain = (p: Listed, of: number) => {
    for (let at: Listed | undefined = p, steps = 0; at && steps < list.length; steps++) {
      if (at.pid === of) return true;
      at = byPid.get(at.ppid);
    }
    return false;
  };
  const ancestors = new Set<number>();
  for (let at = byPid.get(self); at && !ancestors.has(at.pid); at = byPid.get(at.ppid)) {
    ancestors.add(at.pid);
  }
  const credos = list.filter(
    (p) => !ancestors.has(p.pid) && !inChain(p, self) && isCredos(p, root, cwdOf),
  );
  return {
    strays: credos.filter((p) => p.ppid === 1),
    busy: credos.filter((p) => p.ppid !== 1),
  };
}
