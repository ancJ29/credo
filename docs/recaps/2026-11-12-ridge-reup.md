# Ridge comes back by a command, recap, 2026-11-12

Written before the landing on `pre-merge`. <!-- FILL: the deploy job's first run onto the new role, read at the next push to `main` that touches code -->

## What happened

Ridge, the shared pre-production environment, was gone since its teardown. It is back, made from `main` by commands `ops/` already had: the stack, the release and the app, the environment check. Three small hand-off scripts only called those commands and read the result.

The proof is a reading off the running machine, never a template's claim: the box is up with its root disk fenced against termination; the check passes through the app's own address; the sweep of stranded check clients runs and is authorised; the gateway wrote its access-log lines for the requests made a minute earlier; and the three workflows are on, so a code push to `main` now deploys onto ridge.

Two lessons. The first release refused before changing anything: its script gave no region. Set, it went through. And the sweep deleting nothing is the right answer on a fresh ridge: it proves the path runs, not that it removed anything.

## What was rejected

The workflows went on last, not first: a push before the stack existed would have run the deploy against a secret naming the destroyed role, a red to read for nothing. The activity log and the box's shape (pooled boxes, or a stack a company) stay out; neither is in `main`'s templates yet.

## Still yours

- **The address is new.** The templates hold no custom domain, so a link you kept to the old address, and every old passkey, no longer works.
- Ridge holds no demo copy and no operator until the next ridge milestone makes them by script, so it is not yet a place to check a piece.
- No look of this piece is open.

## Evidence

- Base `a51b653c`, `pre-merge`'s tip when the branch took it in. Documents only, so the citation test is the check.
- The stack's plan listed additions alone; the create ended green and GitHub's environment held its role secret.
- The release, the app and the environment check ended green, the check's step through the app's address not skipped. With `c-storage` alone the box had about 287 MiB of memory available.
- The workflows read back active: `ci.yml`, `seed.yml` and `walks.yml`.
- The live reading: one running box, the disk fence off, no unattached volume, the Box's stack policies `RetainExceptOnCreate` and `Retain` (the stack's answer, not the instance's); the access-log one-off found all ten fields in every line.
- Not yet known: the deploy job's own first run, which only a code push starts.
- `docs/products.md`: the ridge line is true again; the demo copies' row says they went with the old disk.
