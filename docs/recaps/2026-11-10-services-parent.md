# The two Go services under one parent, recap, 2026-11-10

Piece 106. Written after the piece reached `main` (`b009e0a0`), not before its squash.

## What happened

On reading the repository's root tree on 2026-11-10 the human saw `c-storage/` and `audit-backbone/` standing among the TypeScript packages as if the same kind of thing. They are not: each is a deployable service with its own language runtime and its own gate, where the packages beside them form a family named by `pnpm-workspace.yaml`. Both now sit under `services/`, the category the piece fixed in one sentence: everything in `services/` is a deployable service with its own runtime and gate.

One commit does the whole move: 168 files, 116 of them renames and 52 edited, read from `git show -M --name-status`. Every reference was rewritten *before* the `git mv`, so the first check after the move already read the new tree: the workflow's path filters, working-directory and cache paths, the `ops/` scripts and their guards, knip, the lint and format ignore lists, the gate table, documents and links. The seventeen lines of `.github/workflows/ci.yml` that named the old location each changed, 17 insertions and 17 deletions.

## What did not change

- **No Go file changed.** The module paths do not contain the directory, so no import moved: every `.go` file in the commit is a pure rename with zero lines edited.
- **Nothing on the running machine.** `/etc/c-storage`, `/var/lib/c-storage` and the unit name are runtime paths on the box, not repository paths, and stay.

## What the piece found, without causing

`audit-backbone` is in no CI job at all: no path filter, no gate. True before the move, true after; `grep` over `.github/workflows/` finds no mention. It belongs with the work that makes something call the service, so it was not added here.

## What remains the human's

- **The act run** that proves the moved workflow paths, in the next-actions note: working-directory, cache, `go.mod` and shellcheck-glob paths. `act` cannot evaluate the `paths:` filters at all, so those two are proved only by a real push that touches `services/c-storage/`.
- Nothing proves the filters until then; the piece named that rather than assuming it.

No `docs/products.md` row: the move changes where directories sit, with nothing a user or partner can open.

## Evidence

- Root gate green at exit 0 (`logs/2026-11-10-121009-gate-all.log`), which notes that it does not cover c-storage's own `make check`; the Go gates' green rests on the piece's report and the commit message, which this recap did not re-run.
- The piece's note of 250 rewritten references in 54 files was not re-counted, so no figure from it is quoted.
