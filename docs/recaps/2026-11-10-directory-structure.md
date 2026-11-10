# Where a file lives in each package, recap, 2026-11-10

Piece 100. Written after the piece reached `main` (merge `b47a8fec`), not before its squash.

## What happened

The human, on 2026-11-09, of the packages' flat folders: "I think this is no problem for machine to read, but for human, totally not." The piece answered in four steps.

1. **The layout, drawn before any file moved.** A research page inventoried every package. The human judged the first proposal by showing a directory tree from an older repository of their own, and it was re-cut by kind (screens, parts, frame) rather than by audience. They answered yes after a fourth part settled the module-layer question.
2. **The rule** (`98826e3a`): `docs/conventions/code.md` gained C17, replacing the claim that every package is one flat folder. A directory earns its name only where "everything in here is a ___" finishes in a word the product uses.
3. **The moves**, one package each, every reference following the files:
   - `ui/src`: 106 of its 165 files moved into `frame/`, `pages/client/`, `pages/operator/`, `parts/` and `i18n/` (`a4eab659`, merged `a7fc1899`).
   - `bff/src`: 34 of 54 files into `routes/` (23), `records/` (5) and `calling/` (6); the other 20 stay, each pinned by an export, a config file or the app it tests (`8184f37c`).
   - `scripts/src`: ten files into `running/` (`b47a8fec`). `shared`, `visual` and `walk` say that flat is their answer, with the measurement.
4. **The guidelines**: each package's `CLAUDE.md` names its directory set in the change that moves it.

## What was rejected

- **An audience-first cut** (`client/`, `operator/`, `common/`): almost nothing both apps share is a screen, so `common/` would mean "not a screen". It also broke more citations than the kind cut.
- **A folder per feature under the screens**: the list and import screens each serve two kinds of record, so a per-feature path cannot be built (recorded in C17).
- **Barrels, and `config/`, `connector/`, `middleware/` in the back end**: refused on the one-home rule.

## What the piece found

- **A collision no reader would have seen.** The branch moved `CustomerPage.tsx` into `pages/client/` while `main` gained an architecture page citing the old path twice. Each was right about its own world. After the merge the gate's citation test read two `the file is not there` findings (`logs/2026-11-10-094041-gate-all.log`); `8be98d7c` re-pointed both. The commit message says only that, so the log is the evidence of the catch.
- **A move's price is citations, not imports.** Living documents cite these packages heavily, and `scripts/src/running/strays.ts` finds leftover processes by a pattern over entry paths, so moving an entry would blind it with no red anywhere. The six `*-main.ts` entries stayed.
- **Open items that cite files which do not exist.** Adding the open log to the citation check reds with findings no move caused, so it was left out; the audit is owed.

## What remains the human's

- The generated per-package tree, agreed on condition that the gate regenerates and diffs it. Not built, so C17's mark stays `reader`.
- C17 still says "`bff` names no set yet", untrue since `8184f37c`: one phrase, owed to the next piece touching `code.md`.
- The act run proving the moved workflow paths.

No `docs/products.md` row: nothing a partner or operator can open changed.

## Evidence

- Gate green at exit 0 after the UI move (`logs/2026-11-10-094808-gate-all.log`) and after the last step (`logs/2026-11-10-110032-gate-all.log`).
- File counts read with `git ls-tree` and `git show -M --name-status` on the commits named.
- The research page's citation measurements were not re-measured here, so no figure from them is quoted.
