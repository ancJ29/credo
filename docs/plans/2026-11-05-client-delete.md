# Delete a client whole, from the operator's console

## At a glance

Too many clients have been made on the stack, and a partner opening the app no longer knows which
one is theirs. The operator console gains a Delete button on every row of its clients list, beside
the New root password button already there (`ui/src/ClientsPage.tsx#L56-L66`), and a page behind it
that removes the client and every record it owns. Only the operator reaches the console.

The cheapest safe path is the mirror of the create. `createClient` writes the code's index **last**,
so a failure before it leaves the code free (`bff/src/records/clients.ts#L44-L52`); a delete writes it
**first**, so the client is dark from the first write. The index is the one door: `resolveTenant`
reads `client.<code>` on every call and answers 404 without it (`bff/src/app.ts#L99-L105`), so
removing it ends every session of that client at its next step and leaves no sign-in or session
record anyone can reach. Then the tenant's records go, swept by the prefix the key layout already
keeps, `tenant.<id>.` (`shared/src/records.ts#L21-L23`).

**The price:** the BFF's function times out at 10 seconds (`ops/env.yml#L223`), c-storage lists at
most 1,000 records (`c-storage/internal/store/store.go#L132`) and deletes one key a call
(`#L125-L127`), so one request cannot finish a large client. The route does bounded work and says
how much is left; the page presses on until the client is gone. A sweep that dies between presses
leaves records no code can reach: clearing those needs c-storage's own key, the human's act — the
price `createClient`'s own doc already accepts.

## The slice

One: the operator deletes a client from the console; it leaves the list, its people cannot sign in,
its records are gone. Walkable end to end on the fake and through the stack.

## The steps

- [x] **1. The cheap build, end to end on the fake** (~25 min). `shared/`: a `DELETE` route beside
      `rootPasswordRoute` (`shared/src/wire.ts#L206-L208`), a request of `{ confirm }` as
      `deleteOperatorRequestSchema` has (`#L413`), a reply of `{ left: number }`, `'delete-client'`
      in `confirmActSchema` (`#L315-L322`), `recordKeys.clientDeletion(code)` beside the index key
      (`shared/src/records.ts#L7-L11`). `ui/`: `DeleteClientPage` at
      `/operator/clients/:code/delete`, from `RootPasswordPage` (the code typed, the touch) and
      `DeleteOperatorPage` (the red button, the 404 that lands on the list); the row's button; the
      fake's `deleteClient` (`ui/src/fake.ts#L1159`); vi and en words. **Done when** `pnpm fake`
      walks the three screens below and `pnpm -C ui test` is green.
      *Done 11-05:* `pnpm -C ui test` green, 59 files, 725 tests, coverage 100 % on all four
      measures; `pnpm -r run typecheck` and prettier clean. The three screens (the delete page, the
      list with the button, the page pressing on with its count left) are held by
      `DeleteClientPage.test.tsx`, `ClientsPage.test.tsx` and `fake.test.tsx` in jsdom; `pnpm fake`
      serves them to a browser, which the sandbox cannot start, so it is the human's look. One
      line outside `ui/`/`shared/`: `'confirm-delete-client'` in `bff/src/calling/challenge.ts`'s `Purpose`
      type, which the shared act list forces to compile; no route.
- [x] **2. The route through the stack** (~30 min). `deleteClient` in `bff/src/records/clients.ts`, one
      route in `app.ts` beside the create (`#L377-L387`). Every check before any write, as
      `root-password.ts#L27-L48` orders its own: the live session (401); the code parsed (400); the
      index read (404, before anything of the client is read); the body (400); the touch (403). Then
      the writes: the deletion record (`{ id, name, by, startedAt }`), the index removed, the prefix
      swept up to a bound, the deletion record removed when a list comes back empty. A later press
      finds no index, reads the deletion record and resumes. **Done when**
      `pnpm -C bff test clients-delete` is green and `pnpm stack` shows a deleted client's `me`
      answering 404.
      *Done 11-05* (ticked after the stack look): the code is `deleteClient` in
      `bff/src/records/clients.ts`, the route in `bff/src/routes/clients-delete.ts`, its cases in
      `bff/src/routes/clients-delete.route.test.ts` (20 after the review round), all green. On
      `pnpm stack` a client's root signed in (200) and its `me` answered 200; one delete press with a
      fresh touch answered `{ left: 0 }`; then the same session's `me` answered 404, the root's
      sign-in 404, the operator's list no longer held the client (the data set's other two stayed),
      and a further press answered 404.
