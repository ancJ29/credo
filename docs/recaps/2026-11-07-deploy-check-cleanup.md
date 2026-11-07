# The deploy check cleans up after itself, recap, 2026-11-07

## At a glance

| | Before | After |
| --- | --- | --- |
| The check's own client (`check-<date>t<time>z`) | made on ridge and left, three records a run | deleted at every end of the check, pass or fail |
| A delete that fails | not applicable | a `WARN` line in the log; the check's verdict does not change |

## What shipped

- **The cause:** ridge's Clients list refilled after every deploy because nothing had ever deleted the client the check makes to prove the app answers (`ops/check.sh#L151`, `#L153-L154` at `main`; its own comment said "it stays"). The only delete was the console's, which needs an operator's passkey.
- **The fix:** `ops/check.sh`'s `cleanup_extra` deletes that client when the run ends, by the product's own delete function and the keys the create already used (`scripts/src/ridge.ts`, the new `untenant`). No new credential.
- **A failed delete warns, it does not turn the check red.** The message says what happened: nothing was deleted (the client moved, or an earlier deletion is unfinished), or how many records are left.

## Rejected and why

- **A guard-less `untenant`.** The review found it would have obeyed a hand-typed real client's code, with none of the console's gates (a live session and a fresh passkey touch). It now accepts only the check's own code shape and refuses the rest, deleting nothing.
- **A non-uuid in the deletion record.** The first version wrote `by: 'deploy-check'` into a record whose schema requires a uuid; a console resume of an unfinished deletion would have failed to read it. It writes the nil uuid.
- **Deferred:** item 117 (nothing greps the `WARN`, so a delete that always fails shows only to whoever opens the log or the list).

## What remains the human's

- The clients already left behind: one clearing by hand in the console.
- **The proof is the first deploy that actually runs.** The check runs only on GitHub, so nothing local proves it, and the last two pushes skipped `deploy` (`ci`'s `app` job failed on `pnpm check`), so ridge is still on the 11-05 commit. In that deploy's log, `ok   client check-… deleted` is the proof; a `WARN` line means the delete failed and the client stayed.

## Evidence

- Commits: `10057530` (the delete), `87e6cc74` (the guard, the wording, item 117).
- Gate, `scripts`: typecheck and `pnpm test`, exit 0, 22 files, 287 tests, 100 percent coverage (`gate4.log`). `ops/test.sh`, exit 0, 509 ok (`ops2.log`), run at `10057530`; the second commit touched no `ops/` file.
- `shellcheck -x ops/check.sh` clean. Review: may merge, no High; the Medium and the Low were closed in `87e6cc74`.
- `docs/products.md`: no row changes. Its rows name what a partner or an operator can do, and the deploy row ("ridge checked") and the `ops/` row ("check scripts") stay true as written; none claimed the leftover client.
