# Test clients flagged, and one press in the console to clear them

## At a glance

Piece 77.2. A test client (the deploy check's, or one made with `ridge tenant --test`) carries a flag set at creation. The
operator's Clients page shows it as a badge and, when any flagged client is listed, offers one press that deletes them all
after one passkey touch, naming the count and the codes first. It replaces deleting test clients one touch at a time. The
human sees the Clients page and the delete-client walk. It follows piece 77.1, the deploy's own sweep of stale check
clients; this one is for clients made by hand.

The cheapest safe path is the delete-client route and page, copied (`bff/src/routes/clients-delete.ts`,
`ui/src/DeleteClientPage.tsx`), with one new act. **Price:** no infrastructure, $0 a month; about 65 machine minutes and
one picture run.

**The design finding this plan rests on: a batch cannot be done through the existing route.** `confirmed()` opens the
challenge as `confirm-${act}` for the operator (`bff/src/routes/operator-auth.ts#L266-L274`), which binds purpose, subject and
five minutes (`bff/src/calling/challenge.ts#L34-L49`), and `spendTouch` refuses a second use of the same challenge
(`#L222`, hash at `#L246-L250`), **so client 2's delete would 403.** Today's multi-press delete passes only because
`clients-delete.ts#L48-L51` skips `confirmed` once the index is gone. **The narrowest safe batch:** a new act and purpose, so
a `delete-client` touch cannot be replayed here or the reverse, and the route recomputes the flagged set and refuses 409
unless it equals the codes the operator confirmed in the body. That comparison, not the challenge, pins the touch to the
batch shown, so a client flagged inside the window cannot ride along.

**Partial sweep.** Each press clears one client's bounded step (`deleteClient`, `DELETE_BOUND = 200`,
`bff/src/records/clients.ts#L112-L114`) and answers `{ remaining, left }`; the page loops as `DeleteClientPage#L49-L52` does.
Three of five cleared reads as three gone, two still listed and still flagged, the sweep record naming them, and the press
reading "continue (2 left)". **The 10-second function timeout (`ops/env.yml#L223`) is why no press may loop over clients
server-side.**

