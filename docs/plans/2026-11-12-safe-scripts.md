# Every terminal script safe on production, or refusing it

## At a glance

**The premise holds; the size does not.** Nine scripts can reach a credo environment, all in
`ops/`. Three already refuse all but ridge. Four more are safe on production as they are. The crash
drill must refuse, and the check must only read there. One landing, about 50 minutes, not "hours
each".

| What happens | Where it is held |
| --- | --- |
| Each script says first what it does on production: refuses, or why it is safe | two helpers in `ops/lib.sh` |
| Production is every environment not listed as invented, today all but ridge | one line there |
| The drill refuses; the check only reads | `ops/drill.sh`, `ops/check.sh` |
| Another lane's new script calls a helper, or turns red | `ops/test.sh` |

The cheapest safe path: the three refusals become the helper, the drill gets one line, the check a
mode it half has. Two acts of yours on ridge (👤).

## The slice

One slice, walkable when it ends: on ridge, `ops/check.sh ridge --reads-only` ends `== green`.
It makes no client, runs no collection and copies no key off the box. The same push's deploy
runs the full check on ridge unchanged. And `bash ops/test.sh` shows each of the nine scripts'
answer on an environment not listed.

## What "production" means to a script

A script knows an environment only by its name. `ops/stack.sh env <name>` makes a stack called
`<name>` (`ops/stack.sh#L68-L69`), sets its `Env` parameter to that name (`#L165`) and makes a
GitHub environment with the same name (`#L294`). Every script works in whatever AWS session the
terminal holds, in one fixed Region (`ops/lib.sh#L11`). None reads a profile or an account. So the
name is the one thing a script can check.

**Decided:** `ops/lib.sh` lists the environments that hold invented data alone, today `ridge`.
Every other name may hold a real company's records and is treated as production. That covers the
production stack, whatever its plan calls it, and a taiga or a crest until someone lists it
(`docs/plans/2026-10-28-ridge.md#L83-L84`). It also covers the network and GitHub stacks, which sit
under every environment, production's included. The one thing the production plan must not do is
name its stack `ridge`.
*Rejected:* a stack parameter or tag marking real data. It needs an AWS read before the refusal,
and a change to the production lane's template. A stack made without it would read as invented,
which fails open. *Rejected:* checking for the production name itself. That name is not chosen
yet, and every unknown name would pass as invented. *Rejected:* an AWS profile or account check.
No script reads one, and production may share ridge's account.

## The list, measured

Every script in the repository that a person runs was read. Only twelve act outside this Mac. The
rest are local only, and need no guard: the gate, the full run, `walk/run.sh`, the `pnpm` commands
of `scripts/` and the two services' scripts.

| Script | What it does to an environment | Reaches production today | Refuses it today | After this piece |
| --- | --- | --- | --- | --- |
| `ops/stack.sh` | makes or changes a stack by change set; refuses a removal or replacement unless named (`#L228-L240`) | yes | no | **works**, as it is: the change-set fence |
| `ops/release.sh` | ships the store's binary and restarts it; main's commits alone (`#L42`), never backwards (`#L67`), above the box's floor (`#L74-L75`) | yes | no | **works**, as it is |
| `ops/app.sh` | ships the back end and the screens; main alone (`#L47`), never backwards (`#L91`) | yes | no | **works**, as it is |
| `ops/operator.sh` | makes an operator, or gives a new-passkey link; refuses GitHub's job (`#L28`) | yes | no | **works**: production's first operator comes from it |
| `ops/check.sh` | reads AWS and the box; copies the store's two keys into a Bruno file (`#L114-L120`); runs the collection, which registers a service each run (`#L122`); sweeps old check clients and makes one (`#L165-L178`) | yes | no | **works, reads only**: no key off the box, no collection, no client |
| `ops/drill.sh` | kills the store (`#L56`), registers a code (`#L69-L70`), reboots the box (`#L74`) | yes | no | **refuses** |
| `ops/tunnel.sh` | holds the store open to this Mac with its keys | no | yes (`#L35-L36`) | refuses, through the helper |
| `ops/seed.sh` | writes demo days into the demo copies | no | yes (`#L38`) | refuses, through the helper |
| `ops/root-password.sh` | sets a demo copy's root password | no | yes (`#L79`) | refuses, through the helper |
| `ops/walks-preview.sh`, `ops/pages-preview.sh` | send a folder to Cloudflare Pages as a preview | not credo's | their own production branch (`ops/walks-preview.sh#L3-L4`) | unchanged |
| `ops/legacy-capture.sh` | opens the legacy app's screens and saves nothing (`#L6`) | not credo's | no; it writes nothing | unchanged |

