# The money defects of the day's end

## At a glance

Three open items were lined up as the last money faults before a real client's first order: the
order form's repricing gap (item 36, finding 5), the closed day's untested precondition (item 41,
finding 2) and the closer recorded as the root (item 41, finding 7). **A read of the code closes
the first one on the spot: it was fixed on 2026-11-07 and `docs/client-readiness.md` has not caught
up.** What is left is one slice in the day's end: the close of a driver's day, where the cash is
settled and no screen changes. The cheapest safe path is the one each item already names — one
`flaky` mode and one assertion for the precondition, and two lines moved above the write loop for
the closer — in one route file and its one route test. Price: the slice is a few lines of code, and
most of its minutes are the ceremony money asks for.

## The slice

One: **a driver's day closes once, against the person who closed it, and the two sums the office
reads for that day are proved one number.** It is walkable end to end when the plan ends — the
close already runs through the real c-storage in `bff/tests/`, and nothing waits on a caller that
is not there.

Why one and not three: all of it lands in `bff/src/reconciliations.ts` and
`bff/src/reconciliations.route.test.ts`, and the cases share one fixture (`dayEnd`, the test file's
tenant with two drivers and the day's calls). Splitting them would write that fixture three times.
Item 36's finding 5 adds no code at all, so the slice is smaller than the readiness page's "about a
day for the three together".

**What the three items really are, checked against the code:**

- **36.5 — fixed, and the readiness page is wrong.** The form draws a saved draft at its saved
  prices and marks a line whose product has moved since (`ui/src/OrderPage.tsx#L89-L92`), a moved
  price alone makes the save worth making (`#L106`), and the moved price is shown
  (`#L219-L222`); `ui/src/OrdersPages.test.tsx` and `walk/specs/orders.spec.ts` hold it.
  `docs/open-items.md#L296` already marks it `[FIXED]`. `docs/client-readiness.md#L393-L399` still
  reads it as the one to fix first, and `#L480-L483` counts it among three.
- **41.2 — the item is right, the readiness page overstates it.** The precondition **is** in the
  code: `storage.putRecord(key, record, null)` at `bff/src/reconciliations.ts#L41`, and `null`
  becomes `if-none-match: *` at `shared/src/c-storage.ts#L105-L107`, whose 412 reads as `moved`
  (`#L146`). So two closes cannot overwrite each other's cash, which is what
  `client-readiness.md#L400-L404` says they can. What is true is the item's own words: **nothing
  holds that `null`.** The two cases that look like they do intercept the write before it reaches
  c-storage — `'moved'` is returned by the wrapper (`reconciliations.route.test.ts#L398`) and
  `'theirs'` throws before our own write (`#L37-L41`, used at `#L400`) — so dropping the `null`
  leaves all fourteen green.
- **41.7 — the item is right, and it is a race only.** A non-root's sign-in already 401s when the
  person is gone or archived (`bff/src/app.ts#L137`, `#L163-L164`), and the root alone has a null
  `employeeId` (`#L127-L129`). So the fall-through at `bff/src/reconciliations.ts#L138-L140` is
  reached by a person only when their record goes **between** the sign-in's read and the close's,
  a window that today spans the whole cancel loop (`#L109-L127`). When it is reached, the stored
  `closedBy` has the root's shape and the screen says so, with the person's own name
  (`ui/src/DriverDayPage.tsx#L183-L185`).

**The invariant, and the one thing it rests on.** The day's sum to collect is built twice — live on
the page (`driverDay` over the deliveries list, `ui/src/DriverDayPage.tsx#L57`, and again per
driver at `ui/src/DeliveriesPage.tsx#L54`) and from the records in the route
(`bff/src/reconciliations.ts#L79-L82`). Both sum the same immutable field: a request's `total` is
written once at issue (`bff/src/orders.ts#L349`, `#L360`) and every later write to a request
spreads the record (`#L389`, `#L493`, `#L522`), so no write moves it. The set is pinned by
`sameIds` (`bff/src/reconciliations.ts#L92-L103`). The sums therefore agree — and **nothing asserts
that they do**, which is case 5 below.

## The cases

| # | The case: one behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | A close whose write reaches c-storage after another close landed under the same key is a 409, and the record stays the first close's | BFF route, `reconciliations.route.test.ts` |
| 2 | A person who may edit orders, whose own staff record goes between their sign-in and the close, is a 401, and the day's requests are left as they were | BFF route, same file |
| 3 | The root still closes with no id and no code, its sign-in name standing in | BFF route, existing case at `#L159` kept green |
| 4 | A person closes and the record names that person's id, code and name | BFF route, existing case at `#L122` kept green |
| 5 | The sum the page builds for a driver's day and the sum the stored close holds are the same number | BFF route, same file |
| 6 | No doc still names item 36 finding 5, or item 41 findings 2 and 7, as open | count, `git grep -c` |

## The steps

- [x] **1. The closer is read before the first write, and a person who is gone is a 401.** Move the
  `readEmployee` of `bff/src/reconciliations.ts#L128-L130` above the cancel loop at `#L109`; the
  root keeps the no-id branch, and anyone else whose record cannot be read throws
  `HttpError(401, 'Unauthorized')`, the wording `bff/src/app.ts#L83` already uses. Cases 2, 3, 4. There is no fake
  step and no screen step: this slice draws nothing new, so its cheap end to end is the route
  through the real c-storage the route tests already start.
  *Done when:* `pnpm --filter @credo/bff test reconciliations` exits 0, case 2's assertion having
  been seen red against the old order of the reads. **Size 14.**
  *Done 2026-11-08:* the read sits just above the cancel loop; case 2 (person's record removed as the
  close looks for the day) is 401 with the waiting request untouched and no closed day. Seen red
  twice, each restore verified with `cmp`: the old file gives 200 for 401, and the new order with
  the `throw` dropped gives 200 for 401. Gate of `bff`, last line of
  `logs/20261108-120230-money-defects-step1-bff-gate.log`: `== exit 0 (typecheck 0 eslint 0
  prettier 0 test 0 knip 0)`, 587 tests. A first whole run
  (`logs/20261108-120141-money-defects-step1-bff-gate.log`, exit 1) timed out one case in
  `clients-delete.route.test.ts`, a file this step cannot reach, and is recorded as a red; the rerun
  was green. 41.7 is closed by this step; the item's prose is deleted in step 6.
- [ ] **2. The precondition is held by a check that reddens when it goes.** A `flaky` mode beside
  `'theirs'` (`reconciliations.route.test.ts#L29-L48`) that lands another close under the key and
  then lets ours through to c-storage with its own `null`; case 1 expects 409 and the first
  close's cash. *Done when:* the case is green, and red with the `null` at
  `bff/src/reconciliations.ts#L41` removed — both runs quoted in the recap. **Size 14.**
- [ ] **3. The two sums are proved one number.** Case 5: over a day with two delivered requests
  and one waiting, assert `driverDay(await requests(), driver).toCollect` equals the stored
  close's `toCollect`, and the typed gap equals the stored `difference`. *Done when:*
  `pnpm --filter @credo/bff test reconciliations` exits 0 with 17 cases. **Size 8.**
- [ ] **4. The whole check, and 100 % on the file.** `pnpm check`'s five steps, each exit 0, under
  the shared `mkdir` lock; `bff/vitest.config.ts#L21`'s four thresholds already demand 100 %.
  *Done when:* the five exit codes and the lock's times are in the recap. **Size 15.**
- [ ] **5. Another model reads the close path.** QA rule 5, on the diff alone; each finding fixed,
  rejected or deferred with its reason. *Done when:* every finding has one of the three, each with
  its line. **Size 8.**
- [ ] **6. The prose the slice makes false.** Delete item 36's finding 5 and its trigger clause,
  and item 41's findings 2 and 7, from `docs/open-items.md`; correct
  `docs/client-readiness.md#L393-L408` and `#L480-L483` — finding 5 done, the precondition present
  but now also held, the closer fixed — and write the recap and its `docs/products.md` row.
  *Done when:* `git grep -c 'finding 5' docs/client-readiness.md` reads 0 and case 6's grep is
  clean. **Size 12.**

Total **71 machine minutes**.

## The human's point

**One, and it is a null proof.** After step 4, the picture run: the walks page should show **no
screen moved at all** — every byte comparison 0 against the bases — and the driver's-day Closed
card reading exactly as it read before, with the code and the name of whoever closed it. This
piece changes what the office *collects*, never what it *looks at*, so a green here reads
backwards: it is right only because nothing moved. A yes says the money fix touched no screen and
the slice can merge. A no means a screen moved that this plan says cannot, and step 1 is reopened
before anything else.
