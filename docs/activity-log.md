# The activity log: built in the back end, shipped to the box by the release, not yet run on ridge

> **Written** 2026-11-09 as the decisions, **rewritten** 2026-11-10 once the back end wrote its
> entries ([the plan](plans/2026-11-10-audit-bff.md)), and **amended** 2026-11-13 once the release, the
> deploy and the check carried it to the box ([the plan](plans/2026-11-12-activity-log.md)). What is built is
> said as built and cited by name; what is still only decided (the history screen, a mitigation) is said as
> decided, and what has not yet run on ridge is said as not read.
>
> **This page is one of the citation check's living documents** (`scripts/src/citations.ts`'s
> `LIVING`), so every name it cites is greped in the file that is named and the gate reds when one
> stops resolving.

**What exists.** `services/audit-backbone/` holds a finished Go service: 22 Go files, nine internal
packages and `cmd/server`, its own SQLite file, its own gate, five rules `AB1` to `AB5`. **The back end
calls it:** every route that changes a client's data declares its entry in `bff/src/audit.ts`'s
`declare`, and one hook in `buildApp` (`bff/src/app.ts`) sends the entry to the service's keyed
write before the reply. The local copy starts the service beside c-storage (`scripts/src/stack.ts`'s
`startStack`). **On the box it is shipped, and has not yet run there:** `ops/release.sh` installs it as its own unit,
`ops/audit-backbone.service`, beside c-storage's, and the CI workflow gates it in its own `audit` job.
No release has carried it to ridge yet, so nothing on ridge is read. Its single write path is `Writer.Do` in `services/audit-backbone/internal/batch/writer.go` and its
store is `Store` in `services/audit-backbone/internal/activity/store.go`. What was changed on the way in
and what was left behind is its recap, [`recaps/2026-11-09-audit-backbone-move.md`](recaps/2026-11-09-audit-backbone-move.md).

**What a person can see of it today.** One command, `pnpm local activity`, prints the entries of one
record in the local copy, read through the service's token-gated read path ([the quick-start](quick-start.md)
says how to run it). No screen shows entries yet; the history screen and its undo are the next piece.

**How long entries are kept.** The service holds 180 days from the act (`RetentionDays` in
`services/audit-backbone/internal/activity/model.go`), and the human decided that stands. A deleted
client's entries are not swept with its records: they live in the service's own file and outlast the
deletion until their 180 days end.

