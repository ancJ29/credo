# B2 of the operator console: a new link for a lost passkey, and the delete

## At a glance

An operator who lost every passkey cannot sign in. A colleague presses **New link** on their row in **Operators**,
touches their passkey and copies the link, shown once; the old passkeys stop at its use. An operator also deletes a
colleague: a page says what goes, one touch, and they are gone, signed out at their next step, nothing kept. Never
oneself. B2 ends B and closes open items 65 to 68.

The cheapest path is what `main` holds: `makeLink` (`bff/src/operators.ts#L64-L97`); A's join, which already
replaces every passkey and ends the sessions at a `replace` link's use (`bff/src/operator-auth.ts#L325-L340`); the
touch (`#L266`); B1's routes (`bff/src/operator-team.ts#L39-L79`) and pages. **Price:** $0 a month; about 68
machine minutes and 13 of the human's.

## The slice

Each row but "you" gains **New link** and **Delete**, each its own page as D's is (`ui/src/OperatorApp.tsx#L170`),
on two routes in `bff/src/operator-team.ts` (console plan `docs/plans/2026-10-29-operator-console.md#L351`), each a
`{ confirm }` for a new act (`shared/src/wire.ts#L308`):

- `POST /api/operator/operators/:id/link`, act `operator-link`, then `makeLink`: `{ link }` once, 201.
- `DELETE /api/operator/operators/:id`, act `delete-operator`, as A's passkey remove (`shared/src/wire.ts#L329`),
  then `deleteOperator` beside `createOperator` (`bff/src/operators.ts#L108-L146`): 204.
- **Screens:** 4, a link for the data set's active colleague (`shared/src/demo.ts#L84`), masked on the stack as
  screen 3's (`walk/specs/operator-team.spec.ts#L91`); 5, their delete, walked last; 1 asked again. The data set stays.

## Decided for the machine

1. **A new link removes nothing when made;** the passkeys go at its use (`bff/src/operator-auth.ts#L327-L337`), so
   a link never opened locks no one out.
2. **Its kind follows the state,** `join` if invited, `replace` if active: only `replace` ends sessions.
3. **Neither on oneself:** one signed in adds passkeys on their own page, and the last active operator is never
   deleted (console rows 13, 15).
4. **The delete's check is its page and a touch,** so a stolen session cannot empty the roster; no name typed.
5. **The sweep is row 47's, amended by the review's M1:** their live link and the links they made first (each
   account's `linkHash` read), then the roster line, as its write makes an operator (`bff/src/operators.ts`), then
   the account. Sessions are left:
   the roster check refuses them (`bff/src/operator-auth.ts#L96-L101`), their records kept as every ended one's
   (`bff/src/sessions.ts#L106`).
6. **Two deletes racing:** a 412 re-reads and checks actor and target again, three times (row 36): actor gone 401,
   target gone 404.

## The case table

Business rows first, each red first from its assertion; every package at 100 %.

| # | The case | Held by | Step |
| --- | --- | --- | --- |
| 1 | A new link after a touch, shown once, replacing their last: join if invited, new-passkey if active, whose use replaces their passkeys and ends their sessions | route; ui; walk | 2, 3 |
| 2 | A delete after its page and a touch: roster line, account, live link and the links they made go, each with its tag; one they added reads "—"; their name is free; their session a 401 at its next request | route, records read back; ui; walk | 2, 3 |
| 3 | Two deleting each other at once: one remains, the other 401; a target already gone: 404, no link left, the page lists again | route, `interrupting` (`bff/src/operator-passkeys.route.test.ts#L1064`); ui | 2, 3 |
| 4 | No session 401; no touch for this act, or oneself the target, 403, nothing written, and "you" offered neither; no link logged | route; shared; ui | 2, 3 |
| 5 | Item 65: a create's failure reads "may not have been added" (`ui/src/i18n/en.ts#L144`, `ui/src/i18n/vi.ts#L143`); a new link reaches one listed invited | ui; route | 2, 3 |
| 6 | Item 66: two spellings of one name racing, the second taken; red with `bff/src/operators.ts#L137` back to `===` | route | 3 |
| 7 | Item 67: names compared and stored NFC, an accented name typed precomposed or combining one name (`shared/src/wire.ts#L367-L371`) | shared | 3 |
| 8 | Item 68: `--replace` finds by the create's compare, any roster name (`scripts/src/ridge.ts#L76-L83`) | scripts | 3 |
| 9 | The fake parses under the shared schemas, each cue once; the scenes match the spec, each with its Vietnamese question; vi and en at three widths | ui; visual; walk | 2 |

## Steps

The full flow, since B2 decides who may sign in; each size is B1's.

- [x] **1. This plan.** 🤖 Opus, 9 minutes. Done when: committed, `wc -w` about 1,000, the grep empty.
- [x] **2. The page on the fake.** 🤖 Sonnet, 26 minutes, on `ui/src/AddOperatorPage.tsx`'s model. Done when: the
  UI halves red once; touched packages at 100 %, lint clean; `pnpm report` builds `tm-4-link` and `tm-5-delete`,
  `tm-1-list` re-asked. Then 👤 1, while step 3 goes on.
  *Ready for the human's look* (2026-11-03; the look answered yes at 16:16 +07 on 2026-11-03, all six screens
  of the walk "Who else may sign in here", `tm-1-list` to `tm-6-taken`, vi, on the walks page built from `c188bc2`): the UI halves seen red once (23 failed before the pages), then the
  whole `pnpm check` `== exit 0` at `c188bc2` (two earlier runs red: a ui test timing out at load 16.6, item 56's,
  then `ui/src/fake.ts` at 99.93 % until its 400 and joined-operator lines had tests, and a visual cue count in a
  new test, fixed); the walks page built from that commit with a clean tree: 106 screens and 212 captures (104 and
  208 before), `tm-4-link` and `tm-5-delete` new in vi and en, `tm-1-list` asked again with both actions and a new
  Vietnamese question each. The BFF gained only the two touches' purposes in its type. *Not done:* the walk spec's
  new steps are typechecked, never run (step 6); the routes are step 3's; the data set's colleague keeps its id
  (`DEMO_COLLEAGUE_ID`) for the stack's walk.
