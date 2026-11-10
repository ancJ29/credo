# Clearing stranded check clients: the sweep in the deploy

## At a glance

Piece 77.1. The deploy's check makes a fresh client each run and deletes it at the end (`ops/check.sh#L44`). When that
delete fails, or the run dies first, the client stays and shows in the operator's Clients list until someone deletes it
by hand (open item 117, `docs/open-items.md#L744-L746`, whose trigger this piece meets). The fix: each deploy, before
its own create, deletes every check client older than two hours. Nobody sees a screen; the operator's list simply stops
growing. **No human look.**

The cheapest safe path is what exists. **`listClients(storage)` already exists** (`bff/src/records/clients.ts#L93-L110`) and
`scripts/src/ridge.ts` already imports from that module, so this adds **a command, not a capability**. The deletion is
`untenant`'s, copied (`scripts/src/ridge.ts#L126-L160`). **Price:** no infrastructure, $0 a month; about 25 machine minutes.

## The slice

`ops/check.sh` calls `ridge_cli clear-checks`, which lists the clients, keeps those whose code is a check code older than
`CHECK_AGE_HOURS`, deletes each as `untenant` does, and prints a line per client. Walkable as: invented stale and recent
records over `memoryCStorage`, then the script's lint and test. No bare `list` command is added: knip would flag an unused one.

**The age.** `.github/workflows/ci.yml#L314` caps the check step at `timeout-minutes: 8`, so a live check client's
lifetime is hard-bounded at 8 minutes; two hours is fifteen times that. **Too short is the dangerous direction**: at ten
minutes a concurrent deploy of the same environment would lose its own client mid-check, its `edge_reads` sign-in would
fail, and an unrelated run would go red. Too long is cosmetic only.

**Where it lives and its guard.** `ops/tunnel.sh#L31-L36`, `ops/root-password.sh#L79` and `ops/seed.sh#L36` refuse a
non-ridge **environment**, because they would land another stack's admin keys on a person's disk. The sweep does not cross
that gate: it opens no tunnel, holds no keys of its own, and runs inside the tunnel `check.sh` already opened, only where
the workflow already holds that environment's keys. **Its guard is `CHECK_CODE`** (`scripts/src/ridge.ts#L33`): the selector
is the regex, so no code an operator has typed enters the sweep (nothing reserves the `check-` shape, so a client deliberately named `check-20260101t000000z` would).

## The steps

Gate line for `scripts`: no package here has a `check` script, only the root does (`package.json#L10`), so a package's five
steps are `pnpm --filter @credo/scripts run typecheck`, `pnpm exec eslint .`, `pnpm exec prettier --check .`,
`pnpm --filter @credo/scripts run test`, `pnpm exec knip`.

- [x] **1. The sweep in `ridge`, on invented records, 12 min.** Beside `CHECK_CODE`: a reader of the stamp out of the code,
  `CHECK_AGE_HOURS = 2`, and a `clear-checks` command calling `listClients`, keeping only `CHECK_CODE` matches older than the
  age, deleting each by `deleteClient` as `untenant` does (`#L135-L160`, **the nil-uuid `by` at `#L142` included**), printing
  a line per client, exiting 1 if any failed. `USAGE` (`#L35-L36`) and the module docstring (`#L37-L50`) are updated.
  *Done when:* `pnpm --filter @credo/scripts run test` exits 0 with new `ridge.test.ts` cases over `memoryCStorage` and a
  fixed `io.now`, rows 1 to 5 below, coverage 100 % (`scripts/vitest.config.ts#L46`); the five steps pass.
  *Done 2026-11-09:* rows 1 to 5 red on the old `ridge.ts`, rows 2 to 4 each shown red by a named mutation of the new code
  and reverted; the five steps exit 0, last line `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0 knip 0)`, 314 tests,
  `logs/20261109-0908-scripts-gate-clear-test-clients.log`. The deletion is one shared helper, `untenant` calling it too.
- [x] **2. `ops/check.sh` runs it, 8 min.** One `ridge_cli clear-checks` after `bff_env_read` and before the create
  (`ops/check.sh#L161-L169`), **inside the tunnel that block already opened**, warning on failure like `#L44` rather than
  reddening the run. **Closes `docs/open-items.md` item 117**; the entry is deleted. *Done when:*
  `shellcheck -x ops/*.sh walk/*.sh` and `bash ops/test.sh` exit 0, plus the `scripts` five steps.
  *Done 2026-11-09:* the sweep is an `if` that prints `WARN` on failure; two `ops/test.sh` lines pin its place and its warning;
  item 117 deleted. Last line `== exit 0 (shellcheck 0 ops-test 0 typecheck 0 eslint 0 prettier 0 test 0 knip 0)`,
  `logs/20261109-0913-ops-gate-clear-test-clients.log`.
- [x] **3. The whole check, the review, the recap, 5 min.** The root `pnpm check` once; one cross-model review, each finding
  tagged; `docs/recaps/2026-11-07-clear-test-clients-sweep.md` with its `docs/products.md` row. *Done when:* `pnpm check`
  exits 0 and the tree is clean.
  *Done 2026-11-09 (the whole check and the recap; the cross-model review was read apart from this tick):* `== exit 0 (typecheck 0 eslint 0 prettier 0 test 0 knip 0)`, `logs/20261109-0920-root-check-clear-test-clients.log`; recap `docs/recaps/2026-11-09-clear-test-clients-sweep.md`; no products row owed.

## Decided here, open to a veto

Neither of these is a question: both are choices about how the machine works, so they are decided here with their reasons.
The human is asked nothing in this piece.

- **Two hours as the age.** The deploy deletes check clients older than two hours, since a live client lives 8 minutes at
  most. A shorter age risks reddening a concurrent deploy that loses its own client mid-check; a longer one means a
  stranded client waits for the next deploy.
- **A failed sweep warns and does not redden the deploy**, as the existing cleanup does (`ops/check.sh#L44`). It is not a
  change. Making the deploy red for a stale record would let housekeeping fail a good deploy; the cost of the warning is that
  a stranded client is announced only in the log, which is item 117 as written.

## The case table

| # | The case | Held by |
| --- | --- | --- |
| 1 | A check client older than the age is deleted whole, and a line names it | `scripts/src/ridge.test.ts`; red first |
| 2 | A check client younger than the age is left, with all its records | same file; red first |
| 3 | A real client's code (not `CHECK_CODE`) is never selected, however old | same file; red first |
| 4 | A code with a malformed stamp is left | same file; red first |
| 5 | A delete that fails is reported, the rest still run, and the exit is 1 | same file; red first |
| 6 | The script passes lint and its test; the sweep sits inside the existing tunnel and warns on failure | `shellcheck -x ops/*.sh walk/*.sh`; `bash ops/test.sh` |
