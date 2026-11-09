# The audit backbone moves in, recap, 2026-11-09

## What happened

A Go service from an older repository of ours now lives in `audit-backbone/`, checked the way `c-storage` is. **This page is the only place that says what was changed on the way and what was left behind**, so a later reader can tell which sentences in the package are original and which were rewritten here. **Nothing in this repository calls it**; how it integrates is the human's next decision and is not made.

| What | Count or fact |
| --- | --- |
| The service | 22 Go files, 3,336 lines, nine internal packages and `cmd/server`, a `Makefile`, Bruno requests, four scripts, `docs/` |
| Module path | rewritten to follow `c-storage/go.mod`'s form, every import with it |
| Checked by | `make check` from inside the package (format, vet, race tests at 100 % outside `cmd/server`, the box's cross-compile). No `check` script, because there is no `package.json` |

## Changed on the way

- **Fourteen references to the old repository's paths were rewritten.** Three were mapped to real files here (the root `CLAUDE.md`, `documentation.md`, `qa.md`). One was dropped (a line saying the old root's ignore list named the package). **Ten were reworded to say there is nothing here yet**: a ship step, a verify step, backups, per-client environment notes. **So a "none yet" in that package is deliberate, not an oversight**, and nothing was mapped to a look-alike.
- **Four sentences in its guideline described the old world** and were replaced with what is true here, measured, not softened: a backup arrangement, a rule whose reason named a store with no counterpart here, a status header no package here uses, and how a key reaches a deployed environment.
- **The guideline was rewritten into the six-section shape** with five rules, `AB1` to `AB5` (two `check`, three `reader`). **A sixth rule, about its tests, was dropped: the count behind it was too thin to support one.**
- **Two lines in the root's ignore lists** (`.prettierignore`, `knip.json`), so the root formatter and unused-code step do not claim files the Go gate owns.

## Deliberately not brought across

The build output with its compiled binary, a local database and a server log, three `.claude` folders, and one request environment for a deployed system belonging to an outside party. That environment was kept out of the branch's history, not deleted afterwards; the package carries only its `local` environment, and its `.gitignore` keeps any other out. Every request stays.

## What it found

- **Open item 200 is the most reusable finding**: a package outside the pnpm gate must be added to the root's two ignore lists, and no convention says so. Its own gate was green while the root formatter reported 17 of its files.
- **The destination's gate caught what the package's did not.** The repository's citation check, merged that afternoon, reddened on a stale pointer in the moved guideline, written for the old repository's layout. The package's own `make check` was green throughout.

## What remains the human's

How the package integrates, and whether CI gains a job for it (the same workflow holds a deploy). No `docs/products.md` row, as in the day's other internal recaps (item 201).

## Evidence

- Move commits `391e368a` (copied unchanged), `45bec421` (module path), `6b4c87b6` (the references), `22dbbc9a` (ignore lists), `6674d6c4` (six-section guideline).
- Whole gate on the merged tree: `2026-11-09-152317-gate-all.log`, `typecheck 0 eslint 0 prettier 0 test 0+1skipped knip 0`, `== green`, `== exit 0`. The package's own check: `20261109-1523-audit-backbone-move.log`, `== make check exit 0`.