- [x] **3. The hardened build** (~35 min). Every row below seen red once
      ([QA](../conventions/qa.md) rule 2), coverage 100 % (rule 8), the walk screens written
      (`visual/src/walks.ts#L396-L470`). **Done when** `pnpm check` is green and
      `pnpm -C bff test --coverage` reads 100 %.
      *Done 11-05:* `pnpm check` green (typecheck, eslint, prettier, every package's tests, knip);
      bff 542 tests at 100 % on all four measures; ui 739; the walk is an appended
      walk `operator-delete-client` (screens `dc-1-page`, `dc-2-code`, `dc-3-failed`, `dc-4-gone`)
      with its spec, its two projects and its row in `walk/run.sh`. The report against `main`
      `4b39482`: `op-5-dashboard` moved (the Delete button), the four `dc-` screens are new, no
      other screen moved. Reds shown: the two safety ones and three sweep ones in step 2; the
      read-order and the isolation cases stay unproved by choice. The stack look of step 2 and the
      full run of the walk are unrun.
- [x] **4. The look, the review and the full run** (~15 min plus the human's). The three points
      below; one review on another model (rule 5); `bash walk/run.sh operator-setup --moved all` in
      the human's terminal; the recap.
      *Done 11-05:* the full run of 12 walks green in 14m35s (`20261105-1446-client-delete-full-run.log`),
      `delete-client` 24 new, `operator` 6 moved, others 0; review fixes in `a073433`; the recap
      `docs/recaps/2026-11-05-client-delete.md`.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A malformed code, and a code naming no client, are refused before any client record is read | BFF route, `clients-delete.route.test.ts` |
| 2 | **A refused touch (403) changes nothing: the index and every tenant record are still there** | BFF route |
| 3 | A malformed body is refused before the touch is asked for | BFF route |
| 4 | The index is removed before any record of the tenant | BFF route |
| 5 | **A person signed in before the deletion is refused at their next call, by the client's 404** | BFF route, the sign-in the app uses |
| 6 | Every record under the prefix is gone, the seed's ledger included (`shared/src/records.ts#L55-L57`) | BFF route |
| 7 | A tenant too large for one sweep answers how many are left, and a second call finishes it | BFF route |
| 8 | The deletion record goes only when a list of the prefix comes back empty | BFF route |
| 9 | A press after the index is gone resumes from the deletion record, on the session alone | BFF route |
| 10 | The code is free: a new client of the same code is made after the deletion | BFF route |
| 11 | The code typed wrong on the page makes no call | ui, `DeleteClientPage.test.tsx` |
| 12 | A client already gone lands the page back on the list | ui |
| 13 | Every row of the list draws a Delete button naming its code | ui, `ClientsPage.test.tsx` |
| 14 | The fake deletes from its own list, so the page walks with no stack | ui, `fake.test.ts` |

## The human's points

1. **The delete page, before anything is pressed** (step 1, on the walks page). You will see the
   company's name, the code, a line saying every person, order, delivery, photo, setting and
   sign-in of this client goes and cannot be brought back, the box asking for the code typed, and a
   red button. This wording is all that stands between a slip and a client's data, so it must read
   as a wall. A yes freezes it; a no rewrites it before the route is built.
2. **The clients list with its new button** (step 1). Every row gains Delete beside New root
   password. This is the screen you will clear the pile from, and the two buttons sit millimetres
   apart with very different consequences. A yes keeps the layout; a no moves the delete into the
   client's own page instead.
3. **The screen while it works, and the list after** (step 3, the stack's walk). The page says how
   many records are left as it presses on, then the list comes back without the client. A yes says
   the act reads as finished when it is; a no means the page must say more about what is left.

## Decided

- **One act, not two.** A hidden-then-deleted pair would cost a wire field, a default at the
  client's boundary (`CLAUDE.md#L23`), a filter on the list and a second screen, and would still
  leave the data the ask says to remove. The confusion ends at the first write either way: the index
  goes first, so the client leaves the list and every sign-in in that instant.
- **What the operator does:** types the client's code, as the root-password page already asks
  (`ui/src/RootPasswordPage.tsx#L72`, `#L136-L137`), then a fresh touch of their own passkey, as the
  colleague's delete asks (`ui/src/DeleteOperatorPage.tsx#L36`). No new kind of confirmation, and
  **one touch a deletion, not one a press**: a resume reads the deletion record as proof the act was
  allowed, since asking four times through one sweep teaches the operator to tap past it.
- **Who may do it: today's permission, unchanged** — a live operator session plus the touch, what
  deleting a colleague already takes (`bff/src/routes/operator-team.ts#L117-L122`). The operator realm has
  no roles to add one to.
- **No audit line is kept.** `recordKeys` holds no log of any kind (`shared/src/records.ts#L7-L69`),
  and a log the console never reads would be a layer ahead of its caller. The deletion record is the
  only trace and it goes with the sweep; an open item carries this to the first real client.
- **The demo copies and the deploy's `check-…` clients go by this same path**, and clearing them on
  ridge is the piece's first real use, the human's own act. It is a broom, not a fix:
  `ops/check.sh#L149-L156` still makes one a run, so that open item stays open until the check
  deletes its own, a next ops piece.
- **A session alone may continue another operator's deletion.** The resume asks for no body and no
  touch, and the deletion record's `by` is kept only as the trace: the touch was given to begin the
  act, and the console's operators are one team.
- **The route's order, as built:** the index is read before the body, so a malformed body on a code
  naming no client and no deletion in progress is a 404, not a 400; nothing is written either way.
- **The writes are conditional (review, 11-05):** the index is removed only over the tag it was read
  with, and the deletion record is written only over what was read (none, or this tenant's own), so
  a code deleted and made again under a press is a 409 and nothing is swept. `createClient` refuses
  a code whose deletion is unfinished, so a new client never hides records no press can reach.
  The page of a client no longer in the list offers to continue blindly: the route answers 404
  where there is nothing to continue.
- **The sweep retries a bounded number of times and never past them**, as `deleteOperator` does on a
  moved roster (`bff/src/records/operators.ts#L168-L196`); `more` is read as a signal to press on, not as
  the error `listClients` makes of it (`bff/src/records/clients.ts#L89-L91`).

## The human's question

1. The deletion stays irreversible, and a client's own stack — its own deployment — is out of this
   piece: the route deletes only from the stack it runs on. **Recommended:** yes. Nothing is at
   stake today, and the day a paying client exists the recoverable form is its own slice, an export
   the operator takes first — worth building then against a real client's shape, not guessed now.