Two meanings of "production" live here already: the Pages scripts' word means the walks page's
production deploy, which they refuse. This piece is about credo's environment. No workflow can
reach production today. The deploy and the seed name ridge (`.github/workflows/ci.yml#L302`,
`#L311`, `#L315`; `seed.yml#L84`), and `ops/test.sh`'s guards hold that (`environment: ridge`,
`ops/test.sh#L807`).

The cut's "hours each" is quoted from `docs/client-readiness.md#L285-L287`. That line names three
things: the check's mode, the drill's refusal and a terminal path to a client's root password. The
third is a missing tool, not a guard. `ops/root-password.sh` already refuses production, so it
stays with open item 132.

## How each part is decided

- **Two helpers, one predicate.** `refuse_real <env> <why>` dies with the script's own words unless
  the name is listed. `real_ok <env> <why>` prints, on a real environment, one `ok` line saying why
  the script is safe there, and sets `REAL=1` for a script that branches on it. Each call goes after
  `log_start`, so a refusal lands in the log, and before `main_synced`, so it comes before any AWS
  call. The three refusals that exist keep their messages word for word, so their tests in
  `ops/test.sh` stay as they are. *Rejected:* the stance inside `main_synced`, behind a variable
  each script sets. A forgotten variable reads as nothing, where a forgotten call reads red in the
  test.
- **The test over the nine.** Every `ops/*.sh` that calls `main_synced` (9 of 9 today,
  `ops/CLAUDE.md#L23`) calls exactly one of the two, on a line between its `log_start` and its
  `main_synced`. A script written later by any lane meets the same test.
- **The scripts' code is the reviewed tree's on production.** On a real environment `real_ok`
  refuses the two test switches the scripts read from the environment, `RIDGE_SCRIPTS_DIR` and
  `OPS_TEST_NO_TTY`, unless the tests' own marker is set beside them (the tests export the first,
  `ops/test.sh#L1595`). That closes open items 143 and 55 for production. On ridge they keep their
  own triggers. Item 142, the install against the lock, stays its own: it guards the machine's
  install, not the environment.
- **The check on production reads only.** It skips the box's keys, the Bruno file, the collection
  and its Bruno version check. It also skips the back end's keys, the sweep and the check's client.
  It keeps every AWS read, the box's facts, `/health`, layer four's reads and the commit agreement.
  `edge_reads` (`ops/lib.sh#L859`) splits in two. The first part is its six reads that need no
  client (`#L865-L866`, `#L884-L895`): an unknown code, a missing one, the operator's door, the sign-in options,
  `/api/health`, `/health`. None writes, since the options' challenge "is signed, not stored"
  (`bff/src/routes/operator-auth.ts#L73`). Ridge runs both parts; production runs the first.
  `--reads-only` gives ridge the production run, so it is rehearsed where every rehearsal goes
  first. The flag can only narrow. *Price:* production's check shows no save. A save is proved on
  ridge, on the same commit, first. This closes open item 131. *Rejected:* refusing the check on
  production, its other fix. The production lane needs a check after each deploy.
