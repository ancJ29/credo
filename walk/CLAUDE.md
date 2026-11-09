# walk
Stack: Playwright on Chromium · Gate: `pnpm check` from the root typechecks and lints this package and runs no spec; the real check is `walk/run.sh`, in the human's terminal · Ship: none

The browser walks: one spec per walk, each screen shot in two languages at three widths, on the fake
and on a stack, the pictures counted raw against each other and the committed bases.

## What belongs here, and what does not

- **A spec, its two projects, its row in the walk table and its base images** belong here.
- **A screen's scene and question belong in `visual`;** its own test and its steps' replay, in `ui`.
- **The pixel reader and the count belong in `scripts`;** `walk/support.ts`'s `shot` only calls it.
- **The screen widths belong in `shared`:** `WIDTHS` in `shared/src/widths.ts`, which `walk/support.ts` re-exports.
- **`walk/legacy-capture.ts` is not a spec:** it photographs the old app, run by `ops/legacy-capture.sh`.

## The file to copy

- **A spec:** `walk/specs/operator-delete-client.spec.ts`: `FULL`, `exactly`, `open`, `walk`, then the
  loop over widths and languages.
- **Its table row:** the `WALKS` line in `walk/run.sh`; **its projects:** the `-fake` and `-full` pair
  in `walk/playwright.config.ts`'s `projects`.

**This package's one directory is `walk/specs`, and that is already the answer:** everything in it is
a walk spec, each with its base images in a folder beside it, and the harness every spec shares stays
at the package root. Nothing else here divides
([the shape of a package](../docs/conventions/code.md#the-shape-of-a-package)).

## This package's own rules

Marks: [How to read a rule](../docs/conventions/code.md#how-to-read-a-rule). What a new screen owes
is [Before a new screen](../docs/conventions/code.md#before-a-new-screen).

- **WK1 · holds · check:** every spec is in some project and every project runs exactly one spec
  (`testMatch`), or pictures land in another walk's folder ("runs every spec file in some project",
  `visual/src/walks.test.ts`).
- **WK2 · holds · reader:** a walk's name stands in its projects, its `WALKS` row and the literal in
  the spec's `FULL`; nothing compares the literal.
- **WK3 · holds · check:** a spec compares nothing with a base: every picture goes through `shot`,
  every screen is named by `await at('…')`, and no `toHaveScreenshot` or tolerance appears.
- **WK4 · holds · reader:** a textbox or a label is found by `exactly(words.…)`, the whole label with
  an optional star; a button or cell by `exact: true`. `piece-2.spec.ts` and `lists.spec.ts` still
  hold plain names, which match longer labels too; this binds the next file. Eight specs hold
  `exactly` byte-identical: copy it as it is.
- **WK5 · holds · reader:** an `expect` on what the screen shows follows every navigation or
  transition, before its picture (123 of 128; the rest follow a helper). No spec sleeps.
- **WK6 · next copy · reader:** each new step is replayed in jsdom on the real router, in `ui`,
  before the commit (`ui/src/OperatorWalk.test.tsx`; four of the twelve specs have a replay of some
  of their steps).
- **WK7 · next copy · reader:** a mask covers only what is minted on every run, and says "Held by"
  the unit test that holds it, as `shot`'s comment asks (`operator.spec.ts` does);
  `operator-team`, `operator-passkeys` and `operator-services` mask without it.
- **WK8 · holds · reader:** a walk that makes or changes a client runs a stack for each test
  (`WALKS`' fifth column, `test`), not one for the pass.
- **WK9 · holds · reader:** an address that may carry a one-time token opens by `gotoQuietly` and is
  waited on by `reachedPath`; Playwright's own error prints the token into a shared log.

## Non-obvious facts

- **A moved pixel is a raw pixel count:** `retries` stays 0 and `--disable-partial-raster` stays in
  `launchOptions`, or an edge falls two ways run by run ([the plan](../docs/plans/2026-10-31-walk-steady.md)).
- **The bases are one Mac's:** their names end `-darwin` (`WALKS`), and `--write` replaces them only
  after a green run.
- **`visual` reads these files as text:** a reformat of a spec, or a renamed `at`, reds `visual`.

## Where the rest is

- The big picture: [`architecture.md`](../docs/architecture.md#at-a-glance).
- The cross-package rules: [`code.md`](../docs/conventions/code.md).
- The sibling to copy: [`visual/CLAUDE.md`](../visual/CLAUDE.md), the page that draws the same screens.
