import { describe, expect, it } from 'vitest';
import { classifyProcesses, type Listed, parseProcessList } from './strays';

const ROOT = '/work/credo';
const SELF = 500;
const at = (pid: number, ppid: number, command: string): Listed => ({ pid, ppid, command });
const classified = (list: Listed[], cwdOf?: (pid: number) => string | undefined) => {
  const { strays, busy } = classifyProcesses(list, { root: ROOT, self: SELF, cwdOf });
  return { strays: strays.map((p) => p.pid), busy: busy.map((p) => p.pid) };
};

describe('which processes of credo’s are left over, and which are someone’s run', () => {
  it('reads ps’s listing, and an empty or garbled one is refused, never read as nothing running', () => {
    expect(
      parseProcessList('  12     1 /sbin/launchd\n 345   12 node --import tsx src/main.ts\n'),
    ).toEqual([at(12, 1, '/sbin/launchd'), at(345, 12, 'node --import tsx src/main.ts')]);
    expect(() => parseProcessList('')).toThrow(/no processes/);
    expect(() => parseProcessList('ps: Cannot get process list')).toThrow(
      /Cannot get process list/,
    );
  });

  it('a process of credo’s under parent 1 is a stray, one with a live parent is busy', () => {
    const list = [
      at(10, 1, `node ${ROOT}/wip-a/node_modules/vitest/vitest.mjs run`),
      at(11, 300, `node ${ROOT}/wip-b/node_modules/playwright/cli.js test`),
      at(12, 1, `${ROOT}/wip-a/walk/run.sh something-else`),
      at(13, 1, '/usr/bin/vim notes.md'),
    ];

    expect(classified(list)).toEqual({ strays: [10], busy: [11] });
  });

  it('a stack’s BFF started by a relative path is credo’s, under parent 1 a stray', () => {
    const list = [
      at(20, 1, '/x/node --import tsx src/main.ts'),
      at(21, 300, '/x/node --import tsx src/fake-main.ts'),
      at(22, 1, '/x/node --import other src/main.ts'),
      at(23, 1, '/x/node --import tsx src/main.ts'),
      at(24, 1, '/x/node --import tsx src/main.ts'),
    ];
    const cwds: Record<number, string> = {
      20: `${ROOT}/wip-a/bff`,
      21: `${ROOT}/wip-a/scripts`,
      23: '/work/other-repo/bff',
    };

    expect(classified(list, (pid) => cwds[pid])).toEqual({ strays: [20], busy: [21] });
  });

  it('a c-storage in a temp credo- folder under parent 1 is a stray', () => {
    const list = [
      at(30, 1, '/var/folders/ab/T/credo-stack-build-x1/c-storage -addr 127.0.0.1:5000'),
      at(31, 300, '/var/folders/ab/T/credo-stack-build-x2/c-storage -addr 127.0.0.1:5001'),
      at(32, 1, '/var/folders/ab/T/other-build/c-storage'),
    ];

    expect(classified(list)).toEqual({ strays: [30], busy: [31] });
  });

  it('another repo’s test or server is neither', () => {
    const list = [
      at(40, 1, 'node /work/other-repo/node_modules/vitest/vitest.mjs run'),
      at(41, 300, 'node /work/other-repo/node_modules/playwright/cli.js test'),
      at(42, 1, 'node /work/credo-notes/node_modules/vitest/vitest.mjs run'),
      // not runs: an editor, a tmux and a vim holding a credo file in their arguments
      at(43, 1, `/Applications/Code.app/Contents/MacOS/Electron ${ROOT}/orch/ui/src/App.tsx`),
      at(44, 1, `tmux new -s w -c ${ROOT}/wip-b pnpm vitest --watch`),
      at(45, 300, `vim ${ROOT}/wip-a/ui/vite.config.ts`),
      at(46, 1, 'node --import tsx src/main.ts'),
    ];

    expect(classified(list)).toEqual({ strays: [], busy: [] });
  });

  it('the script itself, what started it and what it started are never a stray or busy', () => {
    const list = [
      at(SELF, 400, `bash ${ROOT}/wip-a/walk/run.sh operator`),
      at(400, 1, `node ${ROOT}/wip-a/node_modules/vitest/vitest.mjs run`),
      at(501, SELF, `node ${ROOT}/wip-a/node_modules/vitest/vitest.mjs run`),
      at(502, 501, `node ${ROOT}/wip-a/node_modules/playwright/cli.js test`),
    ];

    expect(classified(list)).toEqual({ strays: [], busy: [] });
  });
});