- [x] **3. The routes on the real c-storage.** 🤖 Sonnet, 18 minutes. Done when: the other halves red once, at
  100 %; live, in one `pnpm stack -- <command>`: a link for the colleague 201, its join options naming them; their
  delete 204, the list without them, their link 404; oneself 403; no touch 403; no handle 401.
  *Done* (2026-11-03): the route and unit halves red once (items 67 and 68 with their sources put back to the
  old compare; item 66 with the re-check at `bff/src/operators.ts#L137` back to `===`, only its race test red);
  shared, bff and scripts at 100 %, typecheck, lint, format and knip `== exit 0`. Live in one `pnpm stack`: a new
  link 201 for the invited operator (its options name them) and for the active colleague (who joins by it), the
  colleague's delete 204, the list without them, their next call 401, a link for them 404; oneself 403, another
  act's touch 403, no handle 401; no secret in the log. The deleted one's records go in the sweep's order; a record
  that moves is re-read three times, then a 503.
- [x] **4. The gate.** 🤖, 10 minutes: `main` taken in if moved; `pnpm check` under the lock, `== exit 0`.
  *Done, green on a rerun* (2026-11-03, at `44db639`, `main` not moved): the first whole check
  (`logs/20261103-1625-b2-step4-gate.log`, `== exit 1`, load 2.6 at start, 47 inside) failed only item 56's
  `ui/src/SignIns.test.tsx` test "C: The root turns the email and the QR sign-in on..." (timed out at 5000 ms); the
  rerun at load 7.3 (`logs/20261103-1630-b2-step4-gate.log`) ends `== exit 0`, 6 minutes.
- [x] **5. One review.** 🤖 Opus, 4 minutes: the sweep, the race, the touches. Done when: each finding `[FIXED]`,
  `[REJECTED]` or `[DEFERRED]` here.
  *Done* (2026-11-03, Opus at `44db639`): no High, one Medium, three Lows.
  - M1 `[FIXED]` (`4131696`): a delete that failed after the roster line left live the links the deleted operator
    made, and a retry met a 404 and never swept. The links now go before the roster line, the account after it; a
    failure among the links leaves the operator listed, so the page's "try again" is true. A test fails the delete
    at each removal and at the roster write and checks the links and the retry (red: three of four, then green; bff
    at 100 %).
  - L2 `[DEFERRED]`, item 70: an add or a link the target began before its delete can land after the sweep; rare,
    needs two operators acting in the same instants.
  - L3 `[DEFERRED]`, item 71: a link's kind comes from a roster read that can be stale by one join; rare, and the
    colleague only has their sessions kept.
  - L4 `[DEFERRED]`, item 72: `--replace` refuses roster names with a space or accent; the console's New link
    covers them.
- [ ] **6. The full run** (👤 2), 12.5 minutes; 🤖 reads the logs whole. Done when: the first moves `tm-1-list`'s six
  pictures and adds twelve; the second every count 0; the bases committed.
- [ ] **7. The recap.** 🤖, 1 minute: `docs/products.md`'s B2 row, console steps 10 to 14 ticked, items 65 to 68
  deleted. Done when: committed, `wc -w` under 400, the grep over `main...HEAD` clean; then the squash.

## The human's points

👤 **1. The look, after step 2.** The walk "operator-team" shows, in vi and en: 4, a new link for a colleague who
lost their passkeys: is it clear their old passkeys stop when they use it? 5, deleting one: is it clear they are
signed out at their next step and come back only by a new invite? 1 again, its rows offering both. A no becomes a case, fixed
before step 6; the work goes on, and only the push waits.

👤 **2. The full run, step 6.** In the human's terminal, nothing else running:
`bash walk/run.sh operator passkeys team --moved tm-1-list --write`, then the same without `--moved` and `--write`.
The first rewrites screen 1 and adds 4 and 5; the other walks prove nothing else moved. Green starts the recap; a
red names each moved screen, and the machine finds why before any base is written.
