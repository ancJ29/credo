# scripts
Stack: TypeScript on Node 26 through `tsx`, no build step · Gate: `pnpm check` from the root, which runs this package's typecheck, lint and tests at 100 % (`vitest.config.ts`'s `thresholds`) · Ship: nothing; a person or a shell script runs it from a worktree

The machine's own commands: bringing the product up on this Mac, and the steps a shell script hands to the product's own code. No product package imports it.

## What belongs here, and what does not

- **SC1. A step is here when it must run the product's own code.** `scripts/src/ridge.ts` calls the BFF's functions so every product rule holds; a step that is only `aws`, `ssh`, `gh` or `curl` is shell in `ops/`. A comparison or listing that shell does badly comes here to stand under this gate ([why](../walk/run.sh), the comment above `tool`).
- **SC2. A rule is called, never copied.** A name, bound or wire shape comes from `shared/`; what the product enforces is the BFF's function, imported.

## The directories of `scripts/src`

Each finishes "everything in here is a ___", by [`code.md`](../docs/conventions/code.md)'s C17; a
directory not on this list is not a directory, and a file with no sentence stays at the top.

- **`demo/`**: the demo company's data as a pure function of a scenario and a seed, or the applying of
  it (`scripts/src/demo/apply.ts`).
- **`running/`**: the machine around a child process: a port, a spawn, a wait, a leftover, a static
  server, two folders of pixels, which worktree holds `main` (`scripts/src/running/processes.ts`), with
  the test of each beside it. None of it knows credo's domain.
- **The top level**: a command the human runs, or what one command does (`scripts/src/cli.ts`,
  `scripts/src/stack.ts`, `scripts/src/ridge.ts`), and the `*-main.ts` entries, which
  `vitest.config.ts`, `knip.json`, `package.json`, `ops/lib.sh`, `walk/run.sh` and the stray detector's
  own pattern in `scripts/src/running/strays.ts` name by exact path, so they stay. A directory per command
  was rejected: `cli.ts` serves three commands.

## The file to copy

- **A command:** `scripts/src/fake.ts` with `scripts/src/fake-main.ts`, the pair [code](../docs/conventions/code.md) names.
- **A command with verbs:** `scripts/src/ridge.ts`'s `runRidge`, entered by `scripts/src/ridge-main.ts`.
- **Its test:** `scripts/src/ridge.test.ts`'s `run`, which calls the function and collects what it prints.

## This package's own rules

[code](../docs/conventions/code.md) governs the entry ("Entry points hold wiring and no logic", in "The patterns to copy") and the dispatch ("a command dispatches and fails", in "The winner, named"). What a command owes beyond them:

- **SC3. A command is `run<Name>` in `<name>.ts` and returns its exit status;** the entry sets `process.exitCode` from it, and `process.exit` is called nowhere outside a test. `walksCommand` is the one other spelling, and `scripts/src/cli.ts` is outside this rule: its three commands (`runStack`, `runFake`, `runDemo`) are a lifecycle, not a verb table; the next file takes `run`.
- **SC4. What a command reads from or writes to the process arrives as a parameter:** argv, env, `out`, `err`, stdin. `console.`, `process.argv` and `process.stdin` appear in no file but an entry.
- **SC5. Exit 0 done, 1 a failure, 2 refused before anything was acted on or a call that cannot be read,** stated once in the dispatch's doc comment (`runRidge`, `walksCommand`). It is the 2 every `ops/` script uses. `runRidge` exits 1 on an unknown verb: the one slip, and the next file exits 2.
- **SC6. A verb command keeps one `USAGE` constant naming every verb,** printed for a verb it does not know.
- **SC7. A new entry is reachable:** a `package.json` script `scripts.<name>` running `node --import tsx src/<name>-main.ts`, or, when only a shell script calls it, a line in `knip.json`'s `workspaces.scripts.entry`.
- **SC8. A new entry is excluded from coverage** in `vitest.config.ts`'s `coverage.exclude`, with an `elsewhere:` comment naming the test that runs its function in this process. All seven entries are.

## Non-obvious facts

- **`ridge-main.ts` is the one entry no `package.json` script runs;** shell reaches it through `ops/lib.sh`'s `ridge_cli`, and `walks-main.ts` through `walk/run.sh`'s `tool`.
- **`out` ends in a log; what only a person may see goes to `show`,** fd 3, handed on past its log by `ops/operator.sh` (`RidgeIo` in `scripts/src/ridge.ts`).
- **`ridge_cli` runs the command without the AWS role's credentials** (`ops/lib.sh`'s `clean`): its connection is `C_STORAGE_URL` and the keys in the environment alone.
- **Two entries hold a little logic and are uncounted:** `demo-files-main.ts` runs `git`, and `walks-main.ts`'s `cwdOf` catches. The next entry copies neither.
- **Tests build the product:** `vitest.config.ts` sets `NODE_ENV` to `production`, since a development React build passes the bundle warning.

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`bff/CLAUDE.md`](../bff/CLAUDE.md), TypeScript on Node with the same `*-main.ts` entry shape.