- **The drill refuses production for good**, even on a new box with no company yet. The template
  and the unit are the ones ridge runs. A production box's own boot is read by the release's
  `/health` and the check. Your first point.
- **The four that work stay as they are.** Each reason names the guard already there. For the
  network and GitHub stacks, `stack.sh`'s reason adds that they sit under every environment,
  production's included.

## Scripts other lanes add

A new script meets this rule in one of two ways. Its author calls one helper. Or, if it lands
before this piece, this piece's step 1 adds the line, since the test goes red without it. Either
way each script has exactly one call. The script's own behaviour on production stays its lane's.

| Script | Lane | Its answer on production | Who writes the line |
| --- | --- | --- | --- |
| `ops/restore.sh` | the continuous copy | works: a new file by default, the live path only when named | its author if it lands second, else this step 1 |
| `ops/company-restore.sh` | the store's pages and copy | refuses: ridge and the demo copies alone, its own plan's case 16 | the same |
| `ops/keys.sh` | the front door and keys | works: replacing a key is its point; the seconds of refused calls are that plan's own question | the same |
| `copy-company`, `rekey` in `scripts/src/ridge.ts` | the store's pages; the keys | none of their own: reached only through the two scripts above | — |
| the box flags (`--more-boxes`, `--box`) | the pooled shape | no new script; the answers above hold; item 246's routing stays that lane's | — |
| the Slack alarm's two | the watch | one-offs outside git; they call `ops/stack.sh`, which holds the rule | — |
| the activity log, each company's address, production | plans being written | any new script calls one helper; production owns how its lane uses `release.sh`, `app.sh` and `check.sh` | each author |

**Files in common:** `ops/lib.sh`, `ops/check.sh`, `ops/drill.sh`, `ops/test.sh` and `ops/README.md`
with the continuous copy. Those plus `ops/stack.sh`, `ops/release.sh`, `ops/app.sh` and
`ops/tunnel.sh` with the pooled shape. `ops/lib.sh`, `ops/check.sh`, `ops/app.sh`, `ops/stack.sh`
and `ops/test.sh` with the keys. `ops/lib.sh`, `ops/stack.sh` and `ops/test.sh` with the Slack
alarm. Here each script changes in one line of its first step, plus the appended helpers, check.sh's
two branches and an appended test section. This lane waits on nothing, so it lands first if it can.
The second to land takes `pre-merge` in and builds on the first one's lines.

## The cases

| # | One behaviour, one sentence | Held by |
| --- | --- | --- |
| 1 | Every ops script that calls `main_synced` calls exactly one of `refuse_real` and `real_ok`, after `log_start` and before `main_synced` | `ops/test.sh`, over the glob |
| 2 | The list of invented environments has one home and names ridge alone | `ops/test.sh` |
| 3 | The drill on an unlisted environment refuses before any AWS or box call, naming why | `ops/test.sh`, a whole run |
| 4 | The tunnel, the seed and the root password still refuse another environment in their own words | `ops/test.sh`'s existing cases |
| 5 | A script that works prints its reason on an unlisted environment and nothing new on ridge | `ops/test.sh`, a whole run |
| 6 | On an unlisted environment the two test switches are refused unless the tests' marker is set | `ops/test.sh` |
| 7 | The check on an unlisted environment reads no key off the box, writes no Bruno file and runs no collection, and needs no Bruno | `ops/test.sh`, a whole run on stand-ins |
| 8 | The check on an unlisted environment makes no client and sweeps none, and still runs the six reads that need no client | `ops/test.sh`, the stand-in edge |
| 9 | `--reads-only` on ridge gives the run of case 7 and 8; without it ridge's check is today's | `ops/test.sh` |
| 10 | The deploy job's check on ridge passes no flag | `ops/test.sh`'s deploy guards |

## The steps

