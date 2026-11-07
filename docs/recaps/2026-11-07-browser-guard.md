# A picture run that keeps and checks its browser, recap, 2026-11-07

## What the repository now does

- `walk/run.sh` derives the trunk and its `playwright-core` path at run time, so no machine path is committed.
- It requires the trunk's `browsers.json` to name the revision the run uses.
- It reads the browser claim and reports it when present. When absent, it writes it through a draft and a rename, so an install never reads half a claim.
- It refuses before any pass when the trunk names a different revision, when `browsers.json` cannot be read, or when the folder cannot be written.
- A pass whose browser has vanished stops at once, and the verdict says so.

## Still the human's

- Writing the claim from a terminal that can write the browser folder, if it ever goes missing.
- Reinstalling in the trunk if its Playwright changes.
- Whether an outside install honours the claim at all. Only the next outside install settles it.

## Review

Two Mediums, both fixed in `0e5d7855`. The first: the one recovery command handed to the human was refused by the script's own parser. The second: a torn claim file was read as "already there". Four Lows are items 122 to 125 in `docs/open-items.md`; 125 is already `[DONE]`.

## Rejected

Pinning the browser revision. It would move every base picture, so it stays a recommendation: all twelve walks re-approved by hand.

## Evidence

- Commits `4f47cf39`, `a64a29d2`, `0e5d7855`, `e91b174f` (merge of `main`).
- Whole check on the merge result: typecheck, eslint, prettier, tests, knip each exit 0. Log `browser-guard-check-3.log`.
- **One row cannot be seen red.** Row 9, the draft and rename: a draft then rename and an in-place write leave the same folder behind, so no test can fail on it. It is held by the draft sitting outside `.links` and gone afterwards.
- No `.png` in the diff.
- `docs/products.md`: the `walk/run.sh` row names the guard.
