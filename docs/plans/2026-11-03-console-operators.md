# B1 of the operator console: the operators, listed and added

## At a glance

An operator opens **Operators** in the console's menu and sees everyone who may sign in: name, invited or active, who
added them and when ("—" once that one is deleted), passkeys held, last sign-in, themselves marked "you". They add a
colleague by a name with one touch of their own passkey, and copy the join link, shown once, to send; the colleague
joins on A's join page. Only operators see it.

The cheapest path is what `main` holds: `createOperator` (`bff/src/operators.ts#L108`), A's join
(`bff/src/operator-auth.ts#L296`), the touch `confirmed` (`#L263`), D's route as the model
(`bff/src/root-password.ts#L34`). **Price:** $0 a month; about 96 machine minutes and 20 of the human's (D took 103).
**Next:** B2, a new link for a lost passkey and the delete, planned once B1 is in `main`.

## The slice

The page `/operator/operators` in place of "coming soon" (`ui/src/operatorNav.ts#L22-L24`) and its create page, on two
routes in a new `bff/src/operator-team.ts`:

- `GET /api/operator/operators`: the roster's lines (`shared/src/records.ts#L91-L98`) with each account's passkey count
  and last sign-in; the adder as a name, or null with `addedByTerminal`, as the join answers it
  (`bff/src/operator-auth.ts#L302-L308`).
- `POST /api/operator/operators`: `{ name, confirm }`, the touch for a new act `add-operator`
  (`shared/src/wire.ts#L307`), then `createOperator`; `{ id, link }` once, or a 409.
- **Last sign-in (F5):** every touch, the create's included, moves a passkey's `lastUsedAt`
  (`bff/src/operator-auth.ts#L244`), so the list never reads it. The account (`shared/src/records.ts#L119`) gains
  `signedInAt`, defaulting to null ("—"), written by the sign-in (`bff/src/operator-auth.ts#L279`) and the join
  (`#L324`) alone. *Rejected:* the roster's line, which every sign-in would then write (console plan `#L339`).
- **The data set:** a second active operator, added by one since deleted, with passkeys of their own;
  `DEMO_PASSKEYS` (`shared/src/demo.ts#L48`) untouched: its first id (`#L52`) moves the operator walk's bases. The invited
  operator, made with the stack's own clock (`scripts/src/generator.ts#L386-L390`), is made at a fixed time, then relinked by
  `makeLink` (`bff/src/operators.ts#L64`), since its first link ends a day after that time (`#L115`).
- **Chrome only:** Safari stays parked (`docs/open-items.md#L197`).

## The case table

Rows 1 to 4 are business rows, each red first from its assertion; every package at 100 %.