The gate for `ops/` is `shellcheck -x ops/*.sh walk/*.sh services/c-storage/scripts/*.sh` and
`bash ops/test.sh`, each by its own exit code. A step that touches a `.md` file adds the citation
test, `pnpm --filter @credo/scripts exec vitest run src/citations.test.ts`. Each case is seen red
once on its own assertion, then put back. Sizes come from the runs log's last rows of the same
shape.

- [x] **1. The helpers and the nine.** The list and the two helpers in `ops/lib.sh`. One call in
  each script's first step: `refuse_real` in the drill and in the three that refuse, with their
  words kept; `real_ok` with its reason in the other five. The section in `ops/test.sh` for cases
  1 to 6. Any of the other lanes' scripts already on `pre-merge` get their line here too.
  *Done when:* both gates exit 0, and cases 1 to 6 are each red once, the static one by a call
  removed from one script and then a second call added. 👤 Point 1 follows from here.
  *Done:* the list and both helpers are in `ops/lib.sh`, one call in each of the nine scripts, the section
  at the end of `ops/test.sh`. Shellcheck and `bash ops/test.sh` each exit 0. Cases 1, 2, 4 and 6 were each
  red once on a mutation (a call removed, then a second added; a second home for the list; a changed
  word; the switch check removed), 3 and 5 on a no-op helper, and put back. None of the other lanes'
  scripts was on `pre-merge`, so none got a line. The check's reason reads true of today's check.
  *Size:* 14 (the tree guard's build, a `lib.sh` check all the scripts share, with its rows: 14).
- [x] **2. The check that only reads.** The mode set from `REAL` or `--reads-only`, and line 2's
  usage. Steps 4 and 7 branch on the mode. The Bruno version check moves under step 4. `edge_reads`
  splits in two. Cases 7 to 10, case 7 as a whole run on the stand-ins `ops/tunnel.sh`'s section
  already holds. *Done when:* both gates exit 0, each case red once. 👤 Point 2 follows from here.
  *Size:* 12 (the stranded check clients' change inside check.sh's tunnel, 7, plus about 5 for the
  first whole run of check.sh past its first step).
  *Done:* `ops/check.sh <env> [--reads-only]` takes its mode from `REAL` (set by `real_ok` on an unlisted
  environment) or the flag, and its reason now says it only reads there. In that mode it skips the
  Bruno tools and version check, the box's keys and bff.env, the Bruno file, the collection, the sweep
  and the check's client; it keeps the AWS reads, the box's facts, `/health`, layer four's reads and
  the commit agreement. `edge_reads` is split in `edge_reads_open` (the six reads that need no client)
  and `edge_reads_client`; ridge's full check runs both, as before, the client reads first. Shellcheck
  and `bash ops/test.sh` each exit 0. The new section runs `check.sh` whole on stand-ins (aws, ssh,
  bru, node, the edge): an unlisted environment and `ridge --reads-only` end green with no key read,
  no `bru` call, no client call and the six reads green; plain ridge still reads the keys, runs the
  collection and makes, sweeps and deletes a client; an unknown flag prints the usage, exit 2. Case 10
  is a new deploy guard: the deploy's check line must be exactly `bash ops/check.sh ridge`. Each case was
  red once on a mutation, put back: the real-environment mode removed (cases 7, 8 and the six-reads
  rows), the flag ignored (case 9), the open reads dropped from the reads-only branch (case 8's six
  reads, case 9), the flag put in `ci.yml`'s deploy line (case 10). The one stand-in not built: ridge's
  full run is not green on the stand-in edge (the client it makes is not the edge's), so its rows count
  calls, not the verdict.
  *Size:* 19 (about 12 planned: the stand-ins' first whole run past the first step cost three reds
  of the stand-in's own, an edge port, a missing port in the box's facts, and a `$*` pattern).
- [x] **3. The runbook and the prose it makes false.** `ops/README.md` gains "On production", the
  list above as each script's line. Its table gains `--reads-only`. `ops/CLAUDE.md` gains OP9 (the
  stance call and its test) and its count. In `docs/client-readiness.md`, the sections on the tree
  guard (item 130's fix had not reached it), "deployable, not operable" and the list's items 2 and
  3 are rewritten to what is true. Open item 131 closes; 132 keeps only its root password half;
  143 and 55 keep only their ridge half. *Done when:* the citation test exits 0 and
  `git grep -nE '/Users/|~/'` finds nothing new. 👤 Point 3 follows from here. *Size:* 5 (the
  lighter check's rules written into four documents with four items, 5).
  *Done:* `ops/README.md` has "On production", one line a script read from the code on disk (four
  work as they are, the check only reads, four refuse, each with its reason), the check's row and
  section take `--reads-only`, and `ops/CLAUDE.md` has OP9. In `docs/client-readiness.md` the tree
  guard section, "deployable, not operable" (now "operable, with its limits") and list items 2 and
  3 say what is true. Item 131 is deleted; 132 keeps the root password alone; 143 and 55 keep their
  ridge half. The citation test passes (32 cases) and the added lines name no machine path.
  *Size:* 5 planned, 4 taken.

- [ ] **4. Reviewed, fixed, recapped.** A model other than the author's reads the code, the tests
  and this table (QA's rule 5). One fix pass, each finding tagged in the recap. *Done when:* the fix
  pass's gates exit 0 and the recap is committed. *Size:* 7, 6 and 3 (the stranded check clients'
  review 7 and fix 6; a recap 3). Then the landing on `pre-merge`.
- [ ] **5. Ridge, stage 4.** 👤 With the landing in `main`, your push. Its deploy runs the full
  check on ridge, unchanged. Then, in your terminal:

  ```
  bash ops/check.sh ridge --reads-only
  ```

  You will see `== green`, with the collection and the test company each marked skipped.
  *Done when:* the machine reads the log whole and finds the six reads green, no `RED`, and
  `ok   no key in this log`. *Size:* 2 (a log read, 1 to 2).

**In all:** about 49 machine minutes, one landing, five steps.

## The four stages

1. The cheap build is step 1: the nine scripts' answers on stand-ins.
2. Each step's two gates are stage 2.
3. You read the list in `ops/README.md` (point 3), and the drill and the check (points 1 and 2).
4. Ridge runs the check that only reads (step 5). Production does not exist yet. Its first deploy
   is the production lane's own proof of the same mode.

## Your points

All three are answered on one page, the runbook's "On production" (step 3).

1. **The crash drill refuses production for good** (step 1). On ridge it kills the store and
   reboots the box, about four minutes down. On production it stops before acting, even before the
   first company: ridge's drill proves the same template and unit. I recommend yes. A no lets it
   run on a production box until its first company, and step 1 reads the company list first.
2. **Production's check only reads** (step 2). After each production deploy it reads what it reads
   today, but copies no key off the box, makes no test company in your operators' list and runs no
   test collection. A save is proved on ridge, same commit, first. I recommend yes. A no puts a test
   company in production's list for about two minutes each deploy.
3. **The list reads true** (step 3). One line a script: four work as they are, the check only
   reads, four refuse, each with its reason. A yes closes the milestone once ridge's run reads
   green. A no names the script, and its line reopens step 1 or 2.

## What stays out

- A terminal path to a client's root password: a missing tool, open item 132, still parked.
- The install against the lock (item 142): the machine's install, not the environment.
- By hand, `ops/release.sh` and `ops/app.sh` can ship any commit of `main` to production, one
  ridge never ran included. The production lane decides how a commit reaches production. Item 296,
  filed with this plan, that lane's.
- `ops/stack.sh` rewrites the GitHub environment on every run with a body that names no reviewers
  (`ops/stack.sh#L294-L296`). Whether production's protection rules survive that has not been read.
  Item 297, filed with this plan, the production lane's, if its act rests on those rules.