**Its store, which is the second one in the repository and the only one the continuous copy does not yet take.**
`audit-backbone` opens its own SQLite file at its own `DB_PATH`, with its own schema and its own
single writer: `Store` in `services/audit-backbone/internal/activity/store.go`, every write funnelled through
`Writer.Do` in `services/audit-backbone/internal/batch/writer.go`, which blocks until the commit
(`services/audit-backbone/CLAUDE.md`'s `AB3`). On the box it is a second file, in the unit's own state folder, with no copy of it yet, so
[`architecture.md`](architecture.md)'s one sentence about storage holds for it: **one SQLite file, and it is
the only copy.** In the local copy the file is the second one, in the copy's own data folder, and its
removal takes it.

**Its gate, which is its own and reaches no further.** `make check`, run from inside the package
(`services/audit-backbone/CLAUDE.md`'s `Gate: make check`), cross-compiling for the box's `arm64` so a
dependency quietly needing cgo fails here rather than at ship time
([`services/audit-backbone/Makefile`](../services/audit-backbone/Makefile)), and holding 100 % of statements outside
`cmd/server` (`services/audit-backbone/CLAUDE.md`'s `AB1`). **`pnpm check` reaches none of it:** the package
has no `package.json`, and the root's two ignore lists name it so the root formatter and the
unused-code step do not claim files a Go gate owns ([`.prettierignore`](../.prettierignore),
[`knip.json`](../knip.json)). Those two lines are all the root knows about it, and nothing makes a
newcomer add them for the next such package: that is [open item 200](open-items.md).

**How it ships.** A release sends the binary to the box with its checksum and refuses one that arrives
differently (`ops/release.sh`), makes the write key once in a file only root reads
(`/etc/audit-backbone/keys.env`) and never rewrites it, and installs the unit, which runs as a user of its
own, its folder closed to others, its writing port bound to the box's private address and its reading port
to loopback (`ops/audit-backbone.service`). The log's half runs after c-storage's, and a failure in it says
that c-storage is released and runs. The deploy job builds the binary from the commit it runs on and names
it to the release (`RELEASE_AUDIT_BINARY`), and waits on the `audit` job
(`.github/workflows/ci.yml`). `ops/app.sh` reads the key on the box and puts `AUDIT_URL` and `AUDIT_KEY`
in the function's settings; the box's security group admits the log's writing port from the back end's
group alone (`ops/env.yml`'s `BoxFromBffActivity`). `ops/check.sh` reads the unit, both listeners, the key
file and the commit the log names, adds one customer through the app's address and finds that entry on the
box by its record, with no key in it, and prints each program's memory beside the box's free memory.
**Not yet read on ridge:** a release that names the commit on both `/health` reads, the customer's entry
found by the check, and the memory figures: the human's push, and the check after it, are what read them.
Until a stack run and a release have happened there, the function reads `AUDIT_URL` and `AUDIT_KEY` as
optional, together or not at all (`bff/src/env.ts`), and each change is saved and writes the request-log
line a lost entry writes. Its file is not yet copied: the continuous copy of the records takes it in a later
step of the plan.

### The path, as built

```mermaid
flowchart LR
  req["a request"]
  ctl["the handler<br/>declares what it is about to do"]
  work["the work<br/>permission, read, write — or a refusal"]
  mw["the middleware<br/>records intent + outcome"]
  res["the response"]
  ab["audit-backbone<br/>on the box: writes on its private address, reads on loopback"]
  req --> ctl --> work --> mw --> res
  mw -. "the entry, before the response<br/>600 ms, fail open" .-> ab
  classDef intended stroke-dasharray: 6 4
  class ab intended
```

**Drawn from the code and the decisions in this section.** The first sketch of it was
`request → controller → audit-backbone-logger-middleware → response`, with the handler handing its
intent on *after* doing the work. **The decision to log attempts as well as successes is what moves
the declaration in front of the work:** a handler that threw never reaches the line that would have
handed anything over, so a refused or failed change could not be logged at all. The shape above is
that decision carried through, not a correction of it.

**One hook ships the entry; the handler decides what is in it.** A handler that declares
nothing is never logged, which is this design's strongest property — see the hot paths below. The hook
is the `onSend` hook in `buildApp` (`bff/src/app.ts`), and it also logs an error when a route that
carries an action answers below 400 having declared nothing, so a handler that forgets `declare` is
found by its own test.

### The two prerequisites, and how they were met

1. **The actor is not on the request** ([who may do what](architecture-detail.md#who-may-do-what)): of 39 deliberate write
   sites, 11 have the identity in scope and 28 do not, and the customer and product writes carry no
   actor at all. A middleware built before that would record 28 of 39 deliberate acts as having been
   done by nobody. **So the actor came first and the hook second:** each declaring route now names
   its actor, `employee.<id>`, `root` or `operator.<id>`, and the customer and product writes carry one.
2. **Fifteen write sites must never be logged**, and this design excludes them by construction
   rather than by a list. The hottest is `spendTouch` in `bff/src/routes/operator-auth.ts`, which rewrites
   an operator's whole account — a passkey counter, a `lastUsedAt` stamp and the pruning of the
   spent-challenge list at once — on **every** passkey sign-in and every confirm touch. Next is the
   session renewal inside `resolve` in `bff/src/calling/sessions.ts`, a side effect of *reading* a session on
   the authenticated path of every request. Then the two numbering counters, the sign-in and link
   bookkeeping, the client-deletion sweep, and the two photo writes whose base64 bytes must never
   enter an entry. **A handler that declares no intent is never logged, so none of the fifteen needs
   an exemption.**

**A mutating route that declares no audit intent is a test failure, and it is one now:**
`bff/tests/route-list.test.ts` reads Fastify's own route list and pins 30 routes that declare and 15 that
name their exemption, 45 in all. A route therefore either names what it logs or declares itself exempt
on the record. *Why:* a check that passes by staying silent is
exactly what this repository spent 2026-11-09 removing. *Price:* one line on every new mutating
route, and a named reason on every exemption.

### Where it runs: the box, beside c-storage; its fit unmeasured

The box is a `t4g.nano` (`ops/env.yml`'s `Default: t4g.nano`, and `ops/stack.sh`'s
`offers t4g.nano` refuses a region with no zone that offers one). AWS's published spec for that type
is 512 MB of memory — **AWS's number, not a measurement of ours** — and this project's own build adds
2 GiB of swap, which a release holds a floor under (`ops/lib.sh`'s `FLOOR_SWAP_MB`) and whose comment
there says a `t4g.nano` needs it.

**Whether a second Go service, with a second SQLite file and a second WAL, fits beside `c-storage` is
unmeasured in this project's own records.** `docs/open-items.md`'s `The nano is read on the first box`
has been parked since 2026-10-27 on exactly that reading — its memory and any OOM kill — and the
measurement needs the environment running, which is the human's hand.

**So the plan put it on the same box and left the other door open: the hook points at a URL (`AUDIT_URL`).** A
box of its own is then a configuration value and a deploy, not a rewrite. The check prints each program's
memory beside the box's free memory and stays red on any out-of-memory kill; its first reading on ridge
is not yet taken, and [open item 2](open-items.md) is what the figure settles.

**In the pooled shape, intended and not built**
([how a call finds its tenant's box](architecture-detail.md#how-a-call-finds-its-tenants-box)), the
audit store is routed by the same tenant record as storage, one store a group of tenants, so the
question above becomes whether it fits beside `c-storage` on a group's box. A store has one write
key (`services/audit-backbone/internal/config/config.go`'s `Load` reads `ACTIVITY_WRITE_KEY`), so a
group's key writes as any tenant of the group.

### What is guaranteed, and what cannot be

**A failed audit write must not fail the user's request.** That is decided, and it bounds everything
else, because the back end is a Lambda: `createLambdaHandler` in `bff/src/lambda.ts` is the entry API
Gateway calls, and a release ships that one function (`ops/lib.sh`'s `lambda_wait`). **A Lambda's
execution environment freezes once the response is returned**, so an in-process queue that ships the
entry afterwards has nowhere to live and no guarantee of ever running. *Never fails the request* and
*never loses an entry* therefore cannot both be had in-process, and the first was chosen.

**Decided, and built: the entry is written before the response, under a 600 ms timeout
(`AUDIT_TIMEOUT_MS` in `shared/src/activity.ts`), and a failure to write it is swallowed.** The mechanism
is the one already in this repository, copied: the storage client passes an abort signal to its fetch
(`shared/src/c-storage.ts`'s `signal: AbortSignal.timeout(timeoutMs)`) under a declared bound
(`shared/src/c-storage.ts`'s `DEFAULT_TIMEOUT_MS`, 5,000 ms). The audit call is that same mechanism
with a tighter bound, and the tightness is deliberate: **a write nobody is waiting on gets a fraction
of the budget of a read the answer depends on.**

**Why 600 ms.** A comparable key-value store's observed latency profile is a sub-millisecond median
with a long tail: a p99 near 110 ms and a worst observed call near 545 ms. A bound of 600 ms sits
above that worst case, which is the property that matters — a timeout then means the service is
*unavailable* rather than merely slow, and no entry is discarded during ordinary operation. A round
500 ms would have cut off the worst call in that profile.

**The one implementation note: a `try`/`catch` alone is not enough.** Without the abort signal the catch does not fire at 600 ms; it waits for the socket's own
default, which can be far longer. **The timeout is what makes the `try`/`catch` honest.** And the
bound is a named `UPPER_SNAKE` constant declared once beside its client, never a number typed where
it is used — one decision, one home (`docs/conventions/code.md`'s `One decision, one home`) — which
is why the storage bounds already sit together (`shared/CLAUDE.md`'s `SH2`).

**What it costs when the audit service is slow or down, and the two states of knowledge here are not
the same.** Lambda is billed by duration, so a deliberate change then pays **up to 600 ms more**, in
latency and in billed time. **What that is a multiple of is unknown:** this project's own per-call
duration has never been measured, and the figure the plan costs on — about 100 ms of Lambda a call —
is a planning assumption whose own item opens by saying so
(`docs/open-items.md`'s `The plan's assumptions are unmeasured`, [open item 2](open-items.md), parked
2026-10-27). So the timeout has a measured basis and its cost does not, and this page keeps the two
apart rather than blurring them into one confident paragraph. *The mitigation, and it is not built:*
a Lambda keeps module-level state while its container is warm, so one "last failure" timestamp would
let the middleware stop trying for a while after a run of failures. **Build it only if the service is
ever actually seen to be down** — this project builds when something needs it, and either way the
failures are visible in the request log.

**Where a lost entry shows up, which the guarantee must not gloss.** If the audit service cannot be
reached, that failure cannot be recorded *in* the audit log; it goes to the back end's own request
log, the one the function has written a line per request to all along. So **the guarantee, in one
sentence: an entry is attempted before the response, a failure to write it is recorded in the request
log, and the user's request succeeds either way** (the human's decision, 2026-11-10: a change is never refused when its entry fails) — and a lost entry is then findable only by someone
reading that log. Not "nothing is lost".

### The alternative that was not taken

**Writing the entries as records through `c-storage`, which the BFF already calls on every request.**
No second service, no second port, no second database file, no new secret and no second network hop:
the entries would be records under the tenant's own prefix, two keys each, because c-storage lists
one literal prefix and holds no secondary index. **An earlier costing of this very question
recommended it**, on the reasoning that the nano's headroom is unmeasured and that the separate
service's one real gain — its own write lock, so that audit writes do not queue behind the app's own
data — is far from being needed at this project's write rate. Its price: every entry written twice,
and every activity write behind the single SQLite write lock the app's data already queues on.
**The human chose the separate service, and that decision stands;** the alternative is recorded here
so that nobody re-derives it from scratch in six weeks. That costing is not in this repository — see
[what `architecture-detail.md` did not read](architecture-detail.md#what-this-page-did-not-read).

## What this page did not read

- **The service's 22 Go files were not read.** Everything here about its behaviour comes from its own
  guideline, `services/audit-backbone/CLAUDE.md`, read whole, its `Makefile` whole,
  `services/audit-backbone/internal/config/config.go`, and the declarations of `Writer.Do` and `Store` and
  nothing else of their files.
- **The counts are relayed, not re-derived** — the 39 deliberate write sites, the 11 with the actor
  in scope and the 28 without, and the 15 that must never be logged come from an earlier costing of
  this question that is **not in this repository**. The one negative re-checked directly is
  `request.user`: zero hits in `bff/src/`, against a control that hits. **The latency profile behind
  the 600 ms bound is likewise an observation from elsewhere, not a measurement of this project.**
- **The memory figure for a `t4g.nano` is AWS's published spec, not a measurement**, and no reading
  of the box's own memory exists anywhere in this repository ([open item 2](open-items.md)).
- **The costing this page's last section argues against is not in this repository either.** It is
  recorded here from the decision it lost, not from the document.
- **Nothing live was checked**, and nothing was run for this page.