| # | The case | Held by |
| --- | --- | --- |
| 1 | The list shows every operator: name, state, adder ("—" once deleted, "the command line" for the terminal's) and when, passkeys, last sign-in; "you" marked; no client's data read | BFF route, `operator-team.route.test.ts`; unit, ui; the walk |
| 2 | Any operator creates one by a name with a fresh touch; the link shown once with a copy button; no mail; invited until they join | BFF route; unit, ui; the walk |
| 3 | A name already there, compared trimmed and without case, is refused and says so; what was typed kept | BFF route; unit, ui; the walk |
| 4 | The last sign-in moves at a sign-in or a join, never at a touch; an account written before it reads "—" | BFF route; unit, shared |
| 5 | A live session, else 401; a name of 1 to 60 characters, else 400; a touch for `add-operator` by this operator, else 403, nothing written; the route list exact | BFF route; unit, shared |
| 6 | The link is in the create's answer alone, never a log line | BFF route, the log searched |
| 7 | A 401 opens A's prompt, the name kept; only `NotAllowedError` reads "not given" | unit, ui |
| 8 | The fake's calls parse under the shared schemas, a cue's 401, 403, 409 or 503 once; the scenes equal the spec's and the walks page's, each with its Vietnamese question; vi and en at 1280, 768, 390 | unit, ui, visual; the walk |

The roster's race is held already (`bff/src/operator-passkeys.route.test.ts#L1062`).

## Steps

D's ceremony, since B decides who may sign in: the fake first, one review, the full run.

- [x] **1. This plan.** 🤖 Opus, 12 minutes (this kind: 12, 8). Done when: committed, `wc -w` about 1,000, the path grep empty.
- [ ] **2. The page on the fake.** 🤖 Sonnet, about 25 minutes (D's two builds: 53). The wire, the data set, both
  pages, the words, `createApi` and the fake, four scenes, `walk/specs/operator-team.spec.ts`'s `team-fake`, the
  `walk/run.sh` row. *Models:* `ui/src/RootPasswordPage.tsx`, `ClientMade.tsx`. Done when: rows 1 to 3's UI halves red
  once; touched packages at 100 %, lint clean; `pnpm report` builds the four screens. Then 👤 1, while step 3 goes on.
  *Ready for the human's look* (2026-11-03): `main` taken in (`f7719f5`, docs only); typecheck, eslint, prettier, the
  shared, ui, visual and scripts tests at 100 % and knip, `== exit 0` in one run; the walks page built from `eb428d6`
  with a clean tree: 104 screens and 208 captures (100 and 200 before), the four new ones in vi and en (`tm-1-list`,
  `tm-2-name`, `tm-3-added`, `tm-6-taken`, numbered 1, 2, 3 and 6, each with its Vietnamese question). The preview is
  `ops/walks-preview.sh` on that folder (its refusals and `bash -n` run; the deploy is the human's). *Not done:* the
  new UI tests were written with the pages, then seen red once by taking the two routes out (16 failed); the walk
  specs are typechecked, never run (step 6). `team-full` has the same screens opened on a stack, not yet shown to
  match: step 3. The BFF gained one line, the touch's purpose `confirm-add-operator` in its type, since the act is in
  the wire. A first run of the scripts tests missed 100 % at `scripts/src/processes.ts#L83` (a rerun, with the BFF
  type fixed, passed): logged in `docs/open-items.md#L517`.
- [ ] **3. The routes on the real c-storage.** 🤖 Sonnet, about 28 minutes: the routes, `signedInAt`, the act, the
  generator; `team-full` written, not run. Done when: rows 1 to 4's BFF halves red once; bff at 100 %; live, in one
  `pnpm stack -- <command>`: three operators listed; a create touched by `CREDO_OPERATOR_PASSKEY` 201, its link's join
  options naming the new one, listed invited, the creator's last sign-in unmoved; the name in capitals 409; no touch
  403; no handle 401.
- [ ] **4. The gate.** 🤖, about 17 minutes (D's): `main` taken in if moved; the whole `pnpm check` under the lock,
  `== exit 0`.
- [ ] **5. One review.** 🤖 Opus, about 7 minutes (D's): what the touch is tied to; what a failure claims after a
  timeout. Done when: each finding `[FIXED]`, `[REJECTED]` or `[DEFERRED]` here.
- [ ] **6. The full run** (👤 2), about 12 minutes (D's two walks: 8.5); 🤖 reads each log whole. Done when: both green;
  the first adds 24 bases, `operator` and `passkeys` moving none; the second every count 0; the bases committed.
- [ ] **7. The recap.** 🤖, about 7 minutes (what D's last 38 left), half a page. Done when: committed, `wc -w` under 400; then the squash.

Ridge waits for B2 (console plan step 26).

## The human's points

👤 **1. The look, after step 2.** The walks page shows **"operator-team: who else may sign in here"**: 1 "The
operators: name, state, added by whom ("—" once that one is deleted) and when, passkeys, last sign-in; you marked"; 2
"Creating an operator: a name"; 3 "Added: the join link, once, to send"; 6 "The name taken"; in vi and en. One yes or
no a screen; a no becomes a case, fixed before step 6. The work goes on meanwhile; only the push waits for the yes.

👤 **2. The full run, step 6.** Two commands in the human's terminal, nothing else running (no browser starts in the
sandbox): `bash walk/run.sh operator passkeys team --write`, then without `--write` (`team`, as
`walk/run.sh#L45-L48` names walks). The two others prove the new data set moved none of their screens. Green starts the
recap; a red names each moved screen, and the machine finds why before any base is written.
