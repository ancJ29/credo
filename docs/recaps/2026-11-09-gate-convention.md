# The gate convention, recap, 2026-11-09

## Why it existed

One gate command landed in `main` this morning ([the recap before this](2026-11-09-one-gate-command.md)), and QA's rule 6 still told every brief to name and run the five steps by hand. Until that changed, the next brief would invent again what the command removed, and that invention produced four faults on 2026-11-07, none in product code.

## What changed

- The gate is named as one command with its real spellings: `pnpm check`, and `pnpm --filter @credo/<pkg> check`, as `package.json`'s `scripts.check` has them.
- A session runs it and reports its log, which ends `== exit <code>`; it builds no gate from steps. While iterating it runs whatever answers its question and does not call that the gate.
- The old plans that carry a hand-assembled chain are covered by one dated clause, and none was edited.
- The `ui` load fact is kept as what item 56 supports: `ui` reds are recorded, their cause is not known, and the command passes no worker flag.
- What the command does not do is stated: c-storage, a bare `walk/run.sh`, and `pnpm -r run check`.

## What the read found

All of it was prose. "A skip is not a pass", read literally, meant no whole check could ever pass: `walk` has no test script, so every green whole-gate log ends `0+1skipped`; the standing skip is now named. And nine lines above the new sentence the convention still told a session to assemble, in two step names rather than five, so a grep for the phrase could not see it. A third moment, "before shipping" against rule 6's "on the merge result before a merge", was found last.

## What stays open

Items 193 (the collaboration loop cell still lists steps) and 194 (`ops/gate.sh`'s comment names the wrong loop mechanism).

## The method

When a piece replaces a chain with one command, sweep over the step names, not the phrase, and compare every moment a rewritten rule names against the rule's other sentences. Missing that cost two rounds.

## Evidence

`docs/conventions/qa.md` at the commit after this one's parent; no gate run (docs only, no `node_modules` by design). No `docs/products.md` row changes (internal).
