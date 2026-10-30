# The operator's dashboard, recap, 2026-10-30

## At a glance

[The plan](../plans/2026-10-29-operator-dashboard.md), steps 1 to 13, is done. The operator signs in
at `/operator` and meets the same frame as a client's staff: a menu of five sections, a header with
an "Operator" badge, and a phone layout. The Clients section lists every client with the name it was
made under, its code, the day it was made, and a button that copies its sign-in link; the list is
newest first. "Add a client" makes one and shows its link. Operators, Services status, Usage and
costs and Activity are entries with an empty "coming soon" page, for the operator console plan to fill.

The UI was walked on invented data first, the human answered all 16 asks of the preview "yes", then
the BFF was built, then the human's full run on a real stack came back green: 54 pictures, none
differing from the fake's, the 54 bases written and read back at threshold 0, piece 1's and piece
2's bases unmoved. A model other than the author's reviewed it: six findings, all fixed.

The full run after piece 2 and the demo seed merged in came back red on six card corners (10 pixels
each, one channel value), a raster flip that predates this piece; the human accepted it for the
delivery and the fix is [open item 32](../open-items.md). What stays the human's, in short: the merge
itself and the first look on ridge ([What remains](#what-remains)).

## What shipped

| Part | What it is |
| --- | --- |
| the frame | the operator's sections go through the `pages` piece 2 gave the shell; the four skeleton sections share one "coming soon" page |
| the list | `GET /api/operator/clients` (`listClients` in `bff/src/clients.ts`): one c-storage list under the client prefix, newest first, a 500 on `more` or on a record that does not parse |
| the made-on date | the BFF writes `madeAt` from its own clock when it creates a client; a time in the body is a 400; the list shows "—" for clients made before this piece |
| the link | one function builds the sign-in link, used by the create and by the copy button |
| c-storage | a list of one service's records under a prefix, added by piece 2's group A and used here unchanged |
| the fake | the nine screens as scenes in `visual/src/walks.ts` and a data set whose clients carry fixed times at noon UTC |
| the walk | `walk/specs/operator.spec.ts`, two Playwright projects (`operator-fake`, `operator-full`): 9 screens x 2 languages x 3 widths = 54 pictures, and 54 committed bases |
| the full run | one script, 21 stacks (18 for the operator's six runs, 3 for piece 1 and piece 2), each pass on a stack of its own because the walk makes a client by a fixed code |

Read back, each against its "done when" line in the plan:

- **Step 7, the preview:** the human's 16 answers, every one yes; the fake run's 54 pictures counted
  ([the plan](../plans/2026-10-29-operator-dashboard.md#L401)).
- **Step 8, the BFF:** live on a stack, the operator listed the data set's three with their days,
  made one and listed four with it first; a root's handle was a 401
  ([the plan](../plans/2026-10-29-operator-dashboard.md#L419)).
- **Step 11, the full walk:** green, read whole from the log; `pnpm report` then read `0 waiting, 0
  asked again, 0 no, 68 yes` ([the plan](../plans/2026-10-29-operator-dashboard.md#L487)).

## What was rejected, and its price

| Rejected | Price paid |
| --- | --- |
| a second frame for the operator ([the frame](../plans/2026-10-29-operator-dashboard.md#L90)) | none; the operator wears the shell with its own menu entries |
| the link written out in a column ([the list](../plans/2026-10-29-operator-dashboard.md#L114)) | a copy button instead; the pictures need no mask for the address |
| reading each client's settings for its current name ([the name](../plans/2026-10-29-operator-dashboard.md#L119)) | the list shows the name as made, and the column says "name when made"; a company renamed by its root keeps the old name here. *Trigger:* the operator asking for the current name |
| hiding the deploy check's `check-` clients ([call 4](../plans/2026-10-29-operator-dashboard.md#L280)) | after each deploy one sits at the top of ridge's list until a client can be removed |

Known prices that stay: a data-set time near midnight UTC would read as another day in another zone,
so the data set's times are at noon UTC; a key added under `client.` would turn the list into a 500
(a test over `recordKeys` guards it).

## What the review found

The reviewer was Opus, a model other than the author's, on `4f77e98`
([the plan's step 10](../plans/2026-10-29-operator-dashboard.md#L457)). Six findings, each test seen
red first; the plan records no finding rejected or deferred.

- F1 (High) [FIXED] the spec shot the dashboard after screen 3 had made a client, so a stack's list
  held four rows where the fake holds three: screens 5, 6 and 7 are shot right after screen 1, and a
  test holds the order.
- F2 (Medium) [FIXED] the script left piece 2's 96 bases unread: one more stack reads them with
  nothing written.
- F3 [FIXED] the list's three 500s were not read from the log: each is logged by its kind and holds
  neither the key nor a value.
- F4 [FIXED] the create's `madeAt` was not read between the times before and after the run.
- F5 [FIXED] a second client made after "Add another client" was held by no test.
- F6 [FIXED] the hazard of a revert on ridge was missing from the plan: it is there now, and below.
- The review's two gaps [FIXED]: the script's busy check now names an idle `pnpm stack` or `pnpm fake`,
  and its load is compared as a decimal.

## What remains

- **Step 13, onto `main`: done.** `main` is merged in, `pnpm check` is green, and the human's full run
  was accepted on Decide 33 (a) despite six card corners moved by one channel value
  ([the plan](../plans/2026-10-29-operator-dashboard.md#L513)). The fix is
  [open item 32](../open-items.md), in the pixel piece after the push.
- **Step 14, the merge,** on the human's word.
- **Step 15, ridge.** After the push, the human signs in at `/operator`, adds a client, sees it lead
  the list, and opens its copied link; one question: is this the console to run clients from?
- **Unverified:** a stack's start time (the script's 15 to 25 minutes is a guess), and copying
  from the page, which jsdom cannot test
  ([the plan](../plans/2026-10-29-operator-dashboard.md#L527)).

**Hazard, repeated: never revert past this piece on ridge.** Every client made after it carries a
`madeAt`; the old strict client schema refuses it, so each such client would answer 500
(`shared/src/records.ts#L41`, read strictly in `bff/src/app.ts`). On ridge, roll forward.
