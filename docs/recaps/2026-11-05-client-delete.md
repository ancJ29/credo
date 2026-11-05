# Delete a client whole

Too many clients had been created, and partners opening the app were confused by the list. An operator can now delete a client and everything it owns, from a red page that names the company, asks for its code typed and a fresh passkey touch.

## The safety

- Every check happens before any write, so a refused call writes nothing: a case asserts the store was never even asked.
- The client's index goes before any of its data, so from the first write the client is out of the list and everyone inside is refused at their next call.
- It survives interruption: at most 200 records a press, a marker written before the index goes, and a press that finds no client resumes from the marker. A page opened for a client no longer listed offers to continue.

## What the stack proved

On `pnpm stack` (plan step 2): the root signed in and the list held three clients; one press answered nothing-left; after, that session got a 404, the root could not sign in, and the list held two.

## What the review found

The index was removed without the tag it had been read under, the one path that could take a client nobody condemned if a second operator recreated the same code meanwhile. And the resume was unreachable from the page while the failure words told the operator to stop. Both fixed, each case red once (`a073433`).

## The run

`20261105-1446-client-delete-full-run.log`: green, 14m35s. `delete-client` 24 new pictures, `operator` 6 moved, every other walk 0; run 2 read every count 0. It was the new walk's first run in a real browser, which the sandbox cannot start.

## The human's part

Yes on all four screens of the new walk (11-05, 13:16) and on the rewritten failure words (14:2x). One question answered yes: the deletion stays irreversible, and a client's own stack is out of this piece. The recoverable form, an export taken first, becomes its own slice the day a paying client exists.

## Deliberately absent

No audit line: the records have nowhere to keep one and the console would never read it. No recoverability.

## Open items

Nothing closes. The `check-…` client every deploy leaves is not fixed here: this gives the human a broom, not a fix; the deploy's check deleting its own client stays a later ops piece.

## Commits

`b439e17` plan; `88dca42` page and fake; `3b0f588` and `973945a` route and cases; `3ab431c` walk; `a073433` review fixes; `ca5f30b` walk bases.