**The create question.** `edge_reads` (`ops/lib.sh#L828-L862`) spends the client on the app's page at its own link
(`#L832`), `/api/config` returning **that client's own name out of services/c-storage** twice with no cache in front (`#L835-L840`),
and the full `sign-in → me → sign-out → 401` cycle through the edge **using the password the create returned**
(`#L841-L851`). The client-free assertions (an unknown code's 404, a missing code's 400, the operator door's 401, the
relying-party check, `/api/health`'s 404) already run beside them (`#L853-L862`). So dropping the create keeps the liveness
checks and loses the round-trip and the whole auth cycle.

## The slice

Make a flagged client (`pnpm fake` has one), see the badge, press, confirm, see them gone. Gate line: no package here has a
`check` script, only the root does (`package.json#L10`), so a package's five steps are `pnpm --filter <pkg> run typecheck`,
`pnpm exec eslint .`, `pnpm exec prettier --check .`, `pnpm --filter <pkg> run test`, `pnpm exec knip`. `walk` has no `test`
script at all; its proof is `walk/run.sh delete-client`.

## The steps

- [ ] **1. The flag on the record, in the list reply and in the list, 15 min.** `storedClientSchema`
  (`shared/src/records.ts#L85-L89`, a `z.strictObject` where `madeAt` is already optional, so **an optional `test` reads as
  absent on every existing record and no migration is needed**) and `clientListItemSchema` (`shared/src/wire.ts#L195-L200`).
  `createClient` takes `test?: true`. **The console route passes none and `createClientRequestSchema`
  (`shared/src/wire.ts#L174-L179`) is untouched: this absence is what enforces "set at creation only", because the console
  route spreads its body straight into `createClient` (`bff/src/app.ts#L381-L382`).** `ridge tenant --test` and `check.sh`'s
  create pass it. A fourth, flagged demo client in `shared/src/demo.ts#L112-L116`, with the counts at
  `shared/src/demo.test.ts#L97`, `scripts/src/dashboard-list.test.ts#L55`, `ui/src/fake.test.tsx#L843`, the seed loop at
  `scripts/src/generator.ts#L466-L470` and the fake's map at `ui/src/fake.ts#L291-L292`. A badge at
  `ui/src/ClientsPage.tsx#L44-L48` with words in `ui/src/i18n/en.ts` and `vi.ts`. *Done when:* the five steps for shared,
  bff, ui and scripts; `pnpm fake` shows the badge.
- [ ] **2. The clear route and its one touch, 18 min.** The new act and purpose, one line each at
  `shared/src/wire.ts#L330-L338` and `bff/src/calling/challenge.ts#L5-L15`; `recordKeys.clientSweep` (`client-sweep`, which **does
  not** start with `clientPrefix = 'client.'`, the trick `client-deletion.` already uses, pinned at
  `shared/src/records.test.ts#L33-L34`) and its schema; a route beside `registerDeleteClientRoutes`
  (`bff/src/routes/clients-delete.ts#L36`) **keeping the same check order: session, body, the flagged-set comparison, the touch,
  then the write**; the fake's `clearTestClients`. *Done when:* the five steps for shared, bff, ui, **each new case seen red
  once (QA rule 2)**.
- [ ] **3. The press and its loop in the console, on the fake, 12 min.** **Inside `Loaded`, and only when a flagged client is
  listed**; the confirmation names the count and the codes; the loop and the "continue (N left)" resume. *Done when:* the
  five `@credo/ui` steps; `pnpm fake` walks the press.
- [ ] **4. Screens 5, 6 and 7 appended to the delete-client walk, 12 min.**
  `walk/specs/operator-delete-client.spec.ts` (its docstring's 4×2×3 and the test name), `visual/src/walks.ts#L1979-L2043`,
  `visual/src/walks.test.ts#L393-L420`, `DELETE_PROOF` at `visual/src/words.test.tsx#L413-L421`. **Append, because
  `visual/src/words.test.tsx` slices `WALKS` by index (`#L305,323,344,375,426,446,467`) and `operator-delete-client` is last
  at index 14 (`visual/src/walks.ts#L1972`), so nothing renumbers and no new spec needs wiring** (`walk/playwright.config.ts`
  projects, the chromium `testIgnore` array pinned at `visual/src/walks.test.ts#L595-L610`, `walk/run.sh#L57`'s table).
  *Done when:* the five visual and walk steps, `walk/run.sh delete-client`, and **a grep count of 0 moved base pictures
  outside `op-5-dashboard` and `dc-4-gone`**.
- [ ] **5. The whole check, the review, the recap, 10 min.** The root `pnpm check` once, one cross-model review with each
  finding tagged, `docs/recaps/2026-11-07-clear-test-clients-press.md` and its `docs/products.md` row.

**What moves and what must not.** **`op-5-dashboard` (`visual/src/walks.ts#L495`) and `dc-4-gone` (`#L2028`) move
deliberately**, both drawing the Clients table, which gains a flag badge and a fourth demo client. **`op-7-list-failed`
(`#L519`, cue `listClients:503`, no table) must come back byte-identical, which is why the press lives inside `Loaded`**, and
so must every non-operator walk.

## The human's points

- **(a) One passkey touch for the whole batch.** A touch today is already bound to the operator and the act for five
  minutes, not to a client, and already covers one client's whole deletion across several presses. A yes means one touch for
  the batch shown; a no means one touch per client, which is the chore the ask is about. **Recommend yes.**
- **(b) The check keeps making a fresh client each deploy.** A yes keeps the c-storage round-trip and the whole sign-in
  cycle in every deploy. A no loses both, or buys a permanent root password in every environment's secrets. **Recommend yes.**
- **(c) The look: the flag as a badge, and two existing screens change** (`op-5-dashboard`, `dc-4-gone`), plus three new
  screens in the delete walk. A yes accepts the new base pictures; a no leaves state only the database knows, and reopens the
  piece. **Recommend yes.**

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A record without `test` parses as unflagged; one with `test: true` parses as flagged and is listed so | `shared/src/records.test.ts`; red first |
| 2 | The console's create refuses a `test` field and stores none | BFF route test; red first |
| 3 | `ridge tenant --test` and the check's create store the flag | `scripts/src/ridge.test.ts`; red first |
| 4 | The clear route refuses without a session, with a bad body, and with codes that differ from the flagged set (409), writing nothing | BFF route test; red first |
| 5 | A `delete-client` touch is refused by the clear route, and the reverse | BFF route test; red first |
| 6 | One press clears one client's bounded step and answers `{ remaining, left }`; three of five leaves two flagged and named | BFF route test; red first |
| 7 | A client flagged after the operator confirmed is not deleted: 409 | BFF route test; red first |
| 8 | The press shows only when a flagged client is listed, names the count and codes, loops, and offers "continue (N left)" | `ui/src/ClientsPage.test.tsx`; red first |
| 9 | The badge and every new word read in both languages | `visual/src/words.test.tsx` |
| 10 | Screens 5 to 7 are drawn; only `op-5-dashboard` and `dc-4-gone` moved, `op-7-list-failed` byte-identical | `visual/src/walks.test.ts`; the grep count; `walk/run.sh delete-client` |
