# Part B1 of the operator console: the operators, listed and added, recap, 2026-11-03

## At a glance

[The plan](../plans/2026-11-03-console-operators.md), steps 1 to 7 are done on `console-operators`. An operator now sees
everyone who may sign in and adds one by a name with a touch of their own passkey; the join link is shown once. Cost:
$0 a month. Left to the human: the look at the first walk, and the push.

## What shipped

- The page `/operator/operators` and its create page, in vi and en, on the fake first; two routes in
  `bff/src/routes/operator-team.ts` on the real c-storage.
- The account gains `signedInAt`, written by sign-in and join alone, so "last sign-in" is read from one place.
- The walk `operator-team`: 24 new bases, committed as `8337d81`; the operator and passkeys walks moved none.

## Rejected, and the price

- Reading the passkey's `lastUsedAt` for "last sign-in": every touch, the create's included, moves it. Cost: one field.
- Writing the sign-in onto the roster's line: every sign-in would write the roster. Cost: the same one field.
- Changing the shared passkeys data set: it would move the operator walk's bases. Cost: a second operator beside it.
- Not fixed in B1, five Lows from the review: items 65 to 68 go to B2, item 69 is below.

## Evidence

- Step 1, the plan: `d3da85d`. Step 2, the page on the fake: `eb428d6`; `logs/20261103-1422-b1-step2-check2.log`
  `== exit 0`; the walks page build `walks/2026-11-03-142005-eb428d6ab`, 104 screens.
- Step 3, the routes: `5bae528`; red first `logs/20261103-1427-b1-step3-red.log` (12 failed); green
  `logs/20261103-1450-b1-step3-check5.log` `== exit 0`; live read `logs/20261103-1437-b1-step3-live.log` `== exit 0`.
- Step 4, the gate: `9ad03c7`. First run `logs/20261103-1442-b1-step4-gate.log` `== exit 1` (item 56's two ui flakes, load
  21 to 29); rerun `logs/20261103-1446-b1-step4-gate2.log` `== exit 0`.
- Step 5, the review: `cf59b0a`, Opus at `5bae528`: no High, no Medium, five Lows.
- Step 6, the full run in the human's terminal, 12.5 minutes: run 1 wrote 24 bases and moved none of operator's 54 or
  passkeys' 36; run 2 read every count 0; fake, stack and stack again 6 of 6 for each walk in both
  (`logs/20261103-1453-b1-full-run.log`, `logs/20261103-1501-walk-operator-passkeys-team.log`,
  `logs/20261103-1508-walk-operator-passkeys-team.log`; read whole, no warning, error or secret).

## What remains the human's

- **The look,** 👤 1: the walk "Who else may sign in here", screens 1, 2, 3 and 6. It gates the push alone. A no reopens
  the screen as a case.
- **The push,** when the human calls for it.
- **Hazards, open items 65 to 69,** all Low:
  - 65 to 68 (B2): a timeout may hide a landed write; a race test; Unicode names; the command line's name compare.
  - **69:** a BFF rolled back past B1 cannot read the accounts B1 writes (`signedInAt`, the strict schema,
    `shared/src/records.ts#L125`) and answers 503 to those operators. A rollback past B1 must wait for a fix.

## Next

B2: a new link for a lost passkey, and the delete; it also closes items 65 to 68.
